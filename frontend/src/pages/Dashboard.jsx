import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  clearCache,
  createShortFromVideo,
  deleteComment,
  deleteFromYoutube,
  deleteVideo,
  generateShortFromScratch,
  generateVideo,
  getAutoShortSettings,
  getTikTokStatus,
  disconnectTikTok,
  uploadToTikTok,
  getSpotifyStatus,
  getSpotifyConnectUrl,
  disconnectSpotify,
  getSpotifyTopTracks,
  getSpotifyTopArtists,
  getComments,
  getQuota,
  getStats,
  getYouTubeDetails,
  listCompilations,
  listShorts,
  listVideos,
  moderateComment,
  postComment,
  replyComment,
  retryVideo,
  retryUploadVideo,
  saveAutoShortSettings,
  syncYoutube,
  triggerAutoComment,
  triggerAutoShort,
  uploadVideo,
  updateVideoMeta,
  getPodcastSettings,
  savePodcastSettings,
  triggerAutoPodcast,
  generatePodcastEpisode,
  fixStuckVideos,
  forceResetVideo,
  getBuzzsproutStatus,
  getBuzzsproutSettings,
  saveBuzzsproutSettings,
  uploadToBuzzsprout,
  getPodbeanStatus,
  getPodbeanSettings,
  savePodbeanSettings,
  uploadToPodbean,
  getSubscriptions,
  saveSubscriptions,
  getPipelineMetrics,
  archiveVideo,
  unarchiveVideo,
  listArchivedVideos,
  listStickFigures,
  listStickFiguresPaged,
  seedStickFigures,
  uploadStickFigure,
  updateStickFigure,
  deleteStickFigure,
  setVideoExclusive,
  listSubscriptionRequests,
  approveSubscription,
  rejectSubscription,
  generateThumbnail,
  deleteSubscriptionUser,
  uploadExclusivePreviewVideo,
} from "../api/client";
import CompilationStudio from "../components/CompilationStudio";
import CustomContent from "../components/CustomContent";
import ScriptStudio from "../components/ScriptStudio";
import DangerZone from "../components/DangerZone";
import VideoEditor from "../components/VideoEditor";
import StickfigureManager from "../components/StickfigureManager";
import {
  ShortsModal,
  UploadModal,
  YouTubeSettingsModal,
} from "../components/YouTubeModals";
import { useAuth } from "../context/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const AMBIENCE_OPTIONS = [
  { id: "stars",  emoji: "⭐", label: "Stars",  desc: "Deep space drift" },
  { id: "aurora", emoji: "🌌", label: "Aurora", desc: "Northern lights" },
  { id: "ocean",  emoji: "🌊", label: "Ocean",  desc: "Underwater rays" },
  { id: "fire",   emoji: "🔥", label: "Fire",   desc: "Floating embers" },
  { id: "rain",   emoji: "🌧", label: "Rain",   desc: "Night city window" },
  { id: "galaxy", emoji: "🌀", label: "Galaxy", desc: "Spiral rotation" },
];
const STEPS = [
  "Script",
  "Voice",
  "Clips",
  "Assembly",
  "Captions",
  "Labels",
  "Upload",
];
const STATUS = {
  posted: {
    label: "LIVE",
    color: "#00c070",
    bg: "rgba(0,192,112,0.08)",
    pulse: "#00c070",
  },
  ready: {
    label: "READY",
    color: "#e09000",
    bg: "rgba(224,144,0,0.08)",
    pulse: "#e09000",
  },
  failed: {
    label: "FAILED",
    color: "#e03050",
    bg: "rgba(224,48,80,0.08)",
    pulse: "#e03050",
  },
  generating: {
    label: "GENERATING",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  scripted: {
    label: "SCRIPTED",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  voiced: {
    label: "VOICED",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  assembled: {
    label: "ASSEMBLING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  captioned: {
    label: "CAPTIONING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  labeled: {
    label: "LABELING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  uploading: {
    label: "UPLOADING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
};
// Jaccard word-overlap similarity (0–1). Used for duplicate prompt detection.
const jaccardSim = (a, b) => {
  const words = s => new Set((s || "").toLowerCase().match(/\w+/g) || []);
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return 1;
  const intersection = [...A].filter(w => B.has(w)).length;
  return intersection / (new Set([...A, ...B]).size);
};

const IN_PROGRESS = [
  "generating",
  "scripted",
  "voiced",
  "assembled",
  "captioned",
  "labeled",
  "uploading",
];
const STEP_MAP = {
  generating: 1,
  scripted: 2,
  voiced: 3,
  assembled: 4,
  captioned: 5,
  labeled: 6,
  uploading: 7,
};
const fmtNum = (n) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1000
      ? (n / 1000).toFixed(1) + "K"
      : String(n || 0);
const timeAgo = (d) => {
  if (!d) return "—";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
const fmtDur = (s) =>
  s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—";

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#111214", // dark charcoal — not pure black
    bgSub: "#191a1e",
    bgDeep: "#0b0c0e",
    bgCard: "#1e2026", // neutral dark, not blue
    bgCardHover: "#252830",
    border: "#2b2d35", // clearly visible border
    borderHover: "#4a9eff",
    text: "#f0f2f5", // near-white, crisp
    textMid: "#c8cdd8", // clearly readable secondary
    textDim: "#8892a4", // visible tertiary
    textFaint: "#5a6478", // visible metadata
    inputBg: "#13151a",
    topBar: "#13151a",
    accent: "#4a9eff", // vivid blue
    accentGreen: "#3dd68c", // vivid green
    accentRed: "#ff5c6c", // vivid red
    accentYellow: "#ffb020", // vivid amber
    scrollThumb: "#2e3340",
  },
  light: {
    bg: "#f0f2f5", // neutral cool grey
    bgSub: "#e4e7ed",
    bgDeep: "#d8dce5",
    bgCard: "#ffffff",
    bgCardHover: "#f5f7fa",
    border: "#d0d5de", // clearly visible border
    borderHover: "#2563eb",
    text: "#111827", // near-black, maximum contrast
    textMid: "#374151", // dark readable secondary
    textDim: "#4b5563", // readable tertiary
    textFaint: "#6b7280", // readable metadata — NOT faint
    inputBg: "#ffffff",
    topBar: "#ffffff",
    accent: "#2563eb", // vivid blue
    accentGreen: "#059669", // vivid green
    accentRed: "#dc2626", // vivid red
    accentYellow: "#d97706", // vivid amber
    scrollThumb: "#c1c9d6",
  },
};

function InlineEdit({ value, onSave, placeholder = "", multiline = false, style = {}, T }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => { setDraft(value); }, [value]);
  React.useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  const sharedInputStyle = {
    width: "100%",
    background: T.inputBg,
    border: `1px solid ${T.accent}60`,
    borderRadius: 7,
    padding: "8px 10px",
    color: T.text,
    fontFamily: "inherit",
    fontSize: style.fontSize || 13,
    lineHeight: style.lineHeight || 1.6,
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
  };

  if (editing) {
    return (
      <div>
        {multiline ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            style={sharedInputStyle}
            onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={sharedInputStyle}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={commit} disabled={saving} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: T.accentGreen, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "✓ Save"}
          </button>
          <button onClick={cancel} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        ...style,
        cursor: "text",
        padding: multiline ? "8px 10px" : "2px 4px",
        borderRadius: 6,
        border: "1px solid transparent",
        transition: "border-color 0.15s, background 0.15s",
        wordBreak: "break-word",
        minHeight: multiline ? 40 : "auto",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.inputBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
    >
      {value || <span style={{ color: T.textFaint, fontStyle: "italic", fontWeight: 400 }}>{placeholder}</span>}
      <span style={{ marginLeft: 6, fontSize: 9, color: T.textFaint, opacity: 0.6 }}>✏</span>
    </div>
  );
}

function LegalNavDropdown({ T }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          borderRadius: 8,
          cursor: "pointer",
          color: T.textFaint,
          fontSize: 11,
          letterSpacing: "0.04em",
          transition: "background 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = T.bgCard; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ fontSize: 13 }}>⚖</span>
        <span>Legal</span>
        <span style={{ marginLeft: "auto", fontSize: 9, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 28, display: "flex", flexDirection: "column", gap: 2 }}>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "5px 12px",
              borderRadius: 6,
              color: T.textFaint,
              fontSize: 10,
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.textFaint; }}
          >
            Privacy Policy ↗
          </a>
          <a
            href="/terms-of-service"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "5px 12px",
              borderRadius: 6,
              color: T.textFaint,
              fontSize: 10,
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.textFaint; }}
          >
            Terms of Service ↗
          </a>
          <a
            href="https://4lifemystery.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "5px 12px",
              borderRadius: 6,
              color: T.textFaint,
              fontSize: 10,
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition: "color 0.15s",
              marginTop: 4,
              borderTop: `1px solid ${T.border}`,
              paddingTop: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ff6633"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.textFaint; }}
          >
            🌐 4lifemystery.com ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ── Video Editor Tab ──────────────────────────────────────────────────────────
function VideoEditorTab({ videos, initialVideo, onInitialConsumed, onNewVideo, T }) {
  const [selectedVideo, setSelectedVideo] = React.useState(initialVideo || null);
  const [search, setSearch] = React.useState("");

  // If a video was pre-selected from the detail modal, consume it once
  React.useEffect(() => {
    if (initialVideo) {
      setSelectedVideo(initialVideo);
      onInitialConsumed?.();
    }
  }, [initialVideo]);

  // Exclude shorts (portrait resolution like 1080x1920) and videos without a file
  const eligible = videos.filter(v => {
    if (!v.file_path) return false;
    if (v.resolution) {
      const [w, h] = v.resolution.split("x").map(Number);
      if (w > 0 && h > 0 && h > w) return false; // portrait = short
    }
    return true;
  });

  const filtered = eligible.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (v.title || "").toLowerCase().includes(q) ||
      (v.prompt || "").toLowerCase().includes(q)
    );
  });

  if (selectedVideo) {
    // VideoEditor uses position:fixed so it covers the full viewport including
    // the sidebar. No wrapper needed.
    return (
      <VideoEditor
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onNewVideo={onNewVideo}
        T={T}
      />
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>
          ✂ Video Editor
        </div>
        <div style={{ fontSize: 12, color: T.textDim }}>
          Select a video to open the stick-figure compositor.
        </div>
      </div>

      {eligible.length === 0 ? (
        <div style={{
          padding: 28, background: T.bgCard, borderRadius: 10,
          border: `1px solid ${T.border}`, textAlign: "center",
          color: T.textFaint, fontSize: 12,
        }}>
          No processed videos with a local file yet. Generate a video first.
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search videos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", maxWidth: 400, background: T.inputBg,
              border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "8px 12px", color: T.text, fontFamily: "inherit",
              fontSize: 12, outline: "none", marginBottom: 16, boxSizing: "border-box",
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {filtered.map(v => {
              const fname = (v.file_path || "").split("/").pop();
              const thumb = v.thumbnail_url || null;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVideo(v)}
                  style={{
                    background: T.bgCard, border: `1px solid ${T.border}`,
                    borderRadius: 10, overflow: "hidden", cursor: "pointer",
                    transition: "border-color 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = T.accent;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", position: "relative" }}>
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.textFaint, fontSize: 22 }}>
                        🎬
                      </div>
                    )}
                    <div style={{
                      position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.3)", opacity: 0,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <span style={{ color: "#fff", fontSize: 28 }}>✂</span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.title || v.prompt?.slice(0, 50) || "Untitled"}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint }}>
                      {v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, "0")}` : "—"}
                      {" · "}{v.resolution || "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


// ── Stick Figure Clip Card (Settings view — hover to preview) ─────────────────
function SettingsClipCard({ clip, onUpdated, onDeleted, T }) {
  const videoRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(clip.label || "");
  const [draftKw, setDraftKw] = useState((clip.keywords || []).join(", "));
  const [saving, setSaving] = useState(false);

  // React doesn't reliably pass `muted` to the DOM — set via ref
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = true;
  }, []);

  const enter = () => {
    setHovered(true);
    if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
  };
  const leave = () => {
    setHovered(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };

  const saveEdit = async (e) => {
    e.stopPropagation();
    setSaving(true);
    const kws = draftKw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    try {
      await updateStickFigure(clip.id, { label: draftLabel.trim(), keywords: kws });
      onUpdated({ ...clip, label: draftLabel.trim(), keywords: kws });
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggleEnabled = async (e) => {
    e.stopPropagation();
    try {
      await updateStickFigure(clip.id, { enabled: !clip.enabled });
      onUpdated({ ...clip, enabled: !clip.enabled });
    } catch { /* ignore */ }
  };

  const doDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${clip.label || clip.filename}"?`)) return;
    try {
      await deleteStickFigure(clip.id, false);
      onDeleted(clip.id);
    } catch { /* ignore */ }
  };

  const label = clip.label || clip.filename.replace(".mp4", "").replace(/_/g, " ");

  if (editing) {
    return (
      <div style={{ border: `1px solid ${T.accent}`, borderRadius: 8, padding: 10, background: T.bgCard }} onClick={e => e.stopPropagation()}>
        <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)} placeholder="Label"
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 7px", color: T.text, fontFamily: "inherit", fontSize: 11, boxSizing: "border-box", marginBottom: 5 }} />
        <input value={draftKw} onChange={e => setDraftKw(e.target.value)} placeholder="keywords, comma, separated"
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 7px", color: T.text, fontFamily: "inherit", fontSize: 11, boxSizing: "border-box", marginBottom: 6 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={saveEdit} disabled={saving} style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: T.accentGreen, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ border: `1px solid ${hovered ? T.accent : T.border}`, borderRadius: 8, overflow: "hidden", background: T.bgCard, transition: "border-color 0.15s", position: "relative", opacity: clip.enabled === false ? 0.5 : 1 }}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", position: "relative" }}>
        <video ref={videoRef} src={clip.preview_url} muted loop playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {!hovered && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <span style={{ color: "#fff", fontSize: 18 }}>▶</span>
          </div>
        )}
      </div>
      <div style={{ padding: "5px 7px 7px" }}>
        <div style={{ fontSize: 10, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 9, color: T.textDim, marginTop: 1 }}>
          {clip.duration}s · {clip.has_alpha ? "α" : "key"}
          {clip.keywords?.length > 0 && <span style={{ color: T.textFaint }}> · {clip.keywords.slice(0, 3).join(", ")}{clip.keywords.length > 3 ? "…" : ""}</span>}
        </div>
      </div>
      {hovered && (
        <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3 }} onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); setEditing(true); }}
            style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, cursor: "pointer" }}>✎</button>
          <button onClick={toggleEnabled}
            style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: clip.enabled === false ? "rgba(61,214,140,0.8)" : "rgba(255,92,108,0.8)", color: "#fff", fontSize: 10, cursor: "pointer" }}>
            {clip.enabled === false ? "On" : "Off"}
          </button>
          <button onClick={doDelete}
            style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: "rgba(180,0,0,0.75)", color: "#fff", fontSize: 10, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}


// ── Stick Figure Library Settings Panel ───────────────────────────────────────
function StickFigureSettings({ T }) {
  const [clips, setClips]           = React.useState(null); // null = not loaded yet
  const [loading, setLoading]       = React.useState(false);
  const [seeding, setSeeding]       = React.useState(false);
  const [seedResult, setSeedResult] = React.useState(null);
  const [uploading, setUploading]   = React.useState(false);
  const [uploadLabel, setUploadLabel] = React.useState("");
  const [uploadKw, setUploadKw]     = React.useState("");
  const [showUpload, setShowUpload] = React.useState(false);
  const fileRef = React.useRef(null);

  const load = () => {
    setLoading(true);
    listStickFigures(false)
      .then(d => setClips(d.clips || []))
      .catch(() => setClips([]))
      .finally(() => setLoading(false));
  };

  const handleSeed = async () => {
    setSeeding(true); setSeedResult(null);
    try {
      const r = await seedStickFigures();
      setSeedResult(r); load();
    } catch { setSeedResult({ error: "Seed failed" }); }
    setSeeding(false);
  };

  const [uploadProgress, setUploadProgress] = React.useState("");
  const [uploadLog, setUploadLog] = React.useState([]); // [{msg, ok}]

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadLog([]);
    const kws = uploadKw.split(",").map(s => s.trim()).filter(Boolean).join(",");
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`${i + 1} / ${files.length}`);
      try {
        const label = files.length === 1 ? uploadLabel : "";
        const row = await uploadStickFigure(files[i], label, kws);
        setClips(prev => [row, ...(prev || [])]);
        setUploadLog(prev => [...prev, { msg: `✓ ${files[i].name}`, ok: true }]);
        ok++;
      } catch (err) {
        setUploadLog(prev => [...prev, { msg: `✕ ${files[i].name}: ${err?.response?.data?.detail || err?.message || "failed"}`, ok: false }]);
      }
    }
    setUploadProgress("");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok === files.length) {
      setUploadLabel(""); setUploadKw("");
    }
  };

  const enabled  = (clips || []).filter(c => c.enabled !== false).length;
  const disabled = (clips || []).filter(c => c.enabled === false).length;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
        STICK FIGURE LIBRARY
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>🎭 Clip Catalogue</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
              {clips === null
                ? "Not loaded yet"
                : `${clips.length} clips total · ${enabled} enabled · ${disabled} disabled`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {clips === null && (
              <button
                onClick={load}
                disabled={loading}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: `1px solid ${T.border}`,
                  background: T.bgSub, color: T.textMid, fontSize: 11,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                }}
              >{loading ? "Loading…" : "Load"}</button>
            )}
            <button
              onClick={() => setShowUpload(v => !v)}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: showUpload ? T.accent : T.accentGreen,
                color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}
            >{showUpload ? "Cancel" : "+ Upload"}</button>
          </div>
        </div>

        {seedResult && (
          <div style={{ fontSize: 11, color: seedResult.error ? T.accentRed : T.accentGreen, marginBottom: 10 }}>
            {seedResult.error || `✓ ${seedResult.upserted} clips seeded${seedResult.skipped > 0 ? `, ${seedResult.skipped} skipped` : ""}`}
          </div>
        )}

        {/* Upload form */}
        {showUpload && (
          <div style={{ padding: 12, background: T.bgSub, borderRadius: 8, marginBottom: 12, border: `1px solid ${T.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>DISPLAY LABEL</div>
                <input
                  value={uploadLabel}
                  onChange={e => setUploadLabel(e.target.value)}
                  placeholder="e.g. Running away"
                  style={{
                    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "5px 8px", color: T.text,
                    fontFamily: "inherit", fontSize: 11, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>KEYWORDS (comma-separated)</div>
                <input
                  value={uploadKw}
                  onChange={e => setUploadKw(e.target.value)}
                  placeholder="run, danger, flee"
                  style={{
                    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "5px 8px", color: T.text,
                    fontFamily: "inherit", fontSize: 11, boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".mp4,video/mp4"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "none",
                background: T.accent, color: "#fff", fontSize: 11,
                cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit",
                opacity: uploading ? 0.6 : 1,
              }}
            >{uploading ? `Uploading ${uploadProgress}…` : "Choose .mp4 file(s)"}</button>

            {uploadLog.length > 0 && (
              <div style={{ marginTop: 8, padding: "6px 10px", background: T.bgDeep, borderRadius: 6, border: `1px solid ${T.border}`, fontFamily: "monospace", fontSize: 10, lineHeight: 1.7, maxHeight: 120, overflowY: "auto" }}>
                {uploadLog.map((l, i) => (
                  <div key={i} style={{ color: l.ok ? "#3dd68c" : "#ff5c6c" }}>{l.msg}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clip card grid */}
        {clips !== null && clips.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
            maxHeight: 480,
            overflowY: "auto",
          }}>
            {clips.map(clip => (
              <SettingsClipCard
                key={clip.id || clip.filename}
                clip={clip}
                onUpdated={updated => setClips(prev => prev.map(c => c.id === updated.id ? updated : c))}
                onDeleted={id => setClips(prev => prev.filter(c => c.id !== id))}
                T={T}
              />
            ))}
          </div>
        )}

        {clips !== null && clips.length === 0 && (
          <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", padding: "16px 0" }}>
            No clips in the DB yet — click "Seed from disk" to load the 84 built-in clips.
          </div>
        )}
      </div>
    </div>
  );
}


function ExclusiveVideoSetting({ T, showToast }) {
  const [exUrl, setExUrl] = useState("");
  const [exSaving, setExSaving] = useState(false);
  const [exUploading, setExUploading] = useState(false);
  const [exUploadProgress, setExUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/app-settings/exclusive_preview_video_url").then(r => setExUrl(r.data?.value || "")).catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExUploading(true);
    setExUploadProgress(0);
    try {
      const result = await uploadExclusivePreviewVideo(file);
      if (result.url) {
        setExUrl(result.url);
        showToast("Preview video uploaded");
      }
    } catch { showToast("Upload failed", "error"); }
    finally { setExUploading(false); setExUploadProgress(null); e.target.value = ""; }
  };

  return (
    <div style={{ marginTop: 20, padding: "14px 16px", background: T.bgCard, border: `1px solid rgba(168,85,247,0.25)`, borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: "#a855f7", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>🔐 EXCLUSIVE PREVIEW VIDEO</div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 10 }}>
        Video shown in the subscribe card on your landing page — paste a URL or upload a file
      </div>
      <input
        type="url"
        value={exUrl}
        onChange={e => setExUrl(e.target.value)}
        placeholder="https://... or /local-videos/..."
        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 11, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8, outline: "none" }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={async () => {
            setExSaving(true);
            try {
              await api.post("/admin/exclusive-preview-video", { url: exUrl });
              showToast("Preview video saved");
            } catch { showToast("Failed to save", "error"); }
            finally { setExSaving(false); }
          }}
          disabled={exSaving}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.08)", color: "#a855f7", fontSize: 10, cursor: "pointer", fontFamily: "inherit", opacity: exSaving ? 0.6 : 1 }}
        >
          {exSaving ? "Saving..." : "SAVE URL"}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={exUploading}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.08)", color: "#a855f7", fontSize: 10, cursor: "pointer", fontFamily: "inherit", opacity: exUploading ? 0.6 : 1 }}
        >
          {exUploading ? "Uploading..." : "⬆ UPLOAD FILE"}
        </button>
        <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: "none" }} onChange={handleUpload} />
      </div>
      {exUrl && (
        <div style={{ marginTop: 10, fontSize: 9, color: T.textFaint }}>
          Current: <span style={{ color: T.textDim }}>{exUrl.length > 60 ? exUrl.slice(0, 60) + "…" : exUrl}</span>
        </div>
      )}
    </div>
  );
}


const PAGE_SIZE = 20;

function SubscribersTabContent({ T, showToast }) {
  const [subRequests, setSubRequests] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const listContainerRef = useRef(null);
  const [subConfirm, setSubConfirm] = useState(null); // {message, onConfirm, label}

  const askSubConfirm = (message, onConfirm, label = "CONFIRM") =>
    setSubConfirm({ message, onConfirm, label });

  const loadRequests = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await listSubscriptionRequests();
      setSubRequests(data);
    } catch {
      showToast("Failed to load subscription requests", "error");
    } finally {
      setSubLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = async (id) => {
    try { await approveSubscription(id); showToast("Approved"); loadRequests(); }
    catch { showToast("Failed to approve", "error"); }
  };
  const handleReject = async (id) => {
    try { await rejectSubscription(id); showToast("Rejected"); loadRequests(); }
    catch { showToast("Failed to reject", "error"); }
  };
  const handleUnsubscribe = (id, email) => {
    askSubConfirm(`Revoke library access for ${email}?`, async () => {
      try { await rejectSubscription(id); showToast("Access revoked"); loadRequests(); }
      catch { showToast("Failed to revoke", "error"); }
    }, "REVOKE");
  };
  const handleDelete = (id, email) => {
    askSubConfirm(`Permanently delete subscriber record for ${email}? This cannot be undone.`, async () => {
      try { await deleteSubscriptionUser(id); showToast("Subscriber deleted"); loadRequests(); }
      catch { showToast("Failed to delete", "error"); }
    }, "DELETE");
  };

  // Flattened all-subscribers list for the directory
  const allUsers = subRequests
    ? [...(subRequests.pending || []), ...(subRequests.approved || []), ...(subRequests.rejected || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : [];

  const filtered = search.trim()
    ? allUsers.filter(u => u.email.toLowerCase().includes(search.trim().toLowerCase()))
    : allUsers;
  const visibleUsers = filtered.slice(0, listPage * PAGE_SIZE);
  const hasMore = visibleUsers.length < filtered.length;

  // Infinite scroll on the list container
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const fn = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40 && hasMore) {
        setListPage(p => p + 1);
      }
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [hasMore]);

  // Reset page when search changes
  useEffect(() => { setListPage(1); }, [search]);

  const statusColor = (s) => s === "approved" ? "#3dd68c" : s === "pending" ? "#ffb020" : "#ff5c6c";
  const statusBg = (s) => s === "approved" ? "rgba(61,214,140,0.08)" : s === "pending" ? "rgba(255,176,32,0.08)" : "rgba(255,92,108,0.08)";
  const statusBorder = (s) => s === "approved" ? "rgba(61,214,140,0.2)" : s === "pending" ? "rgba(255,176,32,0.2)" : "rgba(255,92,108,0.1)";

  return (
    <>
    <div style={{ maxWidth: 860, display: "flex", gap: 24 }}>

      {/* ── LEFT: Requests management ── */}
      <div style={{ flex: "0 0 340px", minWidth: 0 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>🔐 Requests</div>
            <div style={{ fontSize: 10, color: T.textDim }}>Approve or reject access</div>
          </div>
          <button onClick={loadRequests} disabled={subLoading} style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            {subLoading ? "⟳" : "↺"}
          </button>
        </div>

        {subLoading && <div style={{ textAlign: "center", color: T.textFaint, padding: 32 }}>Loading...</div>}
        {subRequests && (
          <>
            {/* Pending */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: "#ffb020", letterSpacing: "0.12em", marginBottom: 8, fontWeight: 700 }}>⏳ PENDING ({subRequests.pending?.length || 0})</div>
              {(subRequests.pending || []).length === 0 ? (
                <div style={{ fontSize: 11, color: T.textFaint, padding: "10px 12px", background: T.bgCard, borderRadius: 7, border: `1px solid ${T.border}` }}>No pending requests</div>
              ) : (subRequests.pending || []).map((u, i) => (
                <div key={u.id} style={{ background: T.bgCard, border: `1px solid rgba(255,176,32,0.2)`, borderRadius: 8, marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,176,32,0.12)", border: "1px solid rgba(255,176,32,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#ffb020", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                      <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>{new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleApprove(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(61,214,140,0.35)", background: "rgba(61,214,140,0.08)", color: "#3dd68c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                      <button onClick={() => handleReject(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(255,92,108,0.35)", background: "rgba(255,92,108,0.08)", color: "#ff5c6c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Rejected */}
            <div>
              <div style={{ fontSize: 9, color: "#ff5c6c", letterSpacing: "0.12em", marginBottom: 8, fontWeight: 700 }}>✕ REJECTED ({subRequests.rejected?.length || 0})</div>
              {(subRequests.rejected || []).length === 0 ? (
                <div style={{ fontSize: 11, color: T.textFaint, padding: "10px 12px", background: T.bgCard, borderRadius: 7, border: `1px solid ${T.border}` }}>No rejected requests</div>
              ) : (subRequests.rejected || []).map((u, i) => (
                <div key={u.id} style={{ background: T.bgCard, border: `1px solid rgba(255,92,108,0.1)`, borderRadius: 8, marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,92,108,0.08)", border: "1px solid rgba(255,92,108,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#ff5c6c", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                      <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>{new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => handleApprove(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(61,214,140,0.35)", background: "rgba(61,214,140,0.08)", color: "#3dd68c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>↺ RE-APPROVE</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Subscriber directory ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>Subscriber Directory</div>
            <div style={{ fontSize: 10, color: T.textDim }}>{allUsers.length} total · {(subRequests?.approved || []).length} active</div>
          </div>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }}
        />
        {/* List */}
        <div
          ref={listContainerRef}
          style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}
        >
          {!subRequests && subLoading && <div style={{ textAlign: "center", color: T.textFaint, padding: 32 }}>Loading...</div>}
          {subRequests && filtered.length === 0 && (
            <div style={{ textAlign: "center", color: T.textFaint, padding: 32, fontSize: 12 }}>
              {search ? "No subscribers match your search" : "No subscribers yet"}
            </div>
          )}
          {visibleUsers.map((u, i) => (
            <div key={u.id} style={{ background: T.bgCard, border: `1px solid ${statusBorder(u.status)}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              {/* Index badge */}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: statusBg(u.status), border: `1px solid ${statusColor(u.status)}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: statusColor(u.status), fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              {/* Avatar initial */}
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${statusColor(u.status)}18`, border: `1px solid ${statusColor(u.status)}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: statusColor(u.status), fontWeight: 700, flexShrink: 0 }}>
                {u.email[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{ padding: "3px 9px", borderRadius: 10, background: statusBg(u.status), border: `1px solid ${statusColor(u.status)}33`, color: statusColor(u.status), fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", flexShrink: 0 }}>
                {u.status.toUpperCase()}
              </span>
              {/* Actions */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {u.status === "approved" && (
                  <button onClick={() => handleUnsubscribe(u.id, u.email)} title="Revoke access" style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,92,108,0.3)", background: "rgba(255,92,108,0.07)", color: "#ff5c6c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                    UNSUBSCRIBE
                  </button>
                )}
                {u.status === "pending" && (
                  <>
                    <button onClick={() => handleApprove(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(61,214,140,0.35)", background: "rgba(61,214,140,0.08)", color: "#3dd68c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                    <button onClick={() => handleReject(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(255,92,108,0.35)", background: "rgba(255,92,108,0.08)", color: "#ff5c6c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  </>
                )}
                {u.status === "rejected" && (
                  <button onClick={() => handleApprove(u.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(61,214,140,0.35)", background: "rgba(61,214,140,0.08)", color: "#3dd68c", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>↺</button>
                )}
                {/* Delete — always available */}
                <button onClick={() => handleDelete(u.id, u.email)} title="Delete record permanently" style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(255,92,108,0.2)", background: "transparent", color: "rgba(255,92,108,0.5)", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
              </div>
            </div>
          ))}
          {hasMore && (
            <div style={{ textAlign: "center", padding: "12px 0", fontSize: 10, color: T.textFaint }}>Scroll for more...</div>
          )}
        </div>
      </div>
    </div>

    {/* Custom confirm modal for subscriber actions */}
    {subConfirm && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSubConfirm(null)}>
        <div style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 8 }}>Are you sure?</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 24, lineHeight: 1.6 }}>{subConfirm.message}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setSubConfirm(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>CANCEL</button>
            <button
              onClick={() => { subConfirm.onConfirm(); setSubConfirm(null); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,92,108,0.4)", background: "rgba(255,92,108,0.1)", color: "#ff5c6c", fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 700 }}
            >
              {subConfirm.label}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pageReady, setPageReady] = useState(false); // true after first data load
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({});
  const [quota, setQuota] = useState({});
  const [filter, setFilter] = useState("all");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [profile, setProfile] = useState("educational");
  const [visualMood, setVisualMood] = useState("rain");
  const [musicStyle, setMusicStyle] = useState("Laidback_Fevorite");
  const [musicVolume, setMusicVolume] = useState(0.04); // 0.0–0.5; default 4%
  const [pipeStep, setPipeStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null); // video being previewed
  const [editorVideo, setEditorVideo] = useState(null); // video open in VideoEditor
  const [tab, setTab] = useState("videos");
  const [tabLoading, setTabLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [genError, setGenError] = useState("");
  const [useStickfigures, setUseStickfigures] = useState(false);
  const [shortUseStickfigures, setShortUseStickfigures] = useState(false);
  const [sfClipCount, setSfClipCount] = useState(null); // null = not loaded yet
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {id, hasYoutube, youtubeId}
  const [exclusiveYtModal, setExclusiveYtModal] = useState(null); // {videoId, youtubeId, onSkip} — prompt to unlist/private on YT
  const [syncing, setSyncing] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(null); // string message or null
  const [ytModal, setYtModal] = useState(null); // video being managed on YT
  const [ytDetails, setYtDetails] = useState(null); // full YT details
  const [ytComments, setYtComments] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [deleteYtConfirm, setDeleteYtConfirm] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // {message, onConfirm, confirmLabel}
  const askConfirm = (message, onConfirm, confirmLabel = "DELETE") =>
    setConfirmModal({ message, onConfirm, confirmLabel });
  // Inline comments panel per video card
  const [openComments, setOpenComments] = useState(null); // video_id with panel open
  const [cardComments, setCardComments] = useState({}); // { video_id: [...comments] }
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // thread_id being replied to
  const [replyText, setReplyText] = useState("");
  const [cardCommentText, setCardCommentText] = useState("");
  const [postingCardComment, setPostingCardComment] = useState(false);
  const [billing, setBilling] = useState(null);
  const [libraryComps, setLibraryComps] = useState([]);
  const [channelVideos, setChannelVideos] = useState([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [channelPlatform, setChannelPlatform] = useState("youtube");
  const [channelVisible, setChannelVisible] = useState(24); // how many to render
  const channelBottomRef = useRef(null);
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState(null); // {id, title}
  const isDark = true;
  const pollRef = useRef();
  const videoRef = useRef();
  const logPollRef = useRef(null);
  const logLineRef = useRef(0);
  const [genJobId, setGenJobId] = useState(null);
  const [genLogs, setGenLogs] = useState([]);
  const [showGenLogs, setShowGenLogs] = useState(false);
  const genLogsEndRef = useRef(null);
  const [shortPrompt, setShortPrompt] = useState("");
  const [shortScriptMode, setShortScriptMode] = useState("prompt"); // "prompt" | "custom"
  const [shortCustomScript, setShortCustomScript] = useState("");
  const [shortAmbience, setShortAmbience] = useState(() => { try { return JSON.parse(localStorage.getItem("autovid_shorts_cfg") || "{}").ambience || "rain"; } catch { return "rain"; } });
  const [shortMusicStyle, setShortMusicStyle] = useState(() => { try { return JSON.parse(localStorage.getItem("autovid_shorts_cfg") || "{}").music_style || "Laidback_Fevorite"; } catch { return "Laidback_Fevorite"; } });
  const [shortMusicVolume, setShortMusicVolume] = useState(() => { try { const v = JSON.parse(localStorage.getItem("autovid_shorts_cfg") || "{}").music_volume; return v !== undefined ? v : 0.04; } catch { return 0.04; } });
  const [shortMusicDelay, setShortMusicDelay] = useState(0.0);
  const [shortGenerating, setShortGenerating] = useState(false);
  const [shortGenError, setShortGenError] = useState("");
  const [shortLogs, setShortLogs] = useState([]);
  const [shortLogVideoId, setShortLogVideoId] = useState(null);
  const [shortPipeStep, setShortPipeStep] = useState(0);
  const [showShortLogs, setShowShortLogs] = useState(false);
  const shortLogPollRef = useRef(null);
  const shortStepPollRef = useRef(null);
  const shortLogLineRef = useRef(0);
  const shortLogsEndRef = useRef(null);
  const [shortClipVideoId, setShortClipVideoId] = useState("");
  const [shortClipping, setShortClipping] = useState(false);
  const [shortClipError, setShortClipError] = useState("");
  const [shortClipSuccess, setShortClipSuccess] = useState("");
  const [shortsList, setShortsList] = useState([]);
  const [shortsLoading, setShortsLoading] = useState(false);
  const [shortsHasMore, setShortsHasMore] = useState(true);
  const [shortsFilter, setShortsFilter] = useState("all"); // all | youtube | tiktok | unposted
  const [shortsUploading, setShortsUploading] = useState({});
  const shortsOffsetRef = useRef(0);
  const shortsListRef = useRef(null);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [reviewsTab, setReviewsTab] = useState("pending"); // pending | approved | rejected | all
  const [reviewComments, setReviewComments] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [rejectModal, setRejectModal] = useState(null); // { id, reason }
  const [replyModal, setReplyModal] = useState(null); // { id, content }
  const [liveComments, setLiveComments] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveReplyOpen, setLiveReplyOpen] = useState(null);
  const [liveReplyContent, setLiveReplyContent] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef(null);
  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem("autovid_notifs") || "[]"); } catch { return []; }
  });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const T = THEMES.dark;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const addNotification = (title, body, type = "success") => {
    const notif = { id: Date.now(), title, body, type, timestamp: new Date().toISOString(), read: false };
    setNotifications(prev => {
      const updated = [notif, ...prev].slice(0, 20);
      try { localStorage.setItem("autovid_notifs", JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => {
        if (p === "granted") {
          try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
        }
      });
    }
  };

  // Push video errors to the notification panel (deduplicated by video ID in localStorage)
  useEffect(() => {
    if (!videos.length) return;
    const seenKey = "autovid_notified_errors";
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch {}
    const toNotify = videos.filter(v => v.error_message && !seen.includes(v.id));
    if (!toNotify.length) return;
    toNotify.forEach(v => {
      addNotification(
        `Video error — ${v.title || v.id.slice(0, 8)}`,
        v.error_message.split("\n")[0],
        "error",
      );
    });
    const updated = [...seen, ...toNotify.map(v => v.id)].slice(-200);
    try { localStorage.setItem(seenKey, JSON.stringify(updated)); } catch {}
  }, [videos]); // eslint-disable-line

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      try { localStorage.setItem("autovid_notifs", JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    try { localStorage.removeItem("autovid_notifs"); } catch {}
  };

  // Calculate next scheduled run from days (0=Mon..6=Sun) and hour (UTC)
  const calcNextRun = (days, hour) => {
    if (!days?.length) return "Not scheduled";
    const now = new Date();
    const nowDayJS = now.getUTCDay(); // 0=Sun,1=Mon...
    const nowHour = now.getUTCHours();
    const nowMin = now.getUTCMinutes();
    for (let offset = 0; offset <= 7; offset++) {
      const checkDayJS = (nowDayJS + offset) % 7;
      const checkAppDay = (checkDayJS + 6) % 7; // Mon=0..Sun=6
      if (!days.includes(checkAppDay)) continue;
      if (offset === 0 && (nowHour > hour || (nowHour === hour && nowMin > 0))) continue;
      const runDate = new Date(now);
      runDate.setUTCDate(runDate.getUTCDate() + offset);
      runDate.setUTCHours(hour, 0, 0, 0);
      const diffMs = runDate - now;
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      if (diffH >= 48) return `in ${Math.floor(diffH / 24)}d`;
      if (diffH >= 24) return `in ${Math.floor(diffH / 24)}d ${diffH % 24}h`;
      if (diffH > 0) return `in ${diffH}h ${diffM}m`;
      return `in ${diffM}m`;
    }
    return "Not scheduled";
  };

  const fetchBilling = useCallback(async () => {
    try {
      const res = await api.get("/billing");
      setBilling(res.data);
    } catch (e) {
      console.error("Billing fetch error:", e);
    }
  }, []);

  const isFirstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [v, s, q] = await Promise.all([
        listVideos(),
        getStats(),
        getQuota(),
      ]);
      setVideos(v);
      setStats(s);
      setQuota(q);
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        // Small delay so final render paints before we remove loader
        setTimeout(() => setPageReady(true), 150);
      }
    } catch (e) {
      console.error("Refresh error:", e);
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setPageReady(true); // show page even on error
      }
    }
  }, []);

  // Smart polling: fast when generating, slow when idle, paused when tab hidden
  useEffect(() => {
    refresh(); // initial load

    const getInterval = () => {
      const hasActive = videos.some((v) => IN_PROGRESS.includes(v.status));
      return hasActive ? 6000 : 60000; // 6s while generating, 60s when idle
    };

    const schedule = () => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "hidden") return; // don't poll hidden tab
        refresh().then(() => {
          // Reschedule with correct interval after each refresh
          schedule();
        });
      }, getInterval());
    };

    schedule();
    return () => clearInterval(pollRef.current);
  }, [refresh, videos.length]); // re-evaluate when video count changes

  // Auto-fix stuck videos once on initial load (fires 3s after mount to let data load first)
  useEffect(() => {
    const t = setTimeout(() => {
      fixStuckVideos().then(r => {
        if (r?.fixed > 0) {
          refresh();
          // Toast will be shown after refresh updates videos state
        }
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether THIS SESSION started a generation (not stale DB status)
  const fetchChannel = useCallback(async (forceRefresh = false) => {
    setChannelLoading(true);
    setChannelError("");
    try {
      const url = forceRefresh
        ? "/channel/videos?refresh=true"
        : "/channel/videos";
      const res = await api.get(url);
      setChannelVideos(res.data.videos || []);
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || "";
      if (status === 429 || detail.toLowerCase().includes("quota")) {
        setChannelError(
          "⏳ YouTube API quota exceeded — resets at midnight Pacific Time. Cached data shown if available.",
        );
      } else {
        setChannelError("Failed to load channel videos. Check YouTube OAuth.");
      }
    } finally {
      setChannelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "billing") fetchBilling();
    if (tab === "channel") fetchChannel(false); // use cache, don't burn quota
    if (tab === "shorts") loadShorts(true);
    if (tab === "library") listCompilations().then(r => setLibraryComps(Array.isArray(r) ? r : [])).catch(() => {});
  }, [tab, fetchBilling, fetchChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionGenerating = useRef(false);

  useEffect(() => {
    // Only update pipe step progress if WE started this generation
    if (!sessionGenerating.current) return;
    const active = videos.find((v) => IN_PROGRESS.includes(v.status));
    if (active) {
      setPipeStep(STEP_MAP[active.status] || 1);
    } else {
      // Pipeline finished
      sessionGenerating.current = false;
      setGenerating(false);
      setPipeStep(0);
      showToast("Video pipeline complete!");
      addNotification("Video Ready", "Your video pipeline has completed successfully.");
    }
  }, [videos]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    const dup = isDuplicatePrompt(prompt.trim());
    if (dup) {
      setGenError(`Too similar to existing content: "${dup}". Refine your prompt to make it unique.`);
      return;
    }
    setGenError("");
    setGenerating(true);
    setPipeStep(1);
    setGlobalLoading("Starting pipeline...");
    setGenLogs([]);
    logLineRef.current = 0;
    sessionGenerating.current = true;
    try {
      const data = await generateVideo(
        prompt.trim(),
        false,
        profile,
        useStickfigures ? "rain" : visualMood,
        musicStyle,
        musicVolume,
        useStickfigures,
      );
      const vid = data.video_id;
      setGenJobId(vid);
      saveRecentPrompt(prompt.trim());
      setPrompt("");
      setGlobalLoading(null);

      // Start log polling
      logPollRef.current = setInterval(async () => {
        try {
          const { data: logData } = await api.get(
            `/videos/${vid}/logs?since=${logLineRef.current}`,
          );
          if (logData.lines?.length > 0) {
            logLineRef.current += logData.lines.length;
            setGenLogs((prev) => [...prev, ...logData.lines].slice(-300));
            setTimeout(
              () =>
                genLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }),
              50,
            );
          }
          if (logData.done) clearInterval(logPollRef.current);
        } catch (e) {
          /* ignore */
        }
      }, 1500);

      setTimeout(refresh, 1000);
    } catch (e) {
      setGlobalLoading(null);
      setGenError(
        e.response?.data?.detail ||
          "Pipeline failed. Is the backend running on port 8000?",
      );
      setGenerating(false);
      setPipeStep(0);
    }
  };

  const handleGenCancel = async () => {
    if (!genJobId) return;
    clearInterval(logPollRef.current);
    try {
      await api.post(`/videos/${genJobId}/cancel`);
    } catch (e) {}
    setGenerating(false);
    setPipeStep(0);
    setGenError("Cancelled by you");
    showToast("Pipeline cancelled", "error");
  };

  // ── Duplicate prompt detection ────────────────────────────────────────────
  const saveRecentPrompt = (text) => {
    try {
      const recent = JSON.parse(localStorage.getItem("autovid_recent_prompts") || "[]");
      const updated = [text.trim(), ...recent.filter(p => p !== text.trim())].slice(0, 50);
      localStorage.setItem("autovid_recent_prompts", JSON.stringify(updated));
    } catch {}
  };

  const isDuplicatePrompt = (newText) => {
    const np = (newText || "").trim().toLowerCase();
    if (!np || np.split(/\s+/).length < 4) return null; // too short to check
    const candidates = [
      ...videos.map(v => v.prompt || ""),
      ...videos.map(v => v.title || ""),
      ...(() => { try { return JSON.parse(localStorage.getItem("autovid_recent_prompts") || "[]"); } catch { return []; } })(),
    ].filter(Boolean);
    for (const c of candidates) {
      if (jaccardSim(np, c.toLowerCase()) >= 0.9) return c.slice(0, 100);
    }
    return null;
  };

  // ── Force-reset a stuck video ─────────────────────────────────────────────
  const handleForceReset = async (id, e) => {
    e?.stopPropagation();
    try {
      const r = await forceResetVideo(id);
      showToast(`Reset: ${r.message}`);
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Reset failed", "error");
    }
  };

  // ── Card-level log viewer ─────────────────────────────────────────────────
  const startCardLogs = (videoId, e) => {
    e?.stopPropagation();
    if (cardLogsVideoId === videoId) {
      clearInterval(cardLogsPollRef.current);
      setCardLogsVideoId(null);
      setCardLogsLines([]);
      cardLogsLineRef.current = 0;
      return;
    }
    clearInterval(cardLogsPollRef.current);
    setCardLogsVideoId(videoId);
    setCardLogsLines([]);
    cardLogsLineRef.current = 0;
    cardLogsPollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/videos/${videoId}/logs?since=${cardLogsLineRef.current}`);
        if (data?.lines?.length > 0) {
          cardLogsLineRef.current += data.lines.length;
          setCardLogsLines(prev => [...prev, ...data.lines].slice(-200));
          setTimeout(() => cardLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
        if (data?.done) {
          clearInterval(cardLogsPollRef.current);
          setTimeout(() => {
            setCardLogsVideoId(null);
            setCardLogsLines([]);
            cardLogsLineRef.current = 0;
          }, 3000);
        }
      } catch (_) {}
    }, 1500);
  };


  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = async (id, e) => {
    e?.stopPropagation();
    try {
      await archiveVideo(id);
      setVideos(vs => vs.filter(v => v.id !== id));
      showToast("Video archived");
    } catch {
      showToast("Archive failed", "error");
    }
  };

  const handleUnarchive = async (id, e) => {
    e?.stopPropagation();
    try {
      await unarchiveVideo(id);
      setArchivedVideos(vs => vs.filter(v => v.id !== id));
      showToast("Video restored");
      refresh();
    } catch {
      showToast("Unarchive failed", "error");
    }
  };

  const loadArchived = async () => {
    setArchivedLoading(true);
    try {
      const data = await listArchivedVideos();
      setArchivedVideos(Array.isArray(data) ? data : []);
    } catch {
      setArchivedVideos([]);
    } finally {
      setArchivedLoading(false);
    }
  };

  const SHORT_STEPS = ["Script", "Voice", "Visual", "Captions", "Final", "Ready"];
  const SHORT_STEP_MAP = { generating: 1, scripted: 2, voiced: 3, assembled: 4, captioned: 5, labeled: 5, ready: 6, posted: 6 };

  const handleGenerateShort = async () => {
    const hasInput = shortScriptMode === "custom" ? shortCustomScript.trim() : shortPrompt.trim();
    if (!hasInput || shortGenerating) return;
    const dup = isDuplicatePrompt(hasInput);
    if (dup) {
      setShortGenError(`Too similar to existing content: "${dup}". Refine your prompt or script.`);
      return;
    }
    setShortGenError("");
    setShortGenerating(true);
    setShortPipeStep(1);
    setShowShortLogs(false);
    if (shortLogPollRef.current) clearInterval(shortLogPollRef.current);
    if (shortStepPollRef.current) clearInterval(shortStepPollRef.current);
    setShortLogs([]);
    shortLogLineRef.current = 0;
    setShortLogVideoId(null);

    // Save current config globally (localStorage + backend auto-short settings)
    const cfg = { ambience: shortAmbience, music_style: shortMusicStyle, music_volume: shortMusicVolume };
    try { localStorage.setItem("autovid_shorts_cfg", JSON.stringify(cfg)); } catch {}
    if (autoShortSettings) {
      const updated = { ...autoShortSettings, ambience: shortAmbience, music_style: shortMusicStyle, music_volume: shortMusicVolume };
      saveAutoShortSettings(updated).catch(() => {});
      setAutoShortSettings(updated);
    }

    try {
      const res = await generateShortFromScratch(
        shortScriptMode === "custom" ? shortCustomScript.trim().slice(0, 200) : shortPrompt.trim(),
        shortUseStickfigures ? "rain" : shortAmbience,
        shortMusicStyle, shortMusicVolume, shortMusicDelay,
        shortScriptMode === "custom" ? shortCustomScript.trim() : "",
        shortUseStickfigures,
      );
      const vid = res?.video_id;
      saveRecentPrompt(hasInput);
      setShortPrompt("");
      setShortCustomScript("");
      showToast("Short generation started!");
      if (vid) {
        setShortLogVideoId(vid);
        // Step polling
        shortStepPollRef.current = setInterval(async () => {
          try {
            const { data: st } = await api.get(`/videos/${vid}`);
            if (st?.status) setShortPipeStep(SHORT_STEP_MAP[st.status] ?? 1);
            if (["ready", "posted", "failed"].includes(st?.status)) {
              clearInterval(shortStepPollRef.current);
            }
          } catch (_) {}
        }, 3000);
        // Log polling
        shortLogPollRef.current = setInterval(async () => {
          try {
            const { data: ld } = await api.get(`/videos/${vid}/logs?since=${shortLogLineRef.current}`);
            if (ld?.lines?.length > 0) {
              shortLogLineRef.current += ld.lines.length;
              setShortLogs(prev => [...prev, ...ld.lines].slice(-300));
              setTimeout(() => shortLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
            if (ld?.done) {
              clearInterval(shortLogPollRef.current);
              clearInterval(shortStepPollRef.current);
              setShortGenerating(false);
              // Fetch completed video for title, then show toast
              try {
                const { data: done } = await api.get(`/videos/${vid}`);
                const t = done?.title || "Short";
                const label = t.length > 45 ? t.slice(0, 45) + "…" : t;
                showToast(`⚡ "${label}" is ready!`);
                addNotification("Short Ready", `"${label}" has been generated.`);
              } catch (_) {
                showToast("⚡ Short generation complete!");
                addNotification("Short Ready", "Your short has been generated.");
              }
              // Auto-dismiss the progress panel after 2s
              setTimeout(() => {
                setShortPipeStep(0);
                setShortLogVideoId(null);
                setShortLogs([]);
                setShowShortLogs(false);
              }, 2000);
              refresh();
              loadShorts(true);
            }
          } catch (_) {}
        }, 1500);
      }
    } catch (e) {
      setShortGenError(e?.response?.data?.detail || "Failed to start short generation.");
      setShortGenerating(false);
      setShortPipeStep(0);
    }
  };

  const handleClipShort = async () => {
    if (!shortClipVideoId || shortClipping) return;
    setShortClipError("");
    setShortClipSuccess("");
    setShortClipping(true);
    try {
      await createShortFromVideo(shortClipVideoId);
      setShortClipSuccess("Short is being created and will upload to YouTube.");
      setShortClipVideoId("");
    } catch (e) {
      setShortClipError(e?.response?.data?.detail || "Failed to clip short.");
    } finally {
      setShortClipping(false);
    }
  };

  const loadShorts = async (reset = false) => {
    if (shortsLoading) return;
    if (!reset && !shortsHasMore) return;
    setShortsLoading(true);
    const offset = reset ? 0 : shortsOffsetRef.current;
    try {
      const data = await listShorts(25, offset);
      const items = Array.isArray(data) ? data : [];
      if (reset) {
        setShortsList(items);
      } else {
        setShortsList(prev => [...prev, ...items]);
      }
      shortsOffsetRef.current = offset + items.length;
      setShortsHasMore(items.length === 25);
    } catch (e) {
      console.error("Shorts load error:", e);
    } finally {
      setShortsLoading(false);
    }
  };

  const handleShortsScroll = () => {
    const el = shortsListRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom && !shortsLoading && shortsHasMore) {
      loadShorts(false);
    }
  };

  // Reset channel scroll when switching to channel tab
  useEffect(() => {
    if (tab === "channel") setChannelVisible(24);
  }, [tab]);

  const loadReviews = async (statusFilter = "pending") => {
    setReviewsLoading(true);
    try {
      const r = await api.get(`/admin/blog/comments?status=${statusFilter}&limit=50`);
      setReviewComments(r.data.comments || []);
      setReviewTotal(r.data.total || 0);
      setPendingReviewCount(r.data.pending_count || 0);
    } catch(e) {
      showToast("Failed to load reviews", "error");
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadLiveComments = async () => {
    setLiveLoading(true);
    try {
      // fetch approved top-level + all their replies
      const r = await api.get("/admin/blog/comments?status=approved&limit=100");
      const top = (r.data.comments || []).filter(c => !c.parent_id);
      const replies = (r.data.comments || []).filter(c => c.parent_id);
      const repliesMap = {};
      replies.forEach(rep => { (repliesMap[rep.parent_id] = repliesMap[rep.parent_id] || []).push(rep); });
      setLiveComments(top.map(c => ({ ...c, replies: repliesMap[c.id] || [] })));
    } catch(e) { /* silent */ }
    finally { setLiveLoading(false); }
  };

  const handleRetract = async (id) => {
    await api.post(`/admin/blog/comments/${id}/retract`);
    showToast("Comment retracted");
    loadReviews(reviewsTab);
    loadLiveComments();
  };

  useEffect(() => {
    if (tab !== "reviews") return;
    loadReviews(reviewsTab);
    loadLiveComments();
  }, [tab, reviewsTab]); // eslint-disable-line

  // Fetch pending review count on initial load
  useEffect(() => {
    api.get("/admin/blog/comments?status=pending&limit=1")
      .then(r => setPendingReviewCount(r.data.pending_count || 0))
      .catch(() => {});
  }, []); // eslint-disable-line

  // Settings tab — staggered loading to avoid ERR_INSUFFICIENT_RESOURCES
  // Fast DB-only calls fire immediately; slow external-API status calls are
  // delayed so they never all hit the backend simultaneously.
  useEffect(() => {
    if (tab !== "settings") return;

    // ── Batch 1: fast DB-only reads (fire immediately) ──────────────────────
    api.get("/auto-reply/status").then(r => {
      setAutoReplyEnabled(r.data.enabled);
      setAutoReplyStatus(r.data);
    }).catch(() => {});
    api.get("/auto-generate/settings").then(r => setAutoGenSettings(r.data)).catch(() => {});
    api.get("/auto-short/settings").then(r => {
      const cfg = (() => { try { return JSON.parse(localStorage.getItem("autovid_shorts_cfg") || "{}"); } catch { return {}; } })();
      setAutoShortSettings({
        ...r.data,
        ambience:     r.data.ambience     || cfg.ambience     || "rain",
        music_style:  r.data.music_style  || cfg.music_style  || "Laidback_Fevorite",
        music_volume: r.data.music_volume !== undefined ? r.data.music_volume : (cfg.music_volume ?? 0.04),
      });
    }).catch(() => {});
    getPodcastSettings().then(r => setPodcastSettings(r)).catch(() => {});
    getBuzzsproutSettings().then(r => setBuzzsproutSettings(s => ({
      ...s,
      api_token:   r.api_token_set ? (s.api_token || "••••••••") : "",
      podcast_id:  r.podcast_id  || "",
      auto_upload: r.auto_upload || false,
    }))).catch(() => {});
    getPodbeanSettings().then(r => setPodbeanSettings(s => ({
      ...s,
      client_id:     r.client_id     || "",
      client_secret: r.client_secret_set ? (s.client_secret || "••••••••") : "",
      auto_upload:   r.auto_upload   || false,
    }))).catch(() => {});
    getSubscriptions().then(r => setSubscriptions(Array.isArray(r) ? r : [])).catch(() => {});
    listStickFiguresPaged(0, 1, false).then(r => setSfClipCount(r.total ?? 0)).catch(() => setSfClipCount(0));

    // ── Batch 2: external-API status checks — staggered to avoid thread exhaustion ──
    const t1 = setTimeout(() => getTikTokStatus().then(r => setTiktokConnected(r.connected)).catch(() => {}), 200);
    const t2 = setTimeout(() => getSpotifyStatus().then(r => { setSpotifyConnected(r.connected); if (r.connected) setSpotifyProfile(r); }).catch(() => {}), 600);
    const t3 = setTimeout(() => getBuzzsproutStatus().then(r => setBuzzsproutStatus(r)).catch(() => setBuzzsproutStatus({ connected: false })), 1000);
    const t4 = setTimeout(() => getPodbeanStatus().then(r => setPodbeanStatus(r)).catch(() => setPodbeanStatus({ connected: false })), 1400);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [tab]);

  // Infinite scroll — load more channel videos when bottom sentinel is visible
  useEffect(() => {
    if (!channelBottomRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setChannelVisible((v) => Math.min(v + 24, channelVideos.length));
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(channelBottomRef.current);
    return () => obs.disconnect();
  }, [channelVideos.length, tab]);

  const handleAutoReplyToggle = async (val) => {
    setAutoReplyEnabled(val);
    try {
      await api.post("/auto-reply/toggle", { enabled: val });
      showToast(val ? "💬 Auto-reply enabled" : "🔇 Auto-reply disabled");
    } catch (e) {
      showToast("Toggle failed", "error");
    }
  };

  const handleAutoGenEnabledToggle = async () => {
    const newVal = !autoGenSettings.enabled;
    setAutoGenSettings((s) => ({ ...s, enabled: newVal }));
    try {
      await api.post("/auto-generate/settings", { ...autoGenSettings, enabled: newVal });
      showToast(newVal ? "🤖 Auto-generate videos enabled" : "⏸ Auto-generate videos disabled");
    } catch (e) {
      showToast("Toggle failed", "error");
      setAutoGenSettings((s) => ({ ...s, enabled: !newVal }));
    }
  };

  const handleAutoShortEnabledToggle = async () => {
    const newVal = !autoShortSettings.enabled;
    setAutoShortSettings((s) => ({ ...s, enabled: newVal }));
    try {
      await saveAutoShortSettings({ ...autoShortSettings, enabled: newVal });
      showToast(newVal ? "📱 Auto-generate shorts enabled" : "⏸ Auto-generate shorts disabled");
    } catch (e) {
      showToast("Toggle failed", "error");
      setAutoShortSettings((s) => ({ ...s, enabled: !newVal }));
    }
  };

  const handlePodcastEnabledToggle = async () => {
    const newVal = !podcastSettings.enabled;
    setPodcastSettings((s) => ({ ...s, enabled: newVal }));
    try {
      await savePodcastSettings({ ...podcastSettings, enabled: newVal });
      showToast(newVal ? "🎙 Auto-podcast enabled" : "⏸ Auto-podcast disabled");
    } catch (e) {
      showToast("Toggle failed", "error");
      setPodcastSettings((s) => ({ ...s, enabled: !newVal }));
    }
  };

  const _startPodcastPolling = (vid, topicLabel) => {
    setPodcastJobId(vid);
    setPodcastTopic(topicLabel || "");
    setPodcastRunning(true);
    setPodcastStep(1);
    setPodcastLogs([]);
    podcastLogLineRef.current = 0;
    setShowPodcastLogs(true);

    const stepMap = { generating:1, scripted:2, voiced:3, assembled:4, ready:5 };

    const stepPoll = setInterval(async () => {
      try {
        const { data: st } = await api.get(`/videos/${vid}`);
        if (st?.status) setPodcastStep(stepMap[st.status] ?? 1);
        if (["ready","failed"].includes(st?.status)) {
          clearInterval(stepPoll);
          clearInterval(podcastLogPollRef.current);
          setPodcastRunning(false);
          setTimeout(() => setShowPodcastLogs(false), 2500);
          if (st.status === "failed") { showToast("Podcast episode failed", "error"); addNotification("Podcast Failed", "The podcast episode pipeline failed.", "error"); }
          else { showToast("✅ Podcast episode ready!"); addNotification("Podcast Ready", "Your podcast episode is ready."); refresh(); }
        }
      } catch (e) {}
    }, 4000);

    podcastLogPollRef.current = setInterval(async () => {
      try {
        const { data: ld } = await api.get(`/videos/${vid}/logs?since=${podcastLogLineRef.current}`);
        if (ld?.lines?.length > 0) {
          podcastLogLineRef.current += ld.lines.length;
          setPodcastLogs(prev => [...prev, ...ld.lines].slice(-300));
          setTimeout(() => podcastLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
        if (ld?.done) clearInterval(podcastLogPollRef.current);
      } catch (e) {}
    }, 1500);
  };

  const handleRetry = async (id, e) => {
    e.stopPropagation();
    try {
      await retryVideo(id);
      refresh();
      showToast("Retry started");
    } catch (e) {
      showToast("Retry failed", "error");
    }
  };

  const handleRetryUpload = async (id, e) => {
    e.stopPropagation();
    try {
      await retryUploadVideo(id);
      refresh();
      showToast("YouTube upload retry started");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      showToast(Array.isArray(detail) ? detail.map(d => d.msg).join(", ") : detail || "Retry upload failed", "error");
    }
  };
  // YouTube modal state
  const [uploadModal, setUploadModal] = useState(null); // video object
  const [ytSettingsModal, setYtSettingsModal] = useState(null); // video object
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplyStatus, setAutoReplyStatus] = useState(null);
  const [autoGenSettings, setAutoGenSettings] = useState(null);
  const [autoGenSaving, setAutoGenSaving] = useState(false);
  const [autoGenJobId, setAutoGenJobId] = useState(null);
  const [autoGenRunning, setAutoGenRunning] = useState(false);
  const [autoGenStep, setAutoGenStep] = useState(0);
  const [autoGenLogs, setAutoGenLogs] = useState([]);
  const [showAutoGenLogs, setShowAutoGenLogs] = useState(false);
  const [autoGenPrompt, setAutoGenPrompt] = useState("");
  const autoGenLogLineRef = useRef(0);
  const autoGenLogPollRef = useRef(null);
  const autoGenLogsEndRef = useRef(null);
  const [shortsModal, setShortsModal] = useState(null); // video object | "new"
  const [autoShortSettings, setAutoShortSettings] = useState(null);
  const [autoShortSaving, setAutoShortSaving] = useState(false);
  const [autoShortRunning, setAutoShortRunning] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState([]);
  const [tiktokUploading, setTiktokUploading] = useState({});
  // Buzzsprout state
  const [buzzsproutStatus, setBuzzsproutStatus] = useState(null);
  const [buzzsproutSettings, setBuzzsproutSettings] = useState({ api_token: "", podcast_id: "", auto_upload: false });
  const [buzzsproutSaving, setBuzzsproutSaving] = useState(false);
  const [buzzsproutTesting, setBuzzsproutTesting] = useState(false);
  const [buzzsproutUploading, setBuzzsproutUploading] = useState({});
  // Podbean state
  const [podbeanStatus, setPodbeanStatus] = useState(null);
  const [podbeanSettings, setPodbeanSettings] = useState({ client_id: "", client_secret: "", auto_upload: false });
  const [podbeanSaving, setPodbeanSaving] = useState(false);
  const [podbeanTesting, setPodbeanTesting] = useState(false);
  const [podbeanUploading, setPodbeanUploading] = useState({});
  // Subscriptions / expenditure tracker
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsSaving, setSubsSaving] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSub, setNewSub] = useState({ name: "", cost: "", currency: "USD", cycle: "monthly", next_billing: "" });
  const [autoShortJobId, setAutoShortJobId] = useState(null);
  const [autoShortPrompt, setAutoShortPrompt] = useState("");
  const [autoShortStep, setAutoShortStep] = useState(0);
  const [autoShortLogs, setAutoShortLogs] = useState([]);
  const [showAutoShortLogs, setShowAutoShortLogs] = useState(false);
  const autoShortLogsEndRef = useRef(null);
  const autoShortLogPollRef = useRef(null);
  const autoShortLogLineRef = useRef(0);
  const tabTimerRef = useRef(null);

  // Podcast episode pipeline state
  const [podcastSettings, setPodcastSettings] = useState(null);
  const [podcastSaving, setPodcastSaving] = useState(false);
  const [podcastRunning, setPodcastRunning] = useState(false);
  const [podcastJobId, setPodcastJobId] = useState(null);
  const [podcastTopic, setPodcastTopic] = useState("");
  const [podcastStep, setPodcastStep] = useState(0);
  const [podcastLogs, setPodcastLogs] = useState([]);
  const [showPodcastLogs, setShowPodcastLogs] = useState(false);
  const [showPodcastManual, setShowPodcastManual] = useState(false);
  const [manualPodcastTopic, setManualPodcastTopic] = useState("");
  const [manualPodcastEssay, setManualPodcastEssay] = useState("");
  const [manualPodcastMusic, setManualPodcastMusic] = useState("Birds_Atmosphere_Piano");
  const [podcastMusicDelay, setPodcastMusicDelay] = useState(0.0);
  const [podcastMusicVolume, setPodcastMusicVolume] = useState(0.01);
  const [showTopicsPanel, setShowTopicsPanel] = useState(false);
  const [topicsInputText, setTopicsInputText] = useState("");
  const [podcastTopicsSaving, setPodcastTopicsSaving] = useState(false);
  const [pipelineMetrics, setPipelineMetrics] = useState(null);
  // Card-level live logs (view logs for any in-progress card)
  const [cardLogsVideoId, setCardLogsVideoId] = useState(null);
  const [cardLogsLines, setCardLogsLines] = useState([]);
  const cardLogsPollRef = useRef(null);
  const cardLogsLineRef = useRef(0);
  const cardLogsEndRef = useRef(null);
  // Archive
  const [archivedVideos, setArchivedVideos] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  // Danger zone
  const [showDangerZone, setShowDangerZone] = useState(false);
  const podcastLogsEndRef = useRef(null);
  const podcastLogPollRef = useRef(null);
  const podcastLogLineRef = useRef(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const switchTab = (id) => {
    if (id === tab) return;
    setTab(id);
    setTabLoading(true);
  };

  // Load pipeline metrics when analytics tab is active, refresh every 30s
  useEffect(() => {
    if (tab !== "analytics") return;
    let cancelled = false;
    const load = () => getPipelineMetrics().then((d) => { if (!cancelled) setPipelineMetrics(d); }).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab]);

  // Remove tab spinner 100ms after the new tab's content has rendered in the DOM
  useEffect(() => {
    if (!tabLoading) return;
    const raf = requestAnimationFrame(() => {
      tabTimerRef.current = setTimeout(() => setTabLoading(false), 100);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (tabTimerRef.current) clearTimeout(tabTimerRef.current);
    };
  }, [tab]); // eslint-disable-line

  const handleUpload = async (id, e) => {
    e.stopPropagation();
    setGlobalLoading("Starting YouTube upload...");
    try {
      await uploadVideo(id);
      refresh();
      showToast("YouTube upload started!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Upload failed", "error");
    } finally {
      setGlobalLoading(null);
    }
  };
  const handleDelete = async (id, alsoDeleteFromYt = false) => {
    setGlobalLoading("Deleting...");
    try {
      if (alsoDeleteFromYt && deleteConfirm?.youtubeId) {
        try {
          await deleteFromYoutube(id);
        } catch (e) {
          console.warn("YT delete failed:", e);
        }
      }
      await deleteVideo(id);
      setDeleteConfirm(null);
      setSelected(null);
      refresh();
      showToast("Video deleted");
    } catch (e) {
      showToast("Delete failed", "error");
    } finally {
      setGlobalLoading(null);
    }
  };
  const handlePurge = (id, e) => {
    e?.stopPropagation();
    askConfirm("Permanently delete this failed job?", async () => {
      try {
        await deleteVideo(id);
        setVideos((vs) => vs.filter((v) => v.id !== id));
        showToast("Job purged");
      } catch {
        showToast("Purge failed", "error");
      }
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSync = async () => {
    setSyncing(true);
    setGlobalLoading("Syncing YouTube stats...");
    try {
      const res = await syncYoutube();
      showToast(res.message || `Synced ${res.synced} videos`);
      refresh();
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Sync failed — check YouTube token",
        "error",
      );
    } finally {
      setSyncing(false);
      setGlobalLoading(null);
    }
  };

  // Build video URL from file_path stored in DB
  // Backend serves files from /output/videos/ via FastAPI static files
  const openYtModal = async (video) => {
    setYtModal(video);
    setYtDetails(null);
    setYtComments([]);
    setYtLoading(true);
    setGlobalLoading("Loading YouTube data...");
    try {
      const [details, commentsData] = await Promise.all([
        getYouTubeDetails(video.id),
        getComments(video.id),
      ]);
      setYtDetails(details);
      setYtComments(commentsData.comments || []);
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Failed to load YouTube data",
        "error",
      );
    } finally {
      setYtLoading(false);
      setGlobalLoading(null);
    }
  };

  const handleDeleteFromYt = async (videoId) => {
    setGlobalLoading("Deleting from YouTube...");
    try {
      await deleteFromYoutube(videoId);
      setDeleteYtConfirm(null);
      setYtModal(null);
      refresh();
      showToast("Deleted from YouTube — video is now ready to re-upload");
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Delete from YouTube failed",
        "error",
      );
    } finally {
      setGlobalLoading(null);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !ytModal) return;
    setPostingComment(true);
    try {
      await postComment(ytModal.id, newComment.trim());
      setNewComment("");
      // Refresh comments
      const data = await getComments(ytModal.id);
      setYtComments(data.comments || []);
      showToast("Comment posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed to post comment", "error");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    askConfirm("Delete this YouTube comment?", async () => {
      try {
        await deleteComment(ytModal.id, commentId);
        setYtComments((prev) => prev.filter((c) => c.id !== commentId));
        showToast("Comment deleted");
      } catch (e) {
        showToast("Failed to delete comment", "error");
      }
    });
  };

  const handleTriggerAutoComment = async () => {
    try {
      await triggerAutoComment();
      showToast("Auto-comment cycle triggered!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed", "error");
    }
  };

  const toggleComments = async (videoId) => {
    if (openComments === videoId) {
      setOpenComments(null);
      return;
    }
    setOpenComments(videoId);
    if (cardComments[videoId]) return; // already loaded
    setCommentsLoading(true);
    try {
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
    } catch (e) {
      showToast("Failed to load comments", "error");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCardPostComment = async (videoId) => {
    if (!cardCommentText.trim()) return;
    setPostingCardComment(true);
    try {
      await postComment(videoId, cardCommentText.trim());
      setCardCommentText("");
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast("Comment posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed to post", "error");
    } finally {
      setPostingCardComment(false);
    }
  };

  const handleReply = async (videoId, threadId) => {
    if (!replyText.trim()) return;
    try {
      await replyComment(videoId, threadId, replyText.trim());
      setReplyText("");
      setReplyingTo(null);
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast("Reply posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Reply failed", "error");
    }
  };

  const handleDeleteCardComment = (videoId, commentId) => {
    askConfirm("Delete this comment?", async () => {
      try {
        await deleteComment(videoId, commentId);
        setCardComments((prev) => ({
          ...prev,
          [videoId]: prev[videoId].filter((c) => c.id !== commentId),
        }));
        showToast("Comment deleted");
      } catch (e) {
        showToast("Failed to delete", "error");
      }
    });
  };

  const handleModerate = async (videoId, commentId, status) => {
    try {
      await moderateComment(videoId, commentId, status);
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast(
        `Comment ${status === "rejected" ? "rejected" : status === "published" ? "approved" : "held"}`,
      );
    } catch (e) {
      showToast("Moderation failed", "error");
    }
  };

  // Default avatar SVG for comments with no profile image
  const getAvatarSvg = (gender = "neutral") => {
    const female = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23374151'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%236b7280'/%3E%3Cellipse cx='20' cy='34' rx='10' ry='8' fill='%236b7280'/%3E%3Ccircle cx='17' cy='22' r='1.5' fill='%239ca3af'/%3E%3Ccircle cx='23' cy='22' r='1.5' fill='%239ca3af'/%3E%3C/svg%3E`;
    const male = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%231e3a5f'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%232563eb'/%3E%3Crect x='10' y='26' width='20' height='12' rx='4' fill='%232563eb'/%3E%3C/svg%3E`;
    const neutral = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23312e81'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%236366f1'/%3E%3Cellipse cx='20' cy='33' rx='10' ry='7' fill='%236366f1'/%3E%3C/svg%3E`;
    if (gender === "female") return female;
    if (gender === "male") return male;
    return neutral;
  };

  // Pick a consistent gender per author name so same person always gets same avatar
  const getCommentAvatar = (authorImg, authorName = "") => {
    if (authorImg) return authorImg;
    const hash = authorName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const genders = ["male", "female", "neutral", "male", "female"];
    return getAvatarSvg(genders[hash % genders.length]);
  };

  const handleDownload = async (url, filename) => {
    if (!url) return;
    const isAudio = filename?.match(/\.(mp3|m4a|ogg|wav|aac)$/i);
    const mimeOverride = isAudio ? "audio/mpeg" : null;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("fetch failed");
      const rawBlob = await resp.blob();
      // Force correct MIME type so browser treats audio as audio, not video
      const blob = mimeOverride ? new Blob([rawBlob], { type: mimeOverride }) : rawBlob;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (_) {
      window.open(url, "_blank");
    }
  };

  const getVideoUrl = (filePath) => {
    if (!filePath) return null;
    // Full Supabase/remote URL → play directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://"))
      return filePath;
    // Local path → serve via nginx proxy (relative, works on any host)
    const filename = filePath.split("/").pop();
    if (filename && filename.endsWith(".mp4"))
      return `/local-videos/${filename}`;
    return null;
  };

  const isStructuralError = (msg) => {
    if (!msg) return false;
    return /missing \d+ required positional argument|TypeError:|AttributeError:|NameError:|SyntaxError:|ImportError:|KeyError:|IndexError:|UnboundLocalError:|RecursionError:|<locals>/.test(msg);
  };

  // Reset pagination when filter or search changes; load archived list when switching to it
  useEffect(() => {
    setVisibleCount(20);
    if (filter === "archived") loadArchived();
  }, [filter, videoSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver — load 20 more items when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => c + 20);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = videos.filter((v) => {
    const matchesFilter = (() => {
      if (filter === "all") return v.status !== "failed" && v.resolution !== "1080x1920";
      if (filter === "mp4") return !!v.file_path && v.resolution !== "1080x1920" && v.status !== "failed";
      if (filter === "mp3") return !!v.narration_url && v.resolution !== "1080x1920" && v.status !== "failed";
      if (filter === "shorts") return v.resolution === "1080x1920";
      if (filter === "exclusive") return !!v.is_exclusive && !v.archived;
      return v.status === filter;
    })();
    if (!matchesFilter) return false;
    if (videoSearch.trim()) {
      const q = videoSearch.toLowerCase();
      return (v.title || "").toLowerCase().includes(q) || (v.prompt || "").toLowerCase().includes(q);
    }
    return true;
  });
  const sc = (s) => STATUS[s] || STATUS.failed;
  // True for any podcast/audio-only record regardless of how it was created.
  // Automation pipeline sets narration_url with no file_path;
  // Compilation Studio sets file_path to an .mp3 and may tag labels with "mp3".
  const isPodcast = (v) =>
    (v.labels || []).includes("mp3") ||
    (v.file_path && v.file_path.toLowerCase().endsWith(".mp3")) ||
    (v.narration_url && !v.file_path);

  return (
    <>
      {!pageReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.bg,
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          {/* Animated logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: "-0.02em",
              }}
            >
              <span style={{ color: T.accent }}>VID</span>
              <span
                style={{
                  color: T.accentGreen,
                  fontSize: 14,
                  verticalAlign: "super",
                  marginLeft: 2,
                }}
              >
                AI
              </span>
            </div>
          </div>
          {/* Spinner */}
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `3px solid ${T.border}`,
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `3px solid transparent`,
                borderTopColor: T.accent,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
          <div
            style={{
              color: T.textFaint,
              fontSize: 11,
              letterSpacing: "0.18em",
            }}
          >
            LOADING DASHBOARD
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          height: "100vh",
          background: T.bg,
          color: T.text,
          fontFamily: "'DM Mono','Fira Code',monospace",
          overflow: "hidden",
          opacity: pageReady ? 1 : 0,
          transition: "opacity 0.3s ease, background 0.3s, color 0.3s",
        }}
      >
        {/* ── Global Loading Overlay ──────────────────────────────────────────── */}
        {globalLoading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              zIndex: 200,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${T.border}`,
                borderTop: `3px solid ${T.accent}`,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 13,
                letterSpacing: "0.1em",
                fontFamily: "'Syne',sans-serif",
              }}
            >
              {globalLoading}
            </div>
          </div>
        )}
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px;}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12px;letter-spacing:0.05em;color:${T.textDim};transition:all 0.15s;}
        .nav-item:hover{background:rgba(0,160,220,0.07);color:${T.textMid};}
        .nav-item.active{background:rgba(0,160,220,0.1);color:${T.accent};}
        .stat-card{background:${T.bgCard};border:1px solid ${T.border};border-radius:14px;padding:20px;transition:border-color 0.2s,box-shadow 0.2s;}
        .stat-card:hover{border-color:${T.borderHover};box-shadow:0 4px 20px rgba(0,120,200,0.08);}
        .video-row{background:${T.bgCard};border:1px solid ${T.border};border-radius:12px;padding:16px 20px;cursor:pointer;transition:all 0.15s;margin-bottom:8px;}
        .video-row:hover{background:${T.bgCardHover};border-color:${T.borderHover};transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,100,180,0.08);}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:10px;letter-spacing:0.06em;font-weight:500;white-space:nowrap;}
        .tag{display:inline-block;padding:2px 8px;border-radius:100px;font-size:9px;background:${T.inputBg};color:${T.textDim};border:1px solid ${T.border};margin:1px;letter-spacing:0.04em;flex-shrink:0;white-space:nowrap;}
        .tags-row{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:2px;scrollbar-width:none;}
        .tags-row::-webkit-scrollbar{display:none;}
        .btn-primary{background:linear-gradient(135deg,#0060bb,#00a8f0);border:none;color:white;padding:11px 22px;border-radius:9px;font-family:inherit;font-size:11px;letter-spacing:0.1em;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
        .btn-primary:hover:not(:disabled){opacity:0.85;transform:translateY(-1px);}
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Fluid liquid animations ── */
        /* ── Red fluid — dark crimson, subtle & pleasant ── */
        /* ── Blue fluid — deep navy, subtle & pleasant ── */
        /* ── Black fluid — near-black charcoal morphs ── */
        /* ── Aurora wave animations ── */
        /* Blue aurora */
        /* Dark/obsidian aurora */
        .btn-primary:disabled{opacity:0.35;cursor:not-allowed;transform:none;}
        .btn-sm{padding:5px 12px;border-radius:6px;font-family:inherit;font-size:10px;letter-spacing:0.06em;cursor:pointer;border:1px solid;transition:all 0.15s;}
        .filter-btn{padding:5px 14px;border-radius:6px;font-family:inherit;font-size:10px;letter-spacing:0.06em;border:1px solid ${T.border};background:transparent;color:${T.textDim};cursor:pointer;transition:all 0.15s;}
        .filter-btn.active{background:rgba(0,160,220,0.1);border-color:rgba(0,160,220,0.35);color:${T.accent};}
        .filter-btn:hover:not(.active){color:${T.textMid};border-color:${T.borderHover};}
        .prog-bar{height:2px;background:${T.border};border-radius:2px;overflow:hidden;}
        .prog-fill{height:100%;background:linear-gradient(90deg,#0070cc,#00e080);border-radius:2px;transition:width 0.6s ease;}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.65)}}
        .dot{width:6px;height:6px;border-radius:50%;animation:pulse 2s infinite;flex-shrink:0;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(12px);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;}
        .modal{background:${isDark ? "#060d18" : "#ffffff"};border:1px solid ${T.border};border-radius:18px;padding:28px;max-width:580px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.4);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .modal{animation:fadeUp 0.2s ease;}
        .textarea{width:100%;padding:12px 14px;background:${T.inputBg};border:1px solid ${T.border};border-radius:8px;color:${T.text};font-family:inherit;font-size:13px;resize:none;outline:none;transition:border-color 0.2s;line-height:1.6;}
        .textarea:focus{border-color:rgba(0,160,220,0.4);}
        .textarea::placeholder{color:${T.textFaint};}
        @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:10px;font-size:12px;letter-spacing:0.06em;z-index:100;animation:toastIn 0.2s ease;}
        .pipe-step{padding:5px 12px;border-radius:6px;font-size:10px;letter-spacing:0.05em;transition:all 0.3s;border:1px solid;display:flex;align-items:center;gap:5px;}
        .detail-row{display:flex;justify-content:space-between;padding:10px 14px;background:${T.inputBg};border-radius:8px;font-size:12px;margin-bottom:6px;border:1px solid ${T.border};}
        .theme-toggle{width:40px;height:22px;border-radius:11px;border:1px solid ${T.border};background:${T.bgCard};cursor:pointer;position:relative;transition:all 0.3s;flex-shrink:0;}
        .theme-knob{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:${T.accent};transition:all 0.3s;left:${isDark ? "2px" : "20px"};}
        .play-btn{width:48px;height:48px;border-radius:50%;background:rgba(0,180,255,0.15);border:2px solid rgba(0,180,255,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;font-size:16px;}
        .play-btn:hover{background:rgba(0,180,255,0.25);transform:scale(1.05);}
        video{border-radius:10px;width:100%;background:#000;outline:none;}
        .video-preview-modal{background:#000;border:1px solid ${T.border};border-radius:18px;padding:0;overflow:hidden;max-width:760px;width:100%;box-shadow:0 32px 100px rgba(0,0,0,0.8);}
        .video-preview-modal .modal-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;background:${isDark ? "rgba(0,0,0,0.8)" : "rgba(10,10,20,0.9)"};}

        /* ── Mobile responsive ── */
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content { margin-left: 0 !important; padding-bottom: 72px !important; }
          .content-area { padding: 12px !important; }
          .topbar { padding: 10px 12px !important; }
          /* videos */
          .stat-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .video-row { padding: 12px 14px !important; }
          .filter-bar { flex-wrap: wrap !important; gap: 6px !important; }
          .action-row { flex-wrap: wrap !important; gap: 6px !important; }
          .card-actions { flex-wrap: wrap !important; }
          /* modal */
          .modal { max-width: 100% !important; max-height: 95vh !important; padding: 18px !important; border-radius: 14px !important; }
          /* settings */
          .settings-columns { flex-direction: column !important; gap: 16px !important; }
          .settings-left { max-width: 100% !important; }
          .settings-right { width: 100% !important; position: static !important; }
          /* shorts */
          .shorts-layout { flex-direction: column !important; height: auto !important; }
          .shorts-left { width: 100% !important; height: auto !important; max-height: 380px !important; }
          .shorts-gen-grid { grid-template-columns: 1fr !important; }
          .shorts-tips-grid { grid-template-columns: 1fr 1fr !important; }
          /* analytics */
          .analytics-top-grid { grid-template-columns: 1fr 1fr !important; }
          .analytics-bar-grid { grid-template-columns: 1fr !important; }
          .analytics-perf-grid { flex-direction: column !important; }
          /* billing */
          .billing-grid { grid-template-columns: 1fr !important; }
          /* channel */
          .channel-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          /* script studio */
          .script-studio-layout { grid-template-columns: 1fr !important; }
          /* compile studio */
          .compile-layout { flex-direction: column !important; }
          .compile-video-grid { grid-template-columns: 1fr 1fr !important; }
          .compile-queue { width: 100% !important; position: static !important; }
        }
        @media (min-width: 769px) {
          .mobile-bottom-nav { display: none !important; }
          .sidebar-desktop { display: flex !important; }
        }
        .mobile-bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:${T.bgCard};border-top:1px solid ${T.border};display:none;justify-content:space-around;align-items:center;height:60px;padding:0 4px;}
        .mob-tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:9px;letter-spacing:0.05em;color:${T.textDim};transition:all 0.15s;border:none;background:transparent;flex:1;}
        .mob-tab.active{color:${T.accent};}
        .mob-tab-icon{font-size:18px;line-height:1;}
      `}</style>

        {/* ── Toast ──────────────────────────────────────────────────────────────── */}
        {toast && (
          <div
            className="toast"
            style={{
              background:
                toast.type === "error"
                  ? "rgba(200,40,60,0.12)"
                  : "rgba(0,192,112,0.1)",
              border: `1px solid ${toast.type === "error" ? "rgba(200,40,60,0.3)" : "rgba(0,192,112,0.25)"}`,
              color: toast.type === "error" ? "#e05070" : "#00c070",
            }}
          >
            {toast.type === "error" ? "⚠ " : "✓ "}
            {toast.msg}
          </div>
        )}

        {/* ── Notification Panel ──────────────────────────────────────────────────── */}
        {showNotifPanel && (
          <>
            <div onClick={() => setShowNotifPanel(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
            <div style={{
              position: "fixed", right: 0, top: 0, bottom: 0,
              width: 340, zIndex: 300,
              background: T.bgCard,
              borderLeft: `1px solid ${T.border}`,
              display: "flex", flexDirection: "column",
              boxShadow: "-6px 0 32px rgba(0,0,0,0.5)",
            }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1, letterSpacing: "0.04em" }}>🔔 Notifications</div>
                <button onClick={clearNotifications} style={{ fontSize: 9, color: T.textFaint, background: "none", cursor: "pointer", letterSpacing: "0.08em", padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.border}` }}>CLEAR ALL</button>
                <button onClick={() => setShowNotifPanel(false)} style={{ fontSize: 16, color: T.textFaint, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12, marginTop: 48 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🔕</div>
                    No notifications yet
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} style={{
                    padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                    background: n.type === "error" ? `${T.accentRed}10` : n.type === "warning" ? "rgba(224,144,0,0.08)" : "rgba(0,192,112,0.06)",
                    border: `1px solid ${n.type === "error" ? T.accentRed + "30" : n.type === "warning" ? "rgba(224,144,0,0.2)" : "rgba(0,192,112,0.15)"}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: n.type === "error" ? T.accentRed : n.type === "warning" ? "#e09000" : T.accentGreen }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{n.body}</div>}
                    <div style={{ fontSize: 9, color: T.textFaint, marginTop: 4, letterSpacing: "0.04em" }}>
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.textFaint, textAlign: "center" }}>
                Last {notifications.length} events · browser push enabled when tab is backgrounded
              </div>
            </div>
          </>
        )}

        {/* ── Sidebar ────────────────────────────────────────────────────────────── */}
        <div
          className="sidebar-desktop"
          style={{
            width: 220,
            background: T.bgSub,
            borderRight: `1px solid ${T.border}`,
            flexDirection: "column",
            padding: "20px 10px",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "4px 10px 20px",
              borderBottom: `1px solid ${T.border}`,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "-0.02em",
              }}
            >
              <span
                style={{
                  background: "linear-gradient(135deg,#00b4ff,#00e080)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AUTO
              </span>
              <span style={{ color: T.text }}>VID</span>
            </div>
            <div
              style={{
                fontSize: 9,
                color: T.textFaint,
                letterSpacing: "0.18em",
                marginTop: 2,
              }}
            >
              AI VIDEO ENGINE
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {[
              {
                id: "videos",
                icon: "▣",
                label: "Video Studio",
                count: videos.length,
              },
              { id: "script", icon: "✍", label: "Script Studio" },
              { id: "shorts", icon: "⚡", label: "Shorts Studio" },
              { id: "library", icon: "🗂", label: "Library" },
              { id: "channel", icon: "▶", label: "My Channel" },
              { id: "billing", icon: "◑", label: "Subscriptions" },
              { id: "analytics", icon: "◈", label: "Analytics" },
              { id: "compilations", icon: "🎬", label: "Compilations" },
              { id: "custom_content", icon: "📦", label: "Custom Content" },
              { id: "reviews", icon: "◈", label: "Reviews", count: pendingReviewCount },
              { id: "subscribers", icon: "🔐", label: "Subscribers" },
              { id: "editor", icon: "✂", label: "Video Editor" },
              { id: "stickfigures", icon: "🕹", label: "Stickfigures" },
              { id: "settings", icon: "◎", label: "Settings" },
            ].map((n) => (
              <div
                key={n.id}
                className={`nav-item ${tab === n.id ? "active" : ""}`}
                onClick={() => switchTab(n.id)}
              >
                <span style={{ fontSize: 13 }}>{n.icon}</span>
                <span>{n.label}</span>
                {n.count !== undefined && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "rgba(0,160,220,0.12)",
                      color: T.accent,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 10,
                    }}
                  >
                    {n.count}
                  </span>
                )}
              </div>
            ))}
            <LegalNavDropdown T={T} />
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: T.textFaint,
                transition: "background 0.15s, color 0.15s",
              }}
              onClick={() => window.open("/docs", "_blank")}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,180,255,0.06)"; e.currentTarget.style.color = T.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textFaint; }}
            >
              <span style={{ fontSize: 13 }}>📖</span>
              <span>Docs &amp; API</span>
              <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.5 }}>↗</span>
            </div>
            {/* Danger Zone — subtle, red-tinted */}
            <div
              style={{
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "rgba(180,30,30,0.5)",
                transition: "background 0.15s, color 0.15s",
                borderTop: `1px solid rgba(200,0,30,0.1)`,
              }}
              onClick={() => setShowDangerZone(true)}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,0,30,0.06)"; e.currentTarget.style.color = "#ff4040"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(180,30,30,0.5)"; }}
              title="Admin — destructive operations"
            >
              <span style={{ fontSize: 13 }}>☠</span>
              <span style={{ fontSize: 11, letterSpacing: "0.06em" }}>Danger Zone</span>
            </div>
          </nav>

          {quota.uploads_remaining !== undefined && (
            <div
              style={{
                padding: "10px 8px",
                borderTop: `1px solid ${T.border}`,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: T.textFaint,
                  letterSpacing: "0.1em",
                  marginBottom: 5,
                }}
              >
                YOUTUBE QUOTA
              </div>
              <div
                style={{
                  fontSize: 12,
                  color:
                    quota.uploads_remaining > 1 ? T.accentGreen : T.accentRed,
                  marginBottom: 4,
                }}
              >
                {quota.uploads_remaining} uploads left
              </div>
              <div className="prog-bar">
                <div
                  className="prog-fill"
                  style={{
                    width: `${((6 - quota.uploads_remaining) / 6) * 100}%`,
                    background:
                      quota.uploads_remaining > 2
                        ? "linear-gradient(90deg,#0070cc,#00e080)"
                        : T.accentRed,
                  }}
                />
              </div>
            </div>
          )}

          <div
            style={{ padding: "12px 8px", borderTop: `1px solid ${T.border}` }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg,#0060bb,#00a8f0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {user?.email?.[0]?.toUpperCase() || "S"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMid,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.email}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: T.textFaint,
                    letterSpacing: "0.1em",
                  }}
                >
                  SUPERUSER
                </div>
              </div>
            </div>
            <div
              onClick={handleLogout}
              style={{
                fontSize: 10,
                color: T.accentRed,
                cursor: "pointer",
                letterSpacing: "0.08em",
                padding: "7px 12px",
                borderRadius: 7,
                transition: "all 0.15s",
                border: `1px solid ${T.accentRed}30`,
                background: `${T.accentRed}08`,
                textAlign: "center",
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${T.accentRed}18`;
                e.currentTarget.style.borderColor = `${T.accentRed}60`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${T.accentRed}08`;
                e.currentTarget.style.borderColor = `${T.accentRed}30`;
              }}
            >
              ← LOGOUT
            </div>
          </div>
        </div>

        {/* ── Main ───────────────────────────────────────────────────────────────── */}
        <div
          className="main-content"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Top bar */}
          <div
            className="topbar"
            style={{
              padding: "12px 24px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              background: T.topBar,
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: T.textMid,
              }}
            >
              {tab === "videos"
                ? "Video Studio"
                : tab === "script"
                ? "Script Studio"
                : tab === "shorts"
                ? "Shorts Studio"
                : tab === "library"
                ? "Library"
                : tab === "channel"
                ? "My Channel"
                : tab === "billing"
                ? "Subscriptions & Quotas"
                : tab === "compilations"
                ? "Compilations"
                : tab === "analytics"
                ? "Analytics"
                : tab === "reviews"
                ? "Reviews"
                : tab === "editor"
                ? "Video Editor"
                : tab === "stickfigures"
                ? "Stickfigure Manager"
                : tab === "custom_content"
                ? "Custom Content"
                : "Settings"}
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div className="dot" style={{ background: T.accentGreen }} />
              <span
                style={{
                  fontSize: 10,
                  color: T.textFaint,
                  letterSpacing: "0.1em",
                }}
              >
                ONLINE
              </span>

              {/* Notification bell */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setShowNotifPanel(p => !p); if (!showNotifPanel) markAllRead(); }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px solid ${unreadCount > 0 ? T.accent + "60" : T.border}`,
                    background: unreadCount > 0 ? `${T.accent}10` : "transparent",
                    color: unreadCount > 0 ? T.accent : T.textDim,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  title="Notifications"
                >
                  🔔
                </button>
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    background: T.accentRed, color: "#fff",
                    fontSize: 8, fontWeight: 700,
                    borderRadius: 10, padding: "1px 4px",
                    minWidth: 14, textAlign: "center",
                    pointerEvents: "none",
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textDim,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↺
              </button>
              <button
                onClick={async () => {
                  try {
                    await clearCache();
                    window.location.reload();
                  } catch (e) {
                    window.location.reload();
                  }
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textDim,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.06em",
                }}
              >
                ⊗ CLEAR
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${T.accentGreen}40`,
                  background: `${T.accentGreen}0a`,
                  color: T.accentGreen,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.06em",
                  opacity: syncing ? 0.5 : 1,
                }}
              >
                {syncing ? "⟳ SYNCING..." : "⟳ SYNC YT"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="content-area" style={{ flex: 1, overflow: "auto", padding: 24, position: "relative" }}>
            {/* Tab loading overlay */}
            {tabLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(8,8,16,0.72)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 12,
                  pointerEvents: "all",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "4px solid rgba(255,255,255,0.08)",
                    borderTopColor: "#00a0dc",
                    animation: "tabSpinner 0.7s linear infinite",
                  }}
                />
              </div>
            )}
            {/* ── VIDEOS TAB ──────────────────────────────────────────────────────── */}
            {tab === "videos" && (
              <>
                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5,1fr)",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {!pageReady ? (
                    [0,1,2,3,4].map(i => (
                      <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", height: 80 }}>
                        <div className="skeleton-loader" style={{ width: "40%", height: 10, borderRadius: 4, marginBottom: 10 }} />
                        <div className="skeleton-loader" style={{ width: "60%", height: 22, borderRadius: 4 }} />
                      </div>
                    ))
                  ) : (
                    [
                      {
                        label: "TOTAL VIDEOS",
                        value: stats?.total || videos.length,
                        color: T.accent,
                        icon: "▣",
                      },
                      {
                        label: "LIVE ON YT",
                        value: videos.filter((v) => v.status === "posted").length,
                        color: T.accentGreen,
                        icon: "▶",
                      },
                      {
                        label: "LIVE ON TT",
                        value: videos.filter((v) => v.tiktok_status === "posted").length,
                        color: "#ff2d55",
                        icon: "♪",
                      },
                      {
                        label: "TOTAL VIEWS",
                        value: fmtNum(stats?.total_views ?? videos.reduce((s, v) => s + (v.views_count || 0), 0)),
                        color: T.accentYellow,
                        icon: "◉",
                      },
                      {
                        label: "TOTAL LIKES",
                        value: fmtNum(stats?.total_likes ?? videos.reduce((s, v) => s + (v.likes_count || 0), 0)),
                        color: "#e060a0",
                        icon: "♥",
                      },
                    ].map((s) => (
                      <div key={s.label} className="stat-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.12em",
                            }}
                          >
                            {s.label}
                          </div>
                          <span style={{ color: s.color, fontSize: 14 }}>
                            {s.icon}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "'Syne',sans-serif",
                            fontSize: 30,
                            fontWeight: 800,
                            color: s.color,
                          }}
                        >
                          {s.value}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Generate box */}
                <div
                  style={{
                    background: isDark
                      ? "rgba(0,80,160,0.05)"
                      : "rgba(0,100,200,0.04)",
                    border: `1px solid ${isDark ? "rgba(0,140,220,0.14)" : "rgba(0,100,200,0.15)"}`,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: T.accent,
                      letterSpacing: "0.1em",
                      fontWeight: 500,
                      marginBottom: 12,
                    }}
                  >
                    ⚡ GENERATE NEW VIDEO
                  </div>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
                  >
                    <textarea
                      className="textarea"
                      rows={2}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          handleGenerate();
                      }}
                      placeholder="Describe your video idea... e.g. 'A cat explains quantum physics but keeps getting distracted'"
                      disabled={generating}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleGenerate}
                      disabled={generating || !prompt.trim()}
                    >
                      {generating ? "⚙ RUNNING..." : "▶ GENERATE"}
                    </button>
                  </div>
                  {/* Profile selector */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        id: "educational",
                        label: "🧠 Educational",
                        desc: "Essay-style explainer",
                      },
                      {
                        id: "serious",
                        label: "🎯 Serious",
                        desc: "Documentary / weighty",
                      },
                      {
                        id: "inspirational",
                        label: "🔥 Inspirational",
                        desc: "Emotional storytelling",
                      },
                      {
                        id: "reflective",
                        label: "🌊 Reflective",
                        desc: "Philosophical / deep",
                      },
                      {
                        id: "funny",
                        label: "😄 Funny",
                        desc: "Humour with insight",
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProfile(p.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 7,
                          border: `1px solid ${profile === p.id ? T.accent + "80" : T.border}`,
                          background:
                            profile === p.id ? `${T.accent}15` : "transparent",
                          color: profile === p.id ? T.accent : T.textMid,
                          fontSize: 10,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.06em",
                          transition: "all 0.15s",
                        }}
                        title={p.desc}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Ambience grid */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 7 }}>
                      AMBIENCE
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {AMBIENCE_OPTIONS.map((a) => (
                        <button key={a.id} onClick={() => setVisualMood(a.id)} disabled={generating}
                          style={{
                            padding: "8px 10px", borderRadius: 8, cursor: generating ? "not-allowed" : "pointer",
                            textAlign: "left",
                            border: `2px solid ${visualMood === a.id ? T.accent : T.border}`,
                            background: visualMood === a.id ? `${T.accent}18` : T.inputBg,
                            color: T.text, fontFamily: "inherit",
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700 }}>{a.emoji} {a.label}</div>
                          <div style={{ fontSize: 10, color: T.textDim }}>{a.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Music style */}
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                        marginBottom: 7,
                      }}
                    >
                      BACKGROUND MUSIC
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {[
                        { id: "Birds_Atmosphere_Piano", label: "🌙 Birds & Piano",  desc: "Birds atmosphere + piano" },
                        { id: "Birds_Atmosphere_Wing",  label: "🍃 Birds & Wing",   desc: "Birds atmosphere + wing pads" },
                        { id: "Laidback_Fevorite",      label: "🎹 Laidback Fav",   desc: "Smooth laidback favourite" },
                        { id: "Pads_EPiano",            label: "🎧 Pads & EPiano",  desc: "Deep smooth pads + e-piano" },
                        { id: "Pads",                   label: "🎵 Pads",           desc: "Chill heavy pads" },
                        { id: "none",                   label: "🔇 None",           desc: "Voice only" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMusicStyle(m.id)}
                          disabled={generating}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: `1px solid ${musicStyle === m.id ? T.accentGreen + "80" : T.border}`,
                            background:
                              musicStyle === m.id
                                ? `${T.accentGreen}10`
                                : "transparent",
                            color:
                              musicStyle === m.id ? T.accentGreen : T.textFaint,
                            fontSize: 9,
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                          title={m.desc}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {/* Music volume */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", flexShrink: 0 }}>VOL</div>
                      <input
                        type="range" min={0} max={0.5} step={0.01}
                        value={musicVolume}
                        onChange={e => setMusicVolume(parseFloat(e.target.value))}
                        disabled={generating}
                        style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
                      />
                      <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>
                        {Math.round(musicVolume * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* ── Stickfigure toggle ── */}
                  <div style={{ marginTop: 12, padding: "10px 14px", background: useStickfigures ? `${T.accentPurple}10` : T.bg, border: `1px solid ${useStickfigures ? T.accentPurple + "50" : T.border}`, borderRadius: 10, transition: "all 0.2s" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={useStickfigures}
                        onChange={e => {
                          const on = e.target.checked;
                          setUseStickfigures(on);
                          if (on && sfClipCount === 0) {
                            addNotification("No Stickfigures in DB", "Upload clips in the Stickfigures tab before generating with this mode.", "error");
                            showToast("No stickfigures in DB — add clips first", "error");
                          }
                        }}
                        style={{ accentColor: T.accentPurple, width: 14, height: 14 }}
                      />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: useStickfigures ? T.accentPurple : T.textMid, letterSpacing: "0.04em" }}>
                          🕹 USE STICKFIGURES
                        </div>
                        <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                          {useStickfigures
                            ? `Rain background + auto-matched overlays — ${sfClipCount ?? "?"} clips in DB`
                            : "Use animated stickfigure overlays instead of stock footage"}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div
                    style={{ fontSize: 10, color: T.textFaint, marginTop: 8 }}
                  >
                    Ctrl+Enter to generate · ~3 min pipeline · Auto-saves to
                    Supabase
                  </div>

                  {genError && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "rgba(200,40,60,0.06)",
                        border: `1px solid rgba(200,40,60,0.18)`,
                        borderRadius: 7,
                        fontSize: 11,
                        color: T.accentRed,
                      }}
                    >
                      ⚠ {genError}
                    </div>
                  )}

                  {generating && (
                    <div
                      style={{
                        marginTop: 14,
                        background: T.bgCard,
                        border: `1px solid ${T.border}`,
                        borderRadius: 12,
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          letterSpacing: "0.1em",
                          marginBottom: 14,
                        }}
                      >
                        PIPELINE PROGRESS
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 0,
                          alignItems: "center",
                        }}
                      >
                        {STEPS.map((s, i) => {
                          const done = i < pipeStep - 1,
                            active = i === pipeStep - 1;
                          return (
                            <div
                              key={s}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                flex: 1,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {active && (
                                    <>
                                      <div
                                        style={{
                                          position: "absolute",
                                          borderRadius: "50%",
                                          width: 36,
                                          height: 36,
                                          border: `2px solid ${T.accent}`,
                                          animation:
                                            "ringPulse 1.4s ease-out infinite",
                                          opacity: 0,
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          borderRadius: "50%",
                                          width: 44,
                                          height: 44,
                                          border: `1.5px solid ${T.accent}`,
                                          animation:
                                            "ringPulse 1.4s ease-out infinite 0.4s",
                                          opacity: 0,
                                        }}
                                      />
                                    </>
                                  )}
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: done
                                        ? T.accentGreen
                                        : active
                                          ? T.accent
                                          : T.bgDeep,
                                      color:
                                        done || active ? "white" : T.textFaint,
                                      border: active
                                        ? `2px solid ${T.accent}`
                                        : "none",
                                      transition: "all 0.4s",
                                      boxShadow: active
                                        ? `0 0 16px ${T.accent}80`
                                        : "none",
                                      zIndex: 1,
                                    }}
                                  >
                                    {done ? "✓" : i + 1}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: active
                                      ? T.accent
                                      : done
                                        ? T.accentGreen
                                        : T.textFaint,
                                    letterSpacing: "0.08em",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {s.toUpperCase()}
                                </div>
                              </div>
                              {i < STEPS.length - 1 && (
                                <div
                                  style={{
                                    flex: 1,
                                    height: 2,
                                    background: done ? T.accentGreen : T.border,
                                    margin: "0 4px",
                                    marginBottom: 22,
                                    transition: "background 0.4s",
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div
                        style={{
                          marginTop: 14,
                          fontSize: 11,
                          color: T.textMid,
                          textAlign: "center",
                        }}
                      >
                        {pipeStep === 1 &&
                          "📝 Generating script from prompt..."}
                        {pipeStep === 2 && "🎙 Synthesizing voice narration..."}
                        {pipeStep === 3 && "📐 Aligning segments..."}
                        {pipeStep === 4 && "🎬 Fetching stock footage..."}
                        {pipeStep === 5 && "⚙ Assembling video..."}
                        {pipeStep === 6 && "🎵 Burning captions..."}
                        {pipeStep === 7 && "✅ Done! Loading preview..."}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 16,
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => setShowGenLogs(p => !p)}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 7,
                            border: `1px solid ${T.border}`,
                            background: "transparent",
                            color: T.textMid,
                            fontSize: 10,
                            fontFamily: "inherit",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                          }}
                        >
                          {showGenLogs ? "▲ HIDE LOGS" : "📋 VIEW LOGS"}
                        </button>
                        <button
                          onClick={handleGenCancel}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 7,
                            border: `1px solid ${T.accentRed}50`,
                            background: `${T.accentRed}10`,
                            color: T.accentRed,
                            fontSize: 10,
                            fontFamily: "inherit",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                          }}
                        >
                          🛑 CANCEL
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline pipeline logs */}
                  {(showGenLogs || generating) && genLogs.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      background: isDark ? "#08090e" : "#f0f2f5",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}>
                      <div
                        onClick={() => setShowGenLogs(p => !p)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 14px",
                          cursor: "pointer",
                          borderBottom: showGenLogs ? `1px solid ${T.border}` : "none",
                        }}
                      >
                        <span style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                          📋 PIPELINE LOGS ({genLogs.length} lines)
                        </span>
                        <span style={{ fontSize: 11, color: T.textFaint }}>{showGenLogs ? "▲" : "▼"}</span>
                      </div>
                      {showGenLogs && (
                        <div style={{
                          maxHeight: 200,
                          overflowY: "auto",
                          padding: "10px 14px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          lineHeight: 1.7,
                        }}>
                          {genLogs.slice(-50).map((line, i) => (
                            <div key={i} style={{
                              color: line.startsWith("[ERROR]") ? "#ff6060"
                                : line.startsWith("[DONE]") ? "#60ff60"
                                : isDark ? "#a0d0a0" : "#2d5a2d",
                            }}>
                              {line}
                            </div>
                          ))}
                          <div ref={genLogsEndRef} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Sticky filter panel + scrollable list ── */}
                <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", background: "inherit" }}>

                {/* Search */}
                <div style={{ marginBottom: 10, position: "relative", flexShrink: 0 }}>
                  <input
                    value={videoSearch}
                    onChange={e => setVideoSearch(e.target.value)}
                    placeholder="Search videos by title or prompt..."
                    style={{
                      width: "100%", padding: "7px 10px 7px 30px",
                      borderRadius: 8, border: `1px solid ${T.border}`,
                      background: T.inputBg, color: T.text,
                      fontSize: 12, fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: T.textFaint, pointerEvents: "none" }}>🔍</span>
                  {videoSearch && (
                    <button onClick={() => setVideoSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 13 }}>✕</button>
                  )}
                </div>

                {/* Filters */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.12em",
                      marginRight: 4,
                    }}
                  >
                    FILTER
                  </span>
                  {["all", "posted", "ready", "generating"].map((f) => (
                    <button
                      key={f}
                      className={`filter-btn ${filter === f ? "active" : ""}`}
                      onClick={() => setFilter(f)}
                    >
                      {f.toUpperCase()}
                      {f !== "all" && (
                        <span style={{ marginLeft: 5, opacity: 0.5 }}>
                          {videos.filter((v) => v.status === f).length}
                        </span>
                      )}
                    </button>
                  ))}
                  {/* Failed filter — separated */}
                  <span style={{ width: 1, height: 16, background: T.border, alignSelf: "center", flexShrink: 0 }} />
                  <button
                    className={`filter-btn ${filter === "failed" ? "active" : ""}`}
                    onClick={() => setFilter("failed")}
                    style={filter === "failed"
                      ? { background: "rgba(200,40,60,0.12)", borderColor: "rgba(200,40,60,0.35)", color: T.accentRed }
                      : { color: T.accentRed, borderColor: "rgba(200,40,60,0.18)" }}
                  >
                    ✕ FAILED
                    <span style={{ marginLeft: 5, opacity: 0.6 }}>
                      {videos.filter((v) => v.status === "failed").length}
                    </span>
                  </button>
                  {/* Type separator */}
                  <span style={{ width: 1, height: 16, background: T.border, alignSelf: "center", flexShrink: 0 }} />
                  <button
                    className={`filter-btn ${filter === "mp4" ? "active" : ""}`}
                    onClick={() => setFilter("mp4")}
                    style={filter === "mp4" ? { background: "rgba(0,160,220,0.1)", borderColor: "rgba(0,160,220,0.35)", color: T.accent } : {}}
                  >
                    ▶ MP4
                    <span style={{ marginLeft: 5, opacity: 0.5 }}>
                      {videos.filter((v) => !!v.file_path).length}
                    </span>
                  </button>
                  <button
                    className={`filter-btn ${filter === "mp3" ? "active" : ""}`}
                    onClick={() => setFilter("mp3")}
                    style={filter === "mp3" ? { background: "rgba(29,185,84,0.1)", borderColor: "rgba(29,185,84,0.35)", color: "#1db954" } : {}}
                  >
                    ♪ MP3
                    <span style={{ marginLeft: 5, opacity: 0.5 }}>
                      {videos.filter((v) => !!v.narration_url && v.resolution !== "1080x1920").length}
                    </span>
                  </button>
                  <button
                    className={`filter-btn ${filter === "shorts" ? "active" : ""}`}
                    onClick={() => setFilter("shorts")}
                    style={filter === "shorts" ? { background: "rgba(150,80,255,0.12)", borderColor: "rgba(150,80,255,0.4)", color: "#a855f7" } : { color: "#a855f7", borderColor: "rgba(150,80,255,0.2)" }}
                  >
                    📱 SHORTS
                    <span style={{ marginLeft: 5, opacity: 0.6 }}>
                      {videos.filter((v) => v.resolution === "1080x1920").length}
                    </span>
                  </button>
                  <span style={{ width: 1, height: 16, background: T.border, alignSelf: "center", flexShrink: 0 }} />
                  <button
                    className={`filter-btn ${filter === "archived" ? "active" : ""}`}
                    onClick={() => setFilter("archived")}
                    style={filter === "archived"
                      ? { background: "rgba(120,80,200,0.12)", borderColor: "rgba(120,80,200,0.4)", color: "#a070e8" }
                      : { color: "#8060c0", borderColor: "rgba(120,80,200,0.18)" }}
                  >
                    📦 ARCHIVED
                  </button>
                  <button
                    className={`filter-btn ${filter === "exclusive" ? "active" : ""}`}
                    onClick={() => setFilter("exclusive")}
                    style={filter === "exclusive"
                      ? { background: "rgba(61,214,140,0.1)", borderColor: "rgba(61,214,140,0.4)", color: "#3dd68c" }
                      : { color: "#3dd68c", borderColor: "rgba(61,214,140,0.2)" }}
                  >
                    🔐 EXCLUSIVE
                    <span style={{ marginLeft: 5, opacity: 0.6 }}>
                      {videos.filter(v => !!v.is_exclusive).length}
                    </span>
                  </button>
                </div>

                {/* Video list */}
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
                {!pageReady && videos.length === 0 ? (
                  [0,1,2,3].map(i => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", marginBottom: 8, background: T.bgCard, borderRadius: 10, border: `1px solid ${T.border}` }}>
                      <div className="skeleton-loader" style={{ width: 96, height: 54, borderRadius: 8, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton-loader" style={{ width: "55%", height: 13, borderRadius: 4, marginBottom: 8 }} />
                        <div className="skeleton-loader" style={{ width: "30%", height: 10, borderRadius: 4 }} />
                      </div>
                      <div className="skeleton-loader" style={{ width: 60, height: 22, borderRadius: 20 }} />
                    </div>
                  ))
                ) : (filter === "archived" && archivedLoading) ? (
                  <div style={{ textAlign: "center", padding: 60, color: T.textFaint, fontSize: 12, letterSpacing: "0.1em" }}>
                    LOADING ARCHIVED ITEMS...
                  </div>
                ) : (filter === "archived" ? archivedVideos : filtered).length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 60,
                      color: T.textFaint,
                      fontSize: 12,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {filter === "all"
                      ? "NO VIDEOS YET — GENERATE YOUR FIRST VIDEO ABOVE"
                      : filter === "mp4"
                      ? "NO MP4 FILES READY YET"
                      : filter === "mp3"
                      ? "NO MP3 FILES YET — GENERATED VIA PODCAST PIPELINE"
                      : filter === "shorts"
                      ? "NO SHORTS YET — CREATE SHORTS FROM EXISTING VIDEOS"
                      : filter === "archived"
                      ? "NO ARCHIVED ITEMS"
                      : `NO ${filter.toUpperCase()} VIDEOS`}
                  </div>
                ) : (
                  (filter === "archived" ? archivedVideos : filtered).slice(0, visibleCount).map((v) => {
                    const s = sc(v.status);
                    const vUrl = getVideoUrl(v.file_path);
                    const isArchived = filter === "archived";
                    return (
                      <div
                        key={v.id}
                        className="video-row"
                        onClick={() => !isArchived && setSelected(v)}
                        style={isArchived ? { opacity: 0.75, cursor: "default" } : {}}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          {/* Thumbnail / play button */}
                          <div
                            style={{
                              width: 96,
                              height: 54,
                              borderRadius: 8,
                              background: isPodcast(v)
                                ? "linear-gradient(135deg,rgba(29,185,84,0.12),rgba(0,0,0,0.15))"
                                : `linear-gradient(135deg,${s.color}18,rgba(0,0,0,0.15))`,
                              border: isPodcast(v)
                                ? "1px solid rgba(29,185,84,0.28)"
                                : `1px solid ${s.color}28`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {vUrl ? (
                              // Supabase URL — fully playable video
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreview(v);
                                }}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(0,0,0,0.3)",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  transition: "background 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(0,0,0,0.55)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(0,0,0,0.3)")
                                }
                              >
                                <span
                                  style={{
                                    fontSize: 22,
                                    color: "white",
                                    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                                  }}
                                >
                                  ▶
                                </span>
                              </div>
                            ) : isPodcast(v) && !IN_PROGRESS.includes(v.status) && v.status !== "failed" ? (
                              // Audio-only — MP3 play button
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreview(v);
                                }}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(29,185,84,0.15)",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  transition: "background 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(29,185,84,0.3)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(29,185,84,0.15)")
                                }
                              >
                                <span
                                  style={{
                                    fontSize: 20,
                                    color: "#1db954",
                                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                                  }}
                                >
                                  🎙
                                </span>
                              </div>
                            ) : IN_PROGRESS.includes(v.status) ? (
                              <span style={{ fontSize: 18, opacity: 0.45 }}>
                                ⚙
                              </span>
                            ) : v.status === "failed" ? (
                              <span style={{ fontSize: 18, opacity: 0.45 }}>
                                ✕
                              </span>
                            ) : (
                              // ready/posted but no storage URL — greyed play, non-clickable
                              <span
                                style={{ fontSize: 22, opacity: 0.2 }}
                                title="No preview — this video was generated before storage was set up. New videos will have preview."
                              >
                                ▶
                              </span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "'Syne',sans-serif",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: T.text,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {v.title || (v.status === "failed" ? "" : "Processing...")}
                              </div>
                              <div
                                className="pill"
                                style={{
                                  background: s.bg,
                                  color: s.color,
                                  flexShrink: 0,
                                }}
                              >
                                <div
                                  className="dot"
                                  style={{
                                    background: s.pulse,
                                    width: 5,
                                    height: 5,
                                  }}
                                />
                                {s.label}
                              </div>
                              {v.podbean_episode_id && (
                                <span style={{
                                  fontSize: 8, letterSpacing: "0.07em",
                                  color: "#f26522",
                                  background: "rgba(242,101,34,0.1)",
                                  border: "1px solid rgba(242,101,34,0.25)",
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  flexShrink: 0,
                                  lineHeight: 1.5,
                                }}>🎙 PODBEAN</span>
                              )}
                              {/* VIEW LOGS button — visible on all in-progress cards */}
                              {IN_PROGRESS.includes(v.status) && (
                                <button
                                  className="btn-sm"
                                  onClick={(e) => startCardLogs(v.id, e)}
                                  style={{
                                    color: cardLogsVideoId === v.id ? T.accent : T.textFaint,
                                    borderColor: cardLogsVideoId === v.id ? `${T.accent}50` : `${T.border}`,
                                    background: cardLogsVideoId === v.id ? `${T.accent}12` : "transparent",
                                    flexShrink: 0,
                                    fontSize: 9,
                                  }}
                                >
                                  {cardLogsVideoId === v.id ? "▼ LOGS" : "▶ LOGS"}
                                </button>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textDim,
                                marginBottom: 5,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {v.prompt}
                            </div>
                            <div className="tags-row">
                              {(v.labels || []).map((l) => (
                                <span key={l} className="tag">
                                  {l}
                                </span>
                              ))}
                              {v.category && (
                                <span
                                  className="tag"
                                  style={{
                                    color: T.accent,
                                    borderColor: `${T.accent}30`,
                                  }}
                                >
                                  #{v.category}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right stats */}
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            {v.status === "posted" && (
                              <>
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontFamily: "'Syne',sans-serif",
                                      fontWeight: 700,
                                      color: T.accentYellow,
                                      fontSize: 14,
                                    }}
                                  >
                                    {fmtNum(v.views_count)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textFaint,
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    VIEWS
                                  </div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontFamily: "'Syne',sans-serif",
                                      fontWeight: 700,
                                      color: "#e060a0",
                                      fontSize: 14,
                                    }}
                                  >
                                    {fmtNum(v.likes_count)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textFaint,
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    LIKES
                                  </div>
                                </div>
                              </>
                            )}
                            {v.duration_seconds && (
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontWeight: 600,
                                    color: T.textMid,
                                    fontSize: 13,
                                  }}
                                >
                                  {fmtDur(v.duration_seconds)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: T.textFaint,
                                    letterSpacing: "0.08em",
                                  }}
                                >
                                  LENGTH
                                </div>
                              </div>
                            )}
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: T.textDim }}>
                                {timeAgo(v.created_at)}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textFaint,
                                  letterSpacing: "0.08em",
                                }}
                              >
                                CREATED
                              </div>
                            </div>
                            {/* Archive / Unarchive button */}
                            {isArchived ? (
                              <button
                                className="btn-sm"
                                onClick={(e) => handleUnarchive(v.id, e)}
                                title="Restore from archive"
                                style={{
                                  color: "#a070e8",
                                  borderColor: "rgba(120,80,200,0.3)",
                                  background: "rgba(120,80,200,0.08)",
                                  fontSize: 9,
                                }}
                              >
                                ↩ RESTORE
                              </button>
                            ) : (
                              <button
                                className="btn-sm"
                                onClick={(e) => handleArchive(v.id, e)}
                                title="Archive this video"
                                style={{
                                  color: T.textFaint,
                                  borderColor: T.border,
                                  background: "transparent",
                                  fontSize: 9,
                                }}
                              >
                                📦
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── Inline live log panel (for in-progress cards) ─────── */}
                        {cardLogsVideoId === v.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              marginTop: 10,
                              background: T.bgDeep,
                              border: `1px solid ${T.accent}22`,
                              borderRadius: 8,
                              padding: "10px 12px",
                              maxHeight: 200,
                              overflowY: "auto",
                              fontFamily: "'DM Mono',monospace",
                              fontSize: 10,
                              lineHeight: 1.6,
                              color: T.textDim,
                            }}
                          >
                            {cardLogsLines.length === 0 ? (
                              <span style={{ color: T.textFaint, letterSpacing: "0.08em" }}>
                                ⟳ Waiting for logs...
                              </span>
                            ) : (
                              cardLogsLines.map((line, i) => (
                                <div key={i} style={{
                                  color: line.startsWith("✅") || line.startsWith("[DONE]") ? T.accentGreen
                                       : line.startsWith("❌") || line.startsWith("[ERROR]") ? T.accentRed
                                       : line.startsWith("⚠") ? T.accentYellow
                                       : T.textDim,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}>
                                  {line}
                                </div>
                              ))
                            )}
                            <div ref={cardLogsEndRef} />
                          </div>
                        )}

                        {v.error_message && (v.status === "failed" || v.status === "ready") && (
                          <div
                            style={{
                              marginTop: 6,
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              title={v.error_message.split("\n")[0]}
                              style={{ fontSize: 9, color: T.accentRed, opacity: 0.7, cursor: "help" }}
                            >
                              ⚠ error logged to notifications
                            </span>
                            {v.status === "failed" && (
                              isStructuralError(v.error_message) ? (
                                <button
                                  className="btn-sm"
                                  onClick={(e) => handlePurge(v.id, e)}
                                  style={{
                                    color: T.accentRed,
                                    borderColor: "rgba(200,40,60,0.25)",
                                    background: "rgba(200,40,60,0.07)",
                                    flexShrink: 0,
                                  }}
                                >
                                  PURGE
                                </button>
                              ) : (
                                <button
                                  className="btn-sm"
                                  onClick={(e) => handleRetry(v.id, e)}
                                  style={{
                                    color: T.accentRed,
                                    borderColor: "rgba(200,40,60,0.25)",
                                    background: "rgba(200,40,60,0.07)",
                                    flexShrink: 0,
                                  }}
                                >
                                  RETRY
                                </button>
                              )
                            )}
                            {v.status === "ready" && v.file_path && (
                              <button
                                className="btn-sm"
                                onClick={(e) => handleRetryUpload(v.id, e)}
                                style={{
                                  color: T.accentYellow,
                                  borderColor: `${T.accentYellow}40`,
                                  background: `${T.accentYellow}0d`,
                                  flexShrink: 0,
                                }}
                              >
                                RETRY UPLOAD
                              </button>
                            )}
                          </div>
                        )}

                        {/* ── Inline Comments Panel ─────────────────────────────── */}
                        {openComments === v.id && v.status === "posted" && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginTop: 12,
                              borderTop: `1px solid ${T.border}`,
                              paddingTop: 14,
                            }}
                          >
                            {/* Post new comment */}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginBottom: 14,
                              }}
                            >
                              <input
                                value={cardCommentText}
                                onChange={(e) =>
                                  setCardCommentText(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  !e.shiftKey &&
                                  handleCardPostComment(v.id)
                                }
                                placeholder="Add a comment..."
                                maxLength={500}
                                style={{
                                  flex: 1,
                                  background: T.bgDeep,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  color: T.text,
                                  fontSize: 11,
                                  fontFamily: "inherit",
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => handleCardPostComment(v.id)}
                                disabled={
                                  postingCardComment || !cardCommentText.trim()
                                }
                                style={{
                                  padding: "8px 14px",
                                  background: postingCardComment
                                    ? "transparent"
                                    : T.accent,
                                  border: `1px solid ${T.accent}40`,
                                  borderRadius: 8,
                                  color: postingCardComment
                                    ? T.textFaint
                                    : "white",
                                  fontSize: 10,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  letterSpacing: "0.08em",
                                  flexShrink: 0,
                                }}
                              >
                                {postingCardComment ? "⟳" : "↑ POST"}
                              </button>
                            </div>

                            {/* Comments list */}
                            {commentsLoading && !cardComments[v.id] ? (
                              <div
                                style={{
                                  textAlign: "center",
                                  color: T.textFaint,
                                  fontSize: 11,
                                  padding: 16,
                                }}
                              >
                                ⟳ Loading comments...
                              </div>
                            ) : (cardComments[v.id] || []).length === 0 ? (
                              <div
                                style={{
                                  textAlign: "center",
                                  color: T.textFaint,
                                  fontSize: 11,
                                  padding: 16,
                                }}
                              >
                                No comments yet
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 10,
                                  maxHeight: 400,
                                  overflowY: "auto",
                                }}
                              >
                                {(cardComments[v.id] || []).map((c) => (
                                  <div
                                    key={c.id}
                                    style={{
                                      background: T.bgDeep,
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                      border: `1px solid ${T.border}`,
                                    }}
                                  >
                                    {/* Comment header */}
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 6,
                                      }}
                                    >
                                      <img
                                        src={getCommentAvatar(
                                          c.author_image,
                                          c.author,
                                        )}
                                        style={{
                                          width: 26,
                                          height: 26,
                                          borderRadius: "50%",
                                          flexShrink: 0,
                                          objectFit: "cover",
                                        }}
                                        alt=""
                                      />
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: T.accent,
                                          fontWeight: 600,
                                          flex: 1,
                                        }}
                                      >
                                        {c.author}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: T.textFaint,
                                        }}
                                      >
                                        {timeAgo(c.published_at)}
                                      </span>
                                      {c.likes > 0 && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: "#e060a0",
                                          }}
                                        >
                                          ♥ {c.likes}
                                        </span>
                                      )}
                                      {c.reply_count > 0 && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: T.textFaint,
                                          }}
                                        >
                                          💬 {c.reply_count}
                                        </span>
                                      )}
                                    </div>

                                    {/* Comment text */}
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: T.textMid,
                                        lineHeight: 1.6,
                                        marginBottom: 8,
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: c.text,
                                      }}
                                    />

                                    {/* Actions */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <button
                                        onClick={() => {
                                          setReplyingTo(
                                            replyingTo === c.id ? null : c.id,
                                          );
                                          setReplyText("");
                                        }}
                                        style={{
                                          fontSize: 10,
                                          color:
                                            replyingTo === c.id
                                              ? T.accent
                                              : T.textFaint,
                                          background: "transparent",
                                          border: `1px solid ${replyingTo === c.id ? T.accent + "40" : T.border}`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ↩ Reply
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(
                                            v.id,
                                            c.id,
                                            "published",
                                          )
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentGreen,
                                          background: "transparent",
                                          border: `1px solid ${T.accentGreen}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(
                                            v.id,
                                            c.id,
                                            "heldForReview",
                                          )
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentYellow,
                                          background: "transparent",
                                          border: `1px solid ${T.accentYellow}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ⏸ Hold
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(v.id, c.id, "rejected")
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: "#e0a020",
                                          background: "transparent",
                                          border: "1px solid #e0a02030",
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ✕ Reject
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteCardComment(v.id, c.id)
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentRed,
                                          background: "transparent",
                                          border: `1px solid ${T.accentRed}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                          marginLeft: "auto",
                                        }}
                                      >
                                        🗑 Delete
                                      </button>
                                    </div>

                                    {/* Reply box */}
                                    {replyingTo === c.id && (
                                      <div
                                        style={{
                                          marginTop: 10,
                                          display: "flex",
                                          gap: 8,
                                        }}
                                      >
                                        <input
                                          value={replyText}
                                          onChange={(e) =>
                                            setReplyText(e.target.value)
                                          }
                                          onKeyDown={(e) =>
                                            e.key === "Enter" &&
                                            !e.shiftKey &&
                                            handleReply(v.id, c.id)
                                          }
                                          placeholder={`Reply to ${c.author}...`}
                                          maxLength={500}
                                          autoFocus
                                          style={{
                                            flex: 1,
                                            background: T.bg,
                                            border: `1px solid ${T.accent}40`,
                                            borderRadius: 7,
                                            padding: "7px 10px",
                                            color: T.text,
                                            fontSize: 11,
                                            fontFamily: "inherit",
                                            outline: "none",
                                          }}
                                        />
                                        <button
                                          onClick={() =>
                                            handleReply(v.id, c.id)
                                          }
                                          disabled={!replyText.trim()}
                                          style={{
                                            padding: "7px 12px",
                                            background: T.accent,
                                            border: "none",
                                            borderRadius: 7,
                                            color: "white",
                                            fontSize: 10,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                          }}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          onClick={() => {
                                            setReplyingTo(null);
                                            setReplyText("");
                                          }}
                                          style={{
                                            padding: "7px 10px",
                                            background: "transparent",
                                            border: `1px solid ${T.border}`,
                                            borderRadius: 7,
                                            color: T.textFaint,
                                            fontSize: 10,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                          }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "nowrap",
                            overflowX: "auto",
                            scrollbarWidth: "none",
                          }}
                        >
                          {/* Preview button — show for ready videos always, posted if has URL */}
                          {vUrl ? (
                            <button
                              className="btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreview(v);
                              }}
                              style={{
                                color: T.accent,
                                borderColor: `${T.accent}40`,
                                background: `${T.accent}10`,
                              }}
                            >
                              ▶ PREVIEW
                            </button>
                          ) : null}
                          {vUrl ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(vUrl, `${v.title || v.id}.mp4`); }}
                              className="btn-sm"
                              style={{
                                color: T.textMid,
                                borderColor: T.border,
                                background: "transparent",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer",
                              }}
                            >
                              ↓ DOWNLOAD
                            </button>
                          ) : null}
                          {!vUrl && v.status === "ready" ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: T.textFaint,
                                padding: "4px 10px",
                                border: `1px solid ${T.border}`,
                                borderRadius: 5,
                                cursor: "default",
                              }}
                              title="Video file not in storage yet — regenerate to get preview"
                            >
                              🎬 No Preview
                            </span>
                          ) : null}
                          {/* Library toggle */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const goingExclusive = !v.is_exclusive;
                              try {
                                await setVideoExclusive(v.id, goingExclusive);
                                if (goingExclusive && !v.thumbnail_url) {
                                  generateThumbnail(v.id).catch(() => {});
                                }
                                showToast(goingExclusive ? "Added to Library" : "Removed from Library");
                                refresh();
                                // If video is on YouTube and we're making it exclusive, prompt to update privacy
                                if (goingExclusive && v.youtube_id) {
                                  setExclusiveYtModal({ videoId: v.id, youtubeId: v.youtube_id });
                                }
                              } catch (err) {
                                showToast("Failed to update library", "error");
                              }
                            }}
                            className="btn-sm"
                            title={v.is_exclusive ? "In Library — click to remove" : "Add to Member Library"}
                            style={{
                              color: v.is_exclusive ? "#3dd68c" : T.textFaint,
                              borderColor: v.is_exclusive ? "rgba(61,214,140,0.4)" : T.border,
                              background: v.is_exclusive ? "rgba(61,214,140,0.08)" : "transparent",
                              fontWeight: v.is_exclusive ? 700 : 400,
                            }}
                          >
                            {v.is_exclusive ? "✓ IN LIBRARY" : "+ LIBRARY"}
                          </button>

                          {(v.status === "ready" || v.status === "uploading") && !v.is_exclusive && (
                            /* Audio-only (podcast/MP3) → Podbean; video → YouTube upload */
                            isPodcast(v) ? (
                              <>
                                {/* Podbean upload / status */}
                                {v.podbean_episode_id ? (
                                  <a
                                    href={v.podbean_url || "https://www.podbean.com"}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="btn-sm"
                                    style={{ color: "#f26522", borderColor: "rgba(242,101,34,0.35)", background: "rgba(242,101,34,0.08)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                                    title="View on Podbean"
                                  >
                                    ✓ PODBEAN ↗
                                  </a>
                                ) : (
                                  <button
                                    className="btn-sm"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!podbeanStatus?.connected) {
                                        showToast("Configure Podbean in Settings first", "error"); return;
                                      }
                                      setPodbeanUploading(p => ({ ...p, [v.id]: true }));
                                      try {
                                        await uploadToPodbean(v.id);
                                        showToast("Uploading to Podbean — distributing to Spotify, Apple & more");
                                        setTimeout(refresh, 5000);
                                      } catch (err) {
                                        showToast(err?.response?.data?.detail || "Podbean upload failed", "error");
                                      } finally {
                                        setPodbeanUploading(p => ({ ...p, [v.id]: false }));
                                      }
                                    }}
                                    disabled={podbeanUploading[v.id]}
                                    style={{
                                      color: "#f26522",
                                      borderColor: "rgba(242,101,34,0.3)",
                                      background: "rgba(242,101,34,0.07)",
                                      opacity: podbeanUploading[v.id] ? 0.6 : 1,
                                      cursor: podbeanUploading[v.id] ? "default" : "pointer",
                                    }}
                                    title={podbeanStatus?.connected ? "Publish to Podbean → auto-distributes to Spotify, Apple, Amazon" : "Connect Podbean in Settings"}
                                  >
                                    {podbeanUploading[v.id] ? "⟳ Publishing..." : "🎙 PODBEAN"}
                                  </button>
                                )}
                                {/* Buzzsprout badge (if also uploaded there) */}
                                {v.buzzsprout_episode_id && (
                                  <a
                                    href={v.buzzsprout_url || "https://www.buzzsprout.com"}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="btn-sm"
                                    style={{ color: "#1db954", borderColor: "rgba(29,185,84,0.35)", background: "rgba(29,185,84,0.08)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                                  >
                                    ✓ BUZZSPROUT ↗
                                  </a>
                                )}
                              </>
                            ) : (
                              <button
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (v.status === "ready") setUploadModal(v);
                                }}
                                disabled={v.status === "uploading"}
                                style={{
                                  color: v.status === "uploading" ? T.textFaint : T.accentYellow,
                                  borderColor: v.status === "uploading" ? T.border : `${T.accentYellow}40`,
                                  background: v.status === "uploading" ? "transparent" : `${T.accentYellow}0d`,
                                  opacity: v.status === "uploading" ? 0.6 : 1,
                                  cursor: v.status === "uploading" ? "default" : "pointer",
                                }}
                              >
                                {v.status === "uploading" ? "⟳ Uploading..." : "🚀 UPLOAD TO YOUTUBE"}
                              </button>
                            )
                          )}
                          {/* MP3 narration download — show for any video with a narration (not exclusive) */}
                          {v.narration_url && !v.is_exclusive && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(v.narration_url, `${v.title || v.id}-narration.mp3`); }}
                              title="Download narration MP3"
                              style={{
                                fontSize: 10,
                                color: "#a0d090",
                                padding: "4px 10px",
                                background: "#a0d09010",
                                borderRadius: 5,
                                border: "1px solid #a0d09030",
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              🎙 MP3
                            </button>
                          )}
                          {/* TikTok upload button — show for ready/posted videos when connected */}
                          {tiktokConnected && (v.status === "ready" || v.status === "posted") && v.file_path && (
                            <button
                              className="btn-sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setTiktokUploading(prev => ({ ...prev, [v.id]: true }));
                                try {
                                  await uploadToTikTok(v.id, "SELF_ONLY");
                                  showToast("TikTok upload started — will be private until you publish");
                                } catch (err) {
                                  showToast(err?.response?.data?.detail || "TikTok upload failed");
                                } finally {
                                  setTiktokUploading(prev => ({ ...prev, [v.id]: false }));
                                }
                              }}
                              disabled={tiktokUploading[v.id] || v.tiktok_status === "uploading"}
                              style={{
                                color: v.tiktok_status === "posted" ? "#4ade80" : "#ee4466",
                                borderColor: v.tiktok_status === "posted" ? "rgba(74,222,128,0.3)" : "rgba(238,68,102,0.3)",
                                background: v.tiktok_status === "posted" ? "rgba(74,222,128,0.07)" : "rgba(238,68,102,0.07)",
                                opacity: tiktokUploading[v.id] ? 0.6 : 1,
                                cursor: tiktokUploading[v.id] ? "default" : "pointer",
                              }}
                            >
                              {tiktokUploading[v.id] || v.tiktok_status === "uploading"
                                ? "⟳ TikTok..."
                                : v.tiktok_status === "posted"
                                ? "✓ ON TIKTOK"
                                : "🎵 TIKTOK"}
                            </button>
                          )}
                          {/* Instagram — ready for when verification completes */}
                          {(v.status === "ready" || v.status === "posted") && v.file_path && (
                            <button
                              className="btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                showToast("Instagram verification in progress — this will go live once approved", "info");
                              }}
                              style={{
                                color: "#e1306c",
                                borderColor: "rgba(225,48,108,0.25)",
                                background: "rgba(225,48,108,0.06)",
                                opacity: 0.65,
                                cursor: "pointer",
                              }}
                              title="Instagram — verification in progress"
                            >
                              📸 INSTAGRAM
                            </button>
                          )}
                          {v.status === "posted" && (
                            <>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: T.accentGreen,
                                  padding: "4px 10px",
                                  background: `${T.accentGreen}0d`,
                                  borderRadius: 5,
                                  border: `1px solid ${T.accentGreen}30`,
                                }}
                              >
                                ● LIVE
                              </span>
                              <button
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openYtModal(v);
                                }}
                                style={{
                                  color: "#a060ff",
                                  borderColor: "#a060ff40",
                                  background: "#a060ff0d",
                                }}
                              >
                                ⚙ MANAGE
                              </button>
                              <button
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(v.id);
                                }}
                                style={{
                                  color:
                                    openComments === v.id
                                      ? T.accentGreen
                                      : T.textMid,
                                  borderColor:
                                    openComments === v.id
                                      ? `${T.accentGreen}50`
                                      : T.border,
                                  background:
                                    openComments === v.id
                                      ? `${T.accentGreen}0d`
                                      : "transparent",
                                }}
                              >
                                💬{" "}
                                {openComments === v.id
                                  ? "HIDE"
                                  : `COMMENTS${v.youtube_id ? "" : ""}`}
                              </button>
                              {v.youtube_url && (
                                <a
                                  href={v.youtube_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: 10,
                                    color: T.accent,
                                    textDecoration: "none",
                                    padding: "4px 10px",
                                    background: `${T.accent}0d`,
                                    borderRadius: 5,
                                    border: `1px solid ${T.accent}30`,
                                  }}
                                >
                                  ▶ YouTube
                                </a>
                              )}
                              <span style={{ fontSize: 10, color: T.textFaint, whiteSpace: "nowrap", flexShrink: 0 }}>
                                👁 {fmtNum(v.views_count)} · ♥ {fmtNum(v.likes_count)} · {timeAgo(v.posted_at)}
                              </span>
                              <button
                                className="btn-sm"
                                onClick={(e) => { e.stopPropagation(); setYtSettingsModal(v); }}
                                style={{ color: T.textFaint, borderColor: T.border, background: "transparent", flexShrink: 0 }}
                              >
                                ⚙ Settings
                              </button>
                              {v.resolution !== "1080x1920" && (
                                <button
                                  className="btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setShortsModal(v); }}
                                  style={{ color: T.textFaint, borderColor: T.border, background: "transparent", flexShrink: 0 }}
                                >
                                  📱 Make Short
                                </button>
                              )}
                            </>
                          )}
                          {/* Make Short — available for ready long-form videos only */}
                          {v.status === "ready" && v.file_path && v.resolution !== "1080x1920" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShortsModal(v); }}
                              style={{
                                fontSize: 10,
                                color: T.textFaint,
                                padding: "4px 10px",
                                background: "transparent",
                                borderRadius: 5,
                                border: `1px solid ${T.border}`,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              📱 Make Short
                            </button>
                          )}
                          {v.status === "uploading" && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#9060e0",
                                letterSpacing: "0.08em",
                              }}
                            >
                              ⟳ Uploading to YouTube...
                            </span>
                          )}
                          {/* Force-reset for stuck videos not started in this session */}
                          {IN_PROGRESS.includes(v.status) && !(generating && genJobId === v.id) && (
                            <button
                              className="btn-sm"
                              onClick={(e) => handleForceReset(v.id, e)}
                              style={{
                                color: T.accentYellow,
                                borderColor: `${T.accentYellow}40`,
                                background: `${T.accentYellow}0d`,
                              }}
                              title="Video appears stuck — click to resolve its status based on available output"
                            >
                              ↺ RESET
                            </button>
                          )}
                          <button
                            className="btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                id: v.id,
                                hasYoutube:
                                  v.status === "posted" && !!v.youtube_id,
                                youtubeId: v.youtube_id,
                              });
                            }}
                            style={{
                              marginLeft: "auto",
                              color: T.textFaint,
                              borderColor: T.border,
                              background: "transparent",
                            }}
                          >
                            ✕ DELETE
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Pagination sentinel */}
                {visibleCount < filtered.length && (
                  <div ref={sentinelRef} style={{ height: 1 }} />
                )}
                </div>{/* end scrollable list */}
                </div>{/* end sticky panel */}
              </>
            )}

            {/* ── SCRIPT STUDIO TAB ─────────────────────────────────────────────── */}
            {tab === "script" && (
              <ScriptStudio
                T={T}
                showToast={showToast}
                addNotification={addNotification}
                onVideoReady={(video) => {
                  setTab("videos");
                  setTimeout(() => setPreview(video), 400);
                }}
              />
            )}

            {/* ── SHORTS TAB ─────────────────────────────────────────────────────── */}
            {tab === "shorts" && (
  <div style={{ display: "flex", gap: 20, height: "100%", minHeight: 0 }}>

    {/* LEFT — Existing Shorts */}
    <div style={{
      width: 340,
      flexShrink: 0,
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.08em" }}>
          ⚡ YOUR SHORTS <span style={{ color: T.textFaint, fontWeight: 400 }}>({shortsList.length})</span>
        </div>
        <button
          onClick={() => { setShortsList([]); shortsOffsetRef.current = 0; loadShorts(true); }}
          style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 13 }}
        >↺</button>
      </div>

      {/* Filter bar */}
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}20`, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          { id: "all", label: "All" },
          { id: "youtube", label: "▶ YouTube" },
          { id: "tiktok", label: "🎵 TikTok" },
          { id: "unposted", label: "⬆ Unposted" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setShortsFilter(f.id)}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 9, letterSpacing: "0.05em",
              border: `1px solid ${shortsFilter === f.id ? T.accent : T.border}`,
              background: shortsFilter === f.id ? `${T.accent}18` : "transparent",
              color: shortsFilter === f.id ? T.accent : T.textDim,
              cursor: "pointer", fontFamily: "inherit", fontWeight: shortsFilter === f.id ? 700 : 400,
            }}
          >{f.label}</button>
        ))}
      </div>

      <div
        ref={shortsListRef}
        onScroll={handleShortsScroll}
        style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        {shortsLoading && shortsList.length === 0 ? (
          [0,1,2].map(i => (
            <div key={i} style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", border: `1px solid ${T.border}`, borderRadius: 10, background: T.bgCard }}>
              <div className="skeleton-loader" style={{ width: 40, height: 72, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-loader" style={{ width: "70%", height: 11, borderRadius: 3, marginBottom: 6 }} />
                <div className="skeleton-loader" style={{ width: "40%", height: 9, borderRadius: 3 }} />
              </div>
            </div>
          ))
        ) : (() => {
          const filteredShorts = shortsList.filter(s => {
            if (shortsFilter === "youtube") return !!s.youtube_video_id;
            if (shortsFilter === "tiktok") return s.tiktok_status === "published";
            if (shortsFilter === "unposted") return s.status === "ready" && !s.youtube_video_id && s.tiktok_status !== "published";
            return true;
          });
          if (filteredShorts.length === 0) return (
            <div style={{ textAlign: "center", padding: 40, color: T.textFaint, fontSize: 11 }}>
              {shortsFilter === "all" ? "No shorts yet — generate your first one →" : `No ${shortsFilter} shorts found`}
            </div>
          );
          return filteredShorts.map(s => {
            const isOnYt = !!s.youtube_video_id;
            const isOnTt = s.tiktok_status === "published";
            const isReady = s.status === "ready";
            const isUnposted = isReady && !isOnYt;
            const uploadingYt = shortsUploading[`yt_${s.id}`];
            const uploadingTt = shortsUploading[`tt_${s.id}`];
            const canPlay = !!getVideoUrl(s.file_path);
            return (
              <div
                key={s.id}
                onClick={() => canPlay && setPreview(s)}
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  background: T.bgCard,
                  transition: "border-color 0.15s, background 0.15s",
                  cursor: canPlay ? "pointer" : "default",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgCardHover; e.currentTarget.style.borderColor = T.accent + "50"; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.borderColor = T.border; }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {/* Portrait thumbnail */}
                  <div style={{
                    width: 36, height: 64, borderRadius: 6,
                    background: canPlay
                      ? `linear-gradient(180deg,#4a9eff30,#00000060)`
                      : `linear-gradient(180deg,#4a9eff18,#00000028)`,
                    border: `1px solid ${canPlay ? T.accent + "60" : T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: canPlay ? 18 : 14,
                    transition: "all 0.15s",
                  }}>
                    {s.file_path ? "▶" : "⚙"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: T.text,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      marginBottom: 3,
                    }}>
                      {s.title || s.prompt?.slice(0, 38) || "Untitled Short"}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>
                      {s.status === "ready" ? "✅ Ready" : s.status === "failed" ? "❌ Failed" : "⚙ " + s.status}
                      {s.duration_seconds ? ` · ${s.duration_seconds}s` : ""}
                    </div>
                    {(s.prompt || s.description) && (
                      <div style={{ fontSize: 9.5, color: T.textDim, marginBottom: 5, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {s.description || s.prompt}
                      </div>
                    )}
                    {/* Platform badges */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: isUnposted ? 8 : 0 }}>
                      {isOnYt && (
                        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(255,0,0,0.1)", color: "#ff4444", border: "1px solid rgba(255,0,0,0.2)", letterSpacing: "0.04em" }}>
                          ▶ YOUTUBE
                        </span>
                      )}
                      {isOnTt && (
                        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(0,242,234,0.1)", color: "#00f2ea", border: "1px solid rgba(0,242,234,0.2)", letterSpacing: "0.04em" }}>
                          🎵 TIKTOK
                        </span>
                      )}
                      {!isOnYt && !isOnTt && isReady && (
                        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: `${T.accentYellow}14`, color: T.accentYellow, border: `1px solid ${T.accentYellow}30`, letterSpacing: "0.04em" }}>
                          UNPOSTED
                        </span>
                      )}
                    </div>
                    {/* Action buttons for unposted ready shorts */}
                    {isUnposted && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShortsUploading(p => ({ ...p, [`yt_${s.id}`]: true }));
                            try {
                              await uploadVideo(s.id);
                              showToast("YouTube upload started!");
                              loadShorts(true);
                            } catch (err) {
                              showToast(err?.response?.data?.detail || "Upload failed", "error");
                            } finally {
                              setShortsUploading(p => ({ ...p, [`yt_${s.id}`]: false }));
                            }
                          }}
                          disabled={uploadingYt}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                            border: "1px solid rgba(255,0,0,0.3)", background: "rgba(255,0,0,0.08)",
                            color: "#ff4444", cursor: "pointer", fontFamily: "inherit",
                            opacity: uploadingYt ? 0.5 : 1,
                          }}
                        >
                          {uploadingYt ? "⟳..." : "▶ YT"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast("Instagram verification in progress — this will go live once approved", "info");
                          }}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                            border: "1px solid rgba(225,48,108,0.25)", background: "rgba(225,48,108,0.06)",
                            color: "#e1306c", cursor: "pointer", fontFamily: "inherit", opacity: 0.65,
                          }}
                          title="Instagram — verification in progress"
                        >
                          📸 IG
                        </button>
                        {tiktokConnected && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setShortsUploading(p => ({ ...p, [`tt_${s.id}`]: true }));
                              try {
                                await uploadToTikTok(s.id, "SELF_ONLY");
                                showToast("TikTok upload started!");
                                loadShorts(true);
                              } catch (err) {
                                showToast(err?.response?.data?.detail || "TikTok upload failed", "error");
                              } finally {
                                setShortsUploading(p => ({ ...p, [`tt_${s.id}`]: false }));
                              }
                            }}
                            disabled={uploadingTt}
                            style={{
                              padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                              border: "1px solid rgba(0,242,234,0.3)", background: "rgba(0,242,234,0.08)",
                              color: "#00f2ea", cursor: "pointer", fontFamily: "inherit",
                              opacity: uploadingTt ? 0.5 : 1,
                            }}
                          >
                            {uploadingTt ? "⟳..." : "🎵 TT"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
        {shortsLoading && shortsList.length > 0 && (
          <div style={{ textAlign: "center", padding: 12, color: T.textFaint, fontSize: 11 }}>Loading more...</div>
        )}
        {shortsHasMore === false && shortsList.length > 0 && (
          <div style={{ textAlign: "center", padding: 10, color: T.textFaint, fontSize: 10 }}>All shorts loaded</div>
        )}
      </div>
    </div>

    {/* RIGHT — Generate forms */}
    <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: T.text, marginBottom: 6 }}>
          ⚡ YouTube Shorts Studio
        </div>
        <div style={{ fontSize: 12, color: T.textDim }}>
          Generate portrait 9:16 videos or clip your best existing content into Shorts.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Mode A: Generate from scratch */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>
            ✨ Generate New Short
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16 }}>
            AI writes a concise 90-second script, narrates it, and renders a 9:16 Short.
          </div>
          {!shortGenerating && shortPipeStep === 0 && (
            <>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[{ v: "prompt", label: "✨ AI Prompt" }, { v: "custom", label: "✍ Custom Script" }].map(m => (
                  <button key={m.v} onClick={() => setShortScriptMode(m.v)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em", border: `1px solid ${shortScriptMode === m.v ? T.accent + "80" : T.border}`, background: shortScriptMode === m.v ? `${T.accent}15` : "transparent", color: shortScriptMode === m.v ? T.accent : T.textFaint, fontWeight: shortScriptMode === m.v ? 700 : 400 }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                {shortScriptMode === "prompt" ? (
                  <>
                    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>TOPIC / PROMPT</div>
                    <textarea
                      value={shortPrompt}
                      onChange={e => setShortPrompt(e.target.value)}
                      rows={3}
                      placeholder="e.g. 'The quiet grief nobody talks about'"
                      style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                    />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 4 }}>CUSTOM SCRIPT</div>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6 }}>Write your full narration text. Target ~180-210 words for a 90-second Short.</div>
                    <textarea
                      value={shortCustomScript}
                      onChange={e => setShortCustomScript(e.target.value)}
                      rows={7}
                      placeholder="Write your script here... The AI voice will narrate this exactly as written. Use commas and ellipsis (...) for natural pauses."
                      style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 9, color: T.textFaint, marginTop: 4, textAlign: "right" }}>
                      {shortCustomScript.trim().split(/\s+/).filter(Boolean).length} words
                    </div>
                  </>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>AMBIENCE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { v: "stars", emoji: "⭐", label: "Stars", desc: "Deep space drift" },
                    { v: "aurora", emoji: "🌌", label: "Aurora", desc: "Northern lights" },
                    { v: "ocean", emoji: "🌊", label: "Ocean", desc: "Underwater rays" },
                    { v: "fire", emoji: "🔥", label: "Fire", desc: "Floating embers" },
                    { v: "rain", emoji: "🌧", label: "Rain", desc: "Night city window" },
                    { v: "galaxy", emoji: "🌀", label: "Galaxy", desc: "Spiral rotation" },
                  ].map(a => (
                    <button key={a.v} onClick={() => setShortAmbience(a.v)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: `2px solid ${shortAmbience === a.v ? T.accent : T.border}`, background: shortAmbience === a.v ? `${T.accent}18` : T.inputBg, color: T.text, fontFamily: "inherit" }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{a.emoji} {a.label}</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>{a.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Background music */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>BACKGROUND MUSIC</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                  {[
                    { id: "Birds_Atmosphere_Piano", label: "🌙 Birds & Piano" },
                    { id: "Birds_Atmosphere_Wing",  label: "🍃 Birds & Wing" },
                    { id: "Laidback_Fevorite",      label: "🎹 Laidback Fav" },
                    { id: "Pads_EPiano",            label: "🎧 Pads & EPiano" },
                    { id: "Pads",                   label: "🎵 Pads" },
                    { id: "swingPiano",             label: "🎷 Swing Piano" },
                    { id: "none",                   label: "🔇 None" },
                  ].map(m => (
                    <button key={m.id} onClick={() => setShortMusicStyle(m.id)}
                      style={{
                        padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${shortMusicStyle === m.id ? T.accentGreen + "80" : T.border}`,
                        background: shortMusicStyle === m.id ? `${T.accentGreen}10` : "transparent",
                        color: shortMusicStyle === m.id ? T.accentGreen : T.textFaint,
                        fontSize: 9, fontFamily: "inherit",
                      }}
                    >{m.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>VOL</div>
                  <input type="range" min={0} max={0.5} step={0.01}
                    value={shortMusicVolume}
                    onChange={e => setShortMusicVolume(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
                  />
                  <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>{Math.round(shortMusicVolume * 100)}%</div>
                </div>
                {shortMusicStyle !== "none" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>DELAY</div>
                    <input type="range" min={0} max={5} step={0.1}
                      value={shortMusicDelay}
                      onChange={e => setShortMusicDelay(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
                    />
                    <div style={{ fontSize: 9, color: T.textFaint, width: 32, textAlign: "right" }}>{shortMusicDelay.toFixed(1)}s</div>
                  </div>
                )}
              </div>
            </>
          )}
          {/* ── Stickfigure toggle (Shorts) ── */}
          <div style={{ marginBottom: 10, padding: "10px 14px", background: shortUseStickfigures ? `${T.accentPurple}10` : T.bg, border: `1px solid ${shortUseStickfigures ? T.accentPurple + "50" : T.border}`, borderRadius: 10, transition: "all 0.2s" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={shortUseStickfigures}
                onChange={e => {
                  const on = e.target.checked;
                  setShortUseStickfigures(on);
                  if (on && sfClipCount === 0) {
                    addNotification("No Stickfigures in DB", "Upload clips in the Stickfigures tab before generating with this mode.", "error");
                    showToast("No stickfigures in DB — add clips first", "error");
                  }
                }}
                style={{ accentColor: T.accentPurple, width: 14, height: 14 }}
              />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: shortUseStickfigures ? T.accentPurple : T.textMid, letterSpacing: "0.04em" }}>
                  🕹 USE STICKFIGURES
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                  {shortUseStickfigures
                    ? `Rain background + auto-matched overlays — ${sfClipCount ?? "?"} clips in DB`
                    : "Use animated stickfigure overlays instead of stock footage"}
                </div>
              </div>
            </label>
          </div>

          {shortGenError && <div style={{ fontSize: 11, color: T.accentRed, marginBottom: 10 }}>{shortGenError}</div>}
          {(() => {
            const hasInput = shortScriptMode === "custom" ? shortCustomScript.trim() : shortPrompt.trim();
            const disabled = shortGenerating || !hasInput;
            return (
              <button onClick={handleGenerateShort} disabled={disabled} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: disabled ? T.border : T.accent, color: disabled ? T.textFaint : "#fff", fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}>
                {shortGenerating ? "⚡ GENERATING..." : "⚡ GENERATE SHORT"}
              </button>
            );
          })()}

          {/* ── Progress panel (same style as Video Studio) ── */}
          {(shortGenerating || shortPipeStep > 0) && shortLogVideoId && (
            <div style={{ marginTop: 16, background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 14 }}>PIPELINE PROGRESS</div>
              {/* Step indicators */}
              <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
                {SHORT_STEPS.map((s, i) => {
                  const done = i < shortPipeStep - 1, active = i === shortPipeStep - 1;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {active && (
                            <>
                              <div style={{ position: "absolute", borderRadius: "50%", width: 32, height: 32, border: `2px solid ${T.accent}`, animation: "ringPulse 1.4s ease-out infinite", opacity: 0 }} />
                              <div style={{ position: "absolute", borderRadius: "50%", width: 40, height: 40, border: `1.5px solid ${T.accent}`, animation: "ringPulse 1.4s ease-out infinite 0.4s", opacity: 0 }} />
                            </>
                          )}
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700,
                            background: done ? T.accentGreen : active ? T.accent : T.bgCard,
                            color: done || active ? "white" : T.textFaint,
                            border: active ? `2px solid ${T.accent}` : "none",
                            boxShadow: active ? `0 0 12px ${T.accent}80` : "none",
                            transition: "all 0.4s", zIndex: 1,
                          }}>
                            {done ? "✓" : i + 1}
                          </div>
                        </div>
                        <div style={{ fontSize: 8, color: active ? T.accent : done ? T.accentGreen : T.textFaint, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                          {s.toUpperCase()}
                        </div>
                      </div>
                      {i < SHORT_STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: done ? T.accentGreen : T.border, margin: "0 3px", marginBottom: 20, transition: "background 0.4s" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Status message */}
              <div style={{ marginTop: 12, fontSize: 11, color: T.textMid, textAlign: "center" }}>
                {shortPipeStep === 1 && "📝 Generating 90-second script..."}
                {shortPipeStep === 2 && "🎙 Synthesizing voice narration..."}
                {shortPipeStep === 3 && "🎬 Generating portrait visual..."}
                {shortPipeStep === 4 && "⚙ Burning captions..."}
                {shortPipeStep === 5 && "🎵 Merging audio + finalizing..."}
                {shortPipeStep === 6 && "✅ Short ready — check the Shorts list!"}
              </div>
              {/* View logs toggle + cancel */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <button
                  onClick={() => setShowShortLogs(v => !v)}
                  style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {showShortLogs ? "Hide Logs" : "View Logs"}
                </button>
                {shortGenerating && (
                  <button
                    onClick={() => {
                      clearInterval(shortLogPollRef.current);
                      clearInterval(shortStepPollRef.current);
                      setShortGenerating(false);
                      setShortPipeStep(0);
                    }}
                    style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${T.accentRed}40`, background: "transparent", color: T.accentRed, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {/* Log stream */}
              {showShortLogs && (
                <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>
                    LOGS {shortGenerating && <span style={{ color: T.accent }}>● LIVE</span>}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: T.textDim, maxHeight: 200, overflowY: "auto", lineHeight: 1.6 }}>
                    {shortLogs.length === 0
                      ? <span style={{ color: T.textFaint }}>Waiting for pipeline output...</span>
                      : shortLogs.map((line, i) => (
                        <div key={i} style={{ color: line.includes("[ERROR]") ? T.accentRed : line.includes("[DONE]") ? T.accentGreen : T.textDim }}>{line}</div>
                      ))
                    }
                    <div ref={shortLogsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mode B: Clip from existing video */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>
            ✂️ Clip Existing Video
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16 }}>
            Auto-clips the best 59s from a video in your library, crops to 9:16 portrait.
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>SELECT VIDEO</div>
            <select
              value={shortClipVideoId}
              onChange={e => setShortClipVideoId(e.target.value)}
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
            >
              <option value="">— Pick a video —</option>
              {videos.filter(v => (v.status === "posted" || v.status === "ready") && v.file_path && !(v.labels || []).includes("used_for_short")).map(v => (
                <option key={v.id} value={v.id}>{v.title || v.id.slice(0,16)}</option>
              ))}
              {videos.filter(v => (v.labels || []).includes("used_for_short") && v.file_path).length > 0 && (
                <optgroup label="Already used for a Short">
                  {videos.filter(v => (v.labels || []).includes("used_for_short") && v.file_path).map(v => (
                    <option key={v.id} value={v.id} disabled style={{ color: "#888" }}>⛔ {v.title || v.id.slice(0,16)}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, padding: "10px 12px", background: T.bgSub, borderRadius: 8, lineHeight: 1.6 }}>
            ℹ️ First ~25% skipped (intro), next 59s center-cropped to portrait and saved as a Short.
          </div>
          {shortClipError && <div style={{ fontSize: 11, color: T.accentRed, marginBottom: 10 }}>{shortClipError}</div>}
          {shortClipSuccess && <div style={{ fontSize: 11, color: T.accentGreen, marginBottom: 10 }}>{shortClipSuccess}</div>}
          <button onClick={handleClipShort} disabled={shortClipping || !shortClipVideoId} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: shortClipping || !shortClipVideoId ? T.border : T.accentGreen, color: shortClipping || !shortClipVideoId ? T.textFaint : "#fff", fontSize: 12, fontWeight: 700, cursor: shortClipping || !shortClipVideoId ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}>
            {shortClipping ? "✂️ PROCESSING..." : "✂️ CREATE SHORT"}
          </button>
        </div>
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>SHORTS TIPS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { icon: "⏱", title: "Max 90 Seconds", desc: "YouTube Shorts can be up to 90s. Generated shorts are auto-fitted to exactly 90s." },
            { icon: "📱", title: "9:16 Portrait", desc: "All Shorts are rendered at 1080×1920 — vertical mobile-first format." },
            { icon: "👁", title: "Review Before Upload", desc: "Shorts are saved as Ready — you upload to YouTube when satisfied." },
          ].map(tip => (
            <div key={tip.icon} style={{ background: T.bgSub, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{tip.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>{tip.title}</div>
              <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
            )}

            {/* ── Billing & Quotas Tab ──────────────────────────────────────────── */}
            {/* ── MY CHANNEL TAB ─────────────────────────────────────────────── */}
            {tab === "channel" && (
              <div style={{ padding: "0 2px" }}>
                {/* ── Platform selector ── */}
                <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
                  {[
                    { id: "youtube",   label: "▶ YouTube",   color: "#ff4444" },
                    { id: "instagram", label: "📷 Instagram", color: "#e1306c" },
                    { id: "spotify",   label: "◎ Spotify",   color: "#1db954" },
                    { id: "tiktok",    label: "🎵 TikTok",    color: "#00f2ea" },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setChannelPlatform(p.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 11,
                        fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.04em",
                        border: `1px solid ${channelPlatform === p.id ? p.color + "80" : T.border}`,
                        background: channelPlatform === p.id ? p.color + "18" : "transparent",
                        color: channelPlatform === p.id ? p.color : T.textFaint,
                        fontWeight: channelPlatform === p.id ? 700 : 400,
                        transition: "all 0.18s",
                      }}
                    >{p.label}</button>
                  ))}
                </div>

                {/* Coming-soon placeholder for non-YouTube platforms */}
                {channelPlatform !== "youtube" && (
                  <div style={{ textAlign: "center", padding: "60px 20px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>
                      {channelPlatform === "instagram" ? "📷" : channelPlatform === "spotify" ? "◎" : "🎵"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                      {channelPlatform === "instagram" ? "Instagram" : channelPlatform === "spotify" ? "Spotify" : "TikTok"} integration coming soon
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>
                      Connect your account in Settings to unlock channel analytics here.
                    </div>
                  </div>
                )}

                {channelPlatform === "youtube" && <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 18,
                  }}
                >
                  <div style={{ fontSize: 11, color: T.textMid }}>
                    {channelVideos.length > 0
                      ? `${channelVideos.length} videos on your channel`
                      : ""}
                  </div>
                  <button
                    onClick={() => fetchChannel(true)}
                    disabled={channelLoading}
                    style={{
                      padding: "7px 16px",
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      color: T.textMid,
                      fontSize: 10,
                      fontFamily: "inherit",
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                    }}
                  >
                    {channelLoading ? "..." : "↺ REFRESH"}
                  </button>
                </div>
                {channelError && (
                  <div
                    style={{
                      padding: 16,
                      background: "rgba(255,80,80,0.07)",
                      border: "1px solid rgba(255,80,80,0.2)",
                      borderRadius: 10,
                      color: "#ff5c6c",
                      fontSize: 12,
                      marginBottom: 16,
                    }}
                  >
                    {channelError}
                  </div>
                )}
                {channelLoading && !channelVideos.length ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 60,
                      color: T.textMid,
                      fontSize: 12,
                    }}
                  >
                    Loading channel videos...
                  </div>
                ) : channelVideos.length === 0 && !channelLoading ? (
                  // Quota hit & no cache — fall back to DB posted videos
                  <div>
                    {channelError && (
                      <div
                        style={{
                          padding: "14px 18px",
                          background: "rgba(255,170,0,0.07)",
                          border: "1px solid rgba(255,170,0,0.25)",
                          borderRadius: 10,
                          marginBottom: 18,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#ffaa00",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          📦 Showing cached library data
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: T.textMid,
                            lineHeight: 1.6,
                          }}
                        >
                          YouTube API quota is exhausted — live channel stats
                          unavailable until midnight Pacific Time. Showing your
                          posted videos from the local database instead. Upload
                          counts, views and likes may be outdated.
                        </div>
                      </div>
                    )}
                    {videos.filter((v) => v.status === "posted" || v.youtube_id)
                      .length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 60,
                          color: T.textMid,
                          fontSize: 12,
                        }}
                      >
                        No posted videos found in library.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill,minmax(300px,1fr))",
                          gap: 16,
                        }}
                      >
                        {videos
                          .filter((v) => v.status === "posted" || v.youtube_id)
                          .map((v) => (
                            <div
                              key={v.id}
                              style={{
                                background: T.bgCard,
                                border: `1px solid ${T.border}`,
                                borderRadius: 14,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  position: "relative",
                                  paddingBottom: "56.25%",
                                  background: T.bgBase,
                                }}
                              >
                                {v.thumbnail_url && (
                                  <img
                                    src={v.thumbnail_url}
                                    alt={v.title}
                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={e => { e.target.style.display = "none"; }}
                                  />
                                )}
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: T.textFaint,
                                    fontSize: 28,
                                    pointerEvents: "none",
                                  }}
                                >
                                  ▶
                                </div>
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    fontSize: 9,
                                    padding: "3px 7px",
                                    borderRadius: 5,
                                    letterSpacing: "0.08em",
                                    background: "rgba(0,192,112,0.85)",
                                    color: "#fff",
                                  }}
                                >
                                  POSTED
                                </div>
                              </div>
                              <div style={{ padding: "12px 14px" }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: T.text,
                                    marginBottom: 6,
                                    lineHeight: 1.4,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                >
                                  {v.title || v.prompt}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 12,
                                    fontSize: 10,
                                    color: T.textMid,
                                  }}
                                >
                                  {v.youtube_url && (
                                    <a
                                      href={v.youtube_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: T.accent,
                                        textDecoration: "none",
                                      }}
                                    >
                                      ▶ WATCH ON YOUTUBE
                                    </a>
                                  )}
                                  {v.narration_url && (
                                    <button
                                      onClick={() => handleDownload(v.narration_url, `${v.title || v.id}-narration.mp3`)}
                                      style={{
                                        color: "#a0d090",
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                        fontSize: 10,
                                        fontFamily: "inherit",
                                      }}
                                    >
                                      🎙 NARRATION MP3
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {channelVideos.length > channelVisible && (
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          textAlign: "right",
                          marginBottom: 10,
                        }}
                      >
                        Showing {channelVisible} of {channelVideos.length}{" "}
                        videos — scroll down for more
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill,minmax(300px,1fr))",
                        gap: 16,
                      }}
                    >
                      {channelVideos.slice(0, channelVisible).map((v) => (
                        <div
                          key={v.id}
                          style={{
                            background: T.bgCard,
                            border: `1px solid ${T.border}`,
                            borderRadius: 14,
                            overflow: "hidden",
                          }}
                        >
                          {/* Thumbnail */}
                          <div
                            style={{
                              position: "relative",
                              paddingBottom: "56.25%",
                              background: T.bgBase,
                            }}
                          >
                            {v.thumbnail ? (
                              <img
                                src={v.thumbnail}
                                alt={v.title}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: T.textFaint,
                                  fontSize: 28,
                                }}
                              >
                                ▶
                              </div>
                            )}
                            {/* Privacy badge */}
                            <div
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                fontSize: 9,
                                padding: "3px 7px",
                                borderRadius: 5,
                                letterSpacing: "0.08em",
                                background:
                                  v.privacy === "public"
                                    ? "rgba(0,192,112,0.85)"
                                    : v.privacy === "private"
                                      ? "rgba(30,30,40,0.9)"
                                      : "rgba(255,160,0,0.85)",
                                color: "#fff",
                              }}
                            >
                              {v.privacy?.toUpperCase() || "—"}
                            </div>
                            {/* Duration */}
                            {v.duration && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 8,
                                  right: 8,
                                  fontSize: 9,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "rgba(0,0,0,0.75)",
                                  color: "#fff",
                                }}
                              >
                                {v.duration}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ padding: "12px 14px" }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.text,
                                marginBottom: 6,
                                lineHeight: 1.4,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {v.title}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                fontSize: 10,
                                color: T.textMid,
                                marginBottom: 12,
                              }}
                            >
                              <span>👁 {fmtNum(v.views || 0)}</span>
                              <span>👍 {fmtNum(v.likes || 0)}</span>
                              <span>💬 {fmtNum(v.comments || 0)}</span>
                              <span style={{ marginLeft: "auto" }}>
                                {timeAgo(v.published_at)}
                              </span>
                            </div>
                            {/* Actions */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 6,
                              }}
                            >
                              <a
                                href={`https://youtube.com/watch?v=${v.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  padding: "7px 0",
                                  background: T.bgBase,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 7,
                                  color: T.textMid,
                                  fontSize: 10,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                ▶ WATCH
                              </a>
                              <a
                                href={`https://studio.youtube.com/video/${v.id}/edit`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  padding: "7px 0",
                                  background: T.bgBase,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 7,
                                  color: T.textMid,
                                  fontSize: 10,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                ✏ EDIT
                              </a>
                              {v.privacy !== "private" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "private" },
                                      );
                                      showToast("Video set to private");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast(
                                        "Failed to set private",
                                        "error",
                                      );
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🔒 MAKE PRIVATE
                                </button>
                              )}
                              {v.privacy !== "public" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "public" },
                                      );
                                      showToast("Video set to public");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast(
                                        "Failed to set public",
                                        "error",
                                      );
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🌍 MAKE PUBLIC
                                </button>
                              )}
                              {v.privacy !== "unlisted" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "unlisted" },
                                      );
                                      showToast("Video set to unlisted");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast("Failed", "error");
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🔗 UNLISTED
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setChannelDeleteConfirm({
                                    id: v.id,
                                    title: v.title,
                                  })
                                }
                                style={{
                                  padding: "7px 0",
                                  background: `rgba(220,38,38,0.07)`,
                                  border: `1px solid rgba(220,38,38,0.25)`,
                                  borderRadius: 7,
                                  color: T.accentRed,
                                  fontSize: 10,
                                  fontFamily: "inherit",
                                  letterSpacing: "0.06em",
                                  cursor: "pointer",
                                }}
                              >
                                🗑 DELETE
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Infinite scroll sentinel */}
                    {channelVideos.length > channelVisible && (
                      <div
                        ref={channelBottomRef}
                        style={{
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            letterSpacing: "0.08em",
                          }}
                        >
                          ↓ loading more...
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </>}
              </div>
            )}

            {tab === "billing" && (
              <div style={{ padding: "0 2px" }}>
                {!billing ? (
                  <div style={{ textAlign: "center", padding: 60 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      border: `3px solid ${T.border}`,
                      borderTopColor: T.accent,
                      animation: "spin 0.75s linear infinite",
                      margin: "0 auto 14px",
                    }} />
                    <div style={{ fontSize: 11, color: T.textFaint, letterSpacing: "0.08em" }}>LOADING SUBSCRIPTIONS…</div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    {/* ElevenLabs */}
                    {billing.elevenlabs && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                          width: 300,
                          height: 320,
                          overflowY: "auto",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🎙</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              ElevenLabs
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Text-to-Speech
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background:
                                billing.elevenlabs.status === "ok"
                                  ? "#00ff9020"
                                  : "#ff505020",
                              color:
                                billing.elevenlabs.status === "ok"
                                  ? "#00ff90"
                                  : "#ff5050",
                              border: `1px solid ${billing.elevenlabs.status === "ok" ? "#00ff9040" : "#ff505040"}`,
                            }}
                          >
                            {billing.elevenlabs.status === "ok"
                              ? "● LIVE"
                              : "● ERROR"}
                          </div>
                        </div>
                        {billing.elevenlabs.status === "ok" ? (
                          <>
                            <div style={{ marginBottom: 10 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 11,
                                  marginBottom: 5,
                                }}
                              >
                                <span style={{ color: T.textMid }}>
                                  Characters used
                                </span>
                                <span
                                  style={{ color: T.text, fontWeight: 600 }}
                                >
                                  {(
                                    billing.elevenlabs.chars_used || 0
                                  ).toLocaleString()}{" "}
                                  /{" "}
                                  {(
                                    billing.elevenlabs.chars_limit || 0
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: `${T.border}`,
                                  borderRadius: 99,
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    borderRadius: 99,
                                    width: `${Math.min(billing.elevenlabs.percent_used || 0, 100)}%`,
                                    background:
                                      (billing.elevenlabs.percent_used || 0) >
                                      80
                                        ? "#ff5050"
                                        : (billing.elevenlabs.percent_used ||
                                              0) > 50
                                          ? "#ffaa00"
                                          : "#00d4ff",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: T.textMid,
                                  marginTop: 4,
                                }}
                              >
                                {billing.elevenlabs.percent_used || 0}% used
                              </div>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                              }}
                            >
                              {[
                                [
                                  "Remaining",
                                  `${((billing.elevenlabs.chars_remaining || 0) / 1000).toFixed(0)}K chars`,
                                ],
                                ["Tier", billing.elevenlabs.tier || "—"],
                                [
                                  "Resets On",
                                  billing.elevenlabs.reset_date || "—",
                                ],
                                [
                                  "Voice ID",
                                  billing.elevenlabs.voice_id || "—",
                                ],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    background: T.bgBase,
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textMid,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 2,
                                    }}
                                  >
                                    {k}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: T.text,
                                    }}
                                  >
                                    {v}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <a
                              href="https://elevenlabs.io/subscription"
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "block",
                                marginTop: 12,
                                textAlign: "center",
                                fontSize: 10,
                                color: T.accent,
                                textDecoration: "none",
                                letterSpacing: "0.06em",
                              }}
                            >
                              MANAGE SUBSCRIPTION →
                            </a>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, color: "#ff5050" }}>
                            {billing.elevenlabs.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* YouTube */}
                    {billing.youtube && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                          width: 300,
                          height: 320,
                          overflowY: "auto",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>▶</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              YouTube API
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Data API v3
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● LIVE
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ color: T.textMid }}>
                              Units used today
                            </span>
                            <span style={{ color: T.text, fontWeight: 600 }}>
                              {(
                                billing.youtube.units_used_today || 0
                              ).toLocaleString()}{" "}
                              / 10,000
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: `${T.border}`,
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                width: `${Math.min((billing.youtube.units_used_today || 0) / 100, 100)}%`,
                                background:
                                  (billing.youtube.units_used_today || 0) > 8000
                                    ? "#ff5050"
                                    : (billing.youtube.units_used_today || 0) >
                                        5000
                                      ? "#ffaa00"
                                      : "#00d4ff",
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            [
                              "Uploads Today",
                              billing.youtube.uploads_today || 0,
                            ],
                            [
                              "Uploads Left",
                              billing.youtube.uploads_remaining_today || 0,
                            ],
                            [
                              "Units Remaining",
                              (
                                billing.youtube.units_remaining || 0
                              ).toLocaleString(),
                            ],
                            [
                              "Upload Units",
                              (
                                billing.youtube.upload_units_used || 0
                              ).toLocaleString(),
                            ],
                            [
                              "Read Units",
                              (
                                billing.youtube.read_units_used || 0
                              ).toLocaleString(),
                            ],
                            ["Cost/Upload", "1,600 units"],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textMid,
                            lineHeight: 1.6,
                            marginBottom: 8,
                          }}
                        >
                          Quota resets midnight Pacific Time. Apply for a free
                          increase at Google Cloud Console if needed.
                        </div>
                        <a
                          href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          VIEW QUOTA DASHBOARD →
                        </a>
                      </div>
                    )}

                    {/* Supabase */}
                    {billing.supabase && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                          width: 300,
                          height: 320,
                          overflowY: "auto",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🗄</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Supabase
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Database & Storage
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background:
                                billing.supabase.status === "ok"
                                  ? "#00ff9020"
                                  : "#ff505020",
                              color:
                                billing.supabase.status === "ok"
                                  ? "#00ff90"
                                  : "#ff5050",
                              border: `1px solid ${billing.supabase.status === "ok" ? "#00ff9040" : "#ff505040"}`,
                            }}
                          >
                            {billing.supabase.status === "ok"
                              ? "● LIVE"
                              : "● ERROR"}
                          </div>
                        </div>
                        {/* Storage progress bar */}
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ color: T.textMid }}>
                              Storage used
                            </span>
                            <span style={{ color: T.text, fontWeight: 600 }}>
                              {billing.supabase.storage_used_gb >= 1
                                ? `${billing.supabase.storage_used_gb.toFixed(2)} GB`
                                : `${billing.supabase.storage_used_mb || 0} MB`}{" "}
                              / {billing.supabase.storage_limit_gb || 100} GB
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: T.border,
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                width: `${Math.min(billing.supabase.storage_percent || 0, 100)}%`,
                                background:
                                  (billing.supabase.storage_percent || 0) > 80
                                    ? "#ff5050"
                                    : (billing.supabase.storage_percent || 0) > 50
                                      ? "#ffaa00"
                                      : "#00d4ff",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: T.textMid,
                              marginTop: 4,
                            }}
                          >
                            {billing.supabase.storage_percent || 0}% of{" "}
                            {billing.supabase.storage_limit_gb || 100} GB used
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            ["Tier", billing.supabase.tier || "Pro"],
                            ["Videos in DB", billing.supabase.videos_in_db || 0],
                            [
                              "Video Files",
                              `${billing.supabase.videos_file_count || 0} files (${billing.supabase.videos_bucket_mb || 0} MB)`,
                            ],
                            [
                              "Narrations",
                              `${billing.supabase.narrations_file_count || 0} files (${billing.supabase.narrations_bucket_mb || 0} MB)`,
                            ],
                            [
                              "Storage Limit",
                              `${billing.supabase.storage_limit_gb || 100} GB`,
                            ],
                            [
                              "Max File Size",
                              `${billing.supabase.file_size_limit_gb || 5} GB`,
                            ],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://supabase.com/dashboard"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          OPEN SUPABASE DASHBOARD →
                        </a>
                      </div>
                    )}

                    {/* Groq */}
                    {billing.groq && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>⚡</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Groq
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Script Generation LLM
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● FREE
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            [
                              "Model",
                              billing.groq.model
                                ?.split("-")
                                .slice(0, 3)
                                .join("-") || "—",
                            ],
                            ["Pricing", billing.groq.pricing || "Free"],
                            [
                              "Context",
                              `${billing.groq.context_k || 128}K tokens`,
                            ],
                            [
                              "Tok/Min",
                              (billing.groq.tok_per_min || 6000).toLocaleString(),
                            ],
                            [
                              "Req/Min",
                              billing.groq.req_per_min || 30,
                            ],
                            [
                              "Daily Limit",
                              `${((billing.groq.tok_per_day || 500000) / 1000).toFixed(0)}K tokens`,
                            ],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://console.groq.com"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          OPEN GROQ CONSOLE →
                        </a>
                      </div>
                    )}

                    {/* Pexels */}
                    {billing.pexels && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🎬</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Pexels
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Stock Video & Images
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● FREE
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            ["Pricing", "Free"],
                            [
                              "Rate Limit",
                              `${billing.pexels.rate_limit_hour || 200} req/hr`,
                            ],
                            [
                              "Monthly",
                              `${((billing.pexels.monthly_limit || 20000) / 1000).toFixed(0)}K requests`,
                            ],
                            [
                              "Content",
                              billing.pexels.content_types || "Videos, Photos",
                            ],
                            [
                              "Pixabay Fallback",
                              billing.pexels.pixabay_fallback ? "✓ Configured" : "✗ Not set",
                            ],
                            ["Attribution", "Required"],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://www.pexels.com/api/"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          PEXELS API DOCS →
                        </a>
                      </div>
                    )}

                    {/* ── Hetzner VPS ── */}
                    {billing.hetzner && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                          gridColumn: "1/-1",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🖥️</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Hetzner VPS
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              {billing.hetzner.server_name || "Server"} ·{" "}
                              {billing.hetzner.location || "—"}
                            </div>
                          </div>
                          {billing.hetzner.status === "ok" ? (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background:
                                  billing.hetzner.server_status === "running"
                                    ? "#00ff9020"
                                    : "#ff505020",
                                color:
                                  billing.hetzner.server_status === "running"
                                    ? "#00ff90"
                                    : "#ff5050",
                                border: `1px solid ${billing.hetzner.server_status === "running" ? "#00ff9040" : "#ff505040"}`,
                              }}
                            >
                              ●{" "}
                              {(
                                billing.hetzner.server_status || "unknown"
                              ).toUpperCase()}
                            </div>
                          ) : billing.hetzner.status === "no_token" ? (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background: "#ffaa0015",
                                color: "#ffaa00",
                                border: "1px solid #ffaa0040",
                              }}
                            >
                              ⚠ ADD TOKEN
                            </div>
                          ) : (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background: "#ff505020",
                                color: "#ff5050",
                                border: "1px solid #ff505040",
                              }}
                            >
                              ● ERROR
                            </div>
                          )}
                        </div>

                        {billing.hetzner.status === "ok" ? (
                          <>
                            {/* Specs + Cost grid */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4,1fr)",
                                gap: 8,
                                marginBottom: 14,
                              }}
                            >
                              {[
                                ["Type", billing.hetzner.server_type],
                                ["CPU", `${billing.hetzner.cpu_cores} vCPU`],
                                ["RAM", `${billing.hetzner.ram_gb} GB`],
                                [
                                  "Disk",
                                  `${billing.hetzner.disk_gb} GB ${billing.hetzner.disk_type || ""}`,
                                ],
                                [
                                  "Monthly",
                                  billing.hetzner.monthly_cost || "—",
                                ],
                                ["Since", billing.hetzner.created || "—"],
                                [
                                  "Traffic In",
                                  `${billing.hetzner.ingoing_traffic_gb || 0} GB`,
                                ],
                                [
                                  "Traffic Out",
                                  `${billing.hetzner.outgoing_traffic_gb || 0} GB`,
                                ],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    background: T.bgBase,
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textMid,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 2,
                                    }}
                                  >
                                    {k}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: T.text,
                                    }}
                                  >
                                    {v || "—"}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Traffic bar */}
                            {billing.hetzner.included_traffic_tb &&
                              billing.hetzner.included_traffic_tb !== "—" && (
                                <div style={{ marginBottom: 14 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: 10,
                                      color: T.textMid,
                                      marginBottom: 5,
                                    }}
                                  >
                                    <span>Outbound traffic this month</span>
                                    <span>
                                      {billing.hetzner.outgoing_traffic_gb} GB /{" "}
                                      {billing.hetzner.included_traffic_tb *
                                        1000}{" "}
                                      GB included
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      height: 5,
                                      background: T.border,
                                      borderRadius: 99,
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        borderRadius: 99,
                                        background: "#00d4ff",
                                        width: `${Math.min((billing.hetzner.outgoing_traffic_gb / (billing.hetzner.included_traffic_tb * 1000)) * 100, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                            {/* IPv4 + console link */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: T.textFaint,
                                  fontFamily: "monospace",
                                }}
                              >
                                {billing.hetzner.ipv4}
                              </div>
                              <a
                                href="https://console.hetzner.cloud"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: 10,
                                  color: T.accent,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                OPEN HETZNER CONSOLE →
                              </a>
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                billing.hetzner.status === "no_token"
                                  ? "#ffaa00"
                                  : "#ff5050",
                              lineHeight: 1.6,
                            }}
                          >
                            {billing.hetzner.status === "no_token"
                              ? "Add HETZNER_API_TOKEN to your server .env file to see live server stats. Create a Read-only token at console.hetzner.cloud → Security → API Tokens."
                              : billing.hetzner.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Spotify ── */}
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ fontSize: 22 }}>🎵</div>
                        <div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>Spotify</div>
                          <div style={{ fontSize: 10, color: T.textMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>Listener Analytics</div>
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 6,
                          background: spotifyConnected ? "#1db95420" : `${T.border}`,
                          color: spotifyConnected ? "#1db954" : T.textFaint,
                          border: `1px solid ${spotifyConnected ? "#1db95440" : T.border}` }}>
                          {spotifyConnected ? "● CONNECTED" : "● NOT CONNECTED"}
                        </div>
                      </div>
                      {!spotifyConnected ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 14 }}>Connect Spotify to see listener data and top content analytics</div>
                          <button
                            onClick={async () => { try { const { url } = await getSpotifyConnectUrl(); window.location.href = url; } catch {} }}
                            style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(29,185,84,0.5)", background: "rgba(29,185,84,0.12)", color: "#1db954", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", fontWeight: 600 }}
                          >
                            CONNECT SPOTIFY →
                          </button>
                        </div>
                      ) : (() => {
                        // Lazily fetch top tracks/artists once connected
                        if (spotifyTopTracks.length === 0 && spotifyConnected) {
                          getSpotifyTopTracks(5).then(setSpotifyTopTracks).catch(() => {});
                          getSpotifyTopArtists(5).then(setSpotifyTopArtists).catch(() => {});
                        }
                        return (
                          <div>
                            {spotifyProfile && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                                {[
                                  ["Display Name", spotifyProfile.display_name || "—"],
                                  ["Email",         spotifyProfile.email || "—"],
                                  ["Country",       spotifyProfile.country || "—"],
                                  ["Followers",     (spotifyProfile.followers ?? 0).toLocaleString?.() ?? "0"],
                                  ["Account",       "Spotify Premium"],
                                  ["Status",        "Active"],
                                ].map(([k, v]) => (
                                  <div key={k} style={{ background: T.bgBase, borderRadius: 8, padding: "8px 10px" }}>
                                    <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 2, textTransform: "uppercase" }}>{k}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text, wordBreak: "break-all" }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {spotifyTopTracks.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.12em", marginBottom: 10 }}>TOP TRACKS · ALL TIME</div>
                                {spotifyTopTracks.map((t, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                                    <div style={{ fontSize: 9, color: T.textFaint, width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                                      <div style={{ fontSize: 9, color: T.textFaint }}>{t.artists?.join(", ")}</div>
                                    </div>
                                    <div style={{ fontSize: 9, color: "#1db954", flexShrink: 0 }}>♫ {t.popularity}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {spotifyTopArtists.length > 0 && (
                              <div>
                                <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.12em", marginBottom: 10 }}>TOP ARTISTS · ALL TIME</div>
                                {spotifyTopArtists.map((a, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                                    <div style={{ fontSize: 9, color: T.textFaint, width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{a.name}</div>
                                      <div style={{ fontSize: 9, color: T.textFaint }}>{a.genres?.slice(0, 3).join(", ") || "—"}</div>
                                    </div>
                                    <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>👥 {(a.followers ?? 0).toLocaleString?.()}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ textAlign: "right", marginTop: 12 }}>
                              <a href="https://open.spotify.com" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#1db954", textDecoration: "none", letterSpacing: "0.06em" }}>OPEN SPOTIFY →</a>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Podcast RSS Feed ─────────────────────────────────── */}
                    <div style={{ gridColumn: "1/-1", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 20 }}>🎙</div>
                        <div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>Podcast RSS Feed</div>
                          <div style={{ fontSize: 10, color: T.textMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>Spotify for Podcasters</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12 }}>
                        Submit this URL once at{" "}
                        <a href="https://podcasters.spotify.com" target="_blank" rel="noreferrer" style={{ color: "#1db954" }}>podcasters.spotify.com</a>.
                        New episodes appear automatically when MP3s are generated.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input readOnly value={`${window.location.origin}/api/podcast/feed.xml`}
                          style={{ flex: 1, background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 7,
                                   color: T.text, fontSize: 10, padding: "7px 10px", fontFamily: "monospace", outline: "none" }} />
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/podcast/feed.xml`); showToast("RSS URL copied!"); }}
                          style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(29,185,84,0.4)",
                                   background: "rgba(29,185,84,0.1)", color: "#1db954", fontSize: 11,
                                   cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                          COPY URL
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 8 }}>
                        {videos.filter(v => !!v.narration_url).length} episode{videos.filter(v => !!v.narration_url).length !== 1 ? "s" : ""} available
                      </div>
                    </div>

                    {/* Refresh button */}
                    <div
                      style={{
                        gridColumn: "1/-1",
                        textAlign: "center",
                        paddingTop: 4,
                      }}
                    >
                      <button
                        onClick={fetchBilling}
                        style={{
                          padding: "9px 24px",
                          background: "transparent",
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          color: T.textMid,
                          fontSize: 10,
                          fontFamily: "inherit",
                          letterSpacing: "0.1em",
                          cursor: "pointer",
                        }}
                      >
                        ↺ REFRESH
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LIBRARY TAB ─────────────────────────────────────────────────────── */}
            {tab === "library" && (() => {
              const isCompAudio = (c) =>
                (c.labels || []).includes("mp3") ||
                c.file_path?.toLowerCase().endsWith(".mp3") ||
                c.title?.toLowerCase().includes("podcast");
              const regularVideos = videos.filter(
                (v) => !(v.labels || []).includes("compilation") && v.file_path
              );
              const mp3Videos = videos.filter((v) => !!v.narration_url);
              const videoComps = libraryComps.filter((c) => !isCompAudio(c));
              const audioComps = libraryComps.filter((c) => isCompAudio(c));

              const colStyle = {
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 16,
                minWidth: 0,
              };
              const colHead = {
                fontSize: 12,
                fontWeight: 700,
                color: T.textMid,
                letterSpacing: "0.1em",
                marginBottom: 14,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingBottom: 10,
                borderBottom: `1px solid ${T.border}`,
              };
              const libRow = (item, ext, onDl) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title || item.id}
                    </div>
                    <div style={{ fontSize: 9, color: T.textFaint, marginTop: 2 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                      {item.duration_seconds ? ` · ${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, "0")}` : ""}
                    </div>
                  </div>
                  {item.status && (
                    <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: item.status === "posted" || item.status === "ready" ? `${T.accentGreen}18` : `${T.border}`, color: item.status === "posted" || item.status === "ready" ? T.accentGreen : T.textFaint, letterSpacing: "0.08em" }}>
                      {item.status.toUpperCase()}
                    </span>
                  )}
                  <button
                    onClick={() => handleDownload(item.file_path || item.narration_url, `${item.title || item.id}.${ext}`)}
                    disabled={!item.file_path && !item.narration_url}
                    title={`Download .${ext}`}
                    style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textMid, cursor: item.file_path || item.narration_url ? "pointer" : "default", opacity: item.file_path || item.narration_url ? 1 : 0.3, fontFamily: "inherit", flexShrink: 0 }}
                  >
                    ↓ .{ext}
                  </button>
                </div>
              );

              return (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    {/* Videos / MP4 */}
                    <div style={colStyle}>
                      <div style={colHead}>
                        <span>🎬 VIDEOS · MP4</span>
                        <span style={{ background: `${T.accent}18`, color: T.accent, padding: "1px 7px", borderRadius: 10, fontSize: 9 }}>{regularVideos.length}</span>
                      </div>
                      {regularVideos.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", padding: "20px 0" }}>No videos yet</div>
                      ) : (
                        <div style={{ maxHeight: 340, overflowY: "auto" }}>
                          {regularVideos.map((v) => libRow(v, "mp4"))}
                        </div>
                      )}
                    </div>
                    {/* MP3 Narrations */}
                    <div style={colStyle}>
                      <div style={colHead}>
                        <span>🎙 MP3 · NARRATIONS</span>
                        <span style={{ background: "rgba(160,208,144,0.12)", color: "#a0d090", padding: "1px 7px", borderRadius: 10, fontSize: 9 }}>{mp3Videos.length}</span>
                      </div>
                      {mp3Videos.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", padding: "20px 0" }}>No narrations yet</div>
                      ) : (
                        <div style={{ maxHeight: 340, overflowY: "auto" }}>
                          {mp3Videos.map((v) => (
                            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title || v.id}</div>
                                <div style={{ fontSize: 9, color: T.textFaint, marginTop: 2 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}</div>
                              </div>
                              <button onClick={() => handleDownload(v.narration_url, `${v.title || v.id}-narration.mp3`)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid #a0d09030`, background: "#a0d09010", color: "#a0d090", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>↓ .mp3</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Compilations row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {/* Video Compilations */}
                    <div style={colStyle}>
                      <div style={colHead}>
                        <span>🔗 COMPILATIONS · VIDEO</span>
                        <span style={{ background: `${T.accentYellow}18`, color: T.accentYellow, padding: "1px 7px", borderRadius: 10, fontSize: 9 }}>{videoComps.length}</span>
                      </div>
                      {videoComps.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", padding: "20px 0" }}>No video compilations</div>
                      ) : (
                        <div style={{ maxHeight: 280, overflowY: "auto" }}>
                          {videoComps.map((c) => libRow(c, "mp4"))}
                        </div>
                      )}
                    </div>
                    {/* Audio Compilations */}
                    <div style={colStyle}>
                      <div style={colHead}>
                        <span>🎵 COMPILATIONS · MP3</span>
                        <span style={{ background: "rgba(29,185,84,0.12)", color: "#1db954", padding: "1px 7px", borderRadius: 10, fontSize: 9 }}>{audioComps.length}</span>
                      </div>
                      {audioComps.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", padding: "20px 0" }}>No MP3 compilations</div>
                      ) : (
                        <div style={{ maxHeight: 280, overflowY: "auto" }}>
                          {audioComps.map((c) => libRow(c, "mp3"))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── ANALYTICS TAB ───────────────────────────────────────────────────── */}
            {tab === "compilations" && (
              <CompilationStudio T={T} showToast={showToast} videos={videos} />
            )}

            {tab === "analytics" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: "TOTAL VIDEOS",

                      value: stats.total || 0,
                      color: T.accent,
                    },
                    {
                      label: "LIVE ON YOUTUBE",
                      value: stats.posted || 0,
                      color: T.accentGreen,
                    },
                    {
                      label: "TOTAL VIEWS",
                      value: stats.total_views != null ? fmtNum(stats.total_views) : "—",
                      color: "#a0d090",
                    },
                    {
                      label: "TOTAL LIKES",
                      value: stats.total_likes != null ? fmtNum(stats.total_likes) : "—",
                      color: T.accentYellow,
                    },
                    {
                      label: "SUCCESS RATE",
                      value: stats.total
                        ? `${Math.round(((stats.total - (stats.failed || 0)) / stats.total) * 100)}%`
                        : "—",
                      color: T.accentGreen,
                    },
                    {
                      label: "AVG DURATION",
                      value: (() => {
                        const p = videos.filter((v) => v.duration_seconds);
                        return p.length
                          ? fmtDur(
                              Math.round(
                                p.reduce((s, v) => s + v.duration_seconds, 0) /
                                  p.length,
                              ),
                            )
                          : "—";
                      })(),
                      color: T.accent,
                    },
                    {
                      label: "THIS WEEK",
                      value: videos.filter(
                        (v) =>
                          new Date(v.created_at) >
                          new Date(Date.now() - 7 * 86400000),
                      ).length,
                      color: T.accentYellow,
                    },
                    {
                      label: "FAILED",
                      value: stats.failed || 0,
                      color: T.accentRed,
                    },
                    {
                      label: "NARRATIONS",
                      value: videos.filter((v) => !!v.narration_url).length,
                      color: "#a0d090",
                    },
                  ].map((s) => (
                    <div key={s.label} className="stat-card">
                      <div
                        style={{
                          fontSize: 9,
                          color: T.textFaint,
                          letterSpacing: "0.12em",
                          marginBottom: 10,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontSize: 28,
                          fontWeight: 800,
                          color: s.color,
                        }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textFaint,
                      letterSpacing: "0.12em",
                      marginBottom: 16,
                    }}
                  >
                    STATUS BREAKDOWN
                  </div>
                  {Object.entries(STATUS).map(([key, s]) => {
                    const count = videos.filter((v) => v.status === key).length;
                    if (!count) return null;
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            fontSize: 10,
                            color: s.color,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: T.border,
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${(count / videos.length) * 100}%`,
                              height: "100%",
                              background: s.color,
                              borderRadius: 3,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMid,
                            width: 20,
                            textAlign: "right",
                          }}
                        >
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Pipeline Activity Chart ────────────────────────── */}
                {pipelineMetrics && (() => {
                  const hourly = pipelineMetrics.hourly || {};
                  const summary = pipelineMetrics.summary || {};
                  const hours = Array.from({ length: 24 }, (_, i) => String(i));
                  const doneVals = hours.map(h => (hourly[h]?.done || 0));
                  const failVals = hours.map(h => (hourly[h]?.failed || 0));
                  const maxVal = Math.max(1, ...doneVals, ...failVals);
                  const W = 520, H = 90, PAD = 8;
                  const barW = (W - PAD * 2) / 24;
                  const recentJobs = pipelineMetrics.recent_jobs || [];
                  const JOB_COLORS = { video: "#0070cc", short: "#9b59b6", short_clip: "#8e44ad", script: "#00a896", podcast: "#f26522", compilation: "#e67e22", job: "#999" };
                  return (
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.12em", marginBottom: 14 }}>PIPELINE ACTIVITY — TODAY</div>
                      <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                        {[
                          { label: "DONE", value: summary.total_done || 0, color: T.accentGreen },
                          { label: "FAILED", value: summary.total_failed || 0, color: T.accentRed },
                          { label: "QUEUED", value: summary.pending || 0, color: T.accentYellow },
                        ].map(s => (
                          <div key={s.label}>
                            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 22, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                        <div style={{ marginLeft: "auto", fontSize: 9, color: T.textFaint, alignSelf: "flex-end" }}>{pipelineMetrics.date}</div>
                      </div>
                      <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} style={{ display: "block", overflow: "visible" }}>
                        {hours.map((h, i) => {
                          const dH = Math.round((doneVals[i] / maxVal) * H);
                          const fH = Math.round((failVals[i] / maxVal) * H);
                          const x = PAD + i * barW;
                          return (
                            <g key={h}>
                              {dH > 0 && <rect x={x + 1} y={H - dH} width={barW - 3} height={dH} fill={T.accentGreen} opacity={0.75} rx={2} />}
                              {fH > 0 && <rect x={x + 1} y={H - dH - fH} width={barW - 3} height={fH} fill={T.accentRed} opacity={0.75} rx={2} />}
                              {i % 4 === 0 && <text x={x + barW / 2} y={H + 12} textAnchor="middle" fontSize={8} fill={T.textFaint}>{h}h</text>}
                            </g>
                          );
                        })}
                        <line x1={PAD} y1={H} x2={W - PAD} y2={H} stroke={T.border} strokeWidth={1} />
                      </svg>
                      <div style={{ display: "flex", gap: 14, marginTop: 4, marginBottom: 16 }}>
                        {[{ c: T.accentGreen, l: "done" }, { c: T.accentRed, l: "failed" }].map(e => (
                          <div key={e.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: T.textFaint }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: e.c, opacity: 0.8 }} />{e.l}
                          </div>
                        ))}
                      </div>
                      {recentJobs.length > 0 && (
                        <>
                          <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>RECENT JOBS</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {recentJobs.slice(0, 10).map((j, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.textMid }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: j.status === "done" ? T.accentGreen : T.accentRed, flexShrink: 0, display: "inline-block" }} />
                                <span style={{ width: 70, fontSize: 9, color: JOB_COLORS[j.type] || T.textFaint, letterSpacing: "0.05em", flexShrink: 0 }}>{(j.type || "job").toUpperCase()}</span>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.prompt || "—"}</span>
                                <span style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>{j.duration_s}s</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {quota.chars_remaining !== undefined && (
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.12em",
                        marginBottom: 16,
                      }}
                    >
                      ELEVENLABS QUOTA
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {[
                        {
                          label: "USED",
                          value: quota.chars_used?.toLocaleString(),
                          color: T.accentRed,
                        },
                        {
                          label: "REMAINING",
                          value: quota.chars_remaining?.toLocaleString(),
                          color: T.accentGreen,
                        },
                        {
                          label: "LIMIT",
                          value: quota.chars_limit?.toLocaleString(),
                          color: T.textMid,
                        },
                        {
                          label: "TIER",
                          value: quota.tier?.toUpperCase() || "—",
                          color: T.accent,
                        },
                      ].map((q) => (
                        <div key={q.label}>
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.1em",
                              marginBottom: 4,
                            }}
                          >
                            {q.label}
                          </div>
                          <div
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                              fontSize: 16,
                              color: q.color,
                            }}
                          >
                            {q.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="prog-bar"
                      style={{ marginTop: 14, height: 4 }}
                    >
                      <div
                        className="prog-fill"
                        style={{
                          width: `${quota.percent_used || 0}%`,
                          background:
                            quota.percent_used > 80
                              ? T.accentRed
                              : "linear-gradient(90deg,#0070cc,#00e080)",
                        }}
                      />
                    </div>
                    <div
                      style={{ fontSize: 10, color: T.textFaint, marginTop: 6 }}
                    >
                      {quota.percent_used}% used this month
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── SETTINGS TAB ────────────────────────────────────────────────────── */}
            {tab === "settings" && (
              <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

                {/* ── LEFT COLUMN: Automation ── */}
                <div style={{ flex: 1, minWidth: 0, maxWidth: 540 }}>
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 700,
                    fontSize: 20,
                    color: T.text,
                    marginBottom: 20,
                  }}
                >
                  Automation
                </div>

                {/* ── Automation toggles ── */}
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 10,
                    }}
                  >
                    AUTOMATION
                  </div>
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: T.text }}
                      >
                        💬 Auto-Reply to Comments
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textFaint,
                          marginTop: 2,
                        }}
                      >
                        Runs every 2h · replies to real viewer comments with AI
                        {autoReplyStatus?.quota_backed_off && (
                          <span
                            style={{ color: T.accentYellow, marginLeft: 6 }}
                          >
                            ⏸ Quota hit — resumes in ~
                            {autoReplyStatus.resume_in_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <div
                      onClick={() => handleAutoReplyToggle(!autoReplyEnabled)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: autoReplyEnabled ? T.accentGreen : T.border,
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: autoReplyEnabled ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* ── Auto-Generate Settings ── */}
                {autoGenSettings && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                        marginBottom: 10,
                      }}
                    >
                      AUTO-GENERATE
                    </div>
                    <div
                      style={{
                        background: T.bgCard,
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        padding: "16px",
                      }}
                    >
                      {/* Enable toggle */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: T.text,
                            }}
                          >
                            🤖 Auto-Generate Videos
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: T.textFaint,
                              marginTop: 2,
                            }}
                          >
                            Automatically generates ready-to-review videos on a
                            schedule
                          </div>
                        </div>
                        <div
                          onClick={handleAutoGenEnabledToggle}
                          style={{
                            width: 44,
                            height: 24,
                            borderRadius: 12,
                            background: autoGenSettings.enabled
                              ? T.accentGreen
                              : T.border,
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 0.2s",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 3,
                              left: autoGenSettings.enabled ? 23 : 3,
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "#fff",
                              transition: "left 0.2s",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Days of week */}
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginBottom: 6,
                            letterSpacing: "0.08em",
                          }}
                        >
                          RUN ON DAYS
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                          ].map((d, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                const days = autoGenSettings.days.includes(i)
                                  ? autoGenSettings.days.filter((x) => x !== i)
                                  : [...autoGenSettings.days, i].sort();
                                setAutoGenSettings((s) => ({ ...s, days }));
                              }}
                              style={{
                                flex: 1,
                                padding: "5px 0",
                                borderRadius: 6,
                                border: `1px solid ${autoGenSettings.days.includes(i) ? T.accent + "80" : T.border}`,
                                background: autoGenSettings.days.includes(i)
                                  ? `${T.accent}15`
                                  : "transparent",
                                color: autoGenSettings.days.includes(i)
                                  ? T.accent
                                  : T.textFaint,
                                fontSize: 9,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginTop: 5,
                          }}
                        >
                          {autoGenSettings.days.length} days/week selected ·
                          runs at {autoGenSettings.hour}:00 UTC (={" "}
                          {autoGenSettings.hour + 1}:00 Amsterdam)
                          {autoGenSettings.enabled && (
                            <span style={{ color: T.accent, marginLeft: 6 }}>
                              · next: {calcNextRun(autoGenSettings.days, autoGenSettings.hour)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Profile */}
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginBottom: 6,
                            letterSpacing: "0.08em",
                          }}
                        >
                          CONTENT PROFILE
                        </div>
                        <div
                          style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
                        >
                          {[
                            "educational",
                            "serious",
                            "inspirational",
                            "reflective",
                          ].map((p) => (
                            <button
                              key={p}
                              onClick={() =>
                                setAutoGenSettings((s) => ({
                                  ...s,
                                  profile: p,
                                }))
                              }
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: `1px solid ${autoGenSettings.profile === p ? T.accent + "80" : T.border}`,
                                background:
                                  autoGenSettings.profile === p
                                    ? `${T.accent}15`
                                    : "transparent",
                                color:
                                  autoGenSettings.profile === p
                                    ? T.accent
                                    : T.textFaint,
                                fontSize: 10,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                textTransform: "capitalize",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save + Trigger */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={async () => {
                            setAutoGenSaving(true);
                            try {
                              await api.post(
                                "/auto-generate/settings",
                                autoGenSettings,
                              );
                              showToast("Auto-generate settings saved");
                            } catch (e) {
                              showToast("Failed to save", "error");
                            } finally {
                              setAutoGenSaving(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 7,
                            border: `1px solid ${T.accent}50`,
                            background: `${T.accent}10`,
                            color: T.accent,
                            fontSize: 11,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {autoGenSaving ? "Saving..." : "💾 Save Settings"}
                        </button>
                        <button
                          disabled={autoGenRunning}
                          onClick={async () => {
                            try {
                              const res = await api.post(
                                "/auto-generate/trigger",
                              );
                              const vid = res.data?.video_id;
                              if (!vid) {
                                showToast(
                                  "Server did not return a video ID",
                                  "error",
                                );
                                return;
                              }

                              setAutoGenJobId(vid);
                              setAutoGenPrompt(res.data.prompt || "");
                              setAutoGenRunning(true);
                              setAutoGenStep(1);
                              setAutoGenLogs([]);
                              autoGenLogLineRef.current = 0;
                              setShowAutoGenLogs(true);
                              showToast("🤖 Auto-generate started!");

                              // Poll for step progress — use functional updater to avoid stale closure
                              const stepMap = {
                                generating: 1,
                                scripted: 2,
                                voiced: 3,
                                assembled: 4,
                                captioned: 5,
                                labeled: 5,
                                ready: 6,
                                posted: 6,
                              };
                              const stepPoll = setInterval(async () => {
                                try {
                                  const { data: st } = await api.get(
                                    `/videos/${vid}`,
                                  );
                                  if (st?.status)
                                    setAutoGenStep(stepMap[st.status] ?? 1);
                                  if (
                                    ["ready", "posted", "failed"].includes(
                                      st?.status,
                                    )
                                  ) {
                                    clearInterval(stepPoll);
                                    clearInterval(autoGenLogPollRef.current);
                                    setAutoGenRunning(false);
                                    setTimeout(() => setShowAutoGenLogs(false), 2500);
                                    if (st.status === "failed") {
                                      showToast("Auto-generate failed", "error");
                                      addNotification("Auto-Generate Failed", "The auto-generate video pipeline failed.", "error");
                                    } else {
                                      showToast("✅ Auto-generated video ready!");
                                      addNotification("Auto-Generated Video Ready", "Your auto-generated video is ready.");
                                      refresh();
                                    }
                                  }
                                } catch (e) {}
                              }, 4000);

                              // Poll logs
                              autoGenLogPollRef.current = setInterval(
                                async () => {
                                  try {
                                    const { data: ld } = await api.get(
                                      `/videos/${vid}/logs?since=${autoGenLogLineRef.current}`,
                                    );
                                    if (ld?.lines?.length > 0) {
                                      autoGenLogLineRef.current +=
                                        ld.lines.length;
                                      setAutoGenLogs((prev) =>
                                        [...prev, ...ld.lines].slice(-300),
                                      );
                                      setTimeout(
                                        () =>
                                          autoGenLogsEndRef.current?.scrollIntoView(
                                            { behavior: "smooth" },
                                          ),
                                        50,
                                      );
                                    }
                                    if (ld?.done)
                                      clearInterval(autoGenLogPollRef.current);
                                  } catch (e) {}
                                },
                                1500,
                              );
                            } catch (e) {
                              showToast(
                                e.response?.data?.detail || "Failed to trigger",
                                "error",
                              );
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 7,
                            border: `1px solid ${autoGenRunning ? T.border : T.accentGreen + "60"}`,
                            background: autoGenRunning
                              ? "transparent"
                              : `${T.accentGreen}10`,
                            color: autoGenRunning ? T.textFaint : T.accentGreen,
                            fontSize: 11,
                            fontFamily: "inherit",
                            cursor: autoGenRunning ? "not-allowed" : "pointer",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {autoGenRunning ? "⚙ Running..." : "▶ Run Now"}
                        </button>
                      </div>

                      {/* Progress panel — appears when auto-generate is running */}
                      {autoGenRunning && (
                        <div
                          style={{
                            marginTop: 16,
                            borderTop: `1px solid ${T.border}`,
                            paddingTop: 16,
                          }}
                        >
                          {autoGenPrompt && (
                            <div
                              style={{
                                fontSize: 11,
                                color: T.textMid,
                                marginBottom: 12,
                                fontStyle: "italic",
                              }}
                            >
                              "{autoGenPrompt}"
                            </div>
                          )}
                          {/* Step circles */}
                          <div
                            style={{
                              display: "flex",
                              gap: 0,
                              alignItems: "center",
                              marginBottom: 14,
                            }}
                          >
                            {STEPS.map((s, i) => {
                              const done = i < autoGenStep - 1,
                                active = i === autoGenStep - 1;
                              return (
                                <div
                                  key={s}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "relative",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {active && (
                                        <>
                                          <div
                                            style={{
                                              position: "absolute",
                                              borderRadius: "50%",
                                              width: 32,
                                              height: 32,
                                              border: `2px solid ${T.accent}`,
                                              animation:
                                                "ringPulse 1.4s ease-out infinite",
                                              opacity: 0,
                                            }}
                                          />
                                          <div
                                            style={{
                                              position: "absolute",
                                              borderRadius: "50%",
                                              width: 40,
                                              height: 40,
                                              border: `1.5px solid ${T.accent}`,
                                              animation:
                                                "ringPulse 1.4s ease-out infinite 0.4s",
                                              opacity: 0,
                                            }}
                                          />
                                        </>
                                      )}
                                      <div
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: "50%",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 10,
                                          fontWeight: 700,
                                          background: done
                                            ? T.accentGreen
                                            : active
                                              ? T.accent
                                              : T.bgDeep,
                                          color:
                                            done || active
                                              ? "white"
                                              : T.textFaint,
                                          transition: "all 0.4s",
                                          boxShadow: active
                                            ? `0 0 14px ${T.accent}80`
                                            : "none",
                                          zIndex: 1,
                                        }}
                                      >
                                        {done ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 8,
                                        color: active
                                          ? T.accent
                                          : done
                                            ? T.accentGreen
                                            : T.textFaint,
                                        letterSpacing: "0.06em",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {s.toUpperCase()}
                                    </div>
                                  </div>
                                  {i < STEPS.length - 1 && (
                                    <div
                                      style={{
                                        flex: 1,
                                        height: 2,
                                        background: done
                                          ? T.accentGreen
                                          : T.border,
                                        margin: "0 3px",
                                        marginBottom: 18,
                                        transition: "background 0.4s",
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* View Logs + Cancel */}
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setShowAutoGenLogs(true)}
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: "transparent",
                                color: T.textMid,
                                fontSize: 10,
                                fontFamily: "inherit",
                                letterSpacing: "0.07em",
                                cursor: "pointer",
                              }}
                            >
                              📋 VIEW LOGS
                            </button>
                            <button
                              onClick={async () => {
                                clearInterval(autoGenLogPollRef.current);
                                if (autoGenJobId) {
                                  try {
                                    await api.post(
                                      `/videos/${autoGenJobId}/cancel`,
                                    );
                                  } catch (e) {}
                                }
                                setAutoGenRunning(false);
                                setAutoGenStep(0);
                                showToast("Cancelled", "error");
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: `1px solid ${T.accentRed}40`,
                                background: `${T.accentRed}08`,
                                color: T.accentRed,
                                fontSize: 10,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                letterSpacing: "0.07em",
                              }}
                            >
                              🛑 CANCEL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-gen log modal */}
                {showAutoGenLogs && (
                  <div
                    onClick={() => setShowAutoGenLogs(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.75)",
                      zIndex: 200,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 20,
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        maxWidth: 700,
                        maxHeight: "70vh",
                        background: "#0a0a0f",
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 18px",
                          borderBottom: `1px solid ${T.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.text,
                            letterSpacing: "0.1em",
                          }}
                        >
                          AUTO-GENERATE LOGS
                        </div>
                        <button
                          onClick={() => setShowAutoGenLogs(false)}
                          style={{
                            background: "none",
                            border: "none",
                            color: T.textFaint,
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: "12px 18px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          lineHeight: 1.7,
                        }}
                      >
                        {autoGenLogs.length === 0 ? (
                          <div style={{ color: T.textFaint }}>
                            Waiting for pipeline output...
                          </div>
                        ) : (
                          autoGenLogs.map((line, i) => (
                            <div
                              key={i}
                              style={{
                                color: line.startsWith("[ERROR]")
                                  ? "#ff6060"
                                  : line.startsWith("[DONE]")
                                    ? "#60ff60"
                                    : "#a0d0a0",
                              }}
                            >
                              {line}
                            </div>
                          ))
                        )}
                        <div ref={autoGenLogsEndRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Auto-Short Settings ── */}
                {autoShortSettings && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
                      AUTO-SHORT
                    </div>
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px" }}>
                      {/* Enable toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>📱 Auto-Generate Shorts</div>
                          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                            Automatically generates portrait 9:16 Shorts on a schedule
                          </div>
                        </div>
                        <div
                          onClick={handleAutoShortEnabledToggle}
                          style={{
                            width: 44, height: 24, borderRadius: 12,
                            background: autoShortSettings.enabled ? T.accentGreen : T.border,
                            cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 3,
                            left: autoShortSettings.enabled ? 23 : 3,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          }} />
                        </div>
                      </div>

                      {/* Days of week */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>RUN ON DAYS</div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                            <button key={i}
                              onClick={() => {
                                const days = autoShortSettings.days.includes(i)
                                  ? autoShortSettings.days.filter(x => x !== i)
                                  : [...autoShortSettings.days, i].sort();
                                setAutoShortSettings(s => ({ ...s, days }));
                              }}
                              style={{
                                flex: 1, padding: "5px 0", borderRadius: 6,
                                border: `1px solid ${autoShortSettings.days.includes(i) ? T.accent + "80" : T.border}`,
                                background: autoShortSettings.days.includes(i) ? `${T.accent}15` : "transparent",
                                color: autoShortSettings.days.includes(i) ? T.accent : T.textFaint,
                                fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em",
                              }}
                            >{d}</button>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 5 }}>
                          {autoShortSettings.days.length} days/week · runs at {autoShortSettings.hour}:00 UTC
                          {autoShortSettings.enabled && (
                            <span style={{ color: T.accent }}> · next: {calcNextRun(autoShortSettings.days, autoShortSettings.hour)}</span>
                          )}
                        </div>
                      </div>

                      {/* Hour input */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>RUN HOUR (UTC)</div>
                        <input
                          type="number" min={0} max={23}
                          value={autoShortSettings.hour}
                          onChange={e => setAutoShortSettings(s => ({ ...s, hour: parseInt(e.target.value) || 0 }))}
                          style={{
                            width: 80, padding: "5px 8px", borderRadius: 6,
                            border: `1px solid ${T.border}`, background: T.inputBg,
                            color: T.text, fontSize: 12, fontFamily: "inherit",
                          }}
                        />
                      </div>

                      {/* Ambience selector */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>AMBIENCE</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {["stars","aurora","ocean","fire","rain","galaxy"].map(a => (
                            <button key={a}
                              onClick={() => setAutoShortSettings(s => ({ ...s, ambience: a }))}
                              style={{
                                padding: "5px 10px", borderRadius: 6,
                                border: `1px solid ${autoShortSettings.ambience === a ? T.accent + "80" : T.border}`,
                                background: autoShortSettings.ambience === a ? `${T.accent}15` : "transparent",
                                color: autoShortSettings.ambience === a ? T.accent : T.textFaint,
                                fontSize: 10, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize",
                              }}
                            >{a}</button>
                          ))}
                        </div>
                      </div>

                      {/* Music selector */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>BACKGROUND MUSIC</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                          {[
                            { id: "Birds_Atmosphere_Piano", label: "🌙 Birds & Piano" },
                            { id: "Birds_Atmosphere_Wing",  label: "🍃 Birds & Wing" },
                            { id: "Laidback_Fevorite",      label: "🎹 Laidback Fav" },
                            { id: "Pads_EPiano",            label: "🎧 Pads & EPiano" },
                            { id: "Pads",                   label: "🎵 Pads" },
                            { id: "swingPiano",             label: "🎷 Swing Piano" },
                            { id: "none",                   label: "🔇 None" },
                          ].map(m => (
                            <button key={m.id}
                              onClick={() => setAutoShortSettings(s => ({ ...s, music_style: m.id }))}
                              style={{
                                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                                border: `1px solid ${(autoShortSettings.music_style || "Laidback_Fevorite") === m.id ? T.accentGreen + "80" : T.border}`,
                                background: (autoShortSettings.music_style || "Laidback_Fevorite") === m.id ? `${T.accentGreen}10` : "transparent",
                                color: (autoShortSettings.music_style || "Laidback_Fevorite") === m.id ? T.accentGreen : T.textFaint,
                                fontSize: 9, fontFamily: "inherit",
                              }}
                            >{m.label}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>VOL</div>
                          <input type="range" min={0} max={0.5} step={0.01}
                            value={autoShortSettings.music_volume ?? 0.04}
                            onChange={e => setAutoShortSettings(s => ({ ...s, music_volume: parseFloat(e.target.value) }))}
                            style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
                          />
                          <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>{Math.round((autoShortSettings.music_volume ?? 0.04) * 100)}%</div>
                        </div>
                        {(autoShortSettings.music_style || "Laidback_Fevorite") !== "none" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>DELAY</div>
                            <input type="range" min={0} max={5} step={0.1}
                              value={autoShortSettings.music_delay ?? 0}
                              onChange={e => setAutoShortSettings(s => ({ ...s, music_delay: parseFloat(e.target.value) }))}
                              style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
                            />
                            <div style={{ fontSize: 9, color: T.textFaint, width: 32, textAlign: "right" }}>{(autoShortSettings.music_delay ?? 0).toFixed(1)}s</div>
                          </div>
                        )}
                      </div>

                      {/* Save + Run Now */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={async () => {
                            setAutoShortSaving(true);
                            try {
                              await saveAutoShortSettings(autoShortSettings);
                              // Sync to global shorts config in localStorage
                              const cfg = { ambience: autoShortSettings.ambience, music_style: autoShortSettings.music_style, music_volume: autoShortSettings.music_volume };
                              try { localStorage.setItem("autovid_shorts_cfg", JSON.stringify(cfg)); } catch {}
                              showToast("Auto-short settings saved");
                            } catch (e) {
                              showToast("Failed to save", "error");
                            } finally {
                              setAutoShortSaving(false);
                            }
                          }}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 7,
                            border: `1px solid ${T.accent}50`, background: `${T.accent}10`,
                            color: T.accent, fontSize: 11, fontFamily: "inherit",
                            cursor: "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {autoShortSaving ? "Saving..." : "💾 Save Settings"}
                        </button>
                        <button
                          disabled={autoShortRunning}
                          onClick={async () => {
                            try {
                              const res = await triggerAutoShort();
                              const vid = res?.video_id;
                              if (!vid) { showToast("Server did not return a video ID", "error"); return; }
                              setAutoShortJobId(vid);
                              setAutoShortPrompt(res.topic || "");
                              setAutoShortRunning(true);
                              setAutoShortStep(1);
                              setAutoShortLogs([]);
                              autoShortLogLineRef.current = 0;
                              setShowAutoShortLogs(true);
                              showToast("📱 Auto-short started!");

                              const stepMap = { generating:1, scripted:2, voiced:3, assembled:4, captioned:5, labeled:5, ready:6, posted:6 };
                              const stepPoll = setInterval(async () => {
                                try {
                                  const { data: st } = await api.get(`/videos/${vid}`);
                                  if (st?.status) setAutoShortStep(stepMap[st.status] ?? 1);
                                  if (["ready","posted","failed"].includes(st?.status)) {
                                    clearInterval(stepPoll);
                                    clearInterval(autoShortLogPollRef.current);
                                    setAutoShortRunning(false);
                                    setTimeout(() => setShowAutoShortLogs(false), 2500);
                                    if (st.status === "failed") { showToast("Auto-short failed", "error"); addNotification("Auto-Short Failed", "The auto-short pipeline failed.", "error"); }
                                    else { showToast("✅ Auto-short ready!"); addNotification("Auto-Short Ready", "Your auto-short has been generated."); refresh(); }
                                  }
                                } catch (e) {}
                              }, 4000);

                              autoShortLogPollRef.current = setInterval(async () => {
                                try {
                                  const { data: ld } = await api.get(`/videos/${vid}/logs?since=${autoShortLogLineRef.current}`);
                                  if (ld?.lines?.length > 0) {
                                    autoShortLogLineRef.current += ld.lines.length;
                                    setAutoShortLogs(prev => [...prev, ...ld.lines].slice(-300));
                                    setTimeout(() => autoShortLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                                  }
                                  if (ld?.done) clearInterval(autoShortLogPollRef.current);
                                } catch (e) {}
                              }, 1500);
                            } catch (e) {
                              showToast(e.response?.data?.detail || "Failed to trigger", "error");
                            }
                          }}
                          style={{
                            padding: "8px 14px", borderRadius: 7,
                            border: `1px solid ${autoShortRunning ? T.border : T.accentGreen + "60"}`,
                            background: autoShortRunning ? "transparent" : `${T.accentGreen}10`,
                            color: autoShortRunning ? T.textFaint : T.accentGreen,
                            fontSize: 11, fontFamily: "inherit",
                            cursor: autoShortRunning ? "not-allowed" : "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {autoShortRunning ? "⚙ Running..." : "▶ Run Now"}
                        </button>
                      </div>

                      {/* Progress panel */}
                      {autoShortRunning && (
                        <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                          {autoShortPrompt && (
                            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12, fontStyle: "italic" }}>
                              "{autoShortPrompt}"
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 0, alignItems: "center", marginBottom: 14 }}>
                            {STEPS.map((s, i) => {
                              const done = i < autoShortStep - 1, active = i === autoShortStep - 1;
                              return (
                                <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <div style={{
                                        width: 24, height: 24, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700,
                                        background: done ? T.accentGreen : active ? T.accent : T.bgDeep,
                                        color: done || active ? "white" : T.textFaint,
                                        transition: "all 0.4s",
                                        boxShadow: active ? `0 0 14px ${T.accent}80` : "none", zIndex: 1,
                                      }}>
                                        {done ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <div style={{
                                      fontSize: 8, color: active ? T.accent : done ? T.accentGreen : T.textFaint,
                                      letterSpacing: "0.06em", whiteSpace: "nowrap",
                                    }}>
                                      {s.toUpperCase()}
                                    </div>
                                  </div>
                                  {i < STEPS.length - 1 && (
                                    <div style={{
                                      flex: 1, height: 2,
                                      background: done ? T.accentGreen : T.border,
                                      margin: "0 3px", marginBottom: 18, transition: "background 0.4s",
                                    }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setShowAutoShortLogs(true)}
                              style={{
                                flex: 1, padding: "6px 0", borderRadius: 6,
                                border: `1px solid ${T.border}`, background: "transparent",
                                color: T.textMid, fontSize: 10, fontFamily: "inherit",
                                letterSpacing: "0.07em", cursor: "pointer",
                              }}
                            >📋 VIEW LOGS</button>
                            <button
                              onClick={() => {
                                clearInterval(autoShortLogPollRef.current);
                                setAutoShortRunning(false);
                                setAutoShortStep(0);
                                showToast("Cancelled", "error");
                              }}
                              style={{
                                padding: "6px 12px", borderRadius: 6,
                                border: `1px solid ${T.accentRed}40`, background: `${T.accentRed}08`,
                                color: T.accentRed, fontSize: 10, fontFamily: "inherit",
                                cursor: "pointer", letterSpacing: "0.07em",
                              }}
                            >🛑 CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Auto-Podcast Settings ── */}
                {podcastSettings && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
                      AUTO-PODCAST
                    </div>
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px" }}>
                      {/* Header row: icon + toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>🎙</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Auto-Podcast</div>
                            <div style={{ fontSize: 10, color: T.textFaint }}>LLM essay → TTS → ambient music → RSS feed</div>
                          </div>
                        </div>
                        <div
                          onClick={handlePodcastEnabledToggle}
                          style={{
                            width: 44, height: 24, borderRadius: 12,
                            background: podcastSettings.enabled ? T.accentGreen : T.border,
                            cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 3,
                            left: podcastSettings.enabled ? 23 : 3,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          }} />
                        </div>
                      </div>

                      {/* Schedule: days */}
                      <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>SCHEDULE</div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => (
                          <button key={i}
                            onClick={() => {
                              const days = podcastSettings.days.includes(i)
                                ? podcastSettings.days.filter(x => x !== i)
                                : [...podcastSettings.days, i].sort();
                              setPodcastSettings(s => ({ ...s, days }));
                            }}
                            style={{
                              flex: 1, padding: "5px 0", borderRadius: 6,
                              border: `1px solid ${podcastSettings.days.includes(i) ? T.accent + "80" : T.border}`,
                              background: podcastSettings.days.includes(i) ? `${T.accent}15` : "transparent",
                              color: podcastSettings.days.includes(i) ? T.accent : T.textFaint,
                              fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em",
                            }}
                          >{d}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 12 }}>
                        {podcastSettings.days.length} days/week · runs at {podcastSettings.hour}:00 UTC
                        {podcastSettings.enabled && (
                          <span style={{ color: T.accent }}> · next: {calcNextRun(podcastSettings.days, podcastSettings.hour)}</span>
                        )}
                      </div>

                      {/* Hour + music style */}
                      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "0 0 auto" }}>
                          <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>HOUR (UTC)</div>
                          <input
                            type="number" min={0} max={23}
                            value={podcastSettings.hour}
                            onChange={e => setPodcastSettings(s => ({ ...s, hour: parseInt(e.target.value) || 0 }))}
                            style={{
                              width: 80, padding: "5px 8px", borderRadius: 6,
                              background: T.bgDeep, border: `1px solid ${T.border}`,
                              color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none",
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>BACKGROUND MUSIC</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {["Birds_Atmosphere_Piano","Birds_Atmosphere_Wing","Laidback_Fevorite","Pads_EPiano","Pads","swingPiano","none"].map(s => (
                              <button key={s}
                                onClick={() => setPodcastSettings(ps => ({ ...ps, music_style: s }))}
                                style={{
                                  padding: "5px 10px", borderRadius: 6,
                                  border: `1px solid ${podcastSettings.music_style === s ? T.accent + "80" : T.border}`,
                                  background: podcastSettings.music_style === s ? `${T.accent}15` : "transparent",
                                  color: podcastSettings.music_style === s ? T.accent : T.textFaint,
                                  fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                                }}
                              >{s.replace(/_/g, " ")}</button>
                            ))}
                          </div>
                          {/* Music volume */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", flexShrink: 0 }}>VOL</div>
                            <input
                              type="range" min={0} max={0.5} step={0.01}
                              value={podcastMusicVolume}
                              onChange={e => setPodcastMusicVolume(parseFloat(e.target.value))}
                              style={{ flex: 1, accentColor: T.accent, cursor: "pointer" }}
                            />
                            <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>
                              {Math.round(podcastMusicVolume * 100)}%
                            </div>
                          </div>
                          {podcastSettings?.music_style !== "none" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", flexShrink: 0 }}>DELAY</div>
                              <input
                                type="range" min={0} max={5} step={0.1}
                                value={podcastMusicDelay}
                                onChange={e => setPodcastMusicDelay(parseFloat(e.target.value))}
                                style={{ flex: 1, accentColor: T.accent, cursor: "pointer" }}
                              />
                              <div style={{ fontSize: 9, color: T.textFaint, width: 32, textAlign: "right" }}>
                                {podcastMusicDelay.toFixed(1)}s
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Custom Topics ── */}
                      {(() => {
                        const customTopics = podcastSettings.topics || [];
                        const hasCustom = customTopics.length > 0;
                        const parsedInput = topicsInputText
                          .split("\n")
                          .map(t => t.trim())
                          .filter(Boolean);

                        return (
                          <div style={{
                            marginBottom: 14,
                            background: T.bgDeep,
                            border: `1px solid ${hasCustom ? T.accent + "50" : T.border}`,
                            borderRadius: 8,
                            overflow: "hidden",
                          }}>
                            {/* Header row */}
                            <div
                              onClick={() => {
                                if (!showTopicsPanel) {
                                  setTopicsInputText(customTopics.join("\n"));
                                }
                                setShowTopicsPanel(v => !v);
                              }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "9px 12px", cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14 }}>📋</span>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                                    Custom Topics
                                  </div>
                                  <div style={{ fontSize: 10, color: hasCustom ? T.accent : T.textFaint }}>
                                    {hasCustom
                                      ? `✓ Using ${customTopics.length} custom topic${customTopics.length !== 1 ? "s" : ""}`
                                      : "Using built-in defaults (107 topics)"}
                                  </div>
                                </div>
                              </div>
                              <span style={{ fontSize: 11, color: T.textFaint }}>
                                {showTopicsPanel ? "▲" : "▼"}
                              </span>
                            </div>

                            {/* Expanded panel */}
                            {showTopicsPanel && (
                              <div style={{ padding: "0 12px 12px" }}>
                                <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, lineHeight: 1.6 }}>
                                  Paste your topics below — one per line. When saved, automation will cycle through these
                                  instead of the built-in list. Purge to revert to defaults.
                                </div>
                                <textarea
                                  value={topicsInputText}
                                  onChange={e => setTopicsInputText(e.target.value)}
                                  rows={10}
                                  placeholder={"Why silence is the loudest truth\nThe thing we never say out loud\nWhat ancient civilisations knew that we forgot\n...one topic per line"}
                                  style={{
                                    width: "100%", boxSizing: "border-box",
                                    background: T.bgCard, border: `1px solid ${T.border}`,
                                    borderRadius: 6, padding: "8px 10px",
                                    color: T.text, fontSize: 11, fontFamily: "monospace",
                                    resize: "vertical", outline: "none", lineHeight: 1.6,
                                  }}
                                />
                                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4, marginBottom: 10 }}>
                                  {parsedInput.length > 0
                                    ? <span style={{ color: T.accentGreen }}>{parsedInput.length} topic{parsedInput.length !== 1 ? "s" : ""} ready to save</span>
                                    : "No topics entered"}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    disabled={podcastTopicsSaving || parsedInput.length === 0}
                                    onClick={async () => {
                                      setPodcastTopicsSaving(true);
                                      try {
                                        const updated = { ...podcastSettings, topics: parsedInput };
                                        await savePodcastSettings(updated);
                                        setPodcastSettings(updated);
                                        showToast(`✅ ${parsedInput.length} custom topics saved`);
                                        setShowTopicsPanel(false);
                                      } catch {
                                        showToast("Failed to save topics", "error");
                                      } finally {
                                        setPodcastTopicsSaving(false);
                                      }
                                    }}
                                    style={{
                                      flex: 1, padding: "7px 0", borderRadius: 6,
                                      border: `1px solid ${parsedInput.length === 0 ? T.border : T.accentGreen + "70"}`,
                                      background: parsedInput.length === 0 ? "transparent" : `${T.accentGreen}12`,
                                      color: parsedInput.length === 0 ? T.textFaint : T.accentGreen,
                                      fontSize: 11, fontFamily: "inherit", cursor: parsedInput.length === 0 ? "not-allowed" : "pointer",
                                      fontWeight: 600, letterSpacing: "0.05em",
                                    }}
                                  >
                                    {podcastTopicsSaving ? "Saving..." : "💾 Save topics"}
                                  </button>
                                  {hasCustom && (
                                    <button
                                      disabled={podcastTopicsSaving}
                                      onClick={async () => {
                                        setPodcastTopicsSaving(true);
                                        try {
                                          const updated = { ...podcastSettings, topics: [] };
                                          await savePodcastSettings(updated);
                                          setPodcastSettings(updated);
                                          setTopicsInputText("");
                                          showToast("Topics purged — reverted to defaults");
                                          setShowTopicsPanel(false);
                                        } catch {
                                          showToast("Failed to purge topics", "error");
                                        } finally {
                                          setPodcastTopicsSaving(false);
                                        }
                                      }}
                                      style={{
                                        padding: "7px 14px", borderRadius: 6,
                                        border: `1px solid ${T.accentRed}50`,
                                        background: `${T.accentRed}0a`,
                                        color: T.accentRed, fontSize: 11,
                                        fontFamily: "inherit", cursor: "pointer",
                                        letterSpacing: "0.05em",
                                      }}
                                    >
                                      🗑 Purge
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Save + Run Now buttons */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button
                          onClick={async () => {
                            setPodcastSaving(true);
                            try {
                              await savePodcastSettings(podcastSettings);
                              showToast("Podcast settings saved");
                            } catch (e) {
                              showToast("Failed to save", "error");
                            } finally {
                              setPodcastSaving(false);
                            }
                          }}
                          style={{
                            padding: "8px 14px", borderRadius: 7,
                            border: `1px solid ${T.border}`, background: "transparent",
                            color: T.textMid, fontSize: 11, fontFamily: "inherit",
                            cursor: "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {podcastSaving ? "Saving..." : "💾 Save Settings"}
                        </button>
                        <button
                          disabled={podcastRunning}
                          onClick={async () => {
                            try {
                              const res = await triggerAutoPodcast();
                              const vid = res?.video_id;
                              if (!vid) { showToast("Server did not return a video ID", "error"); return; }
                              _startPodcastPolling(vid, res.topic || "");
                              showToast("🎙 Auto-podcast started!");
                            } catch (e) {
                              showToast("Failed to start", "error");
                            }
                          }}
                          style={{
                            padding: "8px 14px", borderRadius: 7,
                            border: `1px solid ${podcastRunning ? T.border : T.accentGreen + "60"}`,
                            background: podcastRunning ? "transparent" : `${T.accentGreen}10`,
                            color: podcastRunning ? T.textFaint : T.accentGreen,
                            fontSize: 11, fontFamily: "inherit",
                            cursor: podcastRunning ? "not-allowed" : "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {podcastRunning ? "⚙ Running..." : "▶ Run Now"}
                        </button>
                        <button
                          onClick={() => setShowPodcastManual(s => !s)}
                          style={{
                            padding: "8px 14px", borderRadius: 7,
                            border: `1px solid ${T.border}`, background: "transparent",
                            color: T.textMid, fontSize: 11, fontFamily: "inherit",
                            cursor: "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          ✍ Custom Episode
                        </button>
                      </div>

                      {/* Manual episode form */}
                      {showPodcastManual && (
                        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 4 }}>
                          <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 8 }}>CUSTOM EPISODE</div>
                          <input
                            placeholder="Topic (LLM will write the essay)…"
                            value={manualPodcastTopic}
                            onChange={e => setManualPodcastTopic(e.target.value)}
                            style={{
                              width: "100%", padding: "8px 10px", borderRadius: 7, marginBottom: 8,
                              background: T.bgDeep, border: `1px solid ${T.border}`,
                              color: T.text, fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                            }}
                          />
                          <textarea
                            placeholder="Or paste your own essay directly (skips LLM)…"
                            value={manualPodcastEssay}
                            onChange={e => setManualPodcastEssay(e.target.value)}
                            rows={5}
                            style={{
                              width: "100%", padding: "8px 10px", borderRadius: 7, marginBottom: 8,
                              background: T.bgDeep, border: `1px solid ${T.border}`,
                              color: T.text, fontSize: 11, fontFamily: "inherit", outline: "none",
                              resize: "vertical", boxSizing: "border-box",
                            }}
                          />
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}>Music:</div>
                            {[
                              { id: "Birds_Atmosphere_Piano", label: "🌙 Birds & Piano" },
                              { id: "Birds_Atmosphere_Wing",  label: "🍃 Birds & Wing" },
                              { id: "Laidback_Fevorite",      label: "🎹 Laidback Fav" },
                              { id: "Pads_EPiano",            label: "🎧 Pads & EPiano" },
                              { id: "Pads",                   label: "🎵 Pads" },
                              { id: "swingPiano",             label: "🎷 Swing Piano" },
                              { id: "none",                   label: "🔇 None" },
                            ].map(m => (
                              <button key={m.id}
                                onClick={() => setManualPodcastMusic(m.id)}
                                style={{
                                  padding: "4px 8px", borderRadius: 6, fontSize: 10, fontFamily: "inherit",
                                  border: `1px solid ${manualPodcastMusic === m.id ? T.accent + "80" : T.border}`,
                                  background: manualPodcastMusic === m.id ? `${T.accent}15` : "transparent",
                                  color: manualPodcastMusic === m.id ? T.accent : T.textFaint,
                                  cursor: "pointer",
                                }}
                              >{m.label}</button>
                            ))}
                          </div>
                          {/* Music volume */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", flexShrink: 0 }}>VOL</div>
                            <input
                              type="range" min={0} max={0.5} step={0.01}
                              value={podcastMusicVolume}
                              onChange={e => setPodcastMusicVolume(parseFloat(e.target.value))}
                              style={{ flex: 1, accentColor: T.accent, cursor: "pointer" }}
                            />
                            <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>
                              {Math.round(podcastMusicVolume * 100)}%
                            </div>
                          </div>
                          {manualPodcastMusic !== "none" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", flexShrink: 0 }}>DELAY</div>
                              <input
                                type="range" min={0} max={5} step={0.1}
                                value={podcastMusicDelay}
                                onChange={e => setPodcastMusicDelay(parseFloat(e.target.value))}
                                style={{ flex: 1, accentColor: T.accent, cursor: "pointer" }}
                              />
                              <div style={{ fontSize: 9, color: T.textFaint, width: 32, textAlign: "right" }}>
                                {podcastMusicDelay.toFixed(1)}s
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              disabled={podcastRunning || (!manualPodcastTopic.trim() && !manualPodcastEssay.trim())}
                              onClick={async () => {
                                try {
                                  const res = await generatePodcastEpisode({
                                    topic: manualPodcastTopic || null,
                                    essay: manualPodcastEssay || null,
                                    music_style: manualPodcastMusic,
                                    music_volume: podcastMusicVolume,
                                    music_delay: podcastMusicDelay,
                                  });
                                  if (!res?.video_id) { showToast("No video ID returned", "error"); return; }
                                  _startPodcastPolling(res.video_id, manualPodcastTopic);
                                  setShowPodcastManual(false);
                                  setManualPodcastTopic("");
                                  setManualPodcastEssay("");
                                  showToast("🎙 Custom podcast episode started!");
                                } catch (e) {
                                  showToast("Failed to start", "error");
                                }
                              }}
                              style={{
                                padding: "7px 16px", borderRadius: 7,
                                border: `1px solid ${T.accent}60`,
                                background: `${T.accent}10`, color: T.accent,
                                fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                              }}
                            >▶ Generate</button>
                          </div>
                        </div>
                      )}

                      {/* Progress panel */}
                      {podcastRunning && (
                        <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                          {podcastTopic && (
                            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12, fontStyle: "italic" }}>
                              "{podcastTopic}"
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 0, alignItems: "center", marginBottom: 14 }}>
                            {["Essay","Voice","Music","Upload","Ready"].map((s, i) => {
                              const done = i < podcastStep - 1, active = i === podcastStep - 1;
                              return (
                                <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <div style={{
                                        width: 24, height: 24, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700,
                                        background: done ? T.accentGreen : active ? T.accent : T.bgDeep,
                                        color: done || active ? "white" : T.textFaint,
                                        transition: "all 0.4s",
                                        boxShadow: active ? `0 0 14px ${T.accent}80` : "none", zIndex: 1,
                                      }}>
                                        {done ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <div style={{
                                      fontSize: 8, color: active ? T.accent : done ? T.accentGreen : T.textFaint,
                                      letterSpacing: "0.06em", whiteSpace: "nowrap",
                                    }}>
                                      {s.toUpperCase()}
                                    </div>
                                  </div>
                                  {i < 4 && (
                                    <div style={{
                                      flex: 1, height: 2,
                                      background: done ? T.accentGreen : T.border,
                                      margin: "0 3px", marginBottom: 18, transition: "background 0.4s",
                                    }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setShowPodcastLogs(true)}
                              style={{
                                flex: 1, padding: "6px 0", borderRadius: 6,
                                border: `1px solid ${T.border}`, background: "transparent",
                                color: T.textMid, fontSize: 10, fontFamily: "inherit",
                                letterSpacing: "0.07em", cursor: "pointer",
                              }}
                            >📋 VIEW LOGS</button>
                            <button
                              onClick={() => {
                                clearInterval(podcastLogPollRef.current);
                                setPodcastRunning(false);
                                setPodcastStep(0);
                                showToast("Cancelled", "error");
                              }}
                              style={{
                                padding: "6px 12px", borderRadius: 6,
                                border: `1px solid ${T.accentRed}40`, background: `${T.accentRed}08`,
                                color: T.accentRed, fontSize: 10, fontFamily: "inherit",
                                cursor: "pointer", letterSpacing: "0.07em",
                              }}
                            >🛑 CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TikTok Connect ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>TIKTOK</div>
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                        {tiktokConnected ? "✅ TikTok Connected" : "🎵 Connect TikTok"}
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                        {tiktokConnected ? "Auto-post shorts to TikTok" : "Authorise to enable TikTok uploads"}
                      </div>
                    </div>
                    {tiktokConnected ? (
                      <button
                        onClick={async () => {
                          setTiktokLoading(true);
                          await disconnectTikTok().catch(() => {});
                          setTiktokConnected(false);
                          setTiktokLoading(false);
                        }}
                        disabled={tiktokLoading}
                        style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}
                      >
                        DISCONNECT
                      </button>
                    ) : (
                      <a
                        href="/api/tiktok/auth"
                        style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(0,160,220,0.4)", background: "rgba(0,160,220,0.1)", color: "#00a0dc", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", textDecoration: "none", whiteSpace: "nowrap" }}
                      >
                        CONNECT
                      </a>
                    )}
                  </div>
                </div>

                {/* ── Instagram (coming soon) ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>INSTAGRAM</div>
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>📷 Connect Instagram</div>
                      <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Auto-post Reels and Stories — coming soon</div>
                    </div>
                    <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(225,48,108,0.1)", border: "1px solid rgba(225,48,108,0.2)", color: "#e1306c", fontSize: 10, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                      SOON
                    </span>
                  </div>
                </div>

                {/* ── Spotify Connect ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>SPOTIFY</div>
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: spotifyConnected && spotifyProfile ? 14 : 0 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                          {spotifyConnected ? "✅ Spotify Connected" : "🎵 Connect Spotify"}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                          {spotifyConnected
                            ? `${spotifyProfile?.display_name || "Account"} · ${spotifyProfile?.email || ""}`
                            : "Authorise to enable podcast analytics & listener data"}
                        </div>
                      </div>
                      {spotifyConnected ? (
                        <button
                          onClick={async () => {
                            setSpotifyLoading(true);
                            await disconnectSpotify().catch(() => {});
                            setSpotifyConnected(false);
                            setSpotifyProfile(null);
                            setSpotifyTopTracks([]);
                            setSpotifyTopArtists([]);
                            setSpotifyLoading(false);
                          }}
                          disabled={spotifyLoading}
                          style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", flexShrink: 0 }}
                        >
                          DISCONNECT
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            setSpotifyLoading(true);
                            try {
                              const { url } = await getSpotifyConnectUrl();
                              window.location.href = url;
                            } catch { setSpotifyLoading(false); }
                          }}
                          disabled={spotifyLoading}
                          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(29,185,84,0.5)", background: "rgba(29,185,84,0.1)", color: "#1db954", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", flexShrink: 0 }}
                        >
                          {spotifyLoading ? "..." : "CONNECT"}
                        </button>
                      )}
                    </div>
                    {spotifyConnected && spotifyProfile && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          ["Country", spotifyProfile.country || "—"],
                          ["Followers", (spotifyProfile.followers ?? "—").toLocaleString?.() ?? "—"],
                          ["Account", "Premium" ],
                        ].map(([k, v]) => (
                          <div key={k} style={{ background: T.bgBase, borderRadius: 8, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 2 }}>{k}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Podbean ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>PODBEAN — PODCAST HOSTING</div>
                  <div style={{ background: T.bgCard, border: `1px solid ${podbeanStatus?.connected ? "rgba(242,101,34,0.4)" : T.border}`, borderRadius: 10, padding: "16px 18px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                          {podbeanStatus?.connected ? `✅ ${podbeanStatus.title || "Podbean Connected"}` : "🎙 Podbean"}
                          {podbeanStatus?.connected && (
                            <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(242,101,34,0.12)", border: "1px solid rgba(242,101,34,0.3)", color: "#f26522", fontSize: 9, letterSpacing: "0.07em" }}>
                              CONNECTED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 3 }}>
                          {podbeanStatus?.connected
                            ? `${podbeanStatus.episode_count ?? 0} episodes · distributes to Spotify, Apple, Amazon, Google`
                            : "Your podcast host — connect to auto-publish and preserve Spotify monetization"}
                        </div>
                      </div>
                    </div>

                    {/* Recent episodes */}
                    {podbeanStatus?.connected && podbeanStatus.recent_episodes?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>RECENT EPISODES</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {podbeanStatus.recent_episodes.slice(0, 4).map(ep => (
                            <a key={ep.id} href={ep.player_url || "#"} target="_blank" rel="noopener noreferrer"
                              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: T.bgBase, borderRadius: 6, textDecoration: "none", gap: 8 }}>
                              <span style={{ fontSize: 11, color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.title}</span>
                              <span style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>
                                {ep.duration ? `${Math.floor(ep.duration / 60)}m` : "—"}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Config form */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 4 }}>CLIENT ID</div>
                        <input
                          type="text"
                          placeholder="Paste your Podbean Client ID..."
                          value={podbeanSettings.client_id}
                          onChange={e => setPodbeanSettings(s => ({ ...s, client_id: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 4 }}>CLIENT SECRET</div>
                        <input
                          type="password"
                          placeholder="Paste your Podbean Client Secret..."
                          value={podbeanSettings.client_secret}
                          onChange={e => setPodbeanSettings(s => ({ ...s, client_secret: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ fontSize: 9, color: T.textFaint, marginTop: 3 }}>
                          Podbean → Settings → Developer → your app → Client ID &amp; Secret
                        </div>
                      </div>

                      {/* Auto-upload toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bgBase, borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Auto-publish on generate</div>
                          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>Push to Podbean automatically when a podcast episode completes</div>
                        </div>
                        <div
                          onClick={() => setPodbeanSettings(s => ({ ...s, auto_upload: !s.auto_upload }))}
                          style={{ width: 38, height: 20, borderRadius: 10, cursor: "pointer", flexShrink: 0, background: podbeanSettings.auto_upload ? "#f26522" : T.border, position: "relative", transition: "background 0.2s" }}
                        >
                          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: podbeanSettings.auto_upload ? 21 : 3, transition: "left 0.2s" }} />
                        </div>
                      </div>

                      {/* Buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          onClick={async () => {
                            setPodbeanSaving(true);
                            try {
                              await savePodbeanSettings(podbeanSettings);
                              showToast("Podbean settings saved");
                              const s = await getPodbeanStatus();
                              setPodbeanStatus(s);
                            } catch {
                              showToast("Failed to save settings", "error");
                            } finally {
                              setPodbeanSaving(false);
                            }
                          }}
                          disabled={podbeanSaving}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1px solid rgba(242,101,34,0.4)", background: "rgba(242,101,34,0.1)", color: "#f26522", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", fontWeight: 700 }}
                        >
                          {podbeanSaving ? "SAVING..." : "SAVE"}
                        </button>
                        <button
                          onClick={async () => {
                            setPodbeanTesting(true);
                            try {
                              const s = await getPodbeanStatus();
                              setPodbeanStatus(s);
                              showToast(s.connected ? `✅ Connected: ${s.title}` : "Connection failed — check credentials", s.connected ? "success" : "error");
                            } catch {
                              showToast("Connection test failed", "error");
                            } finally {
                              setPodbeanTesting(false);
                            }
                          }}
                          disabled={podbeanTesting}
                          style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}
                        >
                          {podbeanTesting ? "..." : "TEST"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Buzzsprout ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>BUZZSPROUT — PODCAST HOSTING</div>
                  <div style={{ background: T.bgCard, border: `1px solid ${buzzsproutStatus?.connected ? "rgba(29,185,84,0.35)" : T.border}`, borderRadius: 10, padding: "16px 18px" }}>

                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                          {buzzsproutStatus?.connected ? `✅ ${buzzsproutStatus.title || "Connected"}` : "🎙 Buzzsprout"}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                          {buzzsproutStatus?.connected
                            ? `${buzzsproutStatus.episode_count ?? 0} episodes · auto-distributes to Spotify, Apple, Amazon`
                            : "Upload podcast episodes → Spotify keeps monetization intact"}
                        </div>
                      </div>
                      {buzzsproutStatus?.connected && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.25)", color: "#1db954", fontSize: 10, letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                          CONNECTED
                        </span>
                      )}
                    </div>

                    {/* Recent episodes (when connected) */}
                    {buzzsproutStatus?.connected && buzzsproutStatus.recent_episodes?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>RECENT EPISODES</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {buzzsproutStatus.recent_episodes.slice(0, 3).map(ep => (
                            <a key={ep.id} href={ep.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: T.bgBase, borderRadius: 6, textDecoration: "none", gap: 8 }}>
                              <span style={{ fontSize: 11, color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.title}</span>
                              <span style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>
                                {ep.duration ? `${Math.floor(ep.duration / 60)}m` : "—"}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Config form */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 4 }}>API TOKEN</div>
                        <input
                          type="password"
                          placeholder="Paste your Buzzsprout API token..."
                          value={buzzsproutSettings.api_token}
                          onChange={e => setBuzzsproutSettings(s => ({ ...s, api_token: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ fontSize: 9, color: T.textFaint, marginTop: 3 }}>
                          Find it at: buzzsprout.com → Account → API → Token
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 4 }}>PODCAST ID</div>
                        <input
                          type="text"
                          placeholder="e.g. 2345678"
                          value={buzzsproutSettings.podcast_id}
                          onChange={e => setBuzzsproutSettings(s => ({ ...s, podcast_id: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ fontSize: 9, color: T.textFaint, marginTop: 3 }}>
                          Found in your Buzzsprout dashboard URL: buzzsprout.com/<b style={{ color: T.textDim }}>YOUR_ID</b>/episodes
                        </div>
                      </div>

                      {/* Auto-upload toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bgBase, borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Auto-upload on generate</div>
                          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>Push to Buzzsprout automatically when a podcast episode completes</div>
                        </div>
                        <div
                          onClick={() => setBuzzsproutSettings(s => ({ ...s, auto_upload: !s.auto_upload }))}
                          style={{
                            width: 38, height: 20, borderRadius: 10, cursor: "pointer", flexShrink: 0,
                            background: buzzsproutSettings.auto_upload ? "#1db954" : T.border,
                            position: "relative", transition: "background 0.2s",
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: "50%", background: "#fff",
                            position: "absolute", top: 3,
                            left: buzzsproutSettings.auto_upload ? 21 : 3,
                            transition: "left 0.2s",
                          }} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          onClick={async () => {
                            setBuzzsproutSaving(true);
                            try {
                              await saveBuzzsproutSettings(buzzsproutSettings);
                              showToast("Buzzsprout settings saved");
                              const s = await getBuzzsproutStatus();
                              setBuzzsproutStatus(s);
                            } catch (e) {
                              showToast("Failed to save settings", "error");
                            } finally {
                              setBuzzsproutSaving(false);
                            }
                          }}
                          disabled={buzzsproutSaving}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1px solid rgba(29,185,84,0.4)", background: "rgba(29,185,84,0.1)", color: "#1db954", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", fontWeight: 700 }}
                        >
                          {buzzsproutSaving ? "SAVING..." : "SAVE"}
                        </button>
                        <button
                          onClick={async () => {
                            setBuzzsproutTesting(true);
                            try {
                              const s = await getBuzzsproutStatus();
                              setBuzzsproutStatus(s);
                              showToast(s.connected ? `✅ Connected: ${s.title}` : "Connection failed — check token and ID", s.connected ? "success" : "error");
                            } catch {
                              showToast("Connection test failed", "error");
                            } finally {
                              setBuzzsproutTesting(false);
                            }
                          }}
                          disabled={buzzsproutTesting}
                          style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}
                        >
                          {buzzsproutTesting ? "..." : "TEST"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Stick Figure Library ── */}
                <StickFigureSettings T={T} />

                </div>{/* end LEFT COLUMN */}

                {/* ── RIGHT COLUMN: Configuration ── */}
                <div style={{ width: 320, flexShrink: 0, position: "sticky", top: 20 }}>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 20,
                      color: T.text,
                      marginBottom: 20,
                    }}
                  >
                    Configuration
                  </div>

                  <div
                    style={{
                      padding: "12px 16px",
                      background: `${T.accentYellow}0a`,
                      border: `1px solid ${T.accentYellow}22`,
                      borderRadius: 10,
                      fontSize: 11,
                      color: T.accentYellow,
                      marginBottom: 16,
                      lineHeight: 1.6,
                    }}
                  >
                    ⚠ API keys are configured in{" "}
                    <code style={{ background: T.inputBg, padding: "1px 5px", borderRadius: 3 }}>
                      backend/.env
                    </code>
                    . Restart the backend after changes.
                  </div>

                  {[
                    ["LLM MODEL", "Groq — llama-3.3-70b-versatile"],
                    ["TTS ENGINE", "ElevenLabs — Adam voice (deep)"],
                    ["TTS QUALITY", "mp3_44100_192 · stability 0.80"],
                    ["VIDEO RESOLUTION", "1920×1080 @ 30fps"],
                    ["CAPTIONS", "Whisper base + FFmpeg burn"],
                    ["STOCK CLIPS", "Pexels API (Pixabay fallback)"],
                    ["DATABASE", "Supabase PostgreSQL"],
                    ["YOUTUBE QUOTA", "10,000 units/day ≈ 6 uploads"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: T.bgCard,
                        borderRadius: 9,
                        marginBottom: 6,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.1em" }}>{k}</span>
                      <span style={{ fontSize: 11, color: T.textMid }}>{v}</span>
                    </div>
                  ))}
                  {/* ── Subscriptions Card ── */}
                  {(() => {
                    const toMonthly = (cost, cycle) => {
                      const c = parseFloat(cost) || 0;
                      if (cycle === "yearly")  return c / 12;
                      if (cycle === "weekly")  return c * 4.33;
                      if (cycle === "daily")   return c * 30;
                      return c; // monthly
                    };
                    const totalMonthly = subscriptions.reduce((sum, s) => sum + toMonthly(s.cost, s.cycle), 0);
                    const fmtCost = (cost, currency) => {
                      const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency + " ";
                      return `${sym}${parseFloat(cost || 0).toFixed(2)}`;
                    };

                    const handleAddSub = async () => {
                      if (!newSub.name.trim() || !newSub.cost) return;
                      const updated = [...subscriptions, { ...newSub, id: Date.now().toString(), cost: parseFloat(newSub.cost) }];
                      setSubsSaving(true);
                      try {
                        await saveSubscriptions(updated);
                        setSubscriptions(updated);
                        setNewSub({ name: "", cost: "", currency: "USD", cycle: "monthly", next_billing: "" });
                        setShowAddSub(false);
                        showToast("Subscription added");
                      } catch(e) {
                        const msg = e?.response?.data?.detail || e?.message || "Failed to save subscription";
                        showToast(msg, "error");
                        addNotification("Subscription Save Failed", msg, "error");
                      }
                      finally { setSubsSaving(false); }
                    };

                    const handleDeleteSub = async (id) => {
                      const updated = subscriptions.filter(s => s.id !== id);
                      try {
                        await saveSubscriptions(updated);
                        setSubscriptions(updated);
                      } catch(e) {
                        const msg = e?.response?.data?.detail || e?.message || "Failed to delete subscription";
                        showToast(msg, "error");
                        addNotification("Subscription Delete Failed", msg, "error");
                      }
                    };

                    const cycleLabel = { monthly: "/mo", yearly: "/yr", weekly: "/wk", daily: "/day" };

                    // Integration-linked rows — show when configured (credentials set), regardless of live status
                    const pbConfigured = podbeanSettings?.client_id?.length > 3;
                    const bzConfigured = buzzsproutSettings?.api_token?.length > 3 || buzzsproutSettings?.api_token?.startsWith("•");
                    const integrationRows = [
                      pbConfigured && {
                        id: "__podbean__", name: "Podbean",
                        sub: podbeanStatus?.connected
                          ? `${podbeanStatus.episode_count ?? "?"} episodes · distributes to Spotify, Apple, Amazon`
                          : "Podcast hosting — pending connection",
                        cost: 99.99, currency: "USD", cycle: "yearly", color: "#f26522", icon: "🎙",
                        note: "$99.99/yr billed annually ≈ $8.33/mo",
                        connected: podbeanStatus?.connected,
                      },
                      bzConfigured && {
                        id: "__buzzsprout__", name: "Buzzsprout",
                        sub: buzzsproutStatus?.connected
                          ? `${buzzsproutStatus.episode_count ?? "?"} episodes · distributes to Spotify, Apple, Amazon`
                          : "Podcast hosting — pending connection",
                        cost: 12, currency: "USD", cycle: "monthly", color: "#1db954", icon: "🎚",
                        note: "$12/mo hosting plan",
                        connected: buzzsproutStatus?.connected,
                      },
                    ].filter(Boolean);
                    const integrationMonthly = integrationRows.reduce((s, r) => s + toMonthly(r.cost, r.cycle), 0);
                    const grandTotal = totalMonthly + integrationMonthly;

                    return (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>SUBSCRIPTIONS & SPEND</div>
                        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px" }}>

                          {/* Header with total */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>💳 Monthly Spend</div>
                              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>All services · integrations included</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: T.accentYellow, fontFamily: "'Syne',sans-serif" }}>
                                ${grandTotal.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em" }}>/ MONTH</div>
                            </div>
                          </div>

                          {/* Integration rows (auto-detected) */}
                          {integrationRows.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 5 }}>CONNECTED INTEGRATIONS</div>
                              {integrationRows.map(r => (
                                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bgBase, borderRadius: 7, marginBottom: 4, border: `1px solid ${r.color}22`, minHeight: 44 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${r.color}18`, border: `1px solid ${r.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{r.icon}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
                                      {r.name}{" "}
                                      <span style={{ fontSize: 9, color: r.connected ? r.color : T.textFaint, background: r.connected ? `${r.color}18` : `${T.textFaint}18`, padding: "1px 6px", borderRadius: 10, marginLeft: 4 }}>
                                        {r.connected ? "CONNECTED" : "CONFIGURED"}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</div>
                                    <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>{r.note}</div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, color: r.color, fontWeight: 700 }}>
                                      ${r.cost}<span style={{ fontSize: 9, color: T.textFaint }}>{cycleLabel[r.cycle]}</span>
                                    </div>
                                    {r.cycle !== "monthly" && (
                                      <div style={{ fontSize: 9, color: T.textFaint }}>≈ ${toMonthly(r.cost, r.cycle).toFixed(2)}/mo</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {subscriptions.length > 0 && <div style={{ borderTop: `1px solid ${T.border}`, margin: "10px 0 8px" }} />}
                            </div>
                          )}

                          {/* Subscription list */}
                          {subscriptions.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, maxHeight: 260, overflowY: "auto", paddingRight: 2 }}>
                              {subscriptions.map(s => (
                                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: T.bgBase, borderRadius: 7, minHeight: 44, flexShrink: 0 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                                    {s.next_billing && (
                                      <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>
                                        next: {s.next_billing}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, color: T.accentGreen, fontWeight: 700 }}>
                                      {fmtCost(s.cost, s.currency)}<span style={{ fontSize: 9, color: T.textFaint }}>{cycleLabel[s.cycle] || "/mo"}</span>
                                    </div>
                                    {s.cycle !== "monthly" && (
                                      <div style={{ fontSize: 9, color: T.textFaint }}>
                                        ≈ ${toMonthly(s.cost, s.cycle).toFixed(2)}/mo
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => handleDeleteSub(s.id)}
                                    style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                                    title="Remove">×</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {subscriptions.length === 0 && !showAddSub && (
                            <div style={{ textAlign: "center", padding: "16px 0", color: T.textFaint, fontSize: 11 }}>No subscriptions yet</div>
                          )}

                          {/* Add form */}
                          {showAddSub && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10, padding: "12px", background: T.bgBase, borderRadius: 8 }}>
                              <input
                                placeholder="Service name (e.g. ElevenLabs)"
                                value={newSub.name}
                                onChange={e => setNewSub(s => ({ ...s, name: e.target.value }))}
                                style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none" }}
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <input
                                  placeholder="Cost"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newSub.cost}
                                  onChange={e => setNewSub(s => ({ ...s, cost: e.target.value }))}
                                  style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none" }}
                                />
                                <select value={newSub.currency} onChange={e => setNewSub(s => ({ ...s, currency: e.target.value }))}
                                  style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
                                  {["USD","EUR","GBP","CAD","AUD"].map(c => <option key={c}>{c}</option>)}
                                </select>
                                <select value={newSub.cycle} onChange={e => setNewSub(s => ({ ...s, cycle: e.target.value }))}
                                  style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
                                  {["monthly","yearly","weekly","daily"].map(c => <option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <input
                                placeholder="Next billing date (e.g. 2026-04-01)"
                                value={newSub.next_billing}
                                onChange={e => setNewSub(s => ({ ...s, next_billing: e.target.value }))}
                                style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none" }}
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={handleAddSub} disabled={subsSaving || !newSub.name.trim() || !newSub.cost}
                                  style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: `1px solid ${T.accentYellow}55`, background: `${T.accentYellow}18`, color: T.accentYellow, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", fontWeight: 700 }}>
                                  {subsSaving ? "SAVING..." : "ADD"}
                                </button>
                                <button onClick={() => setShowAddSub(false)}
                                  style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          )}

                          {!showAddSub && (
                            <button onClick={() => setShowAddSub(true)}
                              style={{ width: "100%", padding: "8px 0", borderRadius: 7, border: `1px dashed ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em" }}>
                              + ADD SUBSCRIPTION
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Exclusive Preview Video ── */}
                  <ExclusiveVideoSetting T={T} showToast={showToast} />

                </div>{/* end RIGHT COLUMN */}

              </div>
            )}

            {/* ── SUBSCRIBERS TAB ──────────────────────────────────────────────── */}
            {tab === "subscribers" && (
              <SubscribersTabContent T={T} showToast={showToast} />
            )}

            {/* ── VIDEO EDITOR TAB ──────────────────────────────────────────────── */}
            {tab === "editor" && (
              <VideoEditorTab
                videos={videos}
                initialVideo={editorVideo}
                onInitialConsumed={() => setEditorVideo(null)}
                onNewVideo={refresh}
                T={T}
              />
            )}

            {/* ── STICKFIGURE MANAGER TAB ───────────────────────────────────────── */}
            {tab === "stickfigures" && <StickfigureManager T={T} showToast={showToast} addNotification={addNotification} />}

            {/* ── CUSTOM CONTENT TAB ────────────────────────────────────────────── */}
            {tab === "custom_content" && (
              <CustomContent T={T} showToast={showToast} addNotification={addNotification} />
            )}

            {tab === "reviews" && (
              <div style={{ padding: "28px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>

                {/* ── LEFT: Moderation queue ── */}
                <div style={{ flex: "0 0 58%", minWidth: 0 }}>
                  {/* Filter tabs */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    {[
                      { id: "pending", label: "PENDING", color: "#f59e0b" },
                      { id: "approved", label: "APPROVED", color: T.accentGreen },
                      { id: "rejected", label: "REJECTED", color: "#ef4444" },
                      { id: "all", label: "ALL", color: T.accent },
                    ].map(s => (
                      <button key={s.id} onClick={() => setReviewsTab(s.id)}
                        style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${reviewsTab === s.id ? s.color + "55" : T.border}`, background: reviewsTab === s.id ? s.color + "18" : "transparent", color: reviewsTab === s.id ? s.color : T.textDim, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {s.label}
                      </button>
                    ))}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: T.textDim, alignSelf: "center" }}>{reviewTotal}</span>
                  </div>

                  {reviewsLoading ? (
                    <div style={{ textAlign: "center", padding: 60, color: T.textFaint, letterSpacing: "0.12em", fontSize: 11 }}>LOADING…</div>
                  ) : reviewComments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: T.textFaint, fontSize: 12, letterSpacing: "0.1em" }}>NO {reviewsTab.toUpperCase()} COMMENTS</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {reviewComments.map(c => (
                        <div key={c.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", position: "relative" }}>
                          <div style={{ position: "absolute", top: 12, right: 14 }}>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, letterSpacing: "0.1em", fontWeight: 700,
                              background: c.status === "approved" ? "rgba(29,185,84,0.15)" : c.status === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                              color: c.status === "approved" ? T.accentGreen : c.status === "rejected" ? "#ef4444" : "#f59e0b" }}>
                              {c.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `hsl(${c.name.charCodeAt(0)*13%360},45%,28%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                              {c.name[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                                {c.name}
                                {c.is_admin_reply && <span style={{ fontSize: 8, background: "rgba(0,160,220,0.15)", color: T.accent, padding: "1px 6px", borderRadius: 10, letterSpacing: "0.1em" }}>ADMIN REPLY</span>}
                              </div>
                              <div style={{ fontSize: 9, color: T.textDim, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {c.email && <span>✉ {c.email}</span>}
                                <span>{new Date(c.created_at).toLocaleString()}</span>
                                {c.ip_hash && <span style={{ opacity: 0.5 }}>ip:{c.ip_hash}</span>}
                                <span>♥ {c.likes_count}</span>
                              </div>
                            </div>
                          </div>
                          {/* Parent context — shown when this is a reply */}
                          {c.parent_snippet && (
                            <div style={{ fontSize: 10, color: T.textDim, background: T.bg, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}55`, borderRadius: "0 6px 6px 0", padding: "6px 10px", marginBottom: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
                              <span style={{ flexShrink: 0, opacity: 0.6 }}>↩</span>
                              <span><span style={{ fontWeight: 700, color: T.textMid }}>{c.parent_snippet.name}</span>: "{c.parent_snippet.content}{c.parent_snippet.content.length >= 120 ? "…" : ""}"</span>
                            </div>
                          )}
                          <p style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7, margin: "0 0 12px", padding: "10px 14px", background: T.bg, borderRadius: 7, border: `1px solid ${T.border}` }}>
                            {c.content}
                          </p>
                          {c.status === "rejected" && c.rejection_reason && (
                            <div style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "6px 10px", marginBottom: 10 }}>
                              Reason: {c.rejection_reason}
                            </div>
                          )}
                          {rejectModal?.id === c.id && (
                            <div style={{ marginBottom: 10, display: "flex", gap: 7 }}>
                              <input autoFocus placeholder="Reason for rejection…"
                                value={rejectModal.reason} onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
                                style={{ flex: 1, padding: "7px 11px", background: T.bg, border: `1px solid rgba(239,68,68,0.35)`, borderRadius: 7, color: T.text, fontFamily: "inherit", fontSize: 11, outline: "none" }} />
                              <button onClick={async () => { await api.post(`/admin/blog/comments/${c.id}/reject`, { reason: rejectModal.reason }); setRejectModal(null); showToast("Comment rejected"); loadReviews(reviewsTab); }}
                                style={{ padding: "7px 12px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 7, color: "#ef4444", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>CONFIRM</button>
                              <button onClick={() => setRejectModal(null)} style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                            </div>
                          )}
                          {replyModal?.id === c.id && (
                            <div style={{ marginBottom: 10, display: "flex", gap: 7 }}>
                              <textarea autoFocus placeholder="Your reply…" rows={2}
                                value={replyModal.content} onChange={e => setReplyModal(m => ({ ...m, content: e.target.value }))}
                                style={{ flex: 1, padding: "7px 11px", background: T.bg, border: `1px solid ${T.accent}44`, borderRadius: 7, color: T.text, fontFamily: "inherit", fontSize: 11, outline: "none", resize: "vertical" }} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                <button onClick={async () => { if (!replyModal.content.trim()) return; await api.post(`/admin/blog/comments/${c.id}/reply`, { content: replyModal.content }); setReplyModal(null); showToast("Reply posted"); loadReviews(reviewsTab); loadLiveComments(); }}
                                  style={{ padding: "7px 12px", background: `${T.accent}18`, border: `1px solid ${T.accent}44`, borderRadius: 7, color: T.accent, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>POST</button>
                                <button onClick={() => setReplyModal(null)} style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                            {c.status !== "approved" && (
                              <button onClick={async () => { await api.post(`/admin/blog/comments/${c.id}/approve`); showToast("Approved!"); loadReviews(reviewsTab); loadLiveComments(); }}
                                style={{ padding: "5px 12px", background: "rgba(29,185,84,0.12)", border: "1px solid rgba(29,185,84,0.3)", borderRadius: 6, color: T.accentGreen, fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit" }}>
                                ✓ APPROVE
                              </button>
                            )}
                            {c.status !== "rejected" && !c.is_admin_reply && (
                              <button onClick={() => setRejectModal({ id: c.id, reason: "" })}
                                style={{ padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit" }}>
                                ✕ REJECT
                              </button>
                            )}
                            {!c.is_admin_reply && (
                              <button onClick={() => setReplyModal({ id: c.id, content: "" })}
                                style={{ padding: "5px 12px", background: `${T.accent}12`, border: `1px solid ${T.accent}30`, borderRadius: 6, color: T.accent, fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit" }}>
                                ↩ REPLY
                              </button>
                            )}
                            <button onClick={() => askConfirm("Delete this comment?", async () => { await api.delete(`/admin/blog/comments/${c.id}`); showToast("Deleted"); loadReviews(reviewsTab); loadLiveComments(); })}
                              style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit" }}>
                              ␡ DELETE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── RIGHT: Live approved comments panel ── */}
                <div style={{ flex: "0 0 40%", minWidth: 0, position: "sticky", top: 0 }}>
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.text, letterSpacing: "0.12em" }}>LIVE COMMENTS</div>
                      <button onClick={loadLiveComments} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 11 }}>↻</button>
                    </div>
                    <div style={{ maxHeight: "75vh", overflowY: "auto", padding: "12px" }}>
                      {liveLoading ? (
                        <div style={{ textAlign: "center", padding: 30, color: T.textFaint, fontSize: 11, letterSpacing: "0.1em" }}>LOADING…</div>
                      ) : liveComments.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 30, color: T.textFaint, fontSize: 11, letterSpacing: "0.1em" }}>NO LIVE COMMENTS YET</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {liveComments.map(lc => (
                            <div key={lc.id}>
                              {/* Comment card */}
                              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `hsl(${lc.name.charCodeAt(0)*13%360},45%,28%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                    {lc.name[0].toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 11, color: T.text }}>{lc.name}</div>
                                    <div style={{ fontSize: 9, color: T.textDim }}>{new Date(lc.created_at).toLocaleDateString()} · ♥ {lc.likes_count}</div>
                                  </div>
                                </div>
                                <p style={{ fontSize: 11, color: T.textMid, lineHeight: 1.65, margin: "0 0 10px" }}>{lc.content}</p>
                                {/* Actions */}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button onClick={() => setLiveReplyOpen(liveReplyOpen === lc.id ? null : lc.id)}
                                    style={{ padding: "4px 10px", background: `${T.accent}12`, border: `1px solid ${T.accent}30`, borderRadius: 5, color: T.accent, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    ↩ REPLY
                                  </button>
                                  <button onClick={() => handleRetract(lc.id)}
                                    style={{ padding: "4px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 5, color: "#f59e0b", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    ⊘ RETRACT
                                  </button>
                                  <button onClick={() => askConfirm("Delete this comment?", async () => { await api.delete(`/admin/blog/comments/${lc.id}`); showToast("Deleted"); loadLiveComments(); loadReviews(reviewsTab); })}
                                    style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 5, color: T.textDim, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    ␡
                                  </button>
                                  {lc.replies?.length > 0 && (
                                    <button onClick={() => setLiveReplyOpen(liveReplyOpen === `view-${lc.id}` ? null : `view-${lc.id}`)}
                                      style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 5, color: T.textDim, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                      {liveReplyOpen === `view-${lc.id}` ? "▾" : "▸"} {lc.replies.length} repl{lc.replies.length === 1 ? "y" : "ies"}
                                    </button>
                                  )}
                                </div>
                                {/* Reply form */}
                                {liveReplyOpen === lc.id && (
                                  <div style={{ marginTop: 10 }}>
                                    <textarea placeholder="Write a reply as creator…" rows={2}
                                      value={liveReplyContent} onChange={e => setLiveReplyContent(e.target.value)}
                                      style={{ display: "block", width: "100%", padding: "7px 10px", background: T.bg, border: `1px solid ${T.accent}44`, borderRadius: 7, color: T.text, fontFamily: "inherit", fontSize: 11, outline: "none", resize: "vertical", marginBottom: 7 }} />
                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                      <button onClick={() => { setLiveReplyOpen(null); setLiveReplyContent(""); }}
                                        style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>CANCEL</button>
                                      <button onClick={async () => { if (!liveReplyContent.trim()) return; await api.post(`/admin/blog/comments/${lc.id}/reply`, { content: liveReplyContent }); setLiveReplyOpen(null); setLiveReplyContent(""); showToast("Reply posted"); loadLiveComments(); }}
                                        style={{ padding: "5px 10px", background: `${T.accent}18`, border: `1px solid ${T.accent}44`, borderRadius: 6, color: T.accent, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>POST</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Replies thread */}
                              {liveReplyOpen === `view-${lc.id}` && lc.replies?.length > 0 && (
                                <div style={{ marginLeft: 20, marginTop: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                                  {lc.replies.map(rep => (
                                    <div key={rep.id} style={{ display: "flex", gap: 8, padding: "8px 12px", background: rep.is_admin_reply ? "rgba(255,80,30,0.04)" : "transparent", borderRadius: 8, borderLeft: `2px solid ${rep.is_admin_reply ? "rgba(255,80,30,0.4)" : T.border}` }}>
                                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: rep.is_admin_reply ? "linear-gradient(135deg,#cc2200,#ff5533)" : `hsl(${rep.name.charCodeAt(0)*13%360},45%,28%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                        {rep.name[0].toUpperCase()}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                          <span style={{ fontWeight: 700, fontSize: 10, color: rep.is_admin_reply ? "#ff7755" : T.text }}>{rep.name}</span>
                                          {rep.is_admin_reply && <span style={{ fontSize: 7, background: "rgba(255,80,30,0.15)", color: "#ff7755", padding: "1px 5px", borderRadius: 8 }}>CREATOR</span>}
                                          <span style={{ fontSize: 9, color: T.textDim }}>{new Date(rep.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p style={{ fontSize: 10, color: T.textMid, margin: 0, lineHeight: 1.6 }}>{rep.content}</p>
                                        <button onClick={() => askConfirm("Delete this reply?", async () => { await api.delete(`/admin/blog/comments/${rep.id}`); showToast("Deleted"); loadLiveComments(); })}
                                          style={{ marginTop: 4, padding: "2px 8px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 4, color: T.textDim, fontSize: 8, cursor: "pointer", fontFamily: "inherit" }}>
                                          ␡
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

                {/* Podcast log modal */}
                {showPodcastLogs && (
                  <div
                    onClick={() => setShowPodcastLogs(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                  >
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", maxWidth: 700, maxHeight: "70vh", background: "#0a0a0f", border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.1em" }}>PODCAST PIPELINE LOGS</div>
                        <button onClick={() => setShowPodcastLogs(false)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 18 }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
                        {podcastLogs.length === 0 ? (
                          <div style={{ color: T.textFaint }}>Waiting for pipeline output...</div>
                        ) : (
                          podcastLogs.map((line, i) => (
                            <div key={i} style={{ color: line.startsWith("[ERROR]") ? "#ff6060" : line.startsWith("[DONE]") ? "#60ff60" : "#a0d0a0" }}>
                              {line}
                            </div>
                          ))
                        )}
                        <div ref={podcastLogsEndRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-short log modal */}
                {showAutoShortLogs && (
                  <div
                    onClick={() => setShowAutoShortLogs(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                  >
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", maxWidth: 700, maxHeight: "70vh", background: "#0a0a0f", border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.1em" }}>AUTO-SHORT LOGS</div>
                        <button onClick={() => setShowAutoShortLogs(false)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 18 }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
                        {autoShortLogs.length === 0 ? (
                          <div style={{ color: T.textFaint }}>Waiting for pipeline output...</div>
                        ) : (
                          autoShortLogs.map((line, i) => (
                            <div key={i} style={{ color: line.startsWith("[ERROR]") ? "#ff6060" : line.startsWith("[DONE]") ? "#60ff60" : "#a0d0a0" }}>
                              {line}
                            </div>
                          ))
                        )}
                        <div ref={autoShortLogsEndRef} />
                      </div>
                    </div>
                  </div>
                )}
          </div>
        </div>

        {/* ── Video Preview Modal ─────────────────────────────────────────────────── */}
        {preview && (
          <div
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(16px)",
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 800,
                background: "#000",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 40px 120px rgba(0,0,0,0.9)",
                border: "1px solid rgba(255,255,255,0.06)",
                animation: "fadeUp 0.2s ease",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(10,14,22,0.95)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#ddeeff",
                      marginBottom: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 500,
                    }}
                  >
                    {preview.title || "Video Preview"}
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div
                      className="pill"
                      style={{
                        background: sc(preview.status).bg,
                        color: sc(preview.status).color,
                      }}
                    >
                      <div
                        className="dot"
                        style={{
                          background: sc(preview.status).pulse,
                          width: 5,
                          height: 5,
                        }}
                      />
                      {sc(preview.status).label}
                    </div>
                    {preview.duration_seconds && (
                      <span style={{ fontSize: 10, color: "#3a6080" }}>
                        {fmtDur(preview.duration_seconds)}
                      </span>
                    )}
                    {preview.resolution && (
                      <span style={{ fontSize: 10, color: "#3a6080" }}>
                        {preview.resolution}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  onClick={() => setPreview(null)}
                  style={{
                    cursor: "pointer",
                    color: "#3a6080",
                    fontSize: 22,
                    lineHeight: 1,
                    padding: "4px 6px",
                    borderRadius: 6,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#aac0d0")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#3a6080")
                  }
                >
                  ✕
                </div>
              </div>

              {/* Video player */}
              <div
                style={{
                  position: "relative",
                  background: "#000",
                  lineHeight: 0,
                }}
              >
                {getVideoUrl(preview.file_path) ? (
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      maxHeight: "60vh",
                      display: "block",
                      outline: "none",
                    }}
                    src={getVideoUrl(preview.file_path)}
                    onError={() => {
                      showToast(
                        "Video failed to load — check Supabase Storage",
                        "error",
                      );
                    }}
                  />
                ) : preview.narration_url ? (
                  <div style={{
                    padding: "40px 32px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 20,
                    background: "#0a0a10",
                  }}>
                    <div style={{ fontSize: 48 }}>🎙</div>
                    <div style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.55)",
                      textAlign: "center",
                      maxWidth: 400,
                      lineHeight: 1.6,
                    }}>
                      {preview.title || "Podcast Episode"}
                    </div>
                    <audio
                      controls
                      autoPlay
                      style={{
                        width: "100%",
                        maxWidth: 520,
                        outline: "none",
                        borderRadius: 8,
                      }}
                      src={preview.narration_url}
                      onError={() => showToast("Audio failed to load", "error")}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 320,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                      background: "#000",
                      padding: 40,
                    }}
                  >
                    <span style={{ fontSize: 48, opacity: 0.2 }}>🎬</span>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#4a6070",
                          marginBottom: 8,
                        }}
                      >
                        No preview available
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#2a4050",
                          lineHeight: 1.7,
                          maxWidth: 340,
                        }}
                      >
                        This video was generated before Supabase Storage was set
                        up.
                        <br />
                        New videos will automatically upload to storage for
                        permanent preview.
                      </div>
                    </div>
                    {preview.status === "ready" && (
                      <button
                        className="btn-primary"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          fontSize: 11,
                        }}
                        onClick={(e) => {
                          handleUpload(preview.id, e);
                          setPreview(null);
                        }}
                      >
                        🚀 Upload to YouTube anyway
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div
                style={{
                  padding: "12px 20px",
                  background: "rgba(6,10,18,0.98)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  {(preview.labels || []).map((l) => (
                    <span key={l} className="tag">
                      {l}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  {preview.status === "posted" && preview.youtube_url && (
                    <a
                      href={preview.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "8px 16px",
                        background: "rgba(0,160,220,0.1)",
                        border: "1px solid rgba(0,160,220,0.25)",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "#00b4ff",
                        textDecoration: "none",
                        letterSpacing: "0.06em",
                      }}
                    >
                      ▶ View on YouTube
                    </a>
                  )}
                  {preview.status === "ready" && (
                    <button
                      className="btn-primary"
                      style={{ padding: "8px 18px", fontSize: 10 }}
                      onClick={(e) => {
                        handleUpload(preview.id, e);
                        setPreview(null);
                      }}
                    >
                      🚀 UPLOAD TO YOUTUBE
                    </button>
                  )}
                  {preview.status === "posted" && (
                    <div style={{ fontSize: 11, color: "#2a5070" }}>
                      👁 {fmtNum(preview.views_count)} · ♥{" "}
                      {fmtNum(preview.likes_count)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail Modal ────────────────────────────────────────────────────────── */}
        {selected && (
          <div className="modal-bg" onClick={() => setSelected(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 20,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <InlineEdit
                    value={selected.title || ""}
                    placeholder="Processing..."
                    onSave={async (val) => {
                      try {
                        await updateVideoMeta(selected.id, { title: val });
                        setSelected((s) => ({ ...s, title: val }));
                        setVideos((vs) => vs.map((v) => v.id === selected.id ? { ...v, title: val } : v));
                        showToast("Title updated");
                      } catch (e) { showToast("Update failed", "error"); }
                    }}
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 17,
                      color: T.text,
                      marginBottom: 8,
                      lineHeight: 1.3,
                    }}
                    T={T}
                  />
                  <div
                    className="pill"
                    style={{
                      background: sc(selected.status).bg,
                      color: sc(selected.status).color,
                    }}
                  >
                    <div
                      className="dot"
                      style={{ background: sc(selected.status).pulse }}
                    />
                    {sc(selected.status).label}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {getVideoUrl(selected.file_path) && (
                    <button
                      className="btn-sm"
                      onClick={() => {
                        setSelected(null);
                        setPreview(selected);
                      }}
                      style={{
                        color: T.accent,
                        borderColor: `${T.accent}40`,
                        background: `${T.accent}0d`,
                      }}
                    >
                      ▶ PREVIEW
                    </button>
                  )}
                  <button
                    className="btn-sm"
                    onClick={() => {
                      setSelected(null);
                      setEditorVideo(selected);
                      switchTab("editor");
                    }}
                    style={{
                      color: T.accentGreen,
                      borderColor: `${T.accentGreen}40`,
                      background: `${T.accentGreen}0d`,
                    }}
                  >
                    ✂ EDIT
                  </button>
                  <div
                    onClick={() => setSelected(null)}
                    style={{
                      cursor: "pointer",
                      color: T.textDim,
                      fontSize: 18,
                      padding: "0 4px",
                    }}
                  >
                    ✕
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {[
                  ["ID", selected.id.slice(0, 8) + "..."],
                  ["Created", timeAgo(selected.created_at)],
                  ["Duration", fmtDur(selected.duration_seconds)],
                  ["Resolution", selected.resolution || "—"],
                  ["Views", fmtNum(selected.views_count)],
                  ["Likes", fmtNum(selected.likes_count)],
                  ["Category", selected.category || "—"],
                  ["YouTube", selected.youtube_id || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="detail-row">
                    <span
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {k}
                    </span>
                    <span style={{ fontSize: 12, color: T.textMid }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: T.textFaint,
                    letterSpacing: "0.1em",
                    marginBottom: 6,
                  }}
                >
                  PROMPT
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: T.textDim,
                    fontStyle: "italic",
                    padding: "10px 14px",
                    background: T.inputBg,
                    borderRadius: 8,
                    lineHeight: 1.7,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  "{selected.prompt}"
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  DESCRIPTION
                </div>
                <InlineEdit
                  value={selected.description || ""}
                  placeholder="No description — click to add one"
                  multiline
                  onSave={async (val) => {
                    try {
                      await updateVideoMeta(selected.id, { description: val });
                      setSelected((s) => ({ ...s, description: val }));
                      setVideos((vs) => vs.map((v) => v.id === selected.id ? { ...v, description: val } : v));
                      showToast("Description updated");
                    } catch (e) { showToast("Update failed", "error"); }
                  }}
                  style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7 }}
                  T={T}
                />
              </div>

              {(selected.labels?.length > 0 || selected.category) && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    LABELS
                  </div>
                  {(selected.labels || []).map((l) => (
                    <span key={l} className="tag">
                      {l}
                    </span>
                  ))}
                  {selected.category && (
                    <span
                      className="tag"
                      style={{ color: T.accent, borderColor: `${T.accent}30` }}
                    >
                      #{selected.category}
                    </span>
                  )}
                </div>
              )}

              {selected.script && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    SCRIPT PREVIEW
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textDim,
                      padding: "12px 14px",
                      background: T.inputBg,
                      borderRadius: 8,
                      lineHeight: 1.8,
                      maxHeight: 120,
                      overflow: "auto",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    {selected.script}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {selected.status === "ready" && (
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      handleUpload(selected.id, e);
                      setSelected(null);
                    }}
                  >
                    🚀 UPLOAD TO YOUTUBE
                  </button>
                )}
                {selected.status === "posted" && selected.youtube_url && (
                  <a
                    href={selected.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 18px",
                      background: `${T.accent}0d`,
                      border: `1px solid ${T.accent}30`,
                      borderRadius: 9,
                      fontSize: 11,
                      color: T.accent,
                      textDecoration: "none",
                      letterSpacing: "0.08em",
                    }}
                  >
                    ▶ VIEW ON YOUTUBE
                  </a>
                )}
                {selected.status === "failed" && (
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      handleRetry(selected.id, e);
                      setSelected(null);
                    }}
                  >
                    ↺ RETRY
                  </button>
                )}
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      id: selected.id,
                      hasYoutube:
                        selected.status === "posted" && !!selected.youtube_id,
                      youtubeId: selected.youtube_id,
                    });
                    setSelected(null);
                  }}
                  style={{
                    padding: "10px 18px",
                    background: `${T.accentRed}0a`,
                    border: `1px solid ${T.accentRed}25`,
                    borderRadius: 9,
                    fontSize: 11,
                    color: T.accentRed,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.08em",
                  }}
                >
                  ✕ DELETE
                </button>
              </div>

            </div>
          </div>
        )}


        {/* ── YouTube Privacy Prompt (when adding video to Library) ────────────────── */}
        {exclusiveYtModal && (
          <div className="modal-bg" onClick={() => setExclusiveYtModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, padding: 28 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 8 }}>
                🔐 Update YouTube Privacy?
              </div>
              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 20, lineHeight: 1.7 }}>
                This video is on YouTube. Since you're making it exclusive, would you like to update its visibility?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={async () => {
                    const { videoId } = exclusiveYtModal;
                    setExclusiveYtModal(null);
                    try {
                      await api.patch(`/videos/${videoId}/youtube-settings`, { privacy: "unlisted" });
                      showToast("YouTube video set to Unlisted");
                    } catch (err) {
                      showToast("Library updated, but YouTube privacy change failed: " + (err?.response?.data?.detail || err.message), "error");
                    }
                  }}
                  style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid rgba(255,176,32,0.35)", background: "rgba(255,176,32,0.08)", color: "#ffb020", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
                >
                  🔗 Unlist — keep URL working but hide from search
                </button>
                <button
                  onClick={async () => {
                    const { videoId } = exclusiveYtModal;
                    setExclusiveYtModal(null);
                    try {
                      await api.patch(`/videos/${videoId}/youtube-settings`, { privacy: "private" });
                      showToast("YouTube video set to Private");
                    } catch (err) {
                      showToast("Library updated, but YouTube privacy change failed: " + (err?.response?.data?.detail || err.message), "error");
                    }
                  }}
                  style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid rgba(255,92,108,0.35)", background: "rgba(255,92,108,0.08)", color: "#ff5c6c", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
                >
                  🔒 Make Private — only you can see it
                </button>
                <button
                  onClick={() => setExclusiveYtModal(null)}
                  style={{ padding: "11px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Keep As Is — don't change YouTube privacy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Generic Confirm Modal ────────────────────────────────────────────────── */}
        {confirmModal && (
          <div className="modal-bg" onClick={() => setConfirmModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}
              style={{ maxWidth: 360, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 8 }}>
                Are you sure?
              </div>
              <div style={{ fontSize: 12, color: T.textMid, marginBottom: 24, lineHeight: 1.6 }}>
                {confirmModal.message}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    border: `1px solid ${T.border}`, background: "transparent",
                    color: T.textMid, fontSize: 12, fontFamily: "inherit",
                    cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    border: "1px solid rgba(200,40,60,0.4)",
                    background: "rgba(200,40,60,0.12)",
                    color: "#e05060", fontSize: 12, fontFamily: "inherit",
                    cursor: "pointer", letterSpacing: "0.06em", fontWeight: 600,
                  }}
                >
                  {confirmModal.confirmLabel || "DELETE"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ───────────────────────────────────────────────────────── */}
        {deleteConfirm && (
          <div className="modal-bg" onClick={() => setDeleteConfirm(null)}>
            <div
              className="modal"
              style={{ maxWidth: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: T.accentRed,
                  marginBottom: 8,
                }}
              >
                Delete Video?
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.textMid,
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                This removes the record from your dashboard.
              </div>
              {deleteConfirm.hasYoutube && (
                <div
                  style={{
                    background: `rgba(255,90,90,0.07)`,
                    border: `1px solid ${T.accentRed}30`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: T.accentRed,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    ⚠ This video is LIVE on YouTube
                  </div>
                  <div
                    style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}
                  >
                    Do you also want to delete it from YouTube? This cannot be
                    undone.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deleteConfirm.hasYoutube && (
                  <button
                    onClick={() => handleDelete(deleteConfirm.id, true)}
                    style={{
                      width: "100%",
                      padding: 11,
                      background: `${T.accentRed}15`,
                      border: `1px solid ${T.accentRed}50`,
                      borderRadius: 9,
                      color: T.accentRed,
                      fontFamily: "inherit",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🗑 DELETE FROM DASHBOARD + YOUTUBE
                  </button>
                )}
                <button
                  onClick={() => handleDelete(deleteConfirm.id, false)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: `${T.accentRed}07`,
                    border: `1px solid ${T.accentRed}25`,
                    borderRadius: 9,
                    color: T.accentRed,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >
                  {deleteConfirm.hasYoutube
                    ? "✕ DELETE FROM DASHBOARD ONLY"
                    : "✕ YES, DELETE"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    color: T.textMid,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Channel Delete Confirm Modal ────────────────────────────────────────── */}
        {channelDeleteConfirm && (
          <div
            className="modal-bg"
            onClick={() => setChannelDeleteConfirm(null)}
          >
            <div
              className="modal"
              style={{ maxWidth: 380 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: T.accentRed,
                  marginBottom: 8,
                }}
              >
                Delete from YouTube?
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.textMid,
                  marginBottom: 6,
                  lineHeight: 1.6,
                }}
              >
                This will permanently delete:
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: 18,
                  padding: "10px 12px",
                  background: T.bgBase,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  lineHeight: 1.5,
                }}
              >
                {channelDeleteConfirm.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.textMid,
                  marginBottom: 20,
                  lineHeight: 1.6,
                  padding: "10px 12px",
                  background: `rgba(220,38,38,0.06)`,
                  borderRadius: 8,
                  border: `1px solid rgba(220,38,38,0.2)`,
                }}
              >
                ⚠ This cannot be undone. The video will be removed from YouTube
                permanently.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={async () => {
                    const { id } = channelDeleteConfirm;
                    setChannelDeleteConfirm(null);
                    try {
                      await api.delete(`/channel/videos/${id}`);
                      showToast("Deleted from YouTube");
                      fetchChannel();
                    } catch (e) {
                      showToast("Delete failed", "error");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: `rgba(220,38,38,0.12)`,
                    border: `1px solid rgba(220,38,38,0.4)`,
                    borderRadius: 9,
                    color: T.accentRed,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  🗑 YES, DELETE PERMANENTLY
                </button>
                <button
                  onClick={() => setChannelDeleteConfirm(null)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    color: T.textMid,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── YouTube Management Modal ─────────────────────────────────────────────── */}
        {ytModal && (
          <div
            onClick={() => {
              setYtModal(null);
              setYtDetails(null);
              setYtComments([]);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              backdropFilter: "blur(20px)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 720,
                maxHeight: "92vh",
                overflowY: "auto",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  position: "sticky",
                  top: 0,
                  background: T.bgCard,
                  zIndex: 2,
                  borderRadius: "18px 18px 0 0",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#a060ff",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    ⚙ YOUTUBE MANAGEMENT
                  </div>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: T.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ytModal.title || ytModal.prompt}
                  </div>
                  {ytModal.youtube_url && (
                    <a
                      href={ytModal.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        color: T.accent,
                        textDecoration: "none",
                      }}
                    >
                      ↗ {ytModal.youtube_url}
                    </a>
                  )}
                </div>
                <div
                  onClick={() => {
                    setYtModal(null);
                    setYtDetails(null);
                    setYtComments([]);
                  }}
                  style={{
                    cursor: "pointer",
                    color: T.textFaint,
                    fontSize: 20,
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  ✕
                </div>
              </div>

              {ytLoading ? (
                <div
                  style={{
                    padding: 60,
                    textAlign: "center",
                    color: T.textFaint,
                    fontSize: 12,
                  }}
                >
                  ⟳ Loading YouTube data...
                </div>
              ) : (
                <div
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* Stats grid */}
                  {ytDetails && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5,1fr)",
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          label: "VIEWS",
                          val: fmtNum(ytDetails.views),
                          color: T.accentYellow,
                        },
                        {
                          label: "LIKES",
                          val: fmtNum(ytDetails.likes),
                          color: "#e060a0",
                        },
                        {
                          label: "DISLIKES",
                          val: fmtNum(ytDetails.dislikes),
                          color: T.accentRed,
                        },
                        {
                          label: "COMMENTS",
                          val: fmtNum(ytDetails.comments),
                          color: T.accent,
                        },
                        {
                          label: "PRIVACY",
                          val: (ytDetails.privacy || "—").toUpperCase(),
                          color: T.accentGreen,
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          style={{
                            background: T.bgDeep,
                            borderRadius: 10,
                            padding: "12px 10px",
                            textAlign: "center",
                            border: `1px solid ${T.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                              fontSize: 18,
                              color: s.color,
                            }}
                          >
                            {s.val}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.08em",
                              marginTop: 3,
                            }}
                          >
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {ytDetails?.description && (
                    <div
                      style={{
                        background: T.bgDeep,
                        borderRadius: 10,
                        padding: 14,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                        }}
                      >
                        DESCRIPTION
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.textMid,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          maxHeight: 100,
                          overflowY: "auto",
                        }}
                      >
                        {ytDetails.description}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {ytDetails?.tags?.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                        }}
                      >
                        TAGS
                      </div>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {ytDetails.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: 10,
                              color: T.accent,
                              padding: "3px 8px",
                              background: `${T.accent}0d`,
                              borderRadius: 4,
                              border: `1px solid ${T.accent}20`,
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post a comment */}
                  <div
                    style={{
                      background: T.bgDeep,
                      borderRadius: 10,
                      padding: 14,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      POST COMMENT
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          handlePostComment()
                        }
                        placeholder="Write a comment..."
                        maxLength={500}
                        style={{
                          flex: 1,
                          background: T.bg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          padding: "9px 12px",
                          color: T.text,
                          fontSize: 12,
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={postingComment || !newComment.trim()}
                        style={{
                          padding: "9px 16px",
                          background: postingComment
                            ? "transparent"
                            : "#a060ff",
                          border: `1px solid #a060ff50`,
                          borderRadius: 8,
                          color: postingComment ? T.textFaint : "white",
                          fontSize: 11,
                          cursor: postingComment ? "default" : "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {postingComment ? "⟳" : "↑ POST"}
                      </button>
                      <button
                        onClick={handleTriggerAutoComment}
                        title="Trigger one auto-comment cycle now"
                        style={{
                          padding: "9px 14px",
                          background: "transparent",
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          color: T.textFaint,
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🤖 AUTO
                      </button>
                    </div>
                    <div
                      style={{ fontSize: 10, color: T.textFaint, marginTop: 6 }}
                    >
                      Auto-comments post 2×/day automatically on your live
                      videos
                    </div>
                  </div>

                  {/* Comments list */}
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      COMMENTS ({ytComments.length})
                    </div>
                    {ytComments.length === 0 ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: T.textFaint,
                          textAlign: "center",
                          padding: 24,
                        }}
                      >
                        No comments yet
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {ytComments.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              background: T.bgDeep,
                              borderRadius: 10,
                              padding: 12,
                              border: `1px solid ${T.border}`,
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <img
                              src={getCommentAvatar(c.author_image, c.author)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                flexShrink: 0,
                                objectFit: "cover",
                              }}
                              alt=""
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 4,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: T.accent,
                                    fontWeight: 600,
                                  }}
                                >
                                  {c.author}
                                </span>
                                <span
                                  style={{ fontSize: 10, color: T.textFaint }}
                                >
                                  · {timeAgo(c.published_at)}
                                </span>
                                {c.likes > 0 && (
                                  <span
                                    style={{ fontSize: 10, color: "#e060a0" }}
                                  >
                                    ♥ {c.likes}
                                  </span>
                                )}
                                {c.reply_count > 0 && (
                                  <span
                                    style={{ fontSize: 10, color: T.textFaint }}
                                  >
                                    💬 {c.reply_count}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: T.textMid,
                                  lineHeight: 1.6,
                                }}
                                dangerouslySetInnerHTML={{ __html: c.text }}
                              />
                            </div>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              title="Delete comment"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: T.textFaint,
                                cursor: "pointer",
                                fontSize: 14,
                                padding: "2px 6px",
                                borderRadius: 5,
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color = T.accentRed)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = T.textFaint)
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Danger zone */}
                  <div
                    style={{
                      background: "rgba(200,40,60,0.04)",
                      borderRadius: 10,
                      padding: 14,
                      border: "1px solid rgba(200,40,60,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.accentRed,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      DANGER ZONE
                    </div>
                    {deleteYtConfirm === ytModal.id ? (
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMid,
                            marginBottom: 12,
                          }}
                        >
                          This permanently deletes the video from YouTube. The
                          record stays in your dashboard as "ready" so you can
                          re-upload.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            onClick={() => handleDeleteFromYt(ytModal.id)}
                            style={{
                              flex: 1,
                              padding: 10,
                              background: "rgba(200,40,60,0.09)",
                              border: "1px solid rgba(200,40,60,0.3)",
                              borderRadius: 8,
                              color: T.accentRed,
                              fontFamily: "inherit",
                              fontSize: 11,
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                            }}
                          >
                            YES, DELETE FROM YOUTUBE
                          </button>
                          <button
                            onClick={() => setDeleteYtConfirm(null)}
                            style={{
                              flex: 1,
                              padding: 10,
                              background: T.bgCard,
                              border: `1px solid ${T.border}`,
                              borderRadius: 8,
                              color: T.textMid,
                              fontFamily: "inherit",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteYtConfirm(ytModal.id)}
                        style={{
                          padding: "9px 18px",
                          background: "rgba(200,40,60,0.07)",
                          border: "1px solid rgba(200,40,60,0.22)",
                          borderRadius: 8,
                          color: T.accentRed,
                          fontFamily: "inherit",
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        🗑 DELETE FROM YOUTUBE
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube Upload Modal */}
        {uploadModal && (
          <UploadModal
            video={uploadModal}
            theme={T}
            onClose={() => setUploadModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
              refresh();
            }}
          />
        )}
        {/* YouTube Settings Modal */}
        {ytSettingsModal && (
          <YouTubeSettingsModal
            video={ytSettingsModal}
            theme={T}
            onClose={() => setYtSettingsModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
              refresh();
            }}
          />
        )}
        {/* Shorts Modal */}
        {shortsModal && (
          <ShortsModal
            video={shortsModal === "new" ? null : shortsModal}
            theme={T}
            onClose={() => setShortsModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
            }}
          />
        )}

        {/* ── Danger Zone Modal ─────────────────────────────────────────────────── */}
        {showDangerZone && (
          <DangerZone onClose={() => setShowDangerZone(false)} />
        )}

        {/* ── Mobile Bottom Nav ──────────────────────────────────────────────────── */}
        <nav className="mobile-bottom-nav">
          {[
            { id: "videos", icon: "▣", label: "Video Studio" },
            { id: "shorts", icon: "⚡", label: "Shorts" },
            { id: "library", icon: "🗂", label: "Library" },
            { id: "channel", icon: "▶", label: "Channel" },
            { id: "settings", icon: "◎", label: "Settings" },
          ].map(n => (
            <button
              key={n.id}
              className={`mob-tab${tab === n.id ? " active" : ""}`}
              onClick={() => switchTab(n.id)}
            >
              <span className="mob-tab-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
