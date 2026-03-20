/**
 * VideoEditor — Stick-Figure Compositor UI
 *
 * Features:
 *  • Browse stick-figure clip library (hover = inline preview)
 *  • Drag clips onto a video timeline to place them
 *  • Per-overlay controls: position (x/y), scale, start time, loop mode
 *  • Loop modes: none | full | last 1 s | last 2 s | last 3 s
 *  • Manual "Apply Overlays" → POST /videos/{id}/composite
 *  • "Auto-Insert" dry-run preview → POST /videos/{id}/auto-composite/preview
 *  •  "Auto-Insert" apply         → POST /videos/{id}/auto-composite
 *  • Poll composite job status and show result video when done
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

const LOOP_OPTIONS = [
  { value: "none",    label: "No loop" },
  { value: "full",    label: "Loop full" },
  { value: "last_1s", label: "Last 1 s" },
  { value: "last_2s", label: "Last 2 s" },
  { value: "last_3s", label: "Last 3 s" },
];

function formatTime(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}

// Distinct hue for each overlay on the timeline
const OVERLAY_COLORS = [
  "#4a9eff", "#3dd68c", "#ff5c6c", "#ffb020",
  "#c084fc", "#fb923c", "#34d399", "#f472b6",
];

// ── Clip Card (library panel) ──────────────────────────────────────────────────

function ClipCard({ clip, onAdd, onUpdated, onDeleted, T }) {
  const videoRef  = useRef(null);
  const [hovered, setHovered]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [draftLabel, setDraftLabel]   = useState(clip.label || clip.filename.replace(".mp4", ""));
  const [draftKw, setDraftKw]     = useState((clip.keywords || []).join(", "));
  const [saving, setSaving]       = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const enter = () => {
    if (editing) return;
    setHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };
  const leave = () => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const save = async (e) => {
    e.stopPropagation();
    if (!clip.id) return;
    setSaving(true);
    try {
      const kws = draftKw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const updated = await updateStickFigure(clip.id, { label: draftLabel.trim(), keywords: kws });
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
      <div style={{
        gridColumn: "span 2",
        border: `1px solid ${T.accent}`,
        borderRadius: 8, padding: 10,
        background: T.bgCard,
      }}
      onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>Label</div>
        <input
          value={draftLabel}
          onChange={e => setDraftLabel(e.target.value)}
          style={{
            width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
            borderRadius: 5, padding: "4px 7px", color: T.text,
            fontFamily: "inherit", fontSize: 11, boxSizing: "border-box", marginBottom: 6,
          }}
        />
        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>
          Keywords <span style={{ color: T.textDim }}>(comma-separated)</span>
        </div>
        <textarea
          value={draftKw}
          onChange={e => setDraftKw(e.target.value)}
          rows={3}
          style={{
            width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
            borderRadius: 5, padding: "4px 7px", color: T.text,
            fontFamily: "inherit", fontSize: 10, boxSizing: "border-box",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={save} disabled={saving} style={{
            padding: "4px 12px", borderRadius: 5, border: "none",
            background: T.accentGreen, color: "#fff", fontSize: 10,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} style={{
            padding: "4px 10px", borderRadius: 5,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          }}>
            Cancel
          </button>
          {!delConfirm ? (
            <button onClick={() => setDelConfirm(true)} style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 5,
              border: `1px solid ${T.accentRed}40`, background: "transparent",
              color: T.accentRed, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
            }}>
              Delete
            </button>
          ) : (
            <>
              <button onClick={doDelete} style={{
                marginLeft: "auto", padding: "4px 10px", borderRadius: 5,
                border: "none", background: T.accentRed,
                color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              }}>
                Confirm Delete
              </button>
              <button onClick={() => setDelConfirm(false)} style={{
                padding: "4px 8px", borderRadius: 5,
                border: `1px solid ${T.border}`, background: "transparent",
                color: T.textDim, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              }}>
                Cancel
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
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        background: T.bgCard,
        transition: "border-color 0.15s",
        position: "relative",
        opacity: clip.enabled === false ? 0.45 : 1,
      }}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={() => { if (clip.enabled !== false) onAdd(clip); }}
      title={clip.enabled === false ? "Disabled — click ✎ to re-enable" : `Add "${label}" (${clip.duration}s)`}
    >
      {/* Thumbnail / preview */}
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", position: "relative" }}>
        <video
          ref={videoRef}
          src={clip.preview_url}
          muted
          loop
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {!hovered && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}>
            <span style={{ color: "#fff", fontSize: 20 }}>▶</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "5px 7px 6px" }}>
        <div style={{
          fontSize: 10, color: T.text, fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {label}
        </div>
        <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>
          {clip.duration}s · {clip.has_alpha ? "α" : "key"}
          {clip.has_audio ? " · sfx" : ""}
        </div>
      </div>

      {/* Action buttons on hover */}
      {hovered && clip.id && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          display: "flex", gap: 3,
        }}
        onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => { e.stopPropagation(); setEditing(true); }}
            title="Edit keywords / label"
            style={{
              padding: "2px 5px", borderRadius: 4, border: "none",
              background: "rgba(0,0,0,0.65)", color: "#fff",
              fontSize: 10, cursor: "pointer",
            }}
          >✎</button>
          <button
            onClick={toggleEnabled}
            title={clip.enabled === false ? "Enable" : "Disable"}
            style={{
              padding: "2px 5px", borderRadius: 4, border: "none",
              background: clip.enabled === false ? "rgba(61,214,140,0.8)" : "rgba(255,92,108,0.8)",
              color: "#fff", fontSize: 10, cursor: "pointer",
            }}
          >
            {clip.enabled === false ? "On" : "Off"}
          </button>
        </div>
      )}

      {/* "+ ADD" badge on hover (when enabled) */}
      {hovered && clip.enabled !== false && (
        <div style={{
          position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
          background: T.accent, color: "#fff",
          fontSize: 9, fontWeight: 700, padding: "2px 7px",
          borderRadius: 4, letterSpacing: "0.05em", pointerEvents: "none",
        }}>
          + ADD
        </div>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ overlays, videoDuration, selectedId, onSelect, onTimeChange, T }) {
  const barRef = useRef(null);

  const handleBarClick = (e) => {
    if (!barRef.current || !videoDuration) return;
    const rect = barRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // deselect
    onSelect(null);
  };

  return (
    <div style={{ userSelect: "none" }}>
      <div style={{
        fontSize: 9, color: T.textFaint, letterSpacing: "0.08em",
        marginBottom: 4, textTransform: "uppercase",
      }}>
        Timeline — {formatTime(videoDuration)}
      </div>

      {/* Base track */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        style={{
          position: "relative",
          height: 20,
          background: T.bgDeep,
          borderRadius: 4,
          border: `1px solid ${T.border}`,
          marginBottom: 6,
        }}
      >
        {/* Tick marks every 10 s */}
        {videoDuration > 0 && Array.from({ length: Math.floor(videoDuration / 10) }).map((_, i) => {
          const x = ((i + 1) * 10 / videoDuration) * 100;
          return (
            <div key={i} style={{
              position: "absolute", left: `${x}%`,
              top: 0, bottom: 0, width: 1,
              background: T.border, opacity: 0.5,
            }} />
          );
        })}
      </div>

      {/* Overlay tracks */}
      {overlays.map((ov, idx) => {
        const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
        const left  = videoDuration ? (ov.startTime / videoDuration) * 100 : 0;
        const width = videoDuration ? Math.max(1, (ov.duration / videoDuration) * 100) : 5;
        const isSelected = ov.id === selectedId;

        return (
          <div key={ov.id} style={{ position: "relative", height: 22, marginBottom: 3 }}>
            {/* Track background */}
            <div style={{
              position: "absolute", inset: 0,
              background: T.bgDeep, borderRadius: 4,
              border: `1px solid ${T.border}20`,
            }} />
            {/* Segment */}
            <div
              onClick={(e) => { e.stopPropagation(); onSelect(ov.id); }}
              style={{
                position: "absolute",
                left: `${Math.min(left, 97)}%`,
                width: `${Math.min(width, 100 - left)}%`,
                top: 2, bottom: 2,
                background: color,
                opacity: isSelected ? 1 : 0.6,
                borderRadius: 3,
                cursor: "pointer",
                border: isSelected ? `2px solid #fff` : "none",
                overflow: "hidden",
                display: "flex", alignItems: "center", paddingLeft: 4,
                transition: "opacity 0.1s",
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
        <div style={{ fontSize: 10, color: T.textFaint, padding: "6px 0" }}>
          No overlays — click a clip in the library to add one.
        </div>
      )}
    </div>
  );
}

// ── Overlay Controls ──────────────────────────────────────────────────────────

function OverlayControls({ overlay, onChange, onRemove, videoDuration, T }) {
  if (!overlay) {
    return (
      <div style={{ fontSize: 11, color: T.textFaint, padding: "20px 0" }}>
        Select an overlay on the timeline to edit it.
      </div>
    );
  }

  const field = (key, value, setter) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 3, textTransform: "uppercase" }}>
        {key}
      </label>
      {setter}
    </div>
  );

  const slider = (key, val, min, max, step, onCh, fmt = (v) => v) => field(
    `${key}: ${fmt(val)}`,
    <input
      type="range" min={min} max={max} step={step} value={val}
      style={{ width: "100%", accentColor: T.accent }}
      onChange={(e) => onCh(Number(e.target.value))}
    />
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: T.text, fontWeight: 700, marginBottom: 10, wordBreak: "break-word" }}>
        {overlay.filename.replace(".mp4", "").replace(/_/g, " ")}
      </div>

      {slider("Start time", overlay.startTime, 0, Math.max(videoDuration - 1, 1), 0.1,
        (v) => onChange({ ...overlay, startTime: v }),
        formatTime)}

      {slider("Duration", overlay.duration, 0.5, 30, 0.5,
        (v) => onChange({ ...overlay, duration: v }),
        (v) => `${v}s`)}

      {slider("Position X", overlay.x, 0, 1920, 10,
        (v) => onChange({ ...overlay, x: v }),
        (v) => `${v}px`)}

      {slider("Position Y", overlay.y, 0, 1080, 10,
        (v) => onChange({ ...overlay, y: v }),
        (v) => `${v}px`)}

      {slider("Scale", overlay.scale, 0.1, 2.0, 0.05,
        (v) => onChange({ ...overlay, scale: v }),
        (v) => `${Math.round(v * 100)}%`)}

      {field("Loop mode",
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {LOOP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...overlay, loopMode: opt.value })}
              style={{
                padding: "3px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer",
                fontFamily: "inherit",
                background: overlay.loopMode === opt.value ? T.accent : "transparent",
                color: overlay.loopMode === opt.value ? "#fff" : T.textDim,
                border: `1px solid ${overlay.loopMode === opt.value ? T.accent : T.border}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {field("Audio",
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={overlay.hasSound}
            onChange={(e) => onChange({ ...overlay, hasSound: e.target.checked })}
            style={{ accentColor: T.accent }}
          />
          <span style={{ fontSize: 11, color: T.textMid }}>Mix overlay SFX</span>
        </label>
      )}

      <button
        onClick={() => onRemove(overlay.id)}
        style={{
          width: "100%", padding: "6px 0", borderRadius: 6, border: `1px solid ${T.accentRed}40`,
          background: `${T.accentRed}18`, color: T.accentRed,
          fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginTop: 4,
        }}
      >
        Remove Overlay
      </button>
    </div>
  );
}

// ── Main VideoEditor ───────────────────────────────────────────────────────────

let _oidCounter = 0;
function newId() { return `ov_${++_oidCounter}_${Date.now()}`; }

export default function VideoEditor({ video, onClose, T }) {
  const [clips, setClips]               = useState([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [search, setSearch]             = useState("");
  const [showAllClips, setShowAllClips] = useState(false);

  // Upload state
  const uploadRef = useRef(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadLabel, setUploadLabel]   = useState("");
  const [uploadKw, setUploadKw]         = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Seed state
  const [seeding, setSeeding]           = useState(false);
  const [seedResult, setSeedResult]     = useState(null);

  const [overlays, setOverlays]         = useState([]);
  const [selectedId, setSelectedId]     = useState(null);

  // Job state
  const [jobStatus, setJobStatus]       = useState(null); // null | "running" | "done" | "error"
  const [jobMsg, setJobMsg]             = useState("");
  const [resultUrl, setResultUrl]       = useState(null);

  // Auto-composite preview
  const [autoPreview, setAutoPreview]   = useState(null); // list of matched overlays
  const [autoLoading, setAutoLoading]   = useState(false);

  // Chroma key settings
  const [chromaColor, setChromaColor]   = useState("#00FF00");
  const [chromaSim, setChromaSim]       = useState(0.35);
  const [mixAudio, setMixAudio]         = useState(true);

  const pollRef = useRef(null);
  const videoRef = useRef(null);
  const [videoDuration, setVideoDuration] = useState(video.duration_seconds || 60);

  // Load clip library (all clips including disabled, so user can re-enable them)
  const loadClips = useCallback(() => {
    setClipsLoading(true);
    listStickFigures(false)        // enabled_only=false so admin can see disabled clips
      .then((d) => setClips(d.clips || []))
      .catch(() => setClips([]))
      .finally(() => setClipsLoading(false));
  }, []);

  useEffect(() => { loadClips(); }, [loadClips]);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const kws = uploadKw.split(",").map(s => s.trim()).filter(Boolean).join(",");
      const row = await uploadStickFigure(file, uploadLabel, kws);
      row.preview_url = `/stickfigures-assets/${row.filename}`;
      setClips(prev => [row, ...prev]);
      setUploadLabel("");
      setUploadKw("");
      setShowUploadForm(false);
    } catch (err) {
      alert(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const r = await seedStickFigures();
      setSeedResult(r);
      loadClips();
    } catch { setSeedResult({ error: "Seed failed" }); }
    setSeeding(false);
  };

  // Poll composite job
  useEffect(() => {
    if (jobStatus !== "running") {
      clearInterval(pollRef.current);
      return;
    }
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
  }, [jobStatus, video.id]);

  const getVideoUrl = () => {
    if (!video.file_path) return null;
    // file_path is either a Supabase Storage URL or a local filename
    if (video.file_path.startsWith("http")) return video.file_path;
    const fname = video.file_path.split("/").pop();
    return `/local-videos/${fname}`;
  };

  const videoUrl = resultUrl || getVideoUrl();

  // ── Clip library helpers ──────────────────────────────────────────────────
  const filteredClips = clips.filter((c) => {
    if (!showAllClips && c.enabled === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.filename.toLowerCase().includes(q) ||
      (c.label || "").toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.includes(q))
    );
  });

  const addClip = useCallback((clip) => {
    const cur = videoRef.current;
    const startT = cur ? Math.min(cur.currentTime, videoDuration - 1) : 0;
    const newOv = {
      id:        newId(),
      filename:  clip.filename,
      clipPath:  clip.path,
      previewUrl: clip.preview_url,
      startTime: startT,
      duration:  clip.duration || 5,
      x:         80,
      y:         80,
      scale:     0.5,
      loopMode:  "none",
      hasSound:  clip.has_audio,
    };
    setOverlays((prev) => [...prev, newOv]);
    setSelectedId(newOv.id);
  }, [videoDuration]);

  const selectedOverlay = overlays.find((o) => o.id === selectedId) || null;

  const updateOverlay = (updated) => {
    setOverlays((prev) => prev.map((o) => o.id === updated.id ? updated : o));
  };

  const removeOverlay = (id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Build API payload ─────────────────────────────────────────────────────
  const buildPayload = () =>
    overlays.map((ov) => ({
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
    if (overlays.length === 0) return;
    setJobStatus("running");
    setJobMsg("Queuing composite job…");
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

  // ── Auto-insert preview ───────────────────────────────────────────────────
  const handleAutoPreview = async () => {
    setAutoLoading(true);
    setAutoPreview(null);
    try {
      const res = await previewAutoComposite(video.id, { minGap: 8, maxOverlays: 8, mixAudio });
      setAutoPreview(res.overlays || []);
    } catch (err) {
      setAutoPreview([]);
    } finally {
      setAutoLoading(false);
    }
  };

  // ── Auto-insert apply ─────────────────────────────────────────────────────
  const handleAutoApply = async () => {
    setJobStatus("running");
    setJobMsg("Running auto-composite…");
    setResultUrl(null);
    setAutoPreview(null);
    try {
      await startAutoComposite(video.id, { minGap: 8, maxOverlays: 8, mixAudio });
    } catch (err) {
      setJobStatus("error");
      setJobMsg(err?.response?.data?.detail || "Failed to start job");
    }
  };

  // ── Import auto-preview into manual timeline ──────────────────────────────
  const importAutoPreview = () => {
    if (!autoPreview) return;
    const newOvs = autoPreview.map((ap) => ({
      id:        newId(),
      filename:  ap.filename,
      clipPath:  String(ap.clip_path),
      previewUrl: ap.preview_url || `/stickfigures-assets/${ap.filename}`,
      startTime: ap.start_time,
      duration:  ap.duration,
      x:         80,
      y:         80,
      scale:     ap.scale || 0.5,
      loopMode:  ap.loop_mode || "none",
      hasSound:  ap.has_sound !== false,
    }));
    setOverlays(newOvs);
    setAutoPreview(null);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    overlay: {
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
    },
    topBar: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px",
      background: T.topBar,
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    },
    body: {
      flex: 1, display: "flex", overflow: "hidden",
    },
    // Left: clip library
    library: {
      width: 220, flexShrink: 0,
      borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column",
      background: T.bgSub,
      overflow: "hidden",
    },
    libraryScroll: {
      flex: 1, overflowY: "auto", padding: "8px",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
      alignContent: "start",
    },
    // Centre: video + timeline
    centre: {
      flex: 1, display: "flex", flexDirection: "column",
      overflow: "hidden", background: T.bg,
    },
    // Right: controls
    controls: {
      width: 220, flexShrink: 0,
      borderLeft: `1px solid ${T.border}`,
      background: T.bgSub,
      overflowY: "auto", padding: 14,
    },
    sectionLabel: {
      fontSize: 9, color: T.textFaint, letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 6, fontWeight: 700,
    },
    btn: (accent = false) => ({
      padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
      background: accent ? T.accent : T.bgCard,
      color: accent ? "#fff" : T.textMid,
    }),
  };

  return (
    <div style={S.overlay}>
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
            Video Editor
          </span>
          <span style={{ marginLeft: 12, fontSize: 11, color: T.textDim }}>
            {video.title || video.prompt?.slice(0, 50) || video.id}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {jobStatus === "running" && (
            <span style={{ fontSize: 11, color: T.accentYellow }}>⏳ {jobMsg}</span>
          )}
          {jobStatus === "error" && (
            <span style={{ fontSize: 11, color: T.accentRed }}>✕ {jobMsg}</span>
          )}
          {jobStatus === "done" && (
            <span style={{ fontSize: 11, color: T.accentGreen }}>✓ {jobMsg}</span>
          )}
          <button
            onClick={onClose}
            style={{ ...S.btn(), fontSize: 16, padding: "4px 10px" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={S.body}>

        {/* ── LEFT: Clip Library ────────────────────────────────────── */}
        <div style={S.library}>
          <div style={{ padding: "8px 8px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={S.sectionLabel}>
                Library ({filteredClips.length}{!showAllClips && clips.some(c => c.enabled === false) ? ` / ${clips.length}` : ""})
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={loadClips}
                  title="Refresh clip list from DB"
                  style={{
                    padding: "2px 7px", borderRadius: 5, border: "none",
                    background: T.bgCard, color: T.textDim,
                    fontSize: 10, cursor: "pointer",
                  }}
                >↺</button>
                <button
                  onClick={() => setShowUploadForm(v => !v)}
                  title="Upload new clip"
                  style={{
                    padding: "2px 7px", borderRadius: 5, border: "none",
                    background: showUploadForm ? T.accent : T.bgCard,
                    color: showUploadForm ? "#fff" : T.textDim,
                    fontSize: 10, cursor: "pointer",
                  }}
                >+ Upload</button>
              </div>
            </div>

            {/* Upload form */}
            {showUploadForm && (
              <div style={{ marginBottom: 6, padding: "8px", background: T.bgDeep, borderRadius: 7, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>LABEL (optional)</div>
                <input
                  value={uploadLabel}
                  onChange={e => setUploadLabel(e.target.value)}
                  placeholder="e.g. Running away"
                  style={{
                    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "4px 6px", color: T.text,
                    fontFamily: "inherit", fontSize: 10, boxSizing: "border-box", marginBottom: 5,
                  }}
                />
                <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>KEYWORDS (comma-separated)</div>
                <input
                  value={uploadKw}
                  onChange={e => setUploadKw(e.target.value)}
                  placeholder="e.g. run, danger, flee"
                  style={{
                    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "4px 6px", color: T.text,
                    fontFamily: "inherit", fontSize: 10, boxSizing: "border-box", marginBottom: 6,
                  }}
                />
                <input
                  ref={uploadRef}
                  type="file"
                  accept=".mp4,video/mp4"
                  onChange={handleUploadFile}
                  disabled={uploading}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => uploadRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: "100%", padding: "5px 0", borderRadius: 5, border: "none",
                    background: T.accent, color: "#fff", fontSize: 10,
                    cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit",
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? "Uploading…" : "Choose .mp4 file"}
                </button>
                <div style={{ fontSize: 9, color: T.textFaint, marginTop: 5 }}>
                  Tip: DB is empty? Click "Seed DB" to load all 84 built-in clips.
                </div>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  style={{
                    width: "100%", marginTop: 4, padding: "4px 0", borderRadius: 5,
                    border: `1px solid ${T.border}`, background: "transparent",
                    color: T.textDim, fontSize: 10, cursor: seeding ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {seeding ? "Seeding…" : "Seed DB from disk"}
                </button>
                {seedResult && (
                  <div style={{ fontSize: 9, color: seedResult.error ? T.accentRed : T.accentGreen, marginTop: 4 }}>
                    {seedResult.error || `✓ ${seedResult.upserted} clips loaded`}
                    {seedResult.skipped > 0 ? `, ${seedResult.skipped} skipped` : ""}
                  </div>
                )}
              </div>
            )}

            <input
              type="text"
              placeholder="Search clips…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "5px 8px", color: T.text,
                fontFamily: "inherit", fontSize: 11, boxSizing: "border-box",
                outline: "none",
              }}
            />
            {clips.some(c => c.enabled === false) && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showAllClips}
                  onChange={e => setShowAllClips(e.target.checked)}
                  style={{ accentColor: T.accent }}
                />
                <span style={{ fontSize: 9, color: T.textFaint }}>Show disabled</span>
              </label>
            )}
          </div>
          <div style={S.libraryScroll}>
            {clipsLoading ? (
              <div style={{ gridColumn: "span 2", fontSize: 11, color: T.textDim, padding: 8 }}>
                Loading clips…
              </div>
            ) : filteredClips.length === 0 ? (
              <div style={{ gridColumn: "span 2", fontSize: 10, color: T.textDim, padding: 8 }}>
                {clips.length === 0
                  ? "No clips in DB yet — click \"+ Upload\" then \"Seed DB from disk\"."
                  : "No clips match your search."}
              </div>
            ) : (
              filteredClips.map((c) => (
                <ClipCard
                  key={c.id || c.filename}
                  clip={c}
                  onAdd={addClip}
                  onUpdated={updated => setClips(prev => prev.map(x => (x.id === updated.id ? updated : x)))}
                  onDeleted={id => setClips(prev => prev.filter(x => x.id !== id))}
                  T={T}
                />
              ))
            )}
          </div>
        </div>

        {/* ── CENTRE: Video + Timeline ──────────────────────────────── */}
        <div style={S.centre}>
          {/* Video player */}
          <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ maxWidth: "100%", maxHeight: "100%", outline: "none" }}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
              />
            ) : (
              <div style={{ color: T.textDim, fontSize: 12 }}>
                No video file available for this entry.
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{
            padding: "12px 16px", borderTop: `1px solid ${T.border}`,
            background: T.bgSub, flexShrink: 0,
          }}>
            <Timeline
              overlays={overlays}
              videoDuration={videoDuration}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onTimeChange={(id, t) => {
                setOverlays((prev) => prev.map((o) => o.id === id ? { ...o, startTime: t } : o));
              }}
              T={T}
            />
          </div>

          {/* Action bar */}
          <div style={{
            padding: "10px 16px", borderTop: `1px solid ${T.border}`,
            background: T.bgSub, display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", flexShrink: 0,
          }}>
            <button
              onClick={handleApply}
              disabled={overlays.length === 0 || jobStatus === "running"}
              style={{
                ...S.btn(true),
                opacity: (overlays.length === 0 || jobStatus === "running") ? 0.5 : 1,
              }}
            >
              🎬 Apply Overlays ({overlays.length})
            </button>

            <button
              onClick={handleAutoPreview}
              disabled={autoLoading || jobStatus === "running"}
              style={{ ...S.btn(), opacity: (autoLoading || jobStatus === "running") ? 0.5 : 1 }}
            >
              {autoLoading ? "Matching…" : "🤖 Preview Auto-Insert"}
            </button>

            <button
              onClick={handleAutoApply}
              disabled={jobStatus === "running"}
              style={{ ...S.btn(), opacity: jobStatus === "running" ? 0.5 : 1 }}
            >
              ⚡ Auto-Insert & Render
            </button>

            {/* Chroma key colour */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <span style={{ fontSize: 10, color: T.textFaint }}>Key colour</span>
              <input
                type="color"
                value={chromaColor}
                onChange={(e) => setChromaColor(e.target.value)}
                style={{ width: 28, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
              />
              <span style={{ fontSize: 10, color: T.textFaint }}>Similarity</span>
              <input
                type="range" min="0.1" max="0.6" step="0.01"
                value={chromaSim}
                onChange={(e) => setChromaSim(Number(e.target.value))}
                style={{ width: 70, accentColor: T.accent }}
              />
              <span style={{ fontSize: 10, color: T.textDim }}>{chromaSim.toFixed(2)}</span>

              <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={mixAudio}
                  onChange={(e) => setMixAudio(e.target.checked)}
                  style={{ accentColor: T.accent }}
                />
                <span style={{ fontSize: 10, color: T.textFaint }}>Mix SFX</span>
              </label>
            </div>
          </div>

          {/* Auto-preview results */}
          {autoPreview && (
            <div style={{
              padding: "10px 16px", borderTop: `1px solid ${T.border}`,
              background: T.bgCard, flexShrink: 0, maxHeight: 160, overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={S.sectionLabel}>
                  Auto-match results — {autoPreview.length} clip(s) found
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {autoPreview.length > 0 && (
                    <button onClick={importAutoPreview} style={S.btn(true)}>
                      Import to Timeline
                    </button>
                  )}
                  <button onClick={() => setAutoPreview(null)} style={S.btn()}>✕</button>
                </div>
              </div>
              {autoPreview.length === 0 ? (
                <div style={{ fontSize: 11, color: T.textDim }}>No keyword matches found in the script.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {autoPreview.map((ap, i) => (
                    <div key={i} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 10,
                      background: `${OVERLAY_COLORS[i % OVERLAY_COLORS.length]}22`,
                      border: `1px solid ${OVERLAY_COLORS[i % OVERLAY_COLORS.length]}55`,
                      color: T.textMid,
                    }}>
                      <span style={{ fontWeight: 700 }}>{formatTime(ap.start_time)}</span>
                      {" · "}
                      {ap.filename.replace(".mp4", "").replace(/_/g, " ")}
                      <span style={{ color: T.textDim }}> (score {ap.score})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result video */}
          {resultUrl && (
            <div style={{
              padding: "10px 16px", borderTop: `1px solid ${T.border}`,
              background: T.bgCard, flexShrink: 0,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 11, color: T.accentGreen }}>✓ Composited video ready</span>
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 11,
                  background: T.accentGreen, color: "#fff", textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Open / Download
              </a>
            </div>
          )}
        </div>

        {/* ── RIGHT: Overlay Controls ───────────────────────────────── */}
        <div style={S.controls}>
          <div style={S.sectionLabel}>Overlay Controls</div>
          <OverlayControls
            overlay={selectedOverlay}
            onChange={updateOverlay}
            onRemove={removeOverlay}
            videoDuration={videoDuration}
            T={T}
          />

          {overlays.length > 0 && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={S.sectionLabel}>All Overlays ({overlays.length})</div>
              {overlays.map((ov, idx) => {
                const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
                return (
                  <div
                    key={ov.id}
                    onClick={() => setSelectedId(ov.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 6px", borderRadius: 6,
                      background: selectedId === ov.id ? `${color}22` : "transparent",
                      border: `1px solid ${selectedId === ov.id ? color : "transparent"}`,
                      cursor: "pointer", marginBottom: 3,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: T.textMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ov.filename.replace(".mp4", "").replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 9, color: T.textFaint, flexShrink: 0 }}>
                      {formatTime(ov.startTime)}
                    </span>
                  </div>
                );
              })}
              <button
                onClick={() => { setOverlays([]); setSelectedId(null); }}
                style={{
                  marginTop: 6, width: "100%", padding: "5px 0",
                  borderRadius: 6, border: `1px solid ${T.border}`,
                  background: "transparent", color: T.textDim,
                  fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
