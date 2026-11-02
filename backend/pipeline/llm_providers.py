"""Pluggable LLM providers for AutoVid (gcentrix pattern, drop-in for Groq).

Every provider exposes the SAME interface as ``groq.Groq``::

    client.chat.completions.create(
        model=..., messages=[...], temperature=..., max_tokens=...,
        response_format={"type": "json_object"},
    ) -> response with response.choices[0].message.content

So existing pipeline call sites keep working unchanged - only the client
construction + model name are abstracted. Active provider is resolved from
the ``llm_config`` app setting (editable at runtime in the dashboard), with
env-var fallbacks per provider.

Provider notes:
  - groq / deepseek / gpt: OpenAI-compatible Chat Completions (native JSON mode).
  - claude: Anthropic Messages API (text; JSON requested via system prompt).
  - gemini: Google generateContent API (text; JSON via response_mime_type).
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import httpx

import config as _config

OPENAI_COMPAT_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "gpt": "https://api.openai.com/v1",
}

DEFAULT_MODELS = {
    "groq": _config.GROQ_MODEL,
    "deepseek": "deepseek-chat",
    "gpt": "gpt-4o-mini",
    "claude": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.0-flash",
}

PROVIDERS = ("groq", "deepseek", "gpt", "claude", "gemini")

_TIMEOUT = 120.0  # script generations are long


def _make_message(role: str, content: str) -> SimpleNamespace:
    return SimpleNamespace(role=role, content=content)


def _make_response(content: str) -> SimpleNamespace:
    message = _make_message("assistant", content)
    choice = SimpleNamespace(index=0, message=message, finish_reason="stop")
    return SimpleNamespace(choices=[choice])


class _Completions:
    def __init__(self, send):
        self._send = send

    def create(self, **kwargs: Any) -> SimpleNamespace:
        return self._send(**kwargs)


class LLMProvider:
    """OpenAI-shaped client: provider.chat.completions.create(...)"""

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.chat = SimpleNamespace(completions=_Completions(self._create))

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        raise NotImplementedError()


class _OpenAICompatProvider(LLMProvider):
    """groq / deepseek / gpt - native OpenAI Chat Completions shape."""

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        payload: dict[str, Any] = {
            "model": kwargs.get("model") or self.model,
            "messages": kwargs["messages"],
        }
        if kwargs.get("temperature") is not None:
            payload["temperature"] = kwargs["temperature"]
        if kwargs.get("max_tokens") is not None:
            payload["max_tokens"] = kwargs["max_tokens"]
        if kwargs.get("response_format"):
            payload["response_format"] = kwargs["response_format"]

        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        content = data["choices"][0]["message"]["content"] or ""
        return _make_response(content)


class ClaudeProvider(LLMProvider):
    """Anthropic Messages API -> OpenAI-shaped response."""

    def __init__(self, api_key: str, model: str) -> None:
        super().__init__(api_key, model, "https://api.anthropic.com/v1")

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        system = "\n\n".join(
            m["content"] for m in kwargs["messages"] if m["role"] == "system"
        )
        turns = [
            {"role": m["role"], "content": m["content"]}
            for m in kwargs["messages"]
            if m["role"] in ("user", "assistant")
        ]
        rf = kwargs.get("response_format") or {}
        if rf.get("type") == "json_object":
            system = (system + "\n\n" if system else "") + (
                "Respond with a single valid JSON object only - no markdown fences, no prose."
            )
        payload: dict[str, Any] = {
            "model": kwargs.get("model") or self.model,
            "max_tokens": kwargs.get("max_tokens") or 1024,
            "messages": turns,
        }
        if system:
            payload["system"] = system
        if kwargs.get("temperature") is not None:
            payload["temperature"] = kwargs["temperature"]

        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        content = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
        return _make_response(content)


class GeminiProvider(LLMProvider):
    """Google generateContent API -> OpenAI-shaped response."""

    def __init__(self, api_key: str, model: str) -> None:
        super().__init__(api_key, model, "https://generativelanguage.googleapis.com/v1beta")

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        model = kwargs.get("model") or self.model
        system = "\n\n".join(
            m["content"] for m in kwargs["messages"] if m["role"] == "system"
        )
        contents = [
            {
                "role": "user" if m["role"] == "user" else "model",
                "parts": [{"text": m["content"]}],
            }
            for m in kwargs["messages"]
            if m["role"] in ("user", "assistant")
        ]
        payload: dict[str, Any] = {"contents": contents}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        generation_config: dict[str, Any] = {}
        if kwargs.get("temperature") is not None:
            generation_config["temperature"] = kwargs["temperature"]
        if kwargs.get("max_tokens") is not None:
            generation_config["maxOutputTokens"] = kwargs["max_tokens"]
        rf = kwargs.get("response_format") or {}
        if rf.get("type") == "json_object":
            generation_config["responseMimeType"] = "application/json"
        if generation_config:
            payload["generationConfig"] = generation_config

        url = f"{self.base_url}/models/{model}:generateContent?key={self.api_key}"
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return _make_response(content)


def env_key_for(provider: str) -> str:
    return {
        "groq": _config.GROQ_API_KEY,
        "deepseek": getattr(_config, "DEEPSEEK_API_KEY", ""),
        "gpt": getattr(_config, "OPENAI_API_KEY", ""),
        "claude": getattr(_config, "ANTHROPIC_API_KEY", ""),
        "gemini": getattr(_config, "GEMINI_API_KEY", ""),
    }.get(provider, "")


def first_available_env_provider(preferred: str, *, skip: str | None = None) -> str | None:
    """First provider (in PROVIDERS order) with an env key, preferring `preferred`.

    `skip` excludes a provider - used when looking for a fallback other than the
    primary one, so a broken-but-keyed primary isn't chosen as its own fallback.
    """
    if skip is None and env_key_for(preferred):
        return preferred
    for candidate in PROVIDERS:
        if candidate == skip:
            continue
        if env_key_for(candidate):
            return candidate
    return None


def build_provider(provider: str, model: str | None, api_key: str | None) -> LLMProvider:
    key = api_key or env_key_for(provider)
    if not key:
        raise RuntimeError(f"No API key configured for provider '{provider}'")
    resolved_model = model or DEFAULT_MODELS.get(provider, "deepseek-chat")
    if provider in OPENAI_COMPAT_BASE_URLS:
        return _OpenAICompatProvider(key, resolved_model, OPENAI_COMPAT_BASE_URLS[provider])
    if provider == "claude":
        return ClaudeProvider(key, resolved_model)
    if provider == "gemini":
        return GeminiProvider(key, resolved_model)
    raise RuntimeError(f"Unknown LLM provider: {provider}")
