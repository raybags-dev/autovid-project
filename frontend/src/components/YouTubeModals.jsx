import { useState } from "react";
import {
  createShortFromVideo,
  generateShortFromScratch,
  updateYouTubeSettings,
  uploadVideoWithMeta,
} from "../api/client";

const CATEGORIES = [
  "Entertainment",
  "Comedy",
  "Education",
  "Technology",
  "Science",
  "Gaming",
  "Music",
  "Lifestyle",
  "Travel",
  "Food",
  "Sports",
  "News",
];

const PRIVACY_OPTIONS = [
  { value: "public", label: "🌍 Public", desc: "Anyone can watch" },
  {
    value: "unlisted",
    label: "🔗 Unlisted",
    desc: "Only people with the link",
  },
  { value: "private", label: "🔒 Private", desc: "Only you" },
];

// ── Upload Modal (before upload) ──────────────────────────────────────────────
export function UploadModal({ video, onClose, onSuccess, theme }) {
  const [form, setForm] = useState({
    title: video?.title || "",
    description: video?.description || "",
    tags: (video?.labels || []).join(", "),
    privacy: "public",
    category: video?.category || "Entertainment",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const h = theme || defaultTheme;

  const handleUpload = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await uploadVideoWithMeta(video.id, { ...form, tags });
      onSuccess?.("Upload started — video will appear on YouTube shortly.");
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Upload to YouTube" onClose={onClose} h={h}>
      <FormField label="Title" required>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          maxLength={100}
          placeholder="Video title (max 100 chars)"
          style={inputStyle(h)}
        />
        <CharCount current={form.title.length} max={100} />
      </FormField>

      <FormField label="Description">
        <textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          maxLength={5000}
          rows={4}
          placeholder="Describe your video..."
          style={{ ...inputStyle(h), resize: "vertical" }}
        />
        <CharCount current={form.description.length} max={5000} />
      </FormField>

      <FormField label="Tags" hint="Comma-separated">
        <input
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          placeholder="grief, healing, loss, love"
          style={inputStyle(h)}
        />
      </FormField>

      <FormField label="Privacy">
        <div style={{ display: "flex", gap: 8 }}>
          {PRIVACY_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setForm((f) => ({ ...f, privacy: p.value }))}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${form.privacy === p.value ? "#6366f1" : h.border}`,
                background:
                  form.privacy === p.value ? "rgba(99,102,241,0.15)" : h.card,
                color: h.text,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>
                {p.label.split(" ")[0]}
              </div>
              <div style={{ fontWeight: 600 }}>{p.label.split(" ")[1]}</div>
              <div style={{ opacity: 0.6, fontSize: 10 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Category">
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          style={inputStyle(h)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnStyle(h, false)}>
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={loading}
          style={btnStyle(h, true)}
        >
          {loading ? "Starting upload..." : "🚀 Upload to YouTube"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── YouTube Settings Modal (for already-uploaded videos) ─────────────────────
export function YouTubeSettingsModal({ video, onClose, onSuccess, theme }) {
  const [form, setForm] = useState({
    title: video?.title || "",
    description: video?.description || "",
    tags: (video?.labels || []).join(", "),
    privacy: video?.privacy || "public",
    category: video?.category || "Entertainment",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const h = theme || defaultTheme;

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateYouTubeSettings(video.id, { ...form, tags });
      onSuccess?.("YouTube settings updated.");
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="YouTube Settings" onClose={onClose} h={h}>
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 12,
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.3)",
          fontSize: 12,
          color: "#a5b4fc",
        }}
      >
        🎬 Editing:{" "}
        <a
          href={video.youtube_url}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#818cf8" }}
        >
          {video.youtube_url}
        </a>
      </div>

      <FormField label="Privacy">
        <div style={{ display: "flex", gap: 8 }}>
          {PRIVACY_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setForm((f) => ({ ...f, privacy: p.value }))}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${form.privacy === p.value ? "#6366f1" : h.border}`,
                background:
                  form.privacy === p.value ? "rgba(99,102,241,0.15)" : h.card,
                color: h.text,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>
                {p.label.split(" ")[0]}
              </div>
              <div style={{ fontWeight: 600 }}>{p.label.split(" ")[1]}</div>
              <div style={{ opacity: 0.6, fontSize: 10 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Title">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          maxLength={100}
          style={inputStyle(h)}
        />
        <CharCount current={form.title.length} max={100} />
      </FormField>

      <FormField label="Description">
        <textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          maxLength={5000}
          rows={4}
          style={{ ...inputStyle(h), resize: "vertical" }}
        />
        <CharCount current={form.description.length} max={5000} />
      </FormField>

      <FormField label="Tags" hint="Comma-separated">
        <input
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          style={inputStyle(h)}
        />
      </FormField>

      <FormField label="Category">
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          style={inputStyle(h)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnStyle(h, false)}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          style={btnStyle(h, true)}
        >
          {loading ? "Saving..." : "💾 Save Changes"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Shorts Modal ──────────────────────────────────────────────────────────────
const AMBIENCE_OPTIONS = [
  { value: "stars", label: "⭐ Star Zoom", desc: "Deep space star cluster" },
  { value: "galaxy", label: "🌌 Galaxy", desc: "Spiral galaxy rotation" },
  { value: "aurora", label: "🌠 Aurora", desc: "Northern lights ripple" },
  { value: "ocean", label: "🌊 Ocean", desc: "Deep ocean light shafts" },
  { value: "fire", label: "🔥 Embers", desc: "Floating fire sparks" },
  { value: "rain", label: "🌧 Rain", desc: "Rainy window city lights" },
  { value: "candlelight", label: "🕯 Candle", desc: "Soft flickering flame" },
];

export function ShortsModal({ video, onClose, onSuccess, theme }) {
  const [mode, setMode] = useState("clip"); // "clip" | "scratch"
  const [ambience, setAmbience] = useState("stars");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const h = theme || defaultTheme;
  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "clip" && video) {
        await createShortFromVideo(video.id);
        onSuccess?.("Short is being created and will upload to YouTube.");
      } else {
        if (!prompt.trim()) {
          setError("Prompt required");
          setLoading(false);
          return;
        }
        await generateShortFromScratch(prompt, ambience);
        onSuccess?.("Short generation started — check back in a few minutes.");
      }
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to create short");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Create YouTube Short" onClose={onClose} h={h}>
      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { v: "clip", label: "✂️ Clip from video", show: !!video },
          { v: "scratch", label: "✨ Generate new", show: true },
        ]
          .filter((m) => m.show)
          .map((m) => (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${mode === m.v ? "#6366f1" : h.border}`,
                background: mode === m.v ? "rgba(99,102,241,0.15)" : h.card,
                color: h.text,
                fontWeight: mode === m.v ? 600 : 400,
                fontSize: 13,
              }}
            >
              {m.label}
            </button>
          ))}
      </div>

      {mode === "clip" && video && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(99,102,241,0.08)",
            border: `1px solid ${h.border}`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: h.text, marginBottom: 4 }}>
            📹 <strong>{video.title}</strong>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Will clip the best 59 seconds, crop to portrait 9:16, and upload as
            a Short.
          </div>
        </div>
      )}

      {mode === "scratch" && (
        <>
          <FormField label="Prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="What should this Short be about? e.g. 'The quiet grief nobody talks about'"
              style={{ ...inputStyle(h), resize: "vertical" }}
            />
          </FormField>

          <FormField label="Ambience / Background">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {AMBIENCE_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAmbience(a.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    border: `2px solid ${ambience === a.value ? "#6366f1" : h.border}`,
                    background:
                      ambience === a.value ? "rgba(99,102,241,0.15)" : h.card,
                    color: h.text,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{a.desc}</div>
                </button>
              ))}
            </div>
          </FormField>
        </>
      )}

      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnStyle(h, false)}>
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          style={btnStyle(h, true)}
        >
          {loading ? "Starting..." : "🎬 Create Short"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, h }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(5px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: h.card,
          border: `1px solid ${h.border}`,
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          backdropFilter: "blur(5px)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: h.text }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: h.text,
              fontSize: 20,
              cursor: "pointer",
              opacity: 0.6,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          opacity: 0.7,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
        {hint && <span style={{ fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function CharCount({ current, max }) {
  const pct = current / max;
  return (
    <div
      style={{
        fontSize: 11,
        opacity: pct > 0.9 ? 1 : 0.4,
        color: pct > 0.9 ? "#f87171" : "inherit",
        textAlign: "right",
        marginTop: 2,
      }}
    >
      {current}/{max}
    </div>
  );
}

const defaultTheme = {
  bg: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
};

const inputStyle = (h) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  background: h.bg || "#0f172a",
  border: `1px solid ${h.border}`,
  color: h.text,
  outline: "none",
  boxSizing: "border-box",
});

const btnStyle = (h, primary) => ({
  flex: primary ? 2 : 1,
  padding: "11px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  background: primary ? "#6366f1" : h.border,
  color: primary ? "white" : h.text,
  opacity: 1,
});
