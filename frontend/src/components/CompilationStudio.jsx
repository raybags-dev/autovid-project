/**
 * Compilation Studio — Redesigned
 * Drag-and-drop video stitching. Simple, intuitive, no friction.
 */
import { useEffect, useRef, useState } from "react";
import api, { createCompilation, listCompilations } from "../api/client";

export default function CompilationStudio({ T, showToast, videos = [] }) {
  if (!T) return null;

  const [compilations, setCompilations] = useState([]);
  const [queue, setQueue] = useState([]); // ordered clips [{video, start, end, mode}]
  const [title, setTitle] = useState("");
  const [building, setBuilding] = useState(false);
  const [polling, setPolling] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(null); // index being dragged over
  const draggingIdx = useRef(null);
  const pollRef = useRef(null);

  const readyVideos = videos.filter(
    (v) => ["ready", "posted", "failed"].includes(v.status) && v.file_path,
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
    setQueue((prev) => [...prev, { video, start: "", end: "", mode: "both" }]);
  }

  function removeFromQueue(idx) {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTrim(idx, field, value) {
    setQueue((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  }

  function updateMode(idx, mode) {
    setQueue((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, mode } : q)),
    );
  }

  // Parse mm:ss or plain seconds input → number of seconds
  function parseTime(val) {
    if (val === "" || val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str.includes(":")) {
      const parts = str.split(":").map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1]; // mm:ss
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // hh:mm:ss
    }
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  // Format seconds → mm:ss for display
  function toMMSS(sec) {
    if (sec === null || sec === undefined || sec === "") return "";
    const s = Math.floor(Number(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // ── Drag and drop (queue reordering) ─────────────────────────────────────
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
    if (from === null || from === idx) {
      setDragOver(null);
      return;
    }
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

    const hasMp3Only = queue.some((q) => q.mode === "mp3");
    const hasVideo   = queue.some((q) => q.mode === "video" || q.mode === "both");

    // Pure MP3 compilation
    if (hasMp3Only && !hasVideo) {
      setBuilding(true);
      const finalTitle = title.trim() || `Podcast — ${new Date().toLocaleDateString()}`;
      try {
        const clips = queue.map((q) => ({
          video_id:      q.video.id,
          file_path:     q.video.file_path || "",
          narration_url: q.video.narration_url || null,
          title:         q.video.title || "",
          start:         parseTime(q.start),
          end:           parseTime(q.end),
        }));
        const result = await createCompilation({ title: finalTitle, clips, mode: "mp3" });
        setPolling(result.compilation_id);
      } catch (e) {
        showToast(e?.response?.data?.detail || "MP3 compilation failed", "error");
        setBuilding(false);
      }
      return;
    }

    // Video compilation (existing logic — filter to video/both clips only)
    const videoClips = hasVideo
      ? queue.filter((q) => q.mode !== "mp3")
      : queue;  // if no mode set, use all

    if (videoClips.length < 2)
      return showToast("Need at least 2 video clips for a video compilation", "error");

    setBuilding(true);
    const finalTitle = title.trim() || `Compilation — ${new Date().toLocaleDateString()}`;
    try {
      const clips = videoClips.map((q) => ({
        video_id:      q.video.id,
        file_path:     q.video.file_path || "",
        narration_url: q.video.narration_url || null,
        title:         q.video.title || "",
        start:         parseTime(q.start),
        end:           parseTime(q.end),
      }));
      const result = await createCompilation({ title: finalTitle, clips, mode: "video" });
      setPolling(result.compilation_id);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Compilation failed", "error");
      setBuilding(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtDur(sec) {
    if (!sec) return "?";
    const m = Math.floor(sec / 60),
      s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function clipDuration(q) {
    const total = q.video.duration_seconds || 0;
    const s = parseTime(q.start) ?? 0;
    const e = parseTime(q.end) ?? total;
    return Math.max(0, e - s);
  }

  const totalSec = queue.reduce((acc, q) => acc + clipDuration(q), 0);

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 16,
  };
  const btn = (bg, disabled) => ({
    padding: "9px 18px",
    borderRadius: 8,
    border: "none",
    background: disabled ? T.border : bg,
    color: disabled ? T.textFaint : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    transition: "opacity 0.15s",
  });
  const input = {
    background: T.inputBg,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    padding: "6px 10px",
    color: T.text,
    fontSize: 12,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };
  const label = {
    fontSize: 10,
    color: T.textFaint,
    letterSpacing: "0.1em",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* ── LEFT: Video picker ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        <div style={card}>
          <span style={label}>
            AVAILABLE VIDEOS — ready, posted or locally saved
          </span>
          {readyVideos.length === 0 && (
            <div
              style={{
                color: T.textFaint,
                fontSize: 12,
                padding: 12,
                textAlign: "center",
              }}
            >
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
                      ? removeFromQueue(
                          queue.findIndex((q) => q.video.id === v.id),
                        )
                      : addToQueue(v)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 9,
                    cursor: "pointer",
                    border: `1px solid ${inQueue ? T.accentGreen + "70" : T.border}`,
                    background: inQueue ? T.accentGreen + "0f" : "transparent",
                    transition: "all 0.15s",
                    userSelect: "none",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 52,
                      height: 30,
                      borderRadius: 5,
                      overflow: "hidden",
                      background: T.bg,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={v.thumbnail_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: v.thumbnail_url ? "block" : "none" }}
                      onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                    />
                    <div style={{ display: v.thumbnail_url ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎬</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.text,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.title || v.prompt}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint }}>
                      {fmtDur(v.duration_seconds)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: inQueue ? T.accentGreen : T.border,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
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
              {compilations.map((comp) => (
                <div
                  key={comp.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: T.bg,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.text,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {comp.title}
                    </div>
                    <div style={{ fontSize: 10, color: T.textFaint }}>
                      {comp.duration_seconds
                        ? fmtDur(comp.duration_seconds)
                        : "—"}{" "}
                      · {comp.status}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {comp.file_path && comp.status === "ready" && (
                      <button
                        onClick={() => setPreview(comp.file_path)}
                        style={btn(T.accent, false)}
                      >
                        ▶
                      </button>
                    )}
                    {comp.file_path &&
                      comp.status === "ready" &&
                      !comp.youtube_id && (
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/videos/${comp.id}/upload`, {
                                title: comp.title,
                                description: "",
                                tags: ["compilation"],
                                privacy: "public",
                                category: "22",
                              });
                              showToast("🚀 Upload started!");
                            } catch (e) {
                              showToast("Upload failed", "error");
                            }
                          }}
                          style={btn("#ff0000", false)}
                        >
                          ▲ YT
                        </button>
                      )}
                    {comp.youtube_url && (
                      <a
                        href={comp.youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          ...btn("#ff0000", false),
                          textDecoration: "none",
                        }}
                      >
                        YT ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Queue + build ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        {/* Preview */}
        {preview && (
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={label}>PREVIEW</span>
              <button
                onClick={() => setPreview(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: T.textFaint,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <video
              controls
              style={{ width: "100%", borderRadius: 8 }}
              src={preview}
            />
          </div>
        )}

        {/* Queue */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ ...label, marginBottom: 0 }}>
              QUEUE — {queue.length} clip{queue.length !== 1 ? "s" : ""}
              {queue.length >= 2 && (
                <span style={{ color: T.accentGreen, marginLeft: 8 }}>
                  · {fmtDur(totalSec)} total
                </span>
              )}
            </span>
            {queue.length >= 2 && (
              <span style={{ fontSize: 10, color: T.textFaint }}>
                drag to reorder
              </span>
            )}
          </div>

          {queue.length === 0 && (
            <div
              style={{
                padding: "24px 12px",
                textAlign: "center",
                border: `2px dashed ${T.border}`,
                borderRadius: 10,
                color: T.textFaint,
                fontSize: 12,
              }}
            >
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
                  borderRadius: 10,
                  padding: "10px 12px",
                  transition: "all 0.15s",
                  cursor: "grab",
                }}
              >
                {/* Clip header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: T.textFaint,
                      fontWeight: 700,
                      minWidth: 18,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <div
                    style={{
                      width: 40,
                      height: 24,
                      borderRadius: 4,
                      overflow: "hidden",
                      background: T.bgCard,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={q.video.thumbnail_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: q.video.thumbnail_url ? "block" : "none" }}
                      onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                    />
                    <div style={{ display: q.video.thumbnail_url ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🎬</div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: T.text,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {q.video.title || q.video.prompt}
                  </div>
                  <span
                    style={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}
                  >
                    ⠿
                  </span>
                  <button
                    onClick={() => removeFromQueue(i)}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.accentRed,
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Mode selector */}
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {[
                    { v: "both", label: "🎬 Video + MP3", title: "Full video with audio" },
                    { v: "video", label: "🎬 Video only" },
                    { v: "mp3", label: "🎙 MP3 only", title: q.video.narration_url ? "Narration available ✓" : "Will extract from video" },
                  ].map(m => (
                    <button
                      key={m.v}
                      onClick={() => updateMode(i, m.v)}
                      title={m.title}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 5,
                        border: `1px solid ${q.mode === m.v ? T.accent : T.border}`,
                        background: q.mode === m.v ? `${T.accent}18` : "transparent",
                        color: q.mode === m.v ? T.accent : T.textDim,
                        fontSize: 10,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                  {q.video.narration_url && (
                    <span style={{ fontSize: 9, color: T.accentGreen, alignSelf: "center", marginLeft: 4 }}>✓ MP3</span>
                  )}
                </div>

                {/* Trim inputs — accepts mm:ss or plain seconds */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        marginBottom: 3,
                      }}
                    >
                      START — e.g. <span style={{ color: T.accent }}>0:10</span>{" "}
                      or <span style={{ color: T.accent }}>1:30</span>
                    </div>
                    <input
                      type="text"
                      value={q.start}
                      onChange={(e) => updateTrim(i, "start", e.target.value)}
                      placeholder="0:00  (beginning)"
                      style={input}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        marginBottom: 3,
                      }}
                    >
                      END — e.g. <span style={{ color: T.accent }}>4:40</span>{" "}
                      or <span style={{ color: T.accent }}>5:00</span>
                    </div>
                    <input
                      type="text"
                      value={q.end}
                      onChange={(e) => updateTrim(i, "end", e.target.value)}
                      placeholder={
                        q.video.duration_seconds
                          ? toMMSS(q.video.duration_seconds) + "  (full)"
                          : "end"
                      }
                      style={input}
                    />
                  </div>
                </div>

                {/* Duration hint */}
                <div style={{ marginTop: 5, fontSize: 10, color: T.textFaint }}>
                  {q.start !== "" || q.end !== "" ? (
                    <span style={{ color: T.accentGreen }}>
                      ✂️ Using {fmtDur(clipDuration(q))} of clip (
                      {toMMSS(parseTime(q.start) ?? 0)} →{" "}
                      {toMMSS(parseTime(q.end) ?? q.video.duration_seconds)})
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
            placeholder={`Compilation ${new Date().toLocaleDateString()}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <button
            onClick={handleBuild}
            disabled={building || queue.length < 2}
            style={{
              ...btn(T.accentGreen, building || queue.length < 2),
              width: "100%",
              padding: "13px",
              fontSize: 13,
            }}
          >
            {building
              ? "⚙️ Building compilation..."
              : queue.length < 2
                ? `Add ${2 - queue.length} more video${queue.length === 1 ? "" : "s"} to build`
                : `🔗 Build ${queue.length} clips (${fmtDur(totalSec)})`}
          </button>
          {queue.length >= 2 && !building && (
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                color: T.textFaint,
                textAlign: "center",
              }}
            >
              Clips will be joined in queue order · start/end times are optional
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
