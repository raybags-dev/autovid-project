/**
 * VideoEditor — Stick-Figure Compositor UI
 *
 * Full-screen overlay (position:fixed) covering the dashboard sidebar.
 *
 * Workflow:
 *  1. Browse clip library (left panel) → click ▶ to preview, pick loop mode,
 *     then "Add to Timeline"
 *  2. Selected overlays appear on the timeline and in the right controls panel
 *  3. Click "Apply Overlays" to run the FFmpeg composite (preview without saving)
 *  4. Review the result in the video player; then:
 *       • "Save & Replace Original" — finalizes (updates DB file_path)
 *       • "Download Copy" — download without touching the original
 *       • "Discard" — throw away the composite and start over
 *  5. "⚡ Auto-Insert & Render" previews keyword matches first; warns if none found
 *  6. Navigating back with pending overlays or an unsaved composite triggers a
 *     confirm dialog
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteStickFigure,
  finalizeComposite,
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
const LOOP_OPTIONS = [
  { value: "none",    label: "Once",   title: "Play once then stop" },
  { value: "full",    label: "↻ Loop", title: "Loop the entire clip" },
  { value: "last_1s", label: "1s",     title: "Loop the last 1 second" },
  { value: "last_2s", label: "2s",     title: "Loop the last 2 seconds" },
  { value: "last_3s", label: "3s",     title: "Loop the last 3 seconds" },
];

const OVERLAY_COLORS = [
  "#4a9eff","#3dd68c","#ff5c6c","#ffb020","#c084fc","#fb923c","#34d399","#f472b6",
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
// ClipCard — explicit play button + loop mode selector
// ─────────────────────────────────────────────────────────────────────────────
function ClipCard({ clip, onAdd, onUpdated, onDeleted, T }) {
  const videoRef  = useRef(null);
  const [playing,    setPlaying]    = useState(false);
  const [hovered,    setHovered]    = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [loopMode,   setLoopMode]   = useState("none");
  const [draftLabel, setDraftLabel] = useState(clip.label || clip.filename.replace(".mp4",""));
  const [draftKw,    setDraftKw]    = useState((clip.keywords || []).join(", "));
  const [saving,     setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // React doesn't reliably pass `muted` to the DOM
  useEffect(() => { if (videoRef.current) videoRef.current.muted = true; }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.currentTime = 0;
      videoRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    if (clip.enabled === false) return;
    // Pause preview when added
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    setPlaying(false);
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

  const label = clip.label || clip.filename.replace(".mp4","").replace(/_/g," ");

  if (editing) {
    return (
      <div style={{ border:`1px solid ${T.accent}`, borderRadius:8, padding:10, background:T.bgCard, minHeight:200 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:9, color:T.textFaint, marginBottom:3 }}>Label</div>
        <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)}
          style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:5, padding:"4px 7px", color:T.text, fontFamily:"inherit", fontSize:11, boxSizing:"border-box", marginBottom:5 }} />
        <div style={{ fontSize:9, color:T.textFaint, marginBottom:3 }}>Keywords (comma-separated)</div>
        <textarea value={draftKw} onChange={e => setDraftKw(e.target.value)} rows={2}
          style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:5, padding:"4px 7px", color:T.text, fontFamily:"inherit", fontSize:10, boxSizing:"border-box", resize:"vertical", marginBottom:6 }} />
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          <button onClick={save} disabled={saving}
            style={{ padding:"3px 10px", borderRadius:5, border:"none", background:T.accentGreen, color:"#fff", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            style={{ padding:"3px 10px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
            Cancel
          </button>
          {!delConfirm ? (
            <button onClick={() => setDelConfirm(true)}
              style={{ marginLeft:"auto", padding:"3px 10px", borderRadius:5, border:`1px solid ${T.accentRed}40`, background:"transparent", color:T.accentRed, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>Delete</button>
          ) : (
            <>
              <button onClick={doDelete}
                style={{ marginLeft:"auto", padding:"3px 10px", borderRadius:5, border:"none", background:T.accentRed, color:"#fff", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
              <button onClick={() => setDelConfirm(false)}
                style={{ padding:"3px 8px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:`1px solid ${hovered ? T.accent : T.border}`,
        borderRadius:8, overflow:"hidden",
        background:T.bgCard, transition:"border-color 0.15s",
        position:"relative",
        opacity: clip.enabled === false ? 0.45 : 1,
        cursor: clip.enabled === false ? "not-allowed" : "default",
        height:200, minHeight:200,
        display:"flex", flexDirection:"column",
      }}
    >
      {/* ── Video preview (100px) ── */}
      <div style={{ height:100, flexShrink:0, background:"#111", position:"relative", overflow:"hidden" }}>
        <video ref={videoRef} src={clip.preview_url} loop playsInline
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />

        {/* Centered play/pause button — always visible */}
        <div
          onClick={togglePlay}
          style={{
            position:"absolute", inset:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background: playing ? "transparent" : "rgba(0,0,0,0.38)",
            cursor:"pointer", transition:"background 0.15s",
          }}
        >
          {!playing && (
            <div style={{
              width:34, height:34, borderRadius:"50%",
              background:"rgba(255,255,255,0.18)",
              border:"2px solid rgba(255,255,255,0.6)",
              display:"flex", alignItems:"center", justifyContent:"center",
              backdropFilter:"blur(2px)",
            }}>
              <span style={{ color:"#fff", fontSize:14, marginLeft:3 }}>▶</span>
            </div>
          )}
          {playing && (
            <div style={{
              width:34, height:34, borderRadius:"50%",
              background:"rgba(255,255,255,0.12)",
              border:"2px solid rgba(255,255,255,0.4)",
              display:"flex", alignItems:"center", justifyContent:"center",
              backdropFilter:"blur(2px)",
            }}>
              <span style={{ color:"#fff", fontSize:12 }}>⏸</span>
            </div>
          )}
        </div>

        {/* Edit / enable buttons on hover */}
        {hovered && clip.id && (
          <div style={{ position:"absolute", top:4, right:4, display:"flex", gap:3, zIndex:2 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); setEditing(true); }}
              style={{ padding:"2px 5px", borderRadius:4, border:"none", background:"rgba(0,0,0,0.7)", color:"#fff", fontSize:10, cursor:"pointer" }}>✎</button>
            <button onClick={toggleEnabled}
              style={{ padding:"2px 5px", borderRadius:4, border:"none", background: clip.enabled === false ? "rgba(61,214,140,0.8)" : "rgba(255,92,108,0.8)", color:"#fff", fontSize:10, cursor:"pointer" }}>
              {clip.enabled === false ? "On" : "Off"}
            </button>
          </div>
        )}
      </div>

      {/* ── Label + metadata ── */}
      <div style={{ padding:"5px 8px 3px", flexShrink:0 }}>
        <div style={{ fontSize:10, color:T.text, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</div>
        <div style={{ fontSize:9, color:T.textDim, marginTop:1 }}>
          {clip.duration ? `${clip.duration}s` : "?"} · {clip.has_alpha ? "α-channel" : "chroma-key"}
        </div>
      </div>

      {/* ── Loop mode ── */}
      <div style={{ padding:"3px 8px", display:"flex", gap:3, flexWrap:"wrap", flexShrink:0 }}>
        {LOOP_OPTIONS.map(opt => (
          <button key={opt.value} title={opt.title}
            onClick={e => { e.stopPropagation(); setLoopMode(opt.value); }}
            style={{
              padding:"2px 5px", borderRadius:4, fontSize:9, cursor:"pointer",
              fontFamily:"inherit", border:"none",
              background: loopMode === opt.value ? T.accent : `${T.border}80`,
              color: loopMode === opt.value ? "#fff" : T.textDim,
              fontWeight: loopMode === opt.value ? 700 : 400,
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Add button ── */}
      <div style={{ padding:"4px 8px 7px", flexShrink:0, marginTop:"auto" }}>
        <button onClick={handleAdd} disabled={clip.enabled === false}
          style={{
            width:"100%", padding:"5px 0", borderRadius:5, border:"none",
            background: clip.enabled === false ? T.bgDeep : T.accent,
            color: clip.enabled === false ? T.textFaint : "#fff",
            fontSize:10, fontWeight:600, cursor: clip.enabled === false ? "not-allowed" : "pointer",
            fontFamily:"inherit",
          }}>
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
    <div style={{ userSelect:"none" }}>
      <div style={{ fontSize:9, color:T.textFaint, letterSpacing:"0.08em", marginBottom:4, textTransform:"uppercase" }}>
        Timeline — {formatTime(videoDuration)} · {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}
      </div>
      {/* Base track with tick marks */}
      <div style={{ position:"relative", height:18, background:T.bgDeep, borderRadius:4, border:`1px solid ${T.border}`, marginBottom:5 }}>
        {videoDuration > 0 && Array.from({ length:Math.floor(videoDuration / 10) }).map((_, i) => (
          <div key={i} style={{ position:"absolute", left:`${((i+1)*10/videoDuration)*100}%`, top:0, bottom:0, width:1, background:T.border, opacity:0.5 }} />
        ))}
      </div>
      {/* Overlay tracks */}
      {overlays.map((ov, idx) => {
        const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
        const left  = videoDuration ? (ov.startTime / videoDuration) * 100 : 0;
        const width = videoDuration ? Math.max(1.5, (ov.duration / videoDuration) * 100) : 5;
        return (
          <div key={ov.id} style={{ position:"relative", height:20, marginBottom:3 }}>
            <div style={{ position:"absolute", inset:0, background:T.bgDeep, borderRadius:4, border:`1px solid ${T.border}20` }} />
            <div onClick={() => onSelect(ov.id)}
              style={{
                position:"absolute",
                left:`${Math.min(left,97)}%`, width:`${Math.min(width,100-left)}%`,
                top:2, bottom:2, background:color,
                opacity: selectedId === ov.id ? 1 : 0.65,
                borderRadius:3, cursor:"pointer",
                border: selectedId === ov.id ? "2px solid #fff" : "none",
                display:"flex", alignItems:"center", paddingLeft:4, overflow:"hidden",
              }}>
              <span style={{ fontSize:8, color:"#fff", fontWeight:700, whiteSpace:"nowrap" }}>
                {ov.filename.replace(".mp4","").slice(0,16)} · {ov.loopMode !== "none" ? ov.loopMode : "×1"}
              </span>
            </div>
          </div>
        );
      })}
      {overlays.length === 0 && (
        <div style={{ fontSize:10, color:T.textFaint, padding:"5px 0" }}>
          No overlays — pick a clip from the library and click "+ Add to Timeline".
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OverlayControls
// ─────────────────────────────────────────────────────────────────────────────
function OverlayControls({ overlay, onChange, onRemove, onDuplicate, videoDuration, T }) {
  if (!overlay) {
    return (
      <div style={{ fontSize:11, color:T.textFaint, padding:"16px 0", textAlign:"center" }}>
        Click an overlay on the timeline to edit it.
      </div>
    );
  }

  const slider = (lbl, val, min, max, step, onCh, fmt = v => v) => (
    <div style={{ marginBottom:9 }}>
      <label style={{ display:"block", fontSize:9, color:T.textFaint, letterSpacing:"0.08em", marginBottom:2, textTransform:"uppercase" }}>
        {lbl}: {fmt(val)}
      </label>
      <input type="range" min={min} max={max} step={step} value={val}
        style={{ width:"100%", accentColor:T.accent }}
        onChange={e => onCh(Number(e.target.value))} />
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:11, color:T.text, fontWeight:700, marginBottom:8, wordBreak:"break-word" }}>
        {overlay.filename.replace(".mp4","").replace(/_/g," ")}
      </div>

      {slider("Start", overlay.startTime, 0, Math.max(videoDuration-1,1), 0.1,
        v => onChange({...overlay, startTime:v}), formatTime)}
      {slider("Duration", overlay.duration, 0.5, 30, 0.5,
        v => onChange({...overlay, duration:v}), v => `${v}s`)}
      {slider("X position", overlay.x, 0, 1920, 10,
        v => onChange({...overlay, x:v}), v => `${v}px`)}
      {slider("Y position", overlay.y, 0, 1080, 10,
        v => onChange({...overlay, y:v}), v => `${v}px`)}
      {slider("Scale", overlay.scale, 0.1, 2.0, 0.05,
        v => onChange({...overlay, scale:v}), v => `${Math.round(v*100)}%`)}

      {/* Loop mode */}
      <div style={{ marginBottom:9 }}>
        <div style={{ fontSize:9, color:T.textFaint, letterSpacing:"0.08em", marginBottom:4, textTransform:"uppercase" }}>Loop mode</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {LOOP_OPTIONS.map(opt => (
            <button key={opt.value} title={opt.title}
              onClick={() => onChange({...overlay, loopMode:opt.value})}
              style={{
                padding:"3px 7px", borderRadius:5, fontSize:10, cursor:"pointer", fontFamily:"inherit",
                background: overlay.loopMode === opt.value ? T.accent : "transparent",
                color: overlay.loopMode === opt.value ? "#fff" : T.textDim,
                border:`1px solid ${overlay.loopMode === opt.value ? T.accent : T.border}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audio */}
      <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", marginBottom:10 }}>
        <input type="checkbox" checked={overlay.hasSound}
          onChange={e => onChange({...overlay, hasSound:e.target.checked})}
          style={{ accentColor:T.accent }} />
        <span style={{ fontSize:11, color:T.textMid }}>Mix overlay audio</span>
      </label>

      <div style={{ display:"flex", gap:5, marginBottom:4 }}>
        <button onClick={() => onDuplicate(overlay)}
          style={{ flex:1, padding:"5px 0", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
          Duplicate
        </button>
        <button onClick={() => onRemove(overlay.id)}
          style={{ flex:1, padding:"5px 0", borderRadius:5, border:`1px solid ${T.accentRed}40`, background:`${T.accentRed}18`, color:T.accentRed, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
          Remove
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline confirm dialog
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmBanner({ message, confirmLabel, cancelLabel, onConfirm, onCancel, color, T }) {
  return (
    <div style={{
      padding:"10px 16px", background:`${color}18`,
      border:`1px solid ${color}55`, borderRadius:8,
      display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
    }}>
      <span style={{ flex:1, fontSize:11, color:T.textMid }}>{message}</span>
      <button onClick={onConfirm}
        style={{ padding:"5px 14px", borderRadius:6, border:"none", background:color, color:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
        {confirmLabel}
      </button>
      <button onClick={onCancel}
        style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
        {cancelLabel}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VideoEditor
// ─────────────────────────────────────────────────────────────────────────────
export default function VideoEditor({ video, onClose, T }) {
  // ── Clip library ──────────────────────────────────────────────────────────
  const [clips,        setClips]        = useState([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [search,       setSearch]       = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadRef = useRef(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadLabel,    setUploadLabel]    = useState("");
  const [uploadKw,       setUploadKw]       = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [seeding,        setSeeding]        = useState(false);
  const [seedResult,     setSeedResult]     = useState(null);

  // ── Overlays ──────────────────────────────────────────────────────────────
  const [overlays,   setOverlays]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // ── Composite job ─────────────────────────────────────────────────────────
  const [jobStatus, setJobStatus]  = useState(null); // null|"running"|"done"|"error"
  const [jobMsg,    setJobMsg]     = useState("");
  const [resultUrl, setResultUrl]  = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized,  setFinalized]  = useState(false); // saved to DB

  // ── Auto-composite ────────────────────────────────────────────────────────
  const [autoPreview, setAutoPreview]  = useState(null);
  const [autoLoading, setAutoLoading]  = useState(false);
  // Warn when auto-insert found 0 matches
  const [zeroMatchConfirm, setZeroMatchConfirm] = useState(false);

  // ── Back-navigation safety ────────────────────────────────────────────────
  const [backConfirm, setBackConfirm] = useState(false);

  // ── Chroma / audio settings ───────────────────────────────────────────────
  const [chromaColor, setChromaColor] = useState("#00FF00");
  const [chromaSim,   setChromaSim]   = useState(0.35);
  const [mixAudio,    setMixAudio]    = useState(true);

  const pollRef  = useRef(null);
  const videoRef = useRef(null);
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
          setJobMsg("Composite ready — review the result below");
          setResultUrl(s.preview_url || null);
          clearInterval(pollRef.current);
        } else if (s.status === "error") {
          setJobStatus("error");
          setJobMsg(s.message || "Composite failed");
          clearInterval(pollRef.current);
        } else {
          setJobMsg(s.message || "Processing…");
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [jobStatus, video?.id]);

  // ── Seed ──────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true); setSeedResult(null);
    try {
      const r = await seedStickFigures();
      setSeedResult(r); loadClips();
    } catch { setSeedResult({ error: "Seed failed" }); }
    setSeeding(false);
  };

  // ── Upload file ───────────────────────────────────────────────────────────
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const kws = uploadKw.split(",").map(s => s.trim()).filter(Boolean).join(",");
      const row = await uploadStickFigure(file, uploadLabel, kws);
      row.preview_url = `/stickfigures-assets/${row.filename}`;
      setClips(prev => [row, ...prev]);
      setUploadLabel(""); setUploadKw(""); setShowUploadForm(false);
    } catch (err) { alert(err?.response?.data?.detail || "Upload failed"); }
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = "";
  };

  // ── Clip library helpers ──────────────────────────────────────────────────
  const filteredClips = clips.filter(c => {
    if (!showDisabled && c.enabled === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.filename.toLowerCase().includes(q) ||
           (c.label || "").toLowerCase().includes(q) ||
           (c.keywords || []).some(k => k.includes(q));
  });

  // ── Add clip to timeline ──────────────────────────────────────────────────
  const addClip = useCallback((clip, loopMode = "none") => {
    const startT = videoRef.current
      ? Math.min(videoRef.current.currentTime, Math.max(0, videoDuration - 1))
      : 0;
    const newOv = {
      id:         newId(),
      filename:   clip.filename,
      clipPath:   clip.path,
      previewUrl: clip.preview_url,
      startTime:  parseFloat(startT.toFixed(1)),
      duration:   clip.duration || 5,
      x: 80, y: 80, scale: 0.5,
      loopMode,
      hasSound: clip.has_audio,
    };
    setOverlays(prev => [...prev, newOv]);
    setSelectedId(newOv.id);
  }, [videoDuration]);

  const selectedOverlay = overlays.find(o => o.id === selectedId) || null;
  const updateOverlay   = updated => setOverlays(prev => prev.map(o => o.id === updated.id ? updated : o));
  const removeOverlay   = id => { setOverlays(prev => prev.filter(o => o.id !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicateOverlay = (ov) => {
    const copy = { ...ov, id: newId(), startTime: Math.min(ov.startTime + ov.duration + 1, videoDuration - 1) };
    setOverlays(prev => [...prev, copy]);
    setSelectedId(copy.id);
  };

  // ── Build API payload ─────────────────────────────────────────────────────
  const buildPayload = () => overlays.map(ov => ({
    clip_path:  ov.clipPath,
    start_time: ov.startTime,
    duration:   ov.duration,
    x: ov.x, y: ov.y, scale: ov.scale,
    loop_mode:  ov.loopMode,
    has_sound:  ov.hasSound,
  }));

  // ── Apply overlays (preview composite, no save) ───────────────────────────
  const handleApply = async () => {
    if (overlays.length === 0 || jobStatus === "running") return;
    setJobStatus("running"); setJobMsg("Starting composite…");
    setResultUrl(null); setFinalized(false);
    try {
      await startComposite(video.id, buildPayload(), {
        mixAudio, chromaColor: chromaColor.replace("#","0x"), chromaSimilarity: chromaSim,
        replaceOriginal: false,
      });
    } catch (err) {
      setJobStatus("error");
      setJobMsg(err?.response?.data?.detail || "Failed to start composite");
    }
  };

  // ── Save & Replace Original ───────────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await finalizeComposite(video.id);
      setFinalized(true);
      setJobMsg("Saved — this is now the canonical version of the video");
    } catch (err) {
      setJobMsg(err?.response?.data?.detail || "Save failed");
      setJobStatus("error");
    }
    setFinalizing(false);
  };

  // ── Discard composite ─────────────────────────────────────────────────────
  const handleDiscard = () => {
    setResultUrl(null); setJobStatus(null); setJobMsg(""); setFinalized(false);
  };

  // ── Auto-insert flow ──────────────────────────────────────────────────────
  const handleAutoPreview = async () => {
    setAutoLoading(true); setAutoPreview(null); setZeroMatchConfirm(false);
    try {
      const res = await previewAutoComposite(video.id, { minGap:8, maxOverlays:8, mixAudio });
      setAutoPreview(res.overlays || []);
    } catch { setAutoPreview([]); }
    setAutoLoading(false);
  };

  const handleAutoApply = async () => {
    // Preview first so we can warn if no matches
    setAutoLoading(true); setZeroMatchConfirm(false);
    try {
      const res = await previewAutoComposite(video.id, { minGap:8, maxOverlays:8, mixAudio });
      const matches = res.overlays || [];
      setAutoLoading(false);
      if (matches.length === 0) {
        setAutoPreview([]);
        setZeroMatchConfirm(true); // show the "no matches" warning
        return;
      }
      // Proceed with full composite
      setAutoPreview(null);
      setJobStatus("running"); setJobMsg("Running auto-composite…");
      setResultUrl(null); setFinalized(false);
      await startAutoComposite(video.id, { minGap:8, maxOverlays:8, mixAudio });
    } catch (err) {
      setAutoLoading(false);
      setJobStatus("error");
      setJobMsg(err?.response?.data?.detail || "Auto-composite failed");
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
      x:80, y:80, scale: ap.scale || 0.5,
      loopMode:   ap.loop_mode || "none",
      hasSound:   ap.has_sound !== false,
    }));
    setOverlays(newOvs);
    setAutoPreview(null);
  };

  // ── Back navigation ───────────────────────────────────────────────────────
  const tryClose = () => {
    const hasUnsaved = (overlays.length > 0 || (jobStatus === "done" && !finalized));
    if (hasUnsaved) { setBackConfirm(true); return; }
    onClose();
  };

  // ── Video URL ─────────────────────────────────────────────────────────────
  const getVideoUrl = () => {
    if (!video?.file_path) return null;
    if (video.file_path.startsWith("http")) return video.file_path;
    return `/local-videos/${video.file_path.split("/").pop()}`;
  };
  const videoUrl = resultUrl || getVideoUrl();

  const disabledCount = clips.filter(c => c.enabled === false).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:T.bg }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px", background:T.topBar,
        borderBottom:`1px solid ${T.border}`, flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontWeight:700, fontSize:13, color:T.text }}>✂ Video Editor</span>
          <span style={{ fontSize:11, color:T.textDim, maxWidth:400, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
            {video?.title || video?.prompt?.slice(0,60) || video?.id}
          </span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {jobStatus === "running" && <span style={{ fontSize:11, color:T.accentYellow }}>⏳ {jobMsg}</span>}
          {jobStatus === "error"   && <span style={{ fontSize:11, color:T.accentRed, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>✕ {jobMsg}</span>}
          {jobStatus === "done" && !finalized && <span style={{ fontSize:11, color:T.accentGreen }}>✓ Composite ready</span>}
          {finalized && <span style={{ fontSize:11, color:T.accentGreen }}>💾 Saved</span>}
          <button onClick={tryClose}
            style={{ padding:"5px 14px", borderRadius:6, border:`1px solid ${T.border}`, background:T.bgCard, color:T.textMid, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
            ← Back
          </button>
        </div>
      </div>

      {/* ── Back confirm banner ──────────────────────────────────────────── */}
      {backConfirm && (
        <div style={{ padding:"6px 16px", flexShrink:0 }}>
          <ConfirmBanner
            message={jobStatus === "done" && !finalized
              ? "You have a completed composite that hasn't been saved. Go back and discard it?"
              : "You have unsaved overlay changes. Go back and discard them?"}
            confirmLabel="Discard & Go Back"
            cancelLabel="Stay"
            onConfirm={onClose}
            onCancel={() => setBackConfirm(false)}
            color={T.accentRed}
            T={T}
          />
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── LEFT: Clip Library ────────────────────────────────────────── */}
        <div style={{
          width:240, flexShrink:0,
          borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column",
          background:T.bgSub, overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{ padding:"8px 8px 4px", flexShrink:0, borderBottom:`1px solid ${T.border}20` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:9, color:T.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700 }}>
                Clips ({filteredClips.length}{disabledCount > 0 && !showDisabled ? `/${clips.length}` : ""})
              </span>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={loadClips} title="Refresh from DB"
                  style={{ padding:"2px 6px", borderRadius:4, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:11, cursor:"pointer" }}>↺</button>
                <button onClick={handleSeed} disabled={seeding} title="Load all 84 built-in clips"
                  style={{ padding:"2px 7px", borderRadius:4, border:"none", background:seeding ? T.bgCard : `${T.accent}20`, color:T.accent, fontSize:10, cursor:seeding ? "not-allowed" : "pointer" }}>
                  {seeding ? "…" : "Seed"}
                </button>
                <button onClick={() => setShowUploadForm(v => !v)} title="Upload new clip"
                  style={{ padding:"2px 7px", borderRadius:4, border:"none", background:showUploadForm ? T.accent : T.bgCard, color:showUploadForm ? "#fff" : T.textDim, fontSize:10, cursor:"pointer" }}>+</button>
              </div>
            </div>

            {seedResult && (
              <div style={{ fontSize:9, color:seedResult.error ? T.accentRed : T.accentGreen, marginBottom:4 }}>
                {seedResult.error || `✓ ${seedResult.upserted} clips loaded`}
              </div>
            )}

            {showUploadForm && (
              <div style={{ padding:7, background:T.bgDeep, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:5 }}>
                <input value={uploadLabel} onChange={e => setUploadLabel(e.target.value)} placeholder="Label"
                  style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:4, padding:"3px 6px", color:T.text, fontFamily:"inherit", fontSize:10, boxSizing:"border-box", marginBottom:3 }} />
                <input value={uploadKw} onChange={e => setUploadKw(e.target.value)} placeholder="Keywords (comma-separated)"
                  style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:4, padding:"3px 6px", color:T.text, fontFamily:"inherit", fontSize:10, boxSizing:"border-box", marginBottom:5 }} />
                <input ref={uploadRef} type="file" accept=".mp4,video/mp4" onChange={handleUploadFile} disabled={uploading} style={{ display:"none" }} />
                <button onClick={() => uploadRef.current?.click()} disabled={uploading}
                  style={{ width:"100%", padding:"4px 0", borderRadius:4, border:"none", background:T.accent, color:"#fff", fontSize:10, cursor:uploading?"not-allowed":"pointer", fontFamily:"inherit", opacity:uploading?0.6:1 }}>
                  {uploading ? "Uploading…" : "Choose .mp4"}
                </button>
              </div>
            )}

            <input type="text" placeholder="Search clips…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:5, padding:"4px 7px", color:T.text, fontFamily:"inherit", fontSize:11, boxSizing:"border-box", outline:"none" }} />

            {disabledCount > 0 && (
              <label style={{ display:"flex", alignItems:"center", gap:5, marginTop:4, cursor:"pointer" }}>
                <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} style={{ accentColor:T.accent }} />
                <span style={{ fontSize:9, color:T.textFaint }}>Show {disabledCount} disabled</span>
              </label>
            )}
          </div>

          {/* Scrollable clip list */}
          <div style={{ flex:1, overflowY:"auto", padding:"8px", display:"flex", flexDirection:"column", gap:8 }}>
            {clipsLoading ? (
              <div style={{ fontSize:11, color:T.textDim, padding:10, textAlign:"center" }}>Loading clips…</div>
            ) : filteredClips.length === 0 ? (
              <div style={{ fontSize:10, color:T.textDim, padding:10, textAlign:"center", lineHeight:1.6 }}>
                {clips.length === 0
                  ? <><strong>No clips in DB.</strong><br />Click <strong>Seed</strong> to load 84 built-in clips.</>
                  : "No clips match your search."}
              </div>
            ) : (
              filteredClips.map(c => (
                <ClipCard key={c.id || c.filename} clip={c} onAdd={addClip}
                  onUpdated={u => setClips(prev => prev.map(x => x.id === u.id ? u : x))}
                  onDeleted={id => setClips(prev => prev.filter(x => x.id !== id))}
                  T={T} />
              ))
            )}
          </div>
        </div>

        {/* ── CENTRE: Video + Timeline + Actions ───────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.bg, minWidth:0 }}>

          {/* Video player */}
          <div style={{ flex:1, background:"#000", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", minHeight:180, position:"relative" }}>
            {videoUrl ? (
              <video ref={videoRef} src={videoUrl} controls
                style={{ maxWidth:"100%", maxHeight:"100%", outline:"none" }}
                onLoadedMetadata={e => setVideoDuration(e.target.duration)} />
            ) : (
              <div style={{ color:T.textDim, fontSize:12 }}>No video file available for this entry.</div>
            )}
            {/* Overlay count badge */}
            {overlays.length > 0 && (
              <div style={{ position:"absolute", top:10, right:10, background:`${T.accent}cc`, color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>
                {overlays.length} overlay{overlays.length !== 1 ? "s" : ""} queued
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, background:T.bgSub, flexShrink:0 }}>
            <Timeline overlays={overlays} videoDuration={videoDuration}
              selectedId={selectedId} onSelect={setSelectedId} T={T} />
          </div>

          {/* Zero-match warning */}
          {zeroMatchConfirm && (
            <div style={{ padding:"6px 14px", flexShrink:0 }}>
              <ConfirmBanner
                message="No keyword matches found in the script — no stick-figure clips would be inserted. Proceed anyway (composite will copy the video unchanged), or manually add clips from the library."
                confirmLabel="Proceed anyway"
                cancelLabel="Cancel"
                onConfirm={async () => {
                  setZeroMatchConfirm(false);
                  setJobStatus("running"); setJobMsg("Running auto-composite (no matches)…");
                  setResultUrl(null); setFinalized(false);
                  try { await startAutoComposite(video.id, { minGap:8, maxOverlays:8, mixAudio }); }
                  catch (err) { setJobStatus("error"); setJobMsg(err?.response?.data?.detail || "Failed"); }
                }}
                onCancel={() => setZeroMatchConfirm(false)}
                color={T.accentYellow}
                T={T}
              />
            </div>
          )}

          {/* Post-composite: Save / Download / Discard */}
          {jobStatus === "done" && resultUrl && !finalized && (
            <div style={{
              padding:"10px 14px", borderTop:`1px solid ${T.border}`,
              background:`${T.accentGreen}10`, flexShrink:0,
              display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
            }}>
              <span style={{ fontSize:11, color:T.accentGreen, fontWeight:600 }}>✓ Composite ready — choose an action:</span>
              <button onClick={handleFinalize} disabled={finalizing}
                style={{ padding:"5px 14px", borderRadius:6, border:"none", background:T.accentGreen, color:"#fff", fontSize:11, fontWeight:600, cursor:finalizing?"not-allowed":"pointer", fontFamily:"inherit", opacity:finalizing?0.6:1 }}>
                {finalizing ? "Saving…" : "💾 Save & Replace Original"}
              </button>
              <a href={resultUrl} download target="_blank" rel="noopener noreferrer"
                style={{ padding:"5px 14px", borderRadius:6, border:`1px solid ${T.accentGreen}60`, background:"transparent", color:T.accentGreen, fontSize:11, textDecoration:"none", fontFamily:"inherit" }}>
                📥 Download Copy
              </a>
              <button onClick={handleDiscard}
                style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${T.accentRed}40`, background:`${T.accentRed}12`, color:T.accentRed, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                🗑 Discard
              </button>
            </div>
          )}

          {jobStatus === "done" && finalized && (
            <div style={{ padding:"8px 14px", borderTop:`1px solid ${T.border}`, background:`${T.accentGreen}10`, flexShrink:0, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11, color:T.accentGreen }}>💾 Saved — this is now the canonical version.</span>
              <a href={resultUrl} download target="_blank" rel="noopener noreferrer"
                style={{ fontSize:11, color:T.accent, textDecoration:"none" }}>📥 Download</a>
              <button onClick={handleDiscard}
                style={{ marginLeft:"auto", padding:"4px 10px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
                New Edit
              </button>
            </div>
          )}

          {/* Action bar */}
          <div style={{
            padding:"8px 14px", borderTop:`1px solid ${T.border}`,
            background:T.bgSub, display:"flex", gap:7, flexWrap:"wrap",
            alignItems:"center", flexShrink:0,
          }}>
            <button onClick={handleApply}
              disabled={overlays.length === 0 || jobStatus === "running"}
              title={overlays.length === 0 ? "Add overlays first" : "Run FFmpeg composite (preview — not saved yet)"}
              style={{
                padding:"6px 14px", borderRadius:6, border:"none",
                fontFamily:"inherit", fontSize:11, fontWeight:600, cursor: overlays.length === 0 || jobStatus === "running" ? "not-allowed" : "pointer",
                background: overlays.length === 0 || jobStatus === "running" ? T.bgCard : T.accent,
                color: overlays.length === 0 || jobStatus === "running" ? T.textFaint : "#fff",
              }}>
              🎬 Apply Overlays ({overlays.length})
            </button>

            <button onClick={handleAutoPreview} disabled={autoLoading || jobStatus === "running"}
              style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${T.border}`, cursor:autoLoading?"not-allowed":"pointer", fontFamily:"inherit", fontSize:11, background:T.bgCard, color:T.textMid, opacity:autoLoading?0.5:1 }}>
              {autoLoading ? "Matching…" : "🔍 Auto-Preview"}
            </button>

            <button onClick={handleAutoApply} disabled={autoLoading || jobStatus === "running"}
              title="Auto-match script keywords to clips, then composite"
              style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${T.border}`, cursor:autoLoading||jobStatus==="running"?"not-allowed":"pointer", fontFamily:"inherit", fontSize:11, background:T.bgCard, color:T.textMid, opacity:autoLoading||jobStatus==="running"?0.5:1 }}>
              ⚡ Auto-Insert & Render
            </button>

            {overlays.length > 0 && (
              <button onClick={() => { setOverlays([]); setSelectedId(null); }}
                style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${T.accentRed}40`, cursor:"pointer", fontFamily:"inherit", fontSize:11, background:"transparent", color:T.accentRed }}>
                Clear All
              </button>
            )}

            {/* Chroma + audio settings */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto", flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:T.textFaint }}>Chroma key</span>
              <input type="color" value={chromaColor} onChange={e => setChromaColor(e.target.value)}
                style={{ width:26, height:22, border:"none", borderRadius:3, cursor:"pointer", padding:0 }} />
              <span style={{ fontSize:10, color:T.textFaint }}>Sim</span>
              <input type="range" min="0.1" max="0.6" step="0.01" value={chromaSim}
                onChange={e => setChromaSim(Number(e.target.value))}
                style={{ width:60, accentColor:T.accent }} />
              <span style={{ fontSize:9, color:T.textDim }}>{chromaSim.toFixed(2)}</span>
              <label style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
                <input type="checkbox" checked={mixAudio} onChange={e => setMixAudio(e.target.checked)} style={{ accentColor:T.accent }} />
                <span style={{ fontSize:10, color:T.textFaint }}>Mix SFX</span>
              </label>
            </div>
          </div>

          {/* Auto-preview results */}
          {autoPreview !== null && (
            <div style={{ padding:"8px 14px", borderTop:`1px solid ${T.border}`, background:T.bgCard, flexShrink:0, maxHeight:130, overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:9, color:T.textFaint, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  Auto-match — {autoPreview.length} clip{autoPreview.length !== 1 ? "s" : ""} found
                </span>
                <div style={{ display:"flex", gap:5 }}>
                  {autoPreview.length > 0 && (
                    <button onClick={importAutoPreview}
                      style={{ padding:"3px 10px", borderRadius:5, border:"none", background:T.accent, color:"#fff", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
                      Import to Timeline
                    </button>
                  )}
                  <button onClick={() => setAutoPreview(null)}
                    style={{ padding:"3px 8px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
                </div>
              </div>
              {autoPreview.length === 0 ? (
                <div style={{ fontSize:11, color:T.accentYellow }}>⚠ No keyword matches found. Try adding clips manually from the library.</div>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {autoPreview.map((ap, i) => (
                    <div key={i} style={{ padding:"3px 9px", borderRadius:5, fontSize:10, background:`${OVERLAY_COLORS[i%OVERLAY_COLORS.length]}22`, border:`1px solid ${OVERLAY_COLORS[i%OVERLAY_COLORS.length]}55`, color:T.textMid }}>
                      <strong>{formatTime(ap.start_time)}</strong> · {ap.filename.replace(".mp4","").replace(/_/g," ")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Overlay Controls ───────────────────────────────────── */}
        <div style={{ width:230, flexShrink:0, borderLeft:`1px solid ${T.border}`, background:T.bgSub, overflowY:"auto", padding:12 }}>
          <div style={{ fontSize:9, color:T.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>
            Overlay Controls
          </div>

          <OverlayControls
            overlay={selectedOverlay}
            onChange={updateOverlay}
            onRemove={removeOverlay}
            onDuplicate={duplicateOverlay}
            videoDuration={videoDuration}
            T={T}
          />

          {/* Overlay list */}
          {overlays.length > 0 && (
            <div style={{ marginTop:14, borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
              <div style={{ fontSize:9, color:T.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>
                All Overlays ({overlays.length})
              </div>
              {overlays.map((ov, idx) => {
                const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
                return (
                  <div key={ov.id} onClick={() => setSelectedId(ov.id)}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 6px", borderRadius:5, background:selectedId===ov.id?`${color}22`:"transparent", border:`1px solid ${selectedId===ov.id?color:"transparent"}`, cursor:"pointer", marginBottom:2 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:9, color:T.textMid, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {ov.filename.replace(".mp4","").replace(/_/g," ")}
                      </div>
                      <div style={{ fontSize:8, color:T.textFaint }}>
                        {formatTime(ov.startTime)} · {ov.duration}s · {ov.loopMode}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeOverlay(ov.id); }}
                      style={{ padding:"1px 4px", borderRadius:3, border:"none", background:"transparent", color:T.accentRed, fontSize:10, cursor:"pointer", opacity:0.6 }}>✕</button>
                  </div>
                );
              })}
              <button onClick={() => { setOverlays([]); setSelectedId(null); }}
                style={{ marginTop:5, width:"100%", padding:"4px 0", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.textDim, fontSize:9, cursor:"pointer", fontFamily:"inherit" }}>
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
