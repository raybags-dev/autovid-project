/**
 * VideoEditor — Stick-Figure Compositor UI
 *
 * Layout: inline flex (fills tab), NOT a fixed overlay.
 *   Left  (220px) — clip library, search, seed, upload
 *   Centre (flex)  — video player + timeline + action bar
 *   Right  (220px) — per-overlay position / scale / time controls
 *
 * Each clip card shows a hover-to-play preview and inline loop-mode
 * selector buttons (Once | ↻Full | 1s | 2s | 3s). Clicking the card
 * (or the "Add" button) inserts it into the timeline with the chosen mode.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteStickFigure,
  getCompositeStatus,
  listStickFigures,
  previewAutoComposite,
  seedStickFigures,
  startAutoComposite,
  startComposite,
  updateStickFigure,
  uploadStickFigure,
} from "../api/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LOOP_OPTIONS = [
  { value: "none",    label: "Once" },
  { value: "full",    label: "↻ Loop" },
  { value: "last_1s", label: "1s" },
  { value: "last_2s", label: "2s" },
  { value: "last_3s", label: "3s" },
];

const OVERLAY_COLORS = [
  "#4a9eff", "#3dd68c", "#ff5c6c", "#ffb020",
  "#c084fc", "#fb923c", "#34d399", "#f472b6",
];

function formatTime(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}

let _oidCounter = 0;
function newId() { return `ov_${++_oidCounter}_${Date.now()}`; }

// ─────────────────────────────────────────────────────────────────────────────
// ClipCard — hover preview + inline loop-mode selector + add button
// ─────────────────────────────────────────────────────────────────────────────

function ClipCard({ clip, onAdd, onUpdated, onDeleted, T }) {
  const videoRef = useRef(null);
  const [hovered,    setHovered]    = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [loopMode,   setLoopMode]   = useState("none");
  const [draftLabel, setDraftLabel] = useState(clip.label || clip.filename.replace(".mp4", ""));
  const [draftKw,    setDraftKw]    = useState((clip.keywords || []).join(", "));
  const [saving,     setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const enter = () => {
    if (editing) return;
    setHovered(true);
    if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
  };
  const leave = () => {
    setHovered(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    if (clip.enabled === false) return;
    onAdd(clip, loopMode);
  };

  const save = async (e) => {
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
    if (!clip.id) return;
    try {
      await updateStickFigure(clip.id, { enabled: !clip.enabled });
      onUpdated({ ...clip, enabled: !clip.enabled });
    } catch { /* ignore */ }
  };

  const doDelete = async (e) => {
    e.stopPropagation();
    if (!clip.id) return;
    try {
      await deleteStickFigure(clip.id, false);
      onDeleted(clip.id);
    } catch { /* ignore */ }
  };

  const label = clip.label || clip.filename.replace(".mp4", "").replace(/_/g, " ");

  if (editing) {
    return (
      <div
        style={{ border: `1px solid ${T.accent}`, borderRadius: 8, padding: 10, background: T.bgCard }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Label</div>
        <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)}
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 7px", color: T.text, fontFamily: "inherit", fontSize: 11, boxSizing: "border-box", marginBottom: 5 }} />
        <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>Keywords (comma-separated)</div>
        <textarea value={draftKw} onChange={e => setDraftKw(e.target.value)} rows={2}
          style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 7px", color: T.text, fontFamily: "inherit", fontSize: 10, boxSizing: "border-box", resize: "vertical", marginBottom: 6 }} />
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button onClick={save} disabled={saving}
            style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: T.accentGreen, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          {!delConfirm ? (
            <button onClick={() => setDelConfirm(true)}
              style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 5, border: `1px solid ${T.accentRed}40`, background: "transparent", color: T.accentRed, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
              Delete
            </button>
          ) : (
            <>
              <button onClick={doDelete}
                style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 5, border: "none", background: T.accentRed, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                Confirm
              </button>
              <button onClick={() => setDelConfirm(false)}
                style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${hovered ? T.accent : T.border}`,
        borderRadius: 8, overflow: "hidden",
        background: T.bgCard, transition: "border-color 0.15s",
        position: "relative",
        opacity: clip.enabled === false ? 0.45 : 1,
        cursor: clip.enabled === false ? "not-allowed" : "default",
      }}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      {/* ── Video thumbnail ── */}
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#111", position: "relative" }}>
        <video ref={videoRef} src={clip.preview_url} muted loop playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {!hovered && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <span style={{ color: "#fff", fontSize: 18 }}>▶</span>
          </div>
        )}
        {/* Hover action buttons */}
        {hovered && clip.id && (
          <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3 }} onClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); setEditing(true); }}
              style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, cursor: "pointer" }}>✎</button>
            <button onClick={toggleEnabled}
              style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: clip.enabled === false ? "rgba(61,214,140,0.8)" : "rgba(255,92,108,0.8)", color: "#fff", fontSize: 10, cursor: "pointer" }}>
              {clip.enabled === false ? "On" : "Off"}
            </button>
          </div>
        )}
      </div>

      {/* ── Label ── */}
      <div style={{ padding: "5px 7px 3px" }}>
        <div style={{ fontSize: 10, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </div>
        <div style={{ fontSize: 9, color: T.textDim, marginTop: 1 }}>
          {clip.duration}s · {clip.has_alpha ? "α-channel" : "chroma-key"}
        </div>
      </div>

      {/* ── Loop mode selector ── */}
      <div style={{ padding: "3px 7px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {LOOP_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={e => { e.stopPropagation(); setLoopMode(opt.value); }}
            title={opt.value === "none" ? "Play clip once" : opt.value === "full" ? "Loop the full clip" : `Loop last ${opt.value.replace("last_", "").replace("s", "")} second(s)`}
            style={{
              padding: "2px 5px", borderRadius: 4, fontSize: 9, cursor: "pointer",
              fontFamily: "inherit", border: "none",
              background: loopMode === opt.value ? T.accent : `${T.border}80`,
              color: loopMode === opt.value ? "#fff" : T.textDim,
              fontWeight: loopMode === opt.value ? 700 : 400,
              transition: "background 0.1s",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Add button ── */}
      <div style={{ padding: "4px 7px 7px" }}>
        <button
          onClick={handleAdd}
          disabled={clip.enabled === false}
          style={{
            width: "100%", padding: "4px 0", borderRadius: 5, border: "none",
            background: clip.enabled === false ? T.bgDeep : T.accent,
            color: clip.enabled === false ? T.textFaint : "#fff",
            fontSize: 10, fontWeight: 600, cursor: clip.enabled === false ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          + Add to Timeline
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

function Timeline({ overlays, videoDuration, selectedId, onSelect, T }) {
  return (
    <div style={{ userSelect: "none" }}>
      <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
        Timeline — {formatTime(videoDuration)}
      </div>

      {/* Base track with ticks */}
      <div style={{ position: "relative", height: 18, background: T.bgDeep, borderRadius: 4, border: `1px solid ${T.border}`, marginBottom: 5 }}>
        {videoDuration > 0 && Array.from({ length: Math.floor(videoDuration / 10) }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${((i + 1) * 10 / videoDuration) * 100}%`, top: 0, bottom: 0, width: 1, background: T.border, opacity: 0.5 }} />
        ))}
      </div>

      {/* Overlay tracks */}
      {overlays.map((ov, idx) => {
        const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
        const left  = videoDuration ? (ov.startTime / videoDuration) * 100 : 0;
        const width = videoDuration ? Math.max(1, (ov.duration / videoDuration) * 100) : 5;
        return (
          <div key={ov.id} style={{ position: "relative", height: 20, marginBottom: 3 }}>
            <div style={{ position: "absolute", inset: 0, background: T.bgDeep, borderRadius: 4, border: `1px solid ${T.border}20` }} />
            <div
              onClick={() => onSelect(ov.id)}
              style={{
                position: "absolute",
                left: `${Math.min(left, 97)}%`,
                width: `${Math.min(width, 100 - left)}%`,
                top: 2, bottom: 2,
                background: color,
                opacity: selectedId === ov.id ? 1 : 0.65,
                borderRadius: 3, cursor: "pointer",
                border: selectedId === ov.id ? `2px solid #fff` : "none",
                display: "flex", alignItems: "center", paddingLeft: 4, overflow: "hidden",
              }}
            >
              <span style={{ fontSize: 8, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>
                {ov.filename.replace(".mp4", "").slice(0, 18)}
              </span>
            </div>
          </div>
        );
      })}

      {overlays.length === 0 && (
        <div style={{ fontSize: 10, color: T.textFaint, padding: "5px 0" }}>
          No overlays yet — pick a clip from the left and click "Add to Timeline".
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OverlayControls
// ─────────────────────────────────────────────────────────────────────────────

function OverlayControls({ overlay, onChange, onRemove, videoDuration, T }) {
  if (!overlay) {
    return (
      <div style={{ fontSize: 11, color: T.textFaint, padding: "16px 0", textAlign: "center" }}>
        Click an overlay on the timeline to edit it.
      </div>
    );
  }

  const slider = (label, val, min, max, step, onCh, fmt = v => v) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 3, textTransform: "uppercase" }}>
        {label}: {fmt(val)}
      </label>
      <input type="range" min={min} max={max} step={step} value={val}
        style={{ width: "100%", accentColor: T.accent }}
        onChange={e => onCh(Number(e.target.value))} />
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: T.text, fontWeight: 700, marginBottom: 10, wordBreak: "break-word" }}>
        {overlay.filename.replace(".mp4", "").replace(/_/g, " ")}
      </div>

      {slider("Start time", overlay.startTime, 0, Math.max(videoDuration - 1, 1), 0.1,
        v => onChange({ ...overlay, startTime: v }), formatTime)}

      {slider("Duration", overlay.duration, 0.5, 30, 0.5,
        v => onChange({ ...overlay, duration: v }), v => `${v}s`)}

      {slider("Position X", overlay.x, 0, 1920, 10,
        v => onChange({ ...overlay, x: v }), v => `${v}px`)}

      {slider("Position Y", overlay.y, 0, 1080, 10,
        v => onChange({ ...overlay, y: v }), v => `${v}px`)}

      {slider("Scale", overlay.scale, 0.1, 2.0, 0.05,
        v => onChange({ ...overlay, scale: v }), v => `${Math.round(v * 100)}%`)}

      {/* Loop mode */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 5, textTransform: "uppercase" }}>Loop mode</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {LOOP_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={() => onChange({ ...overlay, loopMode: opt.value })}
              style={{
                padding: "3px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                background: overlay.loopMode === opt.value ? T.accent : "transparent",
                color: overlay.loopMode === opt.value ? "#fff" : T.textDim,
                border: `1px solid ${overlay.loopMode === opt.value ? T.accent : T.border}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audio mix */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 12 }}>
        <input type="checkbox" checked={overlay.hasSound}
          onChange={e => onChange({ ...overlay, hasSound: e.target.checked })}
          style={{ accentColor: T.accent }} />
        <span style={{ fontSize: 11, color: T.textMid }}>Mix overlay SFX</span>
      </label>

      <button onClick={() => onRemove(overlay.id)}
        style={{ width: "100%", padding: "6px 0", borderRadius: 6, border: `1px solid ${T.accentRed}40`, background: `${T.accentRed}18`, color: T.accentRed, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
        Remove Overlay
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VideoEditor
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoEditor({ video, onClose, T }) {
  // ── Clip library ────────────────────────────────────────────────────────
  const [clips,        setClips]        = useState([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [search,       setSearch]       = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  // ── Upload ───────────────────────────────────────────────────────────────
  const uploadRef = useRef(null);
  const [uploading,       setUploading]       = useState(false);
  const [uploadLabel,     setUploadLabel]     = useState("");
  const [uploadKw,        setUploadKw]        = useState("");
  const [showUploadForm,  setShowUploadForm]  = useState(false);
  const [seeding,         setSeeding]         = useState(false);
  const [seedResult,      setSeedResult]      = useState(null);

  // ── Overlays ─────────────────────────────────────────────────────────────
  const [overlays,    setOverlays]    = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);

  // ── Composite job ─────────────────────────────────────────────────────────
  const [jobStatus, setJobStatus] = useState(null); // null | "running" | "done" | "error"
  const [jobMsg,    setJobMsg]    = useState("");
  const [resultUrl, setResultUrl] = useState(null);

  // ── Auto-composite preview ────────────────────────────────────────────────
  const [autoPreview, setAutoPreview] = useState(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // ── Chroma key settings ───────────────────────────────────────────────────
  const [chromaColor, setChromaColor] = useState("#00FF00");
  const [chromaSim,   setChromaSim]   = useState(0.35);
  const [mixAudio,    setMixAudio]    = useState(true);

  const pollRef    = useRef(null);
  const videoRef   = useRef(null);
  const [videoDuration, setVideoDuration] = useState(video?.duration_seconds || 60);

  // ── Load clips ────────────────────────────────────────────────────────────
  const loadClips = useCallback(() => {
    setClipsLoading(true);
    listStickFigures(false)
      .then(d => setClips(d.clips || []))
      .catch(() => setClips([]))
      .finally(() => setClipsLoading(false));
  }, []);

  useEffect(() => { loadClips(); }, [loadClips]);

  // ── Poll composite job ────────────────────────────────────────────────────
  useEffect(() => {
    if (jobStatus !== "running") { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      try {
        const s = await getCompositeStatus(video.id);
        if (s.status === "done") {
          setJobStatus("done");
          setJobMsg(s.message || "Complete");
          setResultUrl(s.preview_url || null);
          clearInterval(pollRef.current);
        } else if (s.status === "error") {
          setJobStatus("error");
          setJobMsg(s.message || "Error");
          clearInterval(pollRef.current);
        } else {
          setJobMsg(s.message || "Processing…");
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [jobStatus, video?.id]);

  // ── Seed ─────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true); setSeedResult(null);
    try {
      const r = await seedStickFigures();
      setSeedResult(r);
      loadClips();
    } catch { setSeedResult({ error: "Seed failed" }); }
    setSeeding(false);
  };

  // ── Upload file ───────────────────────────────────────────────────────────
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const kws = uploadKw.split(",").map(s => s.trim()).filter(Boolean).join(",");
      const row = await uploadStickFigure(file, uploadLabel, kws);
      row.preview_url = `/stickfigures-assets/${row.filename}`;
      setClips(prev => [row, ...prev]);
      setUploadLabel(""); setUploadKw(""); setShowUploadForm(false);
    } catch (err) {
      alert(err?.response?.data?.detail || "Upload failed");
    }
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = "";
  };

  // ── Clip library helpers ──────────────────────────────────────────────────
  const filteredClips = clips.filter(c => {
    if (!showDisabled && c.enabled === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.filename.toLowerCase().includes(q) ||
      (c.label || "").toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.includes(q))
    );
  });

  // ── Add clip to timeline ──────────────────────────────────────────────────
  const addClip = useCallback((clip, loopMode = "none") => {
    const cur  = videoRef.current;
    const startT = cur ? Math.min(cur.currentTime, Math.max(0, videoDuration - 1)) : 0;
    const newOv = {
      id:         newId(),
      filename:   clip.filename,
      clipPath:   clip.path,
      previewUrl: clip.preview_url,
      startTime:  startT,
      duration:   clip.duration || 5,
      x:          80,
      y:          80,
      scale:      0.5,
      loopMode,
      hasSound:   clip.has_audio,
    };
    setOverlays(prev => [...prev, newOv]);
    setSelectedId(newOv.id);
  }, [videoDuration]);

  const selectedOverlay = overlays.find(o => o.id === selectedId) || null;
  const updateOverlay   = updated => setOverlays(prev => prev.map(o => o.id === updated.id ? updated : o));
  const removeOverlay   = id => { setOverlays(prev => prev.filter(o => o.id !== id)); if (selectedId === id) setSelectedId(null); };

  // ── Build composite payload ───────────────────────────────────────────────
  const buildPayload = () => overlays.map(ov => ({
    clip_path:  ov.clipPath,
    start_time: ov.startTime,
    duration:   ov.duration,
    x:          ov.x,
    y:          ov.y,
    scale:      ov.scale,
    loop_mode:  ov.loopMode,
    has_sound:  ov.hasSound,
  }));

  // ── Apply overlays ────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (overlays.length === 0 || jobStatus === "running") return;
    setJobStatus("running");
    setJobMsg("Starting composite job…");
    setResultUrl(null);
    try {
      await startComposite(video.id, buildPayload(), {
        mixAudio,
        chromaColor: chromaColor.replace("#", "0x"),
        chromaSimilarity: chromaSim,
      });
    } catch (err) {
      setJobStatus("error");
      setJobMsg(err?.response?.data?.detail || "Failed to start job");
    }
  };

  // ── Auto-insert ───────────────────────────────────────────────────────────
  const handleAutoPreview = async () => {
    setAutoLoading(true); setAutoPreview(null);
    try {
      const res = await previewAutoComposite(video.id, { minGap: 8, maxOverlays: 8, mixAudio });
      setAutoPreview(res.overlays || []);
    } catch { setAutoPreview([]); }
    setAutoLoading(false);
  };

  const handleAutoApply = async () => {
    if (jobStatus === "running") return;
    setJobStatus("running"); setJobMsg("Running auto-composite…");
    setResultUrl(null); setAutoPreview(null);
    try {
      await startAutoComposite(video.id, { minGap: 8, maxOverlays: 8, mixAudio });
    } catch (err) {
      setJobStatus("error");
      setJobMsg(err?.response?.data?.detail || "Failed to start job");
    }
  };

  const importAutoPreview = () => {
    if (!autoPreview) return;
    const newOvs = autoPreview.map(ap => ({
      id:         newId(),
      filename:   ap.filename,
      clipPath:   String(ap.clip_path),
      previewUrl: ap.preview_url || `/stickfigures-assets/${ap.filename}`,
      startTime:  ap.start_time,
      duration:   ap.duration,
      x:          80,
      y:          80,
      scale:      ap.scale || 0.5,
      loopMode:   ap.loop_mode || "none",
      hasSound:   ap.has_sound !== false,
    }));
    setOverlays(newOvs);
    setAutoPreview(null);
  };

  // ── Video URL ─────────────────────────────────────────────────────────────
  const getVideoUrl = () => {
    if (!video?.file_path) return null;
    if (video.file_path.startsWith("http")) return video.file_path;
    const fname = video.file_path.split("/").pop();
    return `/local-videos/${fname}`;
  };
  const videoUrl = resultUrl || getVideoUrl();

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const disabledCount = clips.filter(c => c.enabled === false).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)", minHeight: 500, background: T.bg }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", background: T.topBar,
        borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>✂ Video Editor</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: T.textDim }}>
            {video?.title || video?.prompt?.slice(0, 50) || video?.id}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {jobStatus === "running" && <span style={{ fontSize: 11, color: T.accentYellow }}>⏳ {jobMsg}</span>}
          {jobStatus === "error"   && <span style={{ fontSize: 11, color: T.accentRed }}>✕ {jobMsg}</span>}
          {jobStatus === "done"    && <span style={{ fontSize: 11, color: T.accentGreen }}>✓ {jobMsg}</span>}
          <button onClick={onClose}
            style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textMid, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            ← Back to videos
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: Clip Library ───────────────────────────────────────── */}
        <div style={{
          width: 230, flexShrink: 0,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          background: T.bgSub, overflow: "hidden",
        }}>
          {/* Library header */}
          <div style={{ padding: "8px 8px 4px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                Clips ({filteredClips.length}{disabledCount > 0 && !showDisabled ? `/${clips.length}` : ""})
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={loadClips} title="Refresh clips from DB"
                  style={{ padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer" }}>
                  ↺
                </button>
                <button onClick={handleSeed} disabled={seeding} title="Seed 84 built-in clips from disk"
                  style={{ padding: "2px 7px", borderRadius: 5, border: "none", background: seeding ? T.bgCard : `${T.accent}20`, color: T.accent, fontSize: 10, cursor: seeding ? "not-allowed" : "pointer" }}>
                  {seeding ? "…" : "Seed"}
                </button>
                <button onClick={() => setShowUploadForm(v => !v)} title="Upload a new clip"
                  style={{ padding: "2px 7px", borderRadius: 5, border: "none", background: showUploadForm ? T.accent : T.bgCard, color: showUploadForm ? "#fff" : T.textDim, fontSize: 10, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>

            {seedResult && (
              <div style={{ fontSize: 9, color: seedResult.error ? T.accentRed : T.accentGreen, marginBottom: 4 }}>
                {seedResult.error || `✓ ${seedResult.upserted} clips loaded${seedResult.skipped > 0 ? `, ${seedResult.skipped} skipped` : ""}`}
              </div>
            )}

            {/* Upload form */}
            {showUploadForm && (
              <div style={{ padding: 8, background: T.bgDeep, borderRadius: 7, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                <input value={uploadLabel} onChange={e => setUploadLabel(e.target.value)} placeholder="Label (optional)"
                  style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 6px", color: T.text, fontFamily: "inherit", fontSize: 10, boxSizing: "border-box", marginBottom: 4 }} />
                <input value={uploadKw} onChange={e => setUploadKw(e.target.value)} placeholder="Keywords (comma-separated)"
                  style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 6px", color: T.text, fontFamily: "inherit", fontSize: 10, boxSizing: "border-box", marginBottom: 6 }} />
                <input ref={uploadRef} type="file" accept=".mp4,video/mp4" onChange={handleUploadFile} disabled={uploading} style={{ display: "none" }} />
                <button onClick={() => uploadRef.current?.click()} disabled={uploading}
                  style={{ width: "100%", padding: "5px 0", borderRadius: 5, border: "none", background: T.accent, color: "#fff", fontSize: 10, cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? "Uploading…" : "Choose .mp4"}
                </button>
              </div>
            )}

            {/* Search */}
            <input type="text" placeholder="Search clips…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", color: T.text, fontFamily: "inherit", fontSize: 11, boxSizing: "border-box", outline: "none" }} />

            {disabledCount > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} style={{ accentColor: T.accent }} />
                <span style={{ fontSize: 9, color: T.textFaint }}>Show {disabledCount} disabled</span>
              </label>
            )}
          </div>

          {/* Clip grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
            {clipsLoading ? (
              <div style={{ fontSize: 11, color: T.textDim, padding: 8, textAlign: "center" }}>Loading clips…</div>
            ) : filteredClips.length === 0 ? (
              <div style={{ fontSize: 10, color: T.textDim, padding: 8, textAlign: "center", lineHeight: 1.5 }}>
                {clips.length === 0
                  ? <>No clips yet.<br />Click <strong>Seed</strong> to load the 84 built-in clips.</>
                  : "No clips match your search."}
              </div>
            ) : (
              filteredClips.map(c => (
                <ClipCard
                  key={c.id || c.filename}
                  clip={c}
                  onAdd={addClip}
                  onUpdated={updated => setClips(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDeleted={id => setClips(prev => prev.filter(x => x.id !== id))}
                  T={T}
                />
              ))
            )}
          </div>
        </div>

        {/* ── CENTRE: Video + Timeline + Actions ───────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg, minWidth: 0 }}>
          {/* Video player */}
          <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: 200 }}>
            {videoUrl ? (
              <video ref={videoRef} src={videoUrl} controls
                style={{ maxWidth: "100%", maxHeight: "100%", outline: "none" }}
                onLoadedMetadata={e => setVideoDuration(e.target.duration)} />
            ) : (
              <div style={{ color: T.textDim, fontSize: 12 }}>No video file available for this entry.</div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${T.border}`, background: T.bgSub, flexShrink: 0 }}>
            <Timeline overlays={overlays} videoDuration={videoDuration} selectedId={selectedId} onSelect={setSelectedId} T={T} />
          </div>

          {/* Action bar */}
          <div style={{
            padding: "8px 14px", borderTop: `1px solid ${T.border}`,
            background: T.bgSub, display: "flex", gap: 7, flexWrap: "wrap",
            alignItems: "center", flexShrink: 0,
          }}>
            <button onClick={handleApply}
              disabled={overlays.length === 0 || jobStatus === "running"}
              title={overlays.length === 0 ? "Add at least one clip overlay first" : "Run FFmpeg composite and replace the video"}
              style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: overlays.length === 0 || jobStatus === "running" ? "not-allowed" : "pointer",
                fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                background: overlays.length === 0 || jobStatus === "running" ? T.bgCard : T.accent,
                color: overlays.length === 0 || jobStatus === "running" ? T.textFaint : "#fff",
              }}>
              🎬 Apply Overlays ({overlays.length})
            </button>

            <button onClick={handleAutoPreview} disabled={autoLoading || jobStatus === "running"}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${T.border}`, cursor: autoLoading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 11, background: T.bgCard, color: T.textMid, opacity: autoLoading || jobStatus === "running" ? 0.5 : 1 }}>
              {autoLoading ? "Matching…" : "🤖 Auto-Preview"}
            </button>

            <button onClick={handleAutoApply} disabled={jobStatus === "running"}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${T.border}`, cursor: jobStatus === "running" ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 11, background: T.bgCard, color: T.textMid, opacity: jobStatus === "running" ? 0.5 : 1 }}>
              ⚡ Auto-Insert & Render
            </button>

            {overlays.length > 0 && (
              <button onClick={() => { setOverlays([]); setSelectedId(null); }}
                style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.accentRed}40`, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: T.accentRed }}>
                Clear All
              </button>
            )}

            {/* Chroma key / SFX settings */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: T.textFaint }}>Key colour</span>
              <input type="color" value={chromaColor} onChange={e => setChromaColor(e.target.value)}
                style={{ width: 26, height: 22, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              <span style={{ fontSize: 10, color: T.textFaint }}>Sim</span>
              <input type="range" min="0.1" max="0.6" step="0.01" value={chromaSim}
                onChange={e => setChromaSim(Number(e.target.value))}
                style={{ width: 60, accentColor: T.accent }} />
              <span style={{ fontSize: 10, color: T.textDim }}>{chromaSim.toFixed(2)}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={mixAudio} onChange={e => setMixAudio(e.target.checked)} style={{ accentColor: T.accent }} />
                <span style={{ fontSize: 10, color: T.textFaint }}>Mix SFX</span>
              </label>
            </div>
          </div>

          {/* Auto-preview results */}
          {autoPreview && (
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}`, background: T.bgCard, flexShrink: 0, maxHeight: 140, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Auto-match — {autoPreview.length} clip(s)
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  {autoPreview.length > 0 && (
                    <button onClick={importAutoPreview}
                      style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: T.accent, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                      Import to Timeline
                    </button>
                  )}
                  <button onClick={() => setAutoPreview(null)}
                    style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                    ✕
                  </button>
                </div>
              </div>
              {autoPreview.length === 0 ? (
                <div style={{ fontSize: 11, color: T.textDim }}>No keyword matches found in the script.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {autoPreview.map((ap, i) => (
                    <div key={i} style={{ padding: "3px 9px", borderRadius: 5, fontSize: 10, background: `${OVERLAY_COLORS[i % OVERLAY_COLORS.length]}22`, border: `1px solid ${OVERLAY_COLORS[i % OVERLAY_COLORS.length]}55`, color: T.textMid }}>
                      <strong>{formatTime(ap.start_time)}</strong> · {ap.filename.replace(".mp4", "").replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result video */}
          {resultUrl && (
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}`, background: T.bgCard, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: T.accentGreen }}>✓ Composited video ready</span>
              <a href={resultUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, background: T.accentGreen, color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                Open / Download
              </a>
            </div>
          )}
        </div>

        {/* ── RIGHT: Overlay Controls ──────────────────────────────────── */}
        <div style={{ width: 230, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bgSub, overflowY: "auto", padding: 12 }}>
          <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
            Overlay Controls
          </div>
          <OverlayControls
            overlay={selectedOverlay}
            onChange={updateOverlay}
            onRemove={removeOverlay}
            videoDuration={videoDuration}
            T={T}
          />

          {/* Overlay list */}
          {overlays.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
                All Overlays ({overlays.length})
              </div>
              {overlays.map((ov, idx) => {
                const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
                return (
                  <div key={ov.id} onClick={() => setSelectedId(ov.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", borderRadius: 5, background: selectedId === ov.id ? `${color}22` : "transparent", border: `1px solid ${selectedId === ov.id ? color : "transparent"}`, cursor: "pointer", marginBottom: 2 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: T.textMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ov.filename.replace(".mp4", "").replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 8, color: T.textFaint, flexShrink: 0 }}>{formatTime(ov.startTime)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
