"""Runtime LLM client resolution for AutoVid.

The active provider/model/key live in the ``llm_config`` app setting and are
editable at runtime from the dashboard (Settings -> AI Provider). Resolution
order per call:

  1. ``llm_config.provider`` + its stored key/model
  2. env-var key for that provider
  3. first provider that has any env key (never goes dark)

Consumers call ``get_llm_client()`` (OpenAI-shaped, drop-in for ``groq.Groq``)
and ``get_llm_model()``.
"""

from __future__ import annotations

import json
import logging
import time
from types import SimpleNamespace
from typing import Any

import config as _config
from .llm_providers import (
    DEFAULT_MODELS,
    PROVIDERS,
    LLMProvider,
    build_provider,
    first_available_env_provider,
)

log = logging.getLogger(__name__)

_CONFIG_KEY = "llm_config"
_CACHE_TTL = 60.0
_cache: tuple[dict[str, Any], float] | None = None

# Default row written on first read when nothing is configured yet.
_DEFAULT_CONFIG: dict[str, Any] = {
    "provider": "deepseek",
    "model": None,
    "api_key": None,
}


def invalidate_llm_cache() -> None:
    global _cache
    _cache = None


def get_llm_config() -> dict[str, Any]:
    """Load llm_config from app_settings (TTL-cached). Falls back to groq/env."""
    global _cache
    now = time.monotonic()
    if _cache and (now - _cache[1]) < _CACHE_TTL:
        return _cache[0]

    cfg = dict(_DEFAULT_CONFIG)
    try:
        from database import get_setting

        raw = get_setting(_CONFIG_KEY, None)
        if raw:
            stored = json.loads(raw)
            if isinstance(stored, dict):
                cfg.update({k: v for k, v in stored.items() if k in _DEFAULT_CONFIG})
    except Exception as exc:  # DB down / table missing - env fallback still works
        log.warning("llm_config read failed, using env fallback: %s", exc)

    _cache = (cfg, now)
    return cfg


def save_llm_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """Persist llm_config and invalidate the cache."""
    from database import set_setting

    clean = {
        "provider": cfg.get("provider", "groq"),
        "model": cfg.get("model") or None,
        "api_key": cfg.get("api_key") or None,
    }
    set_setting(_CONFIG_KEY, json.dumps(clean))
    invalidate_llm_cache()
    return clean


def get_llm_model() -> str:
    """Resolved model name for call sites (keeps existing signatures)."""
    cfg = get_llm_config()
    return cfg.get("model") or DEFAULT_MODELS.get(cfg.get("provider", "groq"), "")


_client_cache: tuple[LLMProvider, dict[str, Any]] | None = None


class _FallbackLLMClient:
    """OpenAI-shaped wrapper: try the selected provider, fall back on failure.

    Retryable failures (no key, 401/402/429 auth-quota issues, 5xx, network)
    cascade to the next provider that has an env key, so generation keeps
    working even when the selected provider is out of credit or down.
    Exposes the exact ``client.chat.completions.create(...)`` interface.
    """

    def __init__(self, primary: LLMProvider, fallback: LLMProvider | None) -> None:
        self._primary = primary
        self._fallback = fallback
        self.model = primary.model
        self.base_url = primary.base_url
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        if isinstance(exc, RuntimeError):
            return True
        status = getattr(exc, "response", None)
        if status is not None:
            code = getattr(status, "status_code", 0)
            return code in (401, 402, 408, 409, 425, 429, 500, 502, 503, 504)
        return True

    def _create(self, **kwargs: Any) -> Any:
        try:
            return self._primary.chat.completions.create(**kwargs)
        except Exception as exc:
            if not self._fallback or not self._is_retryable(exc):
                raise
            log.warning(
                "LLM primary %s failed (%s) - falling back to %s",
                self._primary.model,
                type(exc).__name__,
                self._fallback.model,
            )
            kwargs.pop("model", None)
            return self._fallback.chat.completions.create(
                model=self._fallback.model, **kwargs
            )


def get_llm_client() -> LLMProvider:
    """Return an OpenAI-shaped client for the active provider (drop-in for Groq).

    Falls back to the first provider with an env key when the selected one has
    none, and retries transient failures against it - generation never goes dark.
    """
    global _client_cache
    cfg = get_llm_config()
    provider_name = cfg.get("provider", "deepseek")
    cache_key = {**cfg, "_effective": provider_name}

    if _client_cache and _client_cache[1] == cache_key:
        return _client_cache[0]

    api_key = cfg.get("api_key")
    try:
        primary = build_provider(provider_name, cfg.get("model"), api_key)
    except RuntimeError:
        fallback_name = first_available_env_provider(provider_name)
        if not fallback_name:
            raise
        log.warning("LLM provider %r has no key; using %r", provider_name, fallback_name)
        client = build_provider(fallback_name, None, None)
        _client_cache = (client, {**cache_key, "_effective": fallback_name})
        return _client_cache[0]

    fallback: LLMProvider | None = None
    fallback_name = first_available_env_provider(provider_name, skip=provider_name)
    if fallback_name:
        try:
            fallback = build_provider(fallback_name, None, None)
        except RuntimeError:
            fallback = None

    if fallback:
        client = _FallbackLLMClient(primary, fallback)
        _client_cache = (client, cache_key)
        return _client_cache[0]

    _client_cache = (primary, cache_key)
    return primary
