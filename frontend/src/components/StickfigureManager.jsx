import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  backfillStickFigureUrls,
  deleteStickFigure,
  listStickFiguresPaged,
  updateStickFigure,
  uploadStickFigure,
} from "../api/client";

const PAGE_SIZE = 20;

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs) return "—";
  const s = Math.round(secs);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function fmtRes(w, h) {
  if (!w || !h) return "—";
  return `${w}×${h}`;
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ T, clipName, onConfirm, onCancel }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{ background: T.bgCard, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 16, padding: "28px 32px", width: 360, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", letterSpacing: "0.04em" }}>DELETE CLIP</div>
        <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, margin: 0 }}>
          Are you sure you want to delete <strong style={{ color: T.text }}>{clipName}</strong> from the database?<br />
          <span style={{ fontSize: 11, color: T.textFaint }}>The file on disk is not deleted.</span>
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit" }}
          >
            DELETE
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit" }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Clip card ─────────────────────────────────────────────────────────────────
function ClipCard({ clip, T, onDelete, onSave, showToast }) {
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(clip.label || "");
  const [keywords, setKeywords] = useState((clip.keywords || []).join(", "));
  const [enabled, setEnabled] = useState(clip.enabled !== false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const videoRef = useRef(null);

  // Sync state when clip prop changes
  useEffect(() => {
    if (!editing) {
      setLabel(clip.label || "");
      setKeywords((clip.keywords || []).join(", "));
      setEnabled(clip.enabled !== false);
    }
  }, [clip, editing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      v.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const kwArr = keywords
        .split(/[,\n]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      await onSave(clip.id, { label: label.trim(), keywords: kwArr, enabled });
      setEditing(false);
    } catch (e) {
      showToast?.("Save failed: " + (e?.response?.data?.detail || e.message), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(clip.id);
    } catch (e) {
      showToast?.("Delete failed: " + (e?.response?.data?.detail || e.message), "error");
      setDeleting(false);
    }
  };

  const card = {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "border-color 0.15s",
    opacity: deleting ? 0.4 : 1,
    position: "relative",
  };

  const enabledBadge = {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 8,
    padding: "2px 7px",
    borderRadius: 10,
    letterSpacing: "0.1em",
    fontWeight: 700,
    background: enabled ? "rgba(29,185,84,0.18)" : "rgba(120,120,120,0.18)",
    color: enabled ? "#1db954" : T.textDim,
    zIndex: 2,
    pointerEvents: "none",
  };

  return (
    <div style={card}>
      {confirmDelete && (
        <DeleteConfirmModal
          T={T}
          clipName={clip.label || clip.filename}
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {/* ── Video preview area ── */}
      <div
        style={{
          position: "relative",
          background: "#000",
          aspectRatio: "16/9",
          cursor: "pointer",
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={clip.preview_url || clip.file_path}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          loop
          muted
          playsInline
          onEnded={() => setPlaying(false)}
        />
        {/* Play/pause overlay button */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: playing ? "transparent" : "rgba(0,0,0,0.35)",
            transition: "background 0.15s",
          }}
        >
          {!playing && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                border: "1.5px solid rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#fff",
              }}
            >
              ▶
            </div>
          )}
        </div>
        <span style={enabledBadge}>{enabled ? "ON" : "OFF"}</span>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Label */}
        {editing ? (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            style={{
              background: T.bg,
              border: `1px solid ${T.accent}55`,
              borderRadius: 7,
              padding: "5px 10px",
              color: T.text,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            style={{
              fontWeight: 700,
              fontSize: 12,
              color: T.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={clip.label}
          >
            {clip.label || clip.filename}
          </div>
        )}

        {/* Filename (always shown, small) */}
        <div style={{ fontSize: 9, color: T.textFaint, fontFamily: "monospace" }}>
          {clip.filename}
        </div>

        {/* Keywords */}
        {editing ? (
          <div>
            <div style={{ fontSize: 9, color: T.textDim, marginBottom: 3, letterSpacing: "0.08em" }}>
              KEYWORDS (comma-separated)
            </div>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={2}
              placeholder="climb, rising, progress"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: T.bg,
                border: `1px solid ${T.accent}55`,
                borderRadius: 7,
                padding: "5px 10px",
                color: T.text,
                fontSize: 11,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(clip.keywords || []).slice(0, 6).map((kw) => (
              <span
                key={kw}
                style={{
                  fontSize: 9,
                  padding: "2px 7px",
                  borderRadius: 10,
                  background: `${T.accent}15`,
                  color: T.accent,
                  letterSpacing: "0.05em",
                }}
              >
                {kw}
              </span>
            ))}
            {(clip.keywords || []).length > 6 && (
              <span style={{ fontSize: 9, color: T.textFaint }}>
                +{clip.keywords.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Enabled toggle (editing mode) */}
        {editing && (
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: T.textMid }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ accentColor: T.accent }}
            />
            Enabled (used in auto-match)
          </label>
        )}

        {/* Collapsible details */}
        {showDetails && !editing && (
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 10,
              color: T.textDim,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px 10px",
            }}
          >
            <span>Duration</span>
            <span style={{ color: T.text }}>{fmtDuration(clip.duration)}</span>
            <span>Resolution</span>
            <span style={{ color: T.text }}>{fmtRes(clip.width, clip.height)}</span>
            <span>Alpha</span>
            <span style={{ color: clip.has_alpha ? "#1db954" : T.textFaint }}>
              {clip.has_alpha ? "yes" : "no"}
            </span>
            <span>Audio</span>
            <span style={{ color: clip.has_audio ? "#1db954" : T.textFaint }}>
              {clip.has_audio ? "yes" : "no"}
            </span>
            <span>Added</span>
            <span style={{ color: T.text }}>
              {clip.created_at ? new Date(clip.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
        )}

        {/* ── Action row ── */}
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 4, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={btnStyle(T.accent, saving)}
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={btnStyle(T.textDim, false, true)}
              >
                CANCEL
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDetails((v) => !v)}
                style={btnStyle(T.textDim, false, true)}
              >
                {showDetails ? "HIDE" : "DETAILS"}
              </button>
              <button
                onClick={() => setEditing(true)}
                style={btnStyle(T.accent, false, true)}
              >
                EDIT
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                style={btnStyle("#ef4444", deleting, true)}
              >
                {deleting ? "…" : "DELETE"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function btnStyle(color, disabled = false, ghost = false) {
  return {
    flex: ghost ? "0 0 auto" : 1,
    padding: "5px 10px",
    borderRadius: 7,
    border: `1px solid ${color}55`,
    background: ghost ? "transparent" : `${color}18`,
    color: color,
    fontSize: 9,
    letterSpacing: "0.1em",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit",
    transition: "all 0.15s",
  };
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({ T, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [primaryTag, setPrimaryTag] = useState("");
  const [keywords, setKeywords] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadStickFigure(file, label, keywords, primaryTag);
      onUploaded(result);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: T.text,
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 28,
          width: 380,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text, letterSpacing: "0.06em" }}>
          UPLOAD STICKFIGURE CLIP
        </div>

        <div>
          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4, letterSpacing: "0.1em" }}>
            VIDEO FILE (MP4)
          </div>
          <input type="file" accept="video/mp4,video/*" onChange={(e) => setFile(e.target.files[0])} style={{ ...inputStyle, padding: "6px 10px" }} />
        </div>

        <div>
          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4, letterSpacing: "0.1em" }}>
            LABEL
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Climbing" style={inputStyle} />
        </div>

        <div>
          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4, letterSpacing: "0.1em" }}>
            PRIMARY TAG
          </div>
          <input value={primaryTag} onChange={(e) => setPrimaryTag(e.target.value)} placeholder="e.g. climbing" style={inputStyle} />
        </div>

        <div>
          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4, letterSpacing: "0.1em" }}>
            KEYWORDS (comma-separated)
          </div>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="climb, rise, progress, upward" style={inputStyle} />
        </div>

        {error && (
          <div style={{ fontSize: 11, color: "#ef4444", padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 7 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={handleUpload} disabled={!file || uploading} style={{ ...btnStyle(T.accent, !file || uploading), flex: 1, padding: "8px 0", fontSize: 10 }}>
            {uploading ? "UPLOADING…" : "UPLOAD"}
          </button>
          <button onClick={onClose} style={{ ...btnStyle(T.textDim, false, true), flex: 1, padding: "8px 0", fontSize: 10 }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StickfigureManager({ T, showToast, addNotification }) {
  const [clips, setClips] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEnabled, setFilterEnabled] = useState("all"); // "all" | "on" | "off"
  const sentinelRef = useRef(null);
  const skipRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const skip = reset ? 0 : skipRef.current;
    try {
      const res = await listStickFiguresPaged(skip, PAGE_SIZE, false);
      const newClips = res.clips || [];
      const newTotal = res.total || 0;
      setTotal(newTotal);
      if (reset) {
        setClips(newClips);
        skipRef.current = newClips.length;
      } else {
        setClips((prev) => [...prev, ...newClips]);
        skipRef.current = skip + newClips.length;
      }
      hasMoreRef.current = skipRef.current < newTotal;
    } catch (e) {
      console.error("Failed to load stickfigures:", e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    hasMoreRef.current = true;
    skipRef.current = 0;
    loadMore(true);
  }, [loadMore]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMore(false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleRefresh = () => {
    hasMoreRef.current = true;
    skipRef.current = 0;
    loadMore(true);
  };

  const [backfilling, setBackfilling] = useState(false);
  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const r = await backfillStickFigureUrls();
      handleRefresh();
      const msg = `URL repair done: ${r.updated} updated, ${r.already_ok} already had URLs`;
      showToast?.(msg, "success");
      addNotification?.("Stickfigure URL Repair", msg, "success");
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Unknown error";
      showToast?.("Repair failed: " + msg, "error");
      addNotification?.("Stickfigure URL Repair Failed", msg, "error");
    } finally {
      setBackfilling(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteStickFigure(id, false);
    setClips((prev) => prev.filter((c) => c.id !== id));
    setTotal((t) => t - 1);
  };

  const handleSave = async (id, fields) => {
    const updated = await updateStickFigure(id, fields);
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    return updated;
  };

  const handleUploaded = (newClip) => {
    setClips((prev) => [newClip, ...prev]);
    setTotal((t) => t + 1);
  };

  // ── Client-side search + filter ──────────────────────────────────────────
  const searchLower = search.toLowerCase();
  const displayed = clips.filter((c) => {
    if (filterEnabled === "on" && !c.enabled) return false;
    if (filterEnabled === "off" && c.enabled !== false) return false;
    if (searchLower) {
      const inLabel = (c.label || "").toLowerCase().includes(searchLower);
      const inFilename = (c.filename || "").toLowerCase().includes(searchLower);
      const inKw = (c.keywords || []).some((k) => k.toLowerCase().includes(searchLower));
      if (!inLabel && !inFilename && !inKw) return false;
    }
    return true;
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: 8 }}>
      {showUpload && (
        <UploadModal T={T} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}

      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: T.text, letterSpacing: "0.04em" }}>
            Stickfigure Manager
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
            {total} clip{total !== 1 ? "s" : ""} in database
            {displayed.length !== clips.length
              ? ` · ${displayed.length} shown`
              : ""}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${T.accent}55`,
              background: `${T.accent}15`,
              color: T.accent,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + UPLOAD
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: loading ? T.textFaint : T.textDim,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "LOADING…" : "REFRESH FROM DB"}
          </button>
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            title="One-time fix: write Supabase URLs into DB for clips uploaded before this was tracked"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${T.accentPurple ? T.accentPurple + "50" : "#a060ff50"}`,
              background: "transparent",
              color: backfilling ? T.textFaint : (T.accentPurple || "#a060ff"),
              fontSize: 10,
              letterSpacing: "0.1em",
              fontWeight: 700,
              cursor: backfilling ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {backfilling ? "REPAIRING…" : "REPAIR URLS"}
          </button>
        </div>
      </div>

      {/* ── Search + filter bar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by label, filename, or keyword…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.bg,
            color: T.text,
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        {["all", "on", "off"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterEnabled(f)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${filterEnabled === f ? T.accent + "55" : T.border}`,
              background: filterEnabled === f ? T.accent + "15" : "transparent",
              color: filterEnabled === f ? T.accent : T.textDim,
              fontSize: 10,
              letterSpacing: "0.1em",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {f === "all" ? "ALL" : f === "on" ? "ENABLED" : "DISABLED"}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {displayed.length === 0 && !loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: T.textFaint,
            fontSize: 12,
            letterSpacing: "0.12em",
          }}
        >
          {clips.length === 0
            ? "NO CLIPS FOUND — UPLOAD CLIPS OR USE THE API TO SEED FROM THE SERVER"
            : "NO CLIPS MATCH YOUR SEARCH"}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {displayed.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              T={T}
              onDelete={handleDelete}
              onSave={handleSave}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {/* ── Infinite scroll sentinel ── */}
      <div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {loading && (
          <div style={{ fontSize: 11, color: T.textFaint, letterSpacing: "0.12em" }}>
            LOADING…
          </div>
        )}
        {!loading && !hasMoreRef.current && clips.length > 0 && (
          <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
            — {total} CLIPS LOADED —
          </div>
        )}
      </div>
    </div>
  );
}
