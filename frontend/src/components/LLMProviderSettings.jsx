import React, { useEffect, useState } from "react";
import { getLLMSettings, saveLLMSettings, testLLMSettings } from "../api/client";

const PROVIDER_LABELS = {
  deepseek: "DeepSeek (default)",
  groq: "Groq",
  gpt: "OpenAI (GPT)",
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
};

const KEY_HINTS = {
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  gpt: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/**
 * LLM provider selector for the dashboard Settings page.
 * Lets the user switch which AI the generation pipeline uses at runtime
 * (script writing, labels, replies, visual plans, podcast essays).
 */
export default function LLMProviderSettings({ T, showToast }) {
  const [config, setConfig] = useState(null);
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getLLMSettings()
      .then((cfg) => {
        setConfig(cfg);
        setProvider(cfg.provider || "groq");
        setModel(cfg.model || "");
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const res = await saveLLMSettings({
        provider,
        model: model.trim() || null,
        api_key: apiKey.trim() || null,
      });
      const fresh = await getLLMSettings();
      setConfig(fresh);
      setApiKey("");
      setResult({ ok: true, text: `Saved - ${res.provider} is now live for new generations.` });
      showToast?.(`AI provider switched to ${res.provider}`);
    } catch {
      setResult({ ok: false, text: "Save failed - please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await testLLMSettings({
        provider,
        model: model.trim() || null,
        api_key: apiKey.trim() || null,
      });
      if (res.ok) {
        setResult({ ok: true, text: `Connection OK (${res.model}): "${res.reply}"` });
      } else {
        setResult({ ok: false, text: res.detail || "Connection failed." });
      }
    } catch {
      setResult({ ok: false, text: "Test request failed." });
    } finally {
      setTesting(false);
    }
  }

  if (!config) return null;

  const inputStyle = {
    width: "100%",
    background: T.inputBg,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    color: T.text,
    padding: "8px 10px",
    fontSize: 11,
    fontFamily: "inherit",
    outline: "none",
  };

  const labelStyle = { fontSize: 9, color: T.textFaint, display: "block", marginBottom: 3 };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
        AI PROVIDER
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#4ade8020", color: "#4ade80" }}>
          live: {config.provider}
        </span>
        {config.has_api_key && (
          <span style={{ fontSize: 9, color: T.textFaint }}>
            key: {config.api_key_preview ?? config.key_source}
          </span>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Provider</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setResult(null); }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {(config.providers || []).map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Model (blank = {config.default_models?.[provider]})</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={config.default_models?.[provider] || ""}
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>
          API key {config.has_api_key && provider === config.provider ? "(stored - type to replace)" : `(falls back to server ${KEY_HINTS[provider]})`}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="paste key here"
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: T.accent, color: "#fff", border: "none", borderRadius: 7,
            padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save & apply"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            background: "transparent", color: T.text, border: `1px solid ${T.border}`, borderRadius: 7,
            padding: "7px 14px", fontSize: 11, cursor: testing ? "default" : "pointer",
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        {result && (
          <span style={{ fontSize: 10, color: result.ok ? "#4ade80" : "#f87171" }}>
            {result.text}
          </span>
        )}
      </div>

      <div style={{ fontSize: 9, color: T.textFaint, marginTop: 8, lineHeight: 1.5 }}>
        DeepSeek is the default. If the selected provider has no key, the pipeline falls back to any
        provider with a server-side key so generation never goes dark. Applies to script writing,
        SEO labels, comment replies, visual plans and podcast essays.
      </div>
    </div>
  );
}
