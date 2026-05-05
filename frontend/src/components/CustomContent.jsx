import { useEffect, useRef, useState, useCallback } from "react";
import {
  listCustomContent,
  requestCCUpload,
  uploadFileToSignedUrl,
  finalizeCCUpload,
  deleteCustomContent,
  archiveCustomContent,
  unarchiveCustomContent,
  uploadCCToYouTube,
  generateCCMp3,
  getCCLogs,
  getCustomContentItem,
  setVideoExclusive,
  addCaptionsToVideo,
} from "../api/client";

const CATEGORIES = [
  "Entertainment","Comedy","Education","Technology","Science",
  "Gaming","Music","Lifestyle","Travel","Food","Sports","News",
];
const PRIVACY_OPTIONS = [
  { value: "public",   label: "🌍 Public",   desc: "Anyone can watch" },
  { value: "unlisted", label: "🔗 Unlisted", desc: "Only people with the link" },
  { value: "private",  label: "🔒 Private",  desc: "Only you" },
];

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Shared Modal Shell ─────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, T, maxWidth = 560 }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14,
          padding: "24px 28px", width: "100%", maxWidth, maxHeight: "88vh",
          overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: T.text }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: T.textFaint, fontSize: 20,
              cursor: "pointer", lineHeight: 1, padding: "0 4px",
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children, T }) {
  return (
    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 5 }}>
      {children}
    </div>
  );
}

function inputStyle(T) {
  return {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.bgSub, color: T.text, fontSize: 12, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
}

function BtnPrimary({ children, onClick, disabled, T, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 22px", borderRadius: 8, border: "none",
        background: disabled ? "rgba(0,160,220,0.3)" : T.accent,
        color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Upload Form Modal ──────────────────────────────────────────────────────────
function UploadFormModal({ T, onClose, onSuccess, showToast }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", tags: "", category: "Entertainment", privacy: "public",
  });
  // phase: "form" | "sending" | "processing" | "done" | "error"
  const [phase, setPhase] = useState("form");
  const [error, setError] = useState("");
  const [itemId, setItemId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logDone, setLogDone] = useState(false);
  const fileRef = useRef();
  const logPollRef = useRef(null);
  const logSinceRef = useRef(0);
  const logEndRef = useRef(null);
  const resultRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // Poll logs once we have an itemId
  useEffect(() => {
    if (!itemId) return;
    const poll = async () => {
      try {
        const r = await getCCLogs(itemId, logSinceRef.current);
        if (r.lines.length) {
          setLogs(prev => [...prev, ...r.lines]);
          logSinceRef.current = r.total;
        }
        if (r.done) {
          setLogDone(true);
          clearInterval(logPollRef.current);
          // Fetch final item to check status
          try {
            const fresh = await getCustomContentItem(itemId);
            resultRef.current = fresh;
            if (fresh.status === "ready") {
              setPhase("done");
              showToast("Upload complete!", "success");
            } else {
              setPhase("error");
              setError(fresh.error_message || "Upload failed — check logs");
            }
          } catch { setPhase("error"); setError("Could not verify upload status"); }
        }
      } catch { /* ignore polling errors */ }
    };
    poll();
    logPollRef.current = setInterval(poll, 1200);
    return () => clearInterval(logPollRef.current);
  }, [itemId]); // eslint-disable-line

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".mp4")) { setError("Only .mp4 files are accepted."); return; }
    setError("");
    setFile(f);
    if (!form.title) setForm(p => ({ ...p, title: f.name.replace(/\.mp4$/i, "") }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".mp4")) { setError("Only .mp4 files are accepted."); return; }
    setError(""); setFile(f);
    if (!form.title) setForm(p => ({ ...p, title: f.name.replace(/\.mp4$/i, "") }));
  };

  const handleSubmit = async () => {
    if (!file) { setError("Please select an MP4 file."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    setPhase("sending"); setError("");
    setLogs(["Step 1/3 — Requesting upload slot from server..."]);
    try {
      // Step 1: get signed URL from backend (tiny JSON request, no file bytes)
      const { item_id, signed_url } = await requestCCUpload(form);
      setLogs(prev => [...prev,
        "Step 2/3 — Uploading directly to Supabase Storage (bypasses server)...",
        `File: ${(file.size / 1024 / 1024).toFixed(1)} MB`,
      ]);

      // Step 2: PUT file directly to Supabase (no nginx/Cloudflare in path)
      await uploadFileToSignedUrl(signed_url, file, (pct) => {
        setLogs(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.startsWith("Uploading: ")) next[next.length - 1] = `Uploading: ${pct}%`;
          else next.push(`Uploading: ${pct}%`);
          return next;
        });
      });
      setLogs(prev => [...prev, "Upload complete.", "Step 3/3 — Finalizing on server..."]);

      // Step 3: tell backend to mark ready & run ffprobe
      await finalizeCCUpload(item_id);
      // Start log polling only NOW — finalize has registered the pipeline,
      // so getCCLogs won't prematurely return done:true with status="uploading"
      setItemId(item_id);
      setPhase("processing");
    } catch (e) {
      setPhase("error");
      setError(e?.response?.data?.detail || e?.message || "Upload failed — check console for details");
    }
  };

  const isBusy = phase === "sending" || phase === "processing";
  const isDone = phase === "done";

  return (
    <ModalShell title="Upload Custom Content" onClose={isDone ? () => { onSuccess(resultRef.current); } : isBusy ? undefined : onClose} T={T} maxWidth={560}>

      {/* Show form only while in form/error phase */}
      {(phase === "form" || phase === "error") && (<>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${file ? T.accentGreen : T.border}`,
          borderRadius: 10, padding: "24px 16px", textAlign: "center",
          cursor: "pointer", marginBottom: 18,
          background: file ? `${T.accentGreen}08` : T.bgSub,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <input ref={fileRef} type="file" accept=".mp4,video/mp4" style={{ display: "none" }} onChange={handleFile} />
        {file ? (
          <div>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🎬</div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{file.name}</div>
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⬆</div>
            <div style={{ fontSize: 12, color: T.textMid }}>Drop an MP4 here or click to browse</div>
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>Only .mp4 files are accepted</div>
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>TITLE *</Label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          maxLength={100}
          placeholder="Video title"
          style={inputStyle(T)}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>DESCRIPTION</Label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          maxLength={5000}
          rows={3}
          placeholder="Describe your video..."
          style={{ ...inputStyle(T), resize: "vertical" }}
        />
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>TAGS (comma-separated)</Label>
        <input
          value={form.tags}
          onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
          placeholder="tag1, tag2, tag3"
          style={inputStyle(T)}
        />
      </div>

      {/* Category + Privacy row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div>
          <Label T={T}>CATEGORY</Label>
          <select
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{ ...inputStyle(T), cursor: "pointer" }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label T={T}>PRIVACY</Label>
          <select
            value={form.privacy}
            onChange={e => setForm(p => ({ ...p, privacy: e.target.value }))}
            style={{ ...inputStyle(T), cursor: "pointer" }}
          >
            {PRIVACY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(220,40,60,0.1)", color: "#e04060", fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <BtnPrimary onClick={handleSubmit} T={T}>Upload</BtnPrimary>
      </div>
      </>)}

      {/* Log container — shown during sending/processing/done/error phases */}
      {phase !== "form" && (
        <div>
          <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>
            {isDone ? "✓ COMPLETE" : phase === "error" ? "✕ FAILED" : "⟳ UPLOAD LOG"}
          </div>
          <div style={{
            background: "#060912", border: `1px solid ${isDone ? T.accentGreen : phase === "error" ? "#e03050" : T.border}`,
            borderRadius: 8, padding: "12px 14px", fontFamily: "'Courier New',monospace", fontSize: 11,
            lineHeight: 1.7, maxHeight: 220, overflowY: "auto", color: "#c0e0ff",
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                color: l.startsWith("[ERROR]") ? "#ff6060"
                  : l === "__DONE__" ? T.accentGreen
                  : l.startsWith("Sending") || l.startsWith("File received") ? "#ffd080"
                  : "#c0e0ff",
              }}>
                {l === "__DONE__" ? "✓ Done" : l}
              </div>
            ))}
            {!logDone && phase === "processing" && (
              <div style={{ color: T.textFaint, animation: "none" }}>▌</div>
            )}
            <div ref={logEndRef} />
          </div>

          {error && phase === "error" && (
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, background: "rgba(220,40,60,0.1)", color: "#e04060", fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            {isDone && (
              <BtnPrimary onClick={() => onSuccess(resultRef.current)} T={T}>
                Done — View Content
              </BtnPrimary>
            )}
            {phase === "error" && (
              <button onClick={() => { setPhase("form"); setLogs([]); setLogDone(false); setItemId(null); logSinceRef.current = 0; }}
                style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                Try Again
              </button>
            )}
            {isBusy && (
              <div style={{ fontSize: 11, color: T.textFaint, alignSelf: "center" }}>
                {phase === "sending" ? "Transferring file to server..." : "Processing in background..."}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── YouTube Upload Modal ───────────────────────────────────────────────────────
function YoutubeModal({ item, T, onClose, onSuccess, showToast }) {
  const [form, setForm] = useState({
    title:       item.title || "",
    description: item.description || "",
    tags:        (item.tags || []).join(", "),
    privacy:     item.privacy || "public",
    category:    item.category || "Entertainment",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setLoading(true); setError("");
    try {
      const tagList = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      await uploadCCToYouTube(item.id, { ...form, tags: tagList });
      showToast("YouTube upload queued!", "success");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Upload to YouTube" onClose={onClose} T={T} maxWidth={520}>
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>TITLE *</Label>
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={100} style={inputStyle(T)} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>DESCRIPTION</Label>
        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} maxLength={5000} style={{ ...inputStyle(T), resize: "vertical" }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label T={T}>TAGS (comma-separated)</Label>
        <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="tag1, tag2" style={inputStyle(T)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div>
          <Label T={T}>CATEGORY</Label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle(T), cursor: "pointer" }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label T={T}>PRIVACY</Label>
          <select value={form.privacy} onChange={e => setForm(p => ({ ...p, privacy: e.target.value }))} style={{ ...inputStyle(T), cursor: "pointer" }}>
            {PRIVACY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      {error && <div style={{ color: "#e04060", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <BtnPrimary onClick={handleUpload} disabled={loading} T={T}>
          {loading ? "Starting..." : "Upload to YouTube"}
        </BtnPrimary>
      </div>
    </ModalShell>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = "DELETE", T }) {
  return (
    <ModalShell title="Confirm Action" onClose={onCancel} T={T} maxWidth={400}>
      <div style={{ fontSize: 13, color: T.textMid, marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onCancel} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#e03050", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Log Viewer Modal ──────────────────────────────────────────────────────────
function LogModal({ itemId, title, T, onClose }) {
  const [lines, setLines] = useState([]);
  const [done, setDone] = useState(false);
  const sinceRef = useRef(0);
  const pollRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await getCCLogs(itemId, sinceRef.current);
        if (r.lines.length) {
          setLines(prev => [...prev, ...r.lines]);
          sinceRef.current = r.total;
        }
        if (r.done) { setDone(true); clearInterval(pollRef.current); }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => clearInterval(pollRef.current);
  }, [itemId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  return (
    <ModalShell title={`Logs — ${title}`} onClose={onClose} T={T} maxWidth={680}>
      <div
        style={{
          background: "#060912", border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 14, fontFamily: "'Courier New', monospace", fontSize: 11,
          lineHeight: 1.7, maxHeight: 400, overflowY: "auto", color: "#c0e0ff",
        }}
      >
        {lines.length === 0 && !done && (
          <div style={{ color: T.textFaint }}>Waiting for logs...</div>
        )}
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              color: l.startsWith("[ERROR]") ? "#ff6060"
                : l.startsWith("[UPLOAD]") || l.startsWith("[MP3]") ? "#80e0ff"
                : l === "__DONE__" ? T.accentGreen
                : "#c0e0ff",
            }}
          >
            {l === "__DONE__" ? "✓ Done" : l}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {done && <div style={{ marginTop: 10, fontSize: 11, color: T.accentGreen }}>✓ Job completed</div>}
    </ModalShell>
  );
}

// ── Video Player Modal ─────────────────────────────────────────────────────────
function VideoPlayerModal({ item, T, onClose }) {
  const [descOpen, setDescOpen] = useState(false);
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ position: "relative", width: "90vw", maxWidth: 900 }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -40, right: 0, background: "none", border: "none",
            color: "#fff", fontSize: 22, cursor: "pointer",
          }}
        >✕</button>
        <div style={{ fontSize: 13, color: "#ccc", marginBottom: 10, fontWeight: 600 }}>
          {item.title}
        </div>
        <video
          src={item.file_path}
          controls
          autoPlay
          style={{ width: "100%", borderRadius: 10, maxHeight: "80vh", background: "#000" }}
        />
        {item.description && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setDescOpen(o => !o)}
              style={{ background: "none", border: "none", color: "#888", fontSize: 10, cursor: "pointer", padding: "4px 0", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}
            >
              {descOpen ? "▲" : "▼"} DESCRIPTION
            </button>
            {descOpen && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#999", lineHeight: 1.6, padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
                {item.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status, T }) {
  const colors = {
    ready:     { bg: "rgba(220,140,0,0.12)",  text: "#e09000" },
    uploading: { bg: "rgba(140,80,220,0.12)", text: "#9060e0" },
    posted:    { bg: "rgba(0,180,100,0.12)",  text: "#00c070" },
    archived:  { bg: "rgba(120,120,120,0.12)",text: "#888" },
  };
  const c = colors[status] || colors.ready;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", background: c.bg, color: c.text,
    }}>
      {status?.toUpperCase()}
    </span>
  );
}

// ── Main CustomContent Component ───────────────────────────────────────────────
export default function CustomContent({ T, showToast, addNotification }) {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview]     = useState(null);   // item to preview
  const [ytModal, setYtModal]     = useState(null);   // item to upload to YT
  const [logModal, setLogModal]   = useState(null);   // item to view logs
  const [deleteConfirm, setDeleteConfirm] = useState(null);  // item to delete
  const [showArchived, setShowArchived]   = useState(false);
  const [genMp3, setGenMp3]       = useState({});    // {id: true} while generating
  const [search, setSearch]       = useState("");
  const pollRef = useRef({});       // id → interval ref

  const load = useCallback(async () => {
    try {
      const data = await listCustomContent(showArchived);
      setItems(data);
    } catch (e) {
      showToast("Failed to load content", "error");
    } finally {
      setLoading(false);
    }
  }, [showArchived]); // eslint-disable-line

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Poll uploading items every 3 seconds
  useEffect(() => {
    const uploading = items.filter(i => i.status === "uploading");
    uploading.forEach(item => {
      if (!pollRef.current[item.id]) {
        pollRef.current[item.id] = setInterval(async () => {
          try {
            const fresh = await getCustomContentItem(item.id);
            if (fresh.status !== "uploading") {
              setItems(prev => prev.map(i => i.id === item.id ? fresh : i));
              clearInterval(pollRef.current[item.id]);
              delete pollRef.current[item.id];
              if (fresh.status === "posted") {
                showToast(`"${fresh.title}" is now live on YouTube!`, "success");
                addNotification("YouTube Upload Complete", `"${fresh.title}" is now live!`, "success");
              }
            }
          } catch { /* ignore */ }
        }, 3000);
      }
    });
    // Cleanup intervals for items no longer uploading
    Object.keys(pollRef.current).forEach(id => {
      if (!uploading.find(i => i.id === id)) {
        clearInterval(pollRef.current[id]);
        delete pollRef.current[id];
      }
    });
    return () => {};
  }, [items]); // eslint-disable-line

  // Also poll for mp3 generation
  const pollMp3 = useCallback((id, title) => {
    setGenMp3(prev => ({ ...prev, [id]: true }));
    const interval = setInterval(async () => {
      try {
        const fresh = await getCustomContentItem(id);
        if (fresh.mp3_url) {
          setItems(prev => prev.map(i => i.id === id ? fresh : i));
          setGenMp3(prev => { const n = { ...prev }; delete n[id]; return n; });
          clearInterval(interval);
          showToast("MP3 generated!", "success");
          addNotification("MP3 Ready", `Audio extracted from "${title}"`, "success");
        }
      } catch { clearInterval(interval); setGenMp3(prev => { const n = { ...prev }; delete n[id]; return n; }); }
    }, 2000);
  }, []); // eslint-disable-line

  const handleUploadSuccess = (item) => {
    setItems(prev => [item, ...prev]);
    setShowUpload(false);
  };

  const handleDelete = async () => {
    const item = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteCustomContent(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast("Deleted", "success");
    } catch (e) {
      showToast(e?.response?.data?.detail || "Delete failed", "error");
    }
  };

  const handleArchive = async (item) => {
    try {
      if (item.archived) {
        await unarchiveCustomContent(item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, archived: false } : i));
        showToast("Restored from archive", "success");
      } else {
        await archiveCustomContent(item.id);
        setItems(prev => prev.filter(i => i.id !== item.id));
        showToast("Archived", "success");
      }
    } catch {
      showToast("Action failed", "error");
    }
  };

  const handleToggleExclusive = async (item) => {
    const next = !item.is_exclusive;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_exclusive: next } : i));
    try {
      await setVideoExclusive(item.id, next);
      showToast(next ? "Added to Exclusive" : "Removed from Exclusive", "success");
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_exclusive: !next } : i));
      showToast("Action failed", "error");
    }
  };

  const handleGenerateMp3 = async (item) => {
    try {
      await generateCCMp3(item.id);
      pollMp3(item.id, item.title);
      showToast("MP3 generation started…", "success");
    } catch (e) {
      showToast(e?.response?.data?.detail || "Failed to start MP3 generation", "error");
    }
  };

  const filtered = items.filter(i =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase()) ||
    (i.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const btnSm = (style = {}) => ({
    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
    letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${T.border}`, background: "transparent", color: T.textDim,
    transition: "background 0.12s, color 0.12s", ...style,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* ── Header row ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexShrink: 0, flexWrap: "wrap",
      }}>
        {/* Upload button — top-left */}
        <button
          onClick={() => setShowUpload(true)}
          style={{
            padding: "9px 18px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg,#0080d0,#00c060)",
            color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={{ fontSize: 15 }}>⬆</span> Upload Custom Content
        </button>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or tag..."
          style={{ ...inputStyle(T), maxWidth: 220, marginLeft: 0 }}
        />

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived(p => !p)}
          style={btnSm({
            marginLeft: "auto",
            background: showArchived ? `${T.accent}10` : "transparent",
            color: showArchived ? T.accent : T.textDim,
            borderColor: showArchived ? `${T.accent}40` : T.border,
          })}
        >
          {showArchived ? "↩ HIDE ARCHIVED" : "🗄 SHOW ARCHIVED"}
        </button>

        {/* Reload */}
        <button onClick={load} style={btnSm()} title="Reload">↺ RELOAD</button>

        <div style={{ fontSize: 10, color: T.textFaint }}>
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Content grid ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, height: 220 }}>
                <div className="skeleton-loader" style={{ height: "100%", borderRadius: 12 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: 300, gap: 14, color: T.textFaint,
          }}>
            <div style={{ fontSize: 48 }}>🎬</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No custom content yet</div>
            <div style={{ fontSize: 12 }}>Upload your first video to get started</div>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "none",
                background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Upload Custom Content
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {filtered.map(item => (
              <VideoCard
                key={item.id}
                item={item}
                T={T}
                genMp3={genMp3}
                onPreview={() => setPreview(item)}
                onYouTube={() => setYtModal(item)}
                onDelete={() => setDeleteConfirm(item)}
                onArchive={() => handleArchive(item)}
                onGenerateMp3={() => handleGenerateMp3(item)}
                onViewLogs={() => setLogModal(item)}
                onToggleExclusive={() => handleToggleExclusive(item)}
                onAddCaptions={async () => {
                  try {
                    await addCaptionsToVideo(item.id);
                    setLogModal(item);
                    showToast("Captioning started — watching logs...");
                  } catch (err) {
                    showToast(err?.response?.data?.detail || "Captioning failed", "error");
                  }
                }}
                btnSm={btnSm}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showUpload && (
        <UploadFormModal T={T} onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} showToast={showToast} />
      )}
      {preview && (
        <VideoPlayerModal item={preview} T={T} onClose={() => setPreview(null)} />
      )}
      {ytModal && (
        <YoutubeModal
          item={ytModal} T={T}
          onClose={() => setYtModal(null)}
          onSuccess={() => { setYtModal(null); load(); }}
          showToast={showToast}
        />
      )}
      {logModal && (
        <LogModal itemId={logModal.id} title={logModal.title} T={T} onClose={() => setLogModal(null)} />
      )}
      {deleteConfirm && (
        <ConfirmModal
          T={T}
          message={`Permanently delete "${deleteConfirm.title}"? This will also remove the file from storage.`}
          confirmLabel="DELETE"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Video Card ─────────────────────────────────────────────────────────────────
async function _downloadBlob(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

function VideoCard({ item, T, genMp3, onPreview, onYouTube, onDelete, onArchive, onGenerateMp3, onViewLogs, onToggleExclusive, onAddCaptions, btnSm }) {
  const isUploading = item.status === "uploading";
  const isPosted    = item.status === "posted";
  const isArchived  = item.archived;

  return (
    <div
      style={{
        background: T.bgCard, border: `1px solid ${item.is_exclusive ? "rgba(167,139,250,0.35)" : T.border}`,
        borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10,
        opacity: isArchived ? 0.65 : 1, transition: "opacity 0.2s",
        position: "relative",
      }}
    >
      {/* Thumbnail / preview trigger */}
      <div
        onClick={item.file_path ? onPreview : undefined}
        style={{
          height: 150, borderRadius: 8, background: "#0a0e1a", overflow: "hidden",
          cursor: item.file_path ? "pointer" : "default", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : item.file_path ? (
          <video
            src={item.file_path + "#t=2"}
            preload="metadata"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        ) : (
          <div style={{ fontSize: 36, color: T.textFaint }}>🎬</div>
        )}
        {/* Play overlay */}
        {item.file_path && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.3)", opacity: 0, transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
          onMouseLeave={e => e.currentTarget.style.opacity = "0"}
          >
            <div style={{ fontSize: 36, color: "#fff" }}>▶</div>
          </div>
        )}
        {/* Uploading overlay */}
        {isUploading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#00a0dc", animation: "tabSpinner 0.7s linear infinite" }} />
            <div style={{ fontSize: 10, color: "#fff", letterSpacing: "0.06em" }}>UPLOADING TO YT</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.4, flex: 1 }}>
            {item.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {item.is_exclusive && (
              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)", color: "#a78bfa", fontSize: 9, letterSpacing: "0.07em", fontWeight: 700 }}>
                EXCLUSIVE
              </span>
            )}
            <StatusBadge status={isArchived ? "archived" : item.status} T={T} />
          </div>
        </div>
        {item.description && (
          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4, lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {item.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {item.duration_seconds && (
            <span style={{ fontSize: 9, color: T.textFaint }}>⏱ {fmtDuration(item.duration_seconds)}</span>
          )}
          {item.category && (
            <span style={{ fontSize: 9, color: T.textFaint }}>🏷 {item.category}</span>
          )}
          <span style={{ fontSize: 9, color: T.textFaint }}>{fmtDate(item.created_at)}</span>
        </div>
        {(item.tags || []).length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {item.tags.slice(0, 4).map(t => (
              <span key={t} style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                background: "rgba(0,160,220,0.1)", color: T.accent,
              }}>{t}</span>
            ))}
            {item.tags.length > 4 && <span style={{ fontSize: 9, color: T.textFaint }}>+{item.tags.length - 4}</span>}
          </div>
        )}
        {isPosted && item.youtube_url && (
          <a href={item.youtube_url} target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
              fontSize: 10, color: "#ff4444", textDecoration: "none" }}>
            ▶ View on YouTube
          </a>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
        {/* Add Captions */}
        {item.file_path && (
          <button
            onClick={onAddCaptions}
            style={btnSm({ color: "#fbbf24", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.06)" })}
            title="Generate captions for this video"
          >
            💬 ADD CAPTIONS
          </button>
        )}

        {/* Preview */}
        {item.file_path && (
          <button onClick={onPreview} style={btnSm({ color: T.accent, borderColor: `${T.accent}40`, background: `${T.accent}08` })}>
            ▶ PREVIEW
          </button>
        )}

        {/* Download */}
        {item.file_path && (
          <button
            onClick={() => _downloadBlob(item.file_path, `${item.title || item.id}.mp4`)}
            style={btnSm()}
          >
            ⬇ DOWNLOAD
          </button>
        )}

        {/* YouTube upload */}
        {!isPosted && !isUploading && !isArchived && (
          <button
            onClick={onYouTube}
            style={btnSm({ color: "#ff4444", borderColor: "rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.06)" })}
          >
            ▶ YOUTUBE
          </button>
        )}

        {/* Exclusive toggle */}
        {item.file_path && (
          <button
            onClick={onToggleExclusive}
            style={btnSm(item.is_exclusive
              ? { color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)", background: "rgba(167,139,250,0.12)" }
              : { color: T.textFaint }
            )}
            title={item.is_exclusive ? "Remove from Exclusive content" : "Add to Exclusive content"}
          >
            {item.is_exclusive ? "🔓 EXCLUSIVE" : "🔒 EXCLUSIVE"}
          </button>
        )}

        {/* Generate MP3 */}
        {item.file_path && (
          <button
            onClick={onGenerateMp3}
            disabled={!!genMp3[item.id]}
            style={btnSm({
              color: T.accentGreen, borderColor: `${T.accentGreen}40`,
              background: genMp3[item.id] ? `${T.accentGreen}08` : "transparent",
              opacity: genMp3[item.id] ? 0.6 : 1,
            })}
          >
            {genMp3[item.id] ? "⟳ GENERATING..." : "♫ GEN MP3"}
          </button>
        )}

        {/* Download MP3 */}
        {item.mp3_url && (
          <button
            onClick={() => _downloadBlob(item.mp3_url, `${item.title || item.id}.mp3`)}
            style={btnSm({ color: T.accentGreen, borderColor: `${T.accentGreen}40` })}
          >
            ⬇ MP3
          </button>
        )}

        {/* View logs */}
        <button onClick={onViewLogs} style={btnSm({ color: T.textFaint })}>
          📋 LOGS
        </button>

        {/* Archive / Restore */}
        <button
          onClick={onArchive}
          style={btnSm({ color: T.textFaint })}
        >
          {isArchived ? "↩ RESTORE" : "🗄 ARCHIVE"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          style={{ ...btnSm(), marginLeft: "auto", color: T.textFaint }}
        >
          ✕ DELETE
        </button>
      </div>
    </div>
  );
}
