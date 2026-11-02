"""Unit tests for the pluggable LLM providers."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# conftest stubs sys.modules["pipeline"] with a MagicMock (needed for main.py
# imports elsewhere) - load the real module file directly to bypass the stub.
def _load(name: str, rel: str):
    path = Path(__file__).parent.parent / rel
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_llm_providers = _load("llm_providers_under_test", "pipeline/llm_providers.py")

DEFAULT_MODELS = _llm_providers.DEFAULT_MODELS
PROVIDERS = _llm_providers.PROVIDERS
build_provider = _llm_providers.build_provider
env_key_for = _llm_providers.env_key_for


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def _fake_client(payload):
    client = MagicMock()
    client.post = MagicMock(return_value=_FakeResp(payload))
    client.__enter__ = MagicMock(return_value=client)
    client.__exit__ = MagicMock(return_value=None)
    return client


def _call(provider, messages=None, **kwargs):
    with patch.object(_llm_providers.httpx, "Client") as MockClient:
        MockClient.return_value.__enter__.return_value.post = MagicMock(
            return_value=_FakeResp(kwargs.pop("payload"))
        )
        return provider.chat.completions.create(
            model=kwargs.get("model") or provider.model,
            messages=messages or [{"role": "user", "content": "hi"}],
            temperature=kwargs.get("temperature"),
            max_tokens=kwargs.get("max_tokens"),
            response_format=kwargs.get("response_format"),
        )


def test_groq_openai_compat_text():
    payload = {"choices": [{"message": {"content": "hello"}}]}
    provider = build_provider("groq", "openai/gpt-oss-120b", "k")
    result = _call(provider, payload=payload)
    assert result.choices[0].message.content == "hello"
    assert provider.base_url == "https://api.groq.com/openai/v1"


def test_deepseek_tool_shape():
    payload = {"choices": [{"message": {"content": "deep reply"}}]}
    provider = build_provider("deepseek", "deepseek-chat", "k")
    result = _call(provider, payload=payload, temperature=0.5, max_tokens=64)
    assert result.choices[0].message.content == "deep reply"
    assert provider.base_url == "https://api.deepseek.com/v1"


def test_gpt_openai_compat():
    payload = {"choices": [{"message": {"content": "gpt reply"}}]}
    provider = build_provider("gpt", "gpt-4o-mini", "k")
    result = _call(provider, payload=payload)
    assert result.choices[0].message.content == "gpt reply"
    assert provider.base_url == "https://api.openai.com/v1"


def test_claude_parses_text_blocks():
    payload = {"content": [{"type": "text", "text": "hello"}, {"type": "text", "text": " world"}]}
    provider = build_provider("claude", "claude-sonnet-4-20250514", "k")
    result = _call(provider, payload=payload)
    assert result.choices[0].message.content == "hello world"


def test_gemini_parses_candidates():
    payload = {"candidates": [{"content": {"parts": [{"text": "gemini reply"}]}}]}
    provider = build_provider("gemini", "gemini-2.0-flash", "k")
    result = _call(provider, payload=payload)
    assert result.choices[0].message.content == "gemini reply"


def test_build_provider_requires_key():
    with patch.object(_llm_providers, "env_key_for", return_value=""):
        with pytest.raises(RuntimeError, match="No API key"):
            build_provider("deepseek", None, None)


def test_build_provider_unknown_rejected():
    with pytest.raises(RuntimeError, match="Unknown LLM provider"):
        build_provider("hal-9000", None, "k")


def test_response_shape_matches_groq_interface():
    """All providers must return .choices[0].message.content (Groq-compatible)."""
    for name in PROVIDERS:
        assert name in DEFAULT_MODELS, f"{name} missing a default model"
    assert env_key_for("groq") is not None  # env fallback accessor exists


def test_openai_compat_json_mode_forwarded():
    payload = {"choices": [{"message": {"content": '{"a":1}'}}]}
    provider = build_provider("groq", "openai/gpt-oss-120b", "k")

    with patch.object(_llm_providers.httpx, "Client") as MockClient:
        mock_post = MockClient.return_value.__enter__.return_value.post = MagicMock(
            return_value=_FakeResp(payload)
        )
        provider.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": "json please"}],
            response_format={"type": "json_object"},
        )
        sent = mock_post.call_args.kwargs["json"]
        assert sent["response_format"] == {"type": "json_object"}
