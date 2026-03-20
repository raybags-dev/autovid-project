/**
 * Compilation Studio — Redesigned
 * Drag-and-drop video stitching. Simple, intuitive, no friction.
 */
import { useEffect, useRef, useState } from "react";
import api, { createCompilation, listCompilations, renameCompilation } from "../api/client";

export default function CompilationStudio({ T, showToast, videos = [] }) {
  if (!T) return null;

  const [compilations, setCompilations] = useState([]);
  const [queue, setQueue] = useState([]); // ordered clips [{video, start, end}]
  const [compilationType, setCompilationType] = useState("video"); // "video" | "mp3"
  const [title, setTitle] = useState("");
  const [building, setBuilding] = useState(false);
  const [polling, setPolling] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [compLogs, setCompLogs] = useState([]);
  const [compLogId, setCompLogId] = useState(null);
  const [showCompLogs, setShowCompLogs] = useState(true);
  const compLogPollRef = useRef(null);
  const compLogLineRef = useRef(0);
  const compLogsEndRef = useRef(null);

  const handleDownload = async (url, filename) => {
    if (!url) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
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

  const draggingIdx = useRef(null);
  const pollRef = useRef(null);

  const readyVideos = videos.filter(
    (v) =>
      ["ready", "posted", "failed"].includes(v.status) &&
      v.file_path &&
      !v.file_path.toLowerCase().endsWith(".mp3") &&
      !(v.labels || []).includes("mp3") &&
      v.resolution !== "podcast",
  );

  useEffect(() => {
    listCompilations()
      .then((r) => setCompilations(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  // Poll compilation
  useEffect(() => {
    if (!polling) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/videos/${polling}`);
        if (data.status === "ready" || data.status === "failed") {
          clearInterval(pollRef.current);
          setPolling(null);
          setBuilding(false);
          listCompilations().then((r) => setCompilations(Array.isArray(r) ? r : []));
          if (data.status === "ready") {
            showToast("✅ Compilation ready!");
            setPreview(data.file_path);
          } else {
            showToast("Compilation failed", "error");
          }
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [polling]);

  // ── Queue management ──────────────────────────────────────────────────────
  function addToQueue(video) {
    if (queue.find((q) => q.video.id === video.id)) return;
    setQueue((prev) => [...prev, { video, start: "", end: "" }]);
  }

  function removeFromQueue(idx) {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTrim(idx, field, value) {
    setQueue((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  }

  // Parse mm:ss or plain seconds input → number of seconds
  function parseTime(val) {
    if (val === "" || val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str.includes(":")) {
      const parts = str.split(":").map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  function toMMSS(sec) {
    if (sec === null || sec === undefined || sec === "") return "";
    const s = Math.floor(Number(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────
  function onDragStart(e, idx) {
    draggingIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(idx);
  }

  function onDrop(e, idx) {
    e.preventDefault();
    const from = draggingIdx.current;
    if (from === null || from === idx) { setDragOver(null); return; }
    const arr = [...queue];
    const [moved] = arr.splice(from, 1);
    arr.splice(idx, 0, moved);
    setQueue(arr);
    draggingIdx.current = null;
    setDragOver(null);
  }

  function onDragEnd() {
    draggingIdx.current = null;
    setDragOver(null);
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  async function handleBuild() {
    if (queue.length < 2)
      return showToast("Add at least 2 videos to the queue", "error");

    // Guardrail: MP3 mode requires narration_url or video file (always fine)
    // No mixing needed — compilationType applies to the whole queue
    const isMP3 = compilationType === "mp3";
    const finalTitle = title.trim() || (isMP3
      ? `Podcast — ${new Date().toLocaleDateString()}`
      : `Compilation — ${new Date().toLocaleDateString()}`);

    setBuilding(true);
    // reset logs
    if (compLogPollRef.current) clearInterval(compLogPollRef.current);
    setCompLogs([]);
    compLogLineRef.current = 0;
    setCompLogId(null);
    setShowCompLogs(true);

    try {
      const clips = queue.map((q) => ({
        video_id:      q.video.id,
        file_path:     q.video.file_path || "",
        narration_url: q.video.narration_url || null,
        title:         q.video.title || "",
        start:         parseTime(q.start),
        end:           parseTime(q.end),
      }));
      const result = await createCompilation({ title: finalTitle, clips, mode: isMP3 ? "mp3" : "video" });
      const cid = result.compilation_id;
      setPolling(cid);
      setCompLogId(cid);

      // Start log polling
      compLogPollRef.current = setInterval(async () => {
        try {
          const { data: ld } = await api.get(`/videos/${cid}/logs?since=${compLogLineRef.current}`);
          if (ld?.lines?.length > 0) {
            compLogLineRef.current += ld.lines.length;
            setCompLogs(prev => [...prev, ...ld.lines].slice(-500));
            setTimeout(() => compLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
          if (ld?.done) {
            clearInterval(compLogPollRef.current);
            setTimeout(() => setShowCompLogs(false), 2500);
          }
        } catch (_) {}
      }, 1500);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Compilation failed", "error");
      setBuilding(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtDur(sec) {
    if (!sec) return "?";
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function clipDuration(q) {
    const total = q.video.duration_seconds || 0;
    const s = parseTime(q.start) ?? 0;
    const e = parseTime(q.end) ?? total;
    return Math.max(0, e - s);
  }

  const totalSec = queue.reduce((acc, q) => acc + clipDuration(q), 0);

  // Detect if a saved compilation is MP3 — check labels (most reliable), then URL, then fallback
  const isMP3Comp = (comp) =>
    (comp.labels || []).includes("mp3") ||
    comp.file_path?.toLowerCase().includes(".mp3") ||
    (comp.narration_url && !comp.resolution);

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 };
  const btn = (bg, disabled) => ({
    padding: "9px 18px", borderRadius: 8, border: "none",
    background: disabled ? T.border : bg,
    color: disabled ? T.textFaint : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "opacity 0.15s",
  });
  const input = {
    background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 7,
    padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "inherit",
    width: "100%", boxSizing: "border-box",
  };
  const label = { fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 8, display: "block" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, height: "100%", minHeight: 0 }}>
      {/* ── LEFT: Video picker + past compilations ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={card}>
          <span style={label}>AVAILABLE VIDEOS — ready, posted or locally saved</span>
          {readyVideos.length === 0 && (
            <div style={{ color: T.textFaint, fontSize: 12, padding: 12, textAlign: "center" }}>
              No ready videos yet
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {readyVideos.map((v) => {
              const inQueue = !!queue.find((q) => q.video.id === v.id);
              return (
                <div
                  key={v.id}
                  onClick={() =>
                    inQueue
                      ? removeFromQueue(queue.findIndex((q) => q.video.id === v.id))
                      : addToQueue(v)
                  }
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                    border: `1px solid ${inQueue ? T.accentGreen + "70" : T.border}`,
                    background: inQueue ? T.accentGreen + "0f" : "transparent",
                    transition: "all 0.15s", userSelect: "none",
                  }}
                >
                  <div style={{ width: 52, height: 30, borderRadius: 5, overflow: "hidden", background: T.bg, flexShrink: 0 }}>
                    <img src={v.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: v.thumbnail_url ? "block" : "none" }}
                      onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                    <div style={{ display: v.thumbnail_url ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎬</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.title || v.prompt}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint, display: "flex", gap: 6 }}>
                      {fmtDur(v.duration_seconds)}
                      {v.narration_url && <span style={{ color: T.accentGreen }}>🎙 MP3</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: inQueue ? T.accentGreen : T.border, fontWeight: 700, flexShrink: 0 }}>
                    {inQueue ? "✓" : "+"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Past compilations */}
        {compilations.length > 0 && (
          <div style={card}>
            <span style={label}>PAST COMPILATIONS</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {compilations.map((comp) => {
                const isAudio = isMP3Comp(comp);
                return (
                  <div key={comp.id} style={{ padding: "8px 10px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    {renamingId === comp.id ? (
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <input
                          autoFocus value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              await renameCompilation(comp.id, renameVal);
                              setCompilations((cs) => cs.map((c) => c.id === comp.id ? { ...c, title: renameVal } : c));
                              setRenamingId(null);
                            }
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.accent}60`, borderRadius: 5, padding: "4px 8px", color: T.text, fontSize: 11, fontFamily: "inherit", outline: "none" }}
                        />
                        <button onClick={async () => { await renameCompilation(comp.id, renameVal); setCompilations((cs) => cs.map((c) => c.id === comp.id ? { ...c, title: renameVal } : c)); setRenamingId(null); }}
                          style={{ padding: "4px 8px", borderRadius: 5, border: "none", background: T.accentGreen, color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                        <button onClick={() => setRenamingId(null)}
                          style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </div>
                    ) : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isAudio ? "🎙 " : "🎬 "}{comp.title}
                        </div>
                        <div style={{ fontSize: 10, color: T.textFaint }}>
                          {comp.duration_seconds ? fmtDur(comp.duration_seconds) : "—"} · {comp.status}
                          {isAudio && <span style={{ marginLeft: 6, color: "#1db954" }}>MP3</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        {/* Play — video only (audio uses audio element in preview) */}
                        {comp.file_path && comp.status === "ready" && (
                          <button onClick={() => setPreview(comp.file_path)} style={btn(T.accent, false)}>▶</button>
                        )}
                        {/* Download */}
                        {comp.file_path && comp.status === "ready" && (
                          <button
                            onClick={() => handleDownload(comp.file_path, `${comp.title || comp.id}.${isAudio ? "mp3" : "mp4"}`)}
                            title="Download"
                            style={btn(T.textMid, false)}
                          >↓</button>
                        )}
                        {/* Video: YT upload */}
                        {!isAudio && comp.file_path && comp.status === "ready" && !comp.youtube_id && (
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/videos/${comp.id}/upload`, { title: comp.title, description: "", tags: ["compilation"], privacy: "public", category: "22" });
                                showToast("🚀 Upload started!");
                              } catch (e) {
                                showToast("Upload failed", "error");
                              }
                            }}
                            style={btn("#ff0000", false)}
                          >▲ YT</button>
                        )}
                        {/* Video: YT link */}
                        {!isAudio && comp.youtube_url && (
                          <a href={comp.youtube_url} target="_blank" rel="noreferrer"
                            style={{ ...btn("#ff0000", false), textDecoration: "none" }}>YT ↗</a>
                        )}
                        {/* Audio: Spotify note */}
                        {isAudio && comp.file_path && comp.status === "ready" && (
                          <button
                            onClick={() => handleDownload(comp.file_path, `${comp.title || comp.id}.mp3`)}
                            title="Download MP3 — upload to Spotify, Anchor, etc."
                            style={{ ...btn("#1db954", false), fontSize: 10 }}
                          >🎧 Spotify</button>
                        )}
                        <button
                          onClick={() => { setRenamingId(comp.id); setRenameVal(comp.title || ""); }}
                          title="Rename"
                          style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textFaint, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}
                        >✏</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Queue + build ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {/* Preview */}
        {preview && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={label}>PREVIEW</span>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            {preview.toLowerCase().includes(".mp3") ? (
              <audio controls style={{ width: "100%" }} src={preview} />
            ) : (
              <video controls style={{ width: "100%", borderRadius: 8 }} src={preview} />
            )}
          </div>
        )}

        {/* Compilation type toggle */}
        <div style={card}>
          <span style={label}>COMPILATION TYPE</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { v: "video", icon: "🎬", title: "Video Compilation", sub: "MP4 → YouTube, TikTok" },
              { v: "mp3",   icon: "🎙", title: "MP3 Podcast",       sub: "MP3 → Spotify, Anchor" },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setCompilationType(t.v)}
                style={{
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${compilationType === t.v ? T.accent : T.border}`,
                  background: compilationType === t.v ? `${T.accent}18` : T.inputBg,
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: compilationType === t.v ? T.accent : T.text }}>{t.title}</div>
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{t.sub}</div>
              </button>
            ))}
          </div>
          {compilationType === "mp3" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${T.accentGreen}10`, borderRadius: 8, border: `1px solid ${T.accentGreen}30`, fontSize: 10, color: T.textDim, lineHeight: 1.6 }}>
              🎙 Uses saved narration MP3 per clip. If none, audio is extracted from the video.<br />
              Output: <strong style={{ color: T.accentGreen }}>MP3 file</strong> — supported by Spotify, Apple Podcasts, Anchor, and all podcast platforms.
            </div>
          )}
          {compilationType === "video" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${T.accent}08`, borderRadius: 8, border: `1px solid ${T.accent}20`, fontSize: 10, color: T.textDim, lineHeight: 1.6 }}>
              🎬 Full video with audio concatenated. Output: <strong style={{ color: T.accent }}>MP4 file</strong> — ready for YouTube and TikTok upload.
            </div>
          )}
        </div>

        {/* Queue */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...label, marginBottom: 0 }}>
              QUEUE — {queue.length} clip{queue.length !== 1 ? "s" : ""}
              {queue.length >= 2 && <span style={{ color: T.accentGreen, marginLeft: 8 }}>· {fmtDur(totalSec)} total</span>}
            </span>
            {queue.length >= 2 && <span style={{ fontSize: 10, color: T.textFaint }}>drag to reorder</span>}
          </div>

          {queue.length === 0 && (
            <div style={{ padding: "24px 12px", textAlign: "center", border: `2px dashed ${T.border}`, borderRadius: 10, color: T.textFaint, fontSize: 12 }}>
              ← Click videos on the left to add them here
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {queue.map((q, i) => (
              <div
                key={q.video.id}
                draggable
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={(e) => onDrop(e, i)}
                onDragEnd={onDragEnd}
                style={{
                  background: dragOver === i ? T.accent + "18" : T.bg,
                  border: `1px solid ${dragOver === i ? T.accent : T.border}`,
                  borderRadius: 10, padding: "10px 12px", transition: "all 0.15s", cursor: "grab",
                }}
              >
                {/* Clip header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, minWidth: 18 }}>#{i + 1}</span>
                  <div style={{ width: 40, height: 24, borderRadius: 4, overflow: "hidden", background: T.bgCard, flexShrink: 0 }}>
                    <img src={q.video.thumbnail_url} alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: q.video.thumbnail_url ? "block" : "none" }}
                      onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                    <div style={{ display: q.video.thumbnail_url ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🎬</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 11, color: T.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.video.title || q.video.prompt}
                  </div>
                  {compilationType === "mp3" && (
                    <span style={{ fontSize: 9, color: q.video.narration_url ? T.accentGreen : T.textFaint, flexShrink: 0 }}>
                      {q.video.narration_url ? "🎙 MP3 ✓" : "🎙 extract"}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}>⠿</span>
                  <button onClick={() => removeFromQueue(i)}
                    style={{ background: "none", border: "none", color: T.accentRed, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>✕</button>
                </div>

                {/* Trim inputs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>
                      START — e.g. <span style={{ color: T.accent }}>0:10</span>
                    </div>
                    <input type="text" value={q.start} onChange={(e) => updateTrim(i, "start", e.target.value)}
                      placeholder="0:00  (beginning)" style={input} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3 }}>
                      END — e.g. <span style={{ color: T.accent }}>4:40</span>
                    </div>
                    <input type="text" value={q.end} onChange={(e) => updateTrim(i, "end", e.target.value)}
                      placeholder={q.video.duration_seconds ? toMMSS(q.video.duration_seconds) + "  (full)" : "end"}
                      style={input} />
                  </div>
                </div>

                <div style={{ marginTop: 5, fontSize: 10, color: T.textFaint }}>
                  {q.start !== "" || q.end !== "" ? (
                    <span style={{ color: T.accentGreen }}>
                      ✂️ Using {fmtDur(clipDuration(q))} of clip ({toMMSS(parseTime(q.start) ?? 0)} → {toMMSS(parseTime(q.end) ?? q.video.duration_seconds)})
                    </span>
                  ) : (
                    <span>Full clip · {fmtDur(q.video.duration_seconds)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Title + Build */}
        <div style={card}>
          <span style={label}>COMPILATION TITLE (optional)</span>
          <input
            style={{ ...input, marginBottom: 12 }}
            placeholder={compilationType === "mp3"
              ? `Podcast — ${new Date().toLocaleDateString()}`
              : `Compilation — ${new Date().toLocaleDateString()}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            onClick={handleBuild}
            disabled={building || queue.length < 2}
            style={{ ...btn(compilationType === "mp3" ? "#1db954" : T.accentGreen, building || queue.length < 2), width: "100%", padding: "13px", fontSize: 13 }}
          >
            {building
              ? `⚙️ Building ${compilationType === "mp3" ? "podcast" : "compilation"}...`
              : queue.length < 2
                ? `Add ${2 - queue.length} more video${queue.length === 1 ? "" : "s"} to build`
                : `${compilationType === "mp3" ? "🎙" : "🔗"} Build ${compilationType === "mp3" ? "MP3 podcast" : "video"} (${queue.length} clips · ${fmtDur(totalSec)})`}
          </button>
          {queue.length >= 2 && !building && !compLogId && (
            <div style={{ marginTop: 8, fontSize: 10, color: T.textFaint, textAlign: "center" }}>
              {compilationType === "mp3"
                ? "Narration tracks will be joined in queue order · output is MP3"
                : "Video clips will be joined in queue order · output is MP4"}
            </div>
          )}
        </div>

        {/* ── Live log panel ── */}
        {compLogId && (
          <div style={{ ...card, borderColor: building ? `${T.accent}40` : T.border }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                PIPELINE LOGS
                {building && <span style={{ marginLeft: 8, color: T.accent }}>● LIVE</span>}
                {!building && <span style={{ marginLeft: 8, color: T.accentGreen }}>✓ DONE</span>}
              </div>
              <button
                onClick={() => setShowCompLogs(v => !v)}
                style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 10px", color: T.textFaint, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}
              >
                {showCompLogs ? "Hide" : "Show"}
              </button>
            </div>
            {showCompLogs && (
              <div style={{ fontFamily: "monospace", fontSize: 10, color: T.textDim, maxHeight: 260, overflowY: "auto", lineHeight: 1.7, background: T.bgDeep, borderRadius: 8, padding: "10px 12px" }}>
                {compLogs.length === 0
                  ? <span style={{ color: T.textFaint }}>Waiting for pipeline output...</span>
                  : compLogs.map((line, i) => (
                    <div key={i} style={{
                      color: line.includes("[ERROR]") ? T.accentRed
                        : line.includes("[DONE]") ? T.accentGreen
                        : line.includes("[UPLOAD]") ? "#60a0ff"
                        : line.includes("[CONCAT]") ? "#ffa060"
                        : T.textDim
                    }}>{line}</div>
                  ))
                }
                <div ref={compLogsEndRef} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
