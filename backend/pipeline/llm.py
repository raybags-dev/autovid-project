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
    "provider": "groq",
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


def get_llm_client() -> LLMProvider:
    """Return an OpenAI-shaped client for the active provider (drop-in for Groq).

    Falls back to the first provider with an env key when the selected one has
    none, so generation never goes dark.
    """
    global _client_cache
    cfg = get_llm_config()
    provider_name = cfg.get("provider", "groq")
    cache_key = {**cfg, "_effective": provider_name}

    if _client_cache and _client_cache[1] == cache_key:
        return _client_cache[0]

    api_key = cfg.get("api_key")
    try:
        client = build_provider(provider_name, cfg.get("model"), api_key)
        _client_cache = (client, cache_key)
        return client
    except RuntimeError:
        fallback = first_available_env_provider(provider_name)
        if not fallback:
            raise
        log.warning("LLM provider %r has no key; falling back to %r", provider_name, fallback)
        client = build_provider(fallback, None, None)
        _client_cache = (client, {**cache_key, "_effective": fallback})
        return _client_cache[0]
