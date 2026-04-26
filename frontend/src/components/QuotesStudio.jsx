/**
 * Quotes Generator Studio
 * Left: quote library (search + pagination)
 * Right: generation config + logs + generated videos
 */
import api, {
  listQuotes, createQuote, deleteQuote,
  listQuoteVideos, generateQuoteVideo,
  deleteVideo, archiveVideo,
} from "../api/client";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Lbl({ children, T }) {
  return (
    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, color, style = {} }) {
  const bg = disabled ? "#333" : (color || "#e63329");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, border: "none", borderRadius: 7, color: disabled ? "#666" : "#fff",
        fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.08em",
        padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.15s", ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function QuotesStudio({ T, showToast }) {
  if (!T) return null;

  // ── Left: quote library ────────────────────────────────────────────────────
  const [quotes, setQuotes]         = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [search, setSearch]         = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [loadingQ, setLoadingQ]     = useState(false);
  const [tableError, setTableError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addText, setAddText]         = useState("");
  const [addAuthor, setAddAuthor]     = useState("");
  const [adding, setAdding]           = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // quote id pending delete

  // ── Right: generation config ───────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote] = useState(null); // quote object or null (use custom)
  const [customText, setCustomText]       = useState("");
  const [customAuthor, setCustomAuthor]   = useState("");
  const [aspectRatio, setAspectRatio]     = useState("16:9");
  const [fontSize, setFontSize]           = useState(52);
  const [typingSpeed, setTypingSpeed]     = useState(42);
  const [holdDuration, setHoldDuration]   = useState(5);

  // ── Generation state ───────────────────────────────────────────────────────
  const [generating, setGenerating]   = useState(false);
  const [genLogs, setGenLogs]         = useState([]);
  const [genJobId, setGenJobId]       = useState(null);
  const logPollRef  = useRef(null);
  const logLineRef  = useRef(0);
  const logsEndRef  = useRef(null);

  // ── Generated videos ───────────────────────────────────────────────────────
  const [qVideos, setQVideos]         = useState([]);
  const [loadingVids, setLoadingVids] = useState(false);
  const [preview, setPreview]         = useState(null); // url
  const [vidDeleteConfirm, setVidDeleteConfirm] = useState(null);

  // ── Load quotes ────────────────────────────────────────────────────────────
  const loadQuotes = useCallback(async (pg = page, srch = search) => {
    setLoadingQ(true);
    setTableError("");
    try {
      const res = await listQuotes({ search: srch, limit: PAGE_SIZE, offset: pg * PAGE_SIZE });
      setQuotes(res.quotes || []);
      setTotal(res.total || 0);
    } catch (e) {
      const detail = e?.response?.data?.detail || String(e);
      if (detail.includes("quotes table missing")) {
        setTableError(detail);
      } else {
        showToast(detail, "error");
      }
    } finally {
      setLoadingQ(false);
    }
  }, [page, search]);

  useEffect(() => { loadQuotes(0, ""); }, []);

  // ── Load generated videos ──────────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setLoadingVids(true);
    try {
      const vids = await listQuoteVideos();
      setQVideos(Array.isArray(vids) ? vids : []);
    } catch (_) {}
    finally { setLoadingVids(false); }
  }, []);
  useEffect(() => { loadVideos(); }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = () => {
    setSearch(searchDraft);
    setPage(0);
    loadQuotes(0, searchDraft);
  };

  // ── Add quote ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addText.trim()) return;
    setAdding(true);
    try {
      await createQuote(addText.trim(), addAuthor.trim());
      setAddText(""); setAddAuthor(""); setShowAddForm(false);
      showToast("Quote saved");
      loadQuotes(0, search);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Failed to save quote", "error");
    } finally { setAdding(false); }
  };

  // ── Delete quote ───────────────────────────────────────────────────────────
  const handleDeleteQuote = async (id) => {
    try {
      await deleteQuote(id);
      showToast("Quote deleted");
      if (selectedQuote?.id === id) setSelectedQuote(null);
      loadQuotes(page, search);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Delete failed", "error");
    } finally { setDeleteConfirm(null); }
  };

  // ── Generate video ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const text   = selectedQuote ? selectedQuote.text   : customText.trim();
    const author = selectedQuote ? selectedQuote.author : customAuthor.trim();
    if (!text) { showToast("Enter or select a quote first", "error"); return; }

    setGenerating(true);
    setGenLogs([]);
    setGenJobId(null);
    logLineRef.current = 0;
    if (logPollRef.current) clearInterval(logPollRef.current);

    try {
      const res = await generateQuoteVideo({
        text, author,
        quote_id:       selectedQuote?.id || null,
        aspect_ratio:   aspectRatio,
        font_size:      fontSize,
        typing_speed_ms: typingSpeed,
        hold_duration_s: holdDuration,
      });
      const vid = res.video_id;
      setGenJobId(vid);

      logPollRef.current = setInterval(async () => {
        try {
          const { data: ld } = await api.get(`/videos/${vid}/logs?since=${logLineRef.current}`);
          if (ld?.lines?.length > 0) {
            logLineRef.current += ld.lines.length;
            setGenLogs(prev => [...prev, ...ld.lines].slice(-200));
            setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
          if (ld?.done) {
            clearInterval(logPollRef.current);
            setGenerating(false);
            showToast("✅ Quote video ready!");
            loadVideos();
          }
        } catch (_) {}
      }, 1800);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Generation failed", "error");
      setGenerating(false);
    }
  };

  // ── Download helper ────────────────────────────────────────────────────────
  const handleDownload = async (url, title) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (title || "quote_video").replace(/[^a-z0-9_\-]/gi, "_") + ".mp4";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (_) { window.open(url, "_blank"); }
  };

  // ── Delete video ───────────────────────────────────────────────────────────
  const handleDeleteVideo = async (id) => {
    try {
      await deleteVideo(id);
      showToast("Video deleted");
      setQVideos(vs => vs.filter(v => v.id !== id));
      if (preview && qVideos.find(v => v.id === id)?.file_path === preview) setPreview(null);
    } catch (e) {
      showToast(e?.response?.data?.detail || "Delete failed", "error");
    } finally { setVidDeleteConfirm(null); }
  };

  // ── Archive video ──────────────────────────────────────────────────────────
  const handleArchiveVideo = async (id) => {
    try {
      await archiveVideo(id);
      showToast("Video archived");
      setQVideos(vs => vs.filter(v => v.id !== id));
    } catch (e) {
      showToast(e?.response?.data?.detail || "Archive failed", "error");
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = {
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 12, padding: "14px 16px",
  };
  const inp = {
    width: "100%", boxSizing: "border-box",
    background: T.inputBg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 12, padding: "9px 12px",
    fontFamily: "inherit", outline: "none",
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, minHeight: 0 }}>

      {/* ══════════════════════ LEFT: QUOTE LIBRARY ══════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>

        {/* Table setup warning */}
        {tableError && (
          <div style={{ ...card, borderColor: "#e63329", background: "#1a0000" }}>
            <div style={{ fontSize: 11, color: "#ff6b6b", marginBottom: 8, fontWeight: 700 }}>⚠ Quotes table not set up</div>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 10 }}>Run this SQL in your Supabase Dashboard → SQL Editor:</div>
            <pre style={{ fontSize: 10, color: "#aaa", background: "#0a0a0a", padding: 10, borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap" }}>
{`CREATE TABLE public.quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);`}
            </pre>
            <Btn onClick={() => loadQuotes(0, "")} color="#444" style={{ marginTop: 8, fontSize: 10 }}>Retry</Btn>
          </div>
        )}

        {/* Header + Add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: T.text }}>
            Quote Library
            <span style={{ marginLeft: 8, fontSize: 11, color: T.textFaint, fontFamily: "inherit", fontWeight: 400 }}>
              ({total} total)
            </span>
          </div>
          <Btn onClick={() => setShowAddForm(s => !s)} color={showAddForm ? "#555" : "#e63329"} style={{ fontSize: 10, padding: "7px 14px" }}>
            {showAddForm ? "✕ Cancel" : "+ Add Quote"}
          </Btn>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={card}>
            <Lbl T={T}>Quote Text *</Lbl>
            <textarea
              value={addText}
              onChange={e => setAddText(e.target.value)}
              rows={3}
              placeholder="Enter quote text…"
              style={{ ...inp, resize: "vertical", marginBottom: 10 }}
            />
            <Lbl T={T}>Author</Lbl>
            <input
              value={addAuthor}
              onChange={e => setAddAuthor(e.target.value)}
              placeholder="e.g. Steve Jobs"
              style={{ ...inp, marginBottom: 12 }}
            />
            <Btn onClick={handleAdd} disabled={adding || !addText.trim()} style={{ width: "100%" }}>
              {adding ? "Saving…" : "Save Quote"}
            </Btn>
          </div>
        )}

        {/* Search */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search quotes…"
            style={{ ...inp, flex: 1 }}
          />
          <Btn onClick={handleSearch} color="#333" style={{ padding: "9px 14px", fontSize: 11 }}>Search</Btn>
        </div>

        {/* Quote cards */}
        {loadingQ ? (
          <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12, padding: 20 }}>Loading…</div>
        ) : quotes.length === 0 ? (
          <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12, padding: 20 }}>
            {search ? "No quotes match your search." : "No quotes yet — add one above."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quotes.map(q => {
              const isSelected = selectedQuote?.id === q.id;
              const pendingDel = deleteConfirm === q.id;
              return (
                <div
                  key={q.id}
                  style={{
                    ...card,
                    borderColor: isSelected ? "#e63329" : T.border,
                    background: isSelected ? "rgba(230,51,41,0.06)" : T.bgCard,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onClick={() => setSelectedQuote(isSelected ? null : q)}
                >
                  {/* Quote text */}
                  <div style={{
                    fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 6,
                    display: "-webkit-box", WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    "{q.text}"
                  </div>
                  {/* Author + date + actions */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      {q.author && (
                        <div style={{ fontSize: 11, color: "#e63329", fontWeight: 600 }}>— {q.author}</div>
                      )}
                      <div style={{ fontSize: 10, color: T.textFaint }}>{fmtDate(q.created_at)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedQuote(q); setCustomText(""); setCustomAuthor(""); }}
                        style={{
                          background: "none", border: `1px solid ${isSelected ? "#e63329" : T.border}`,
                          borderRadius: 5, color: isSelected ? "#e63329" : T.textFaint,
                          fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {isSelected ? "✓ Selected" : "Use"}
                      </button>
                      {!pendingDel ? (
                        <button
                          onClick={() => setDeleteConfirm(q.id)}
                          style={{
                            background: "none", border: `1px solid ${T.border}`, borderRadius: 5,
                            color: T.textFaint, fontSize: 10, padding: "4px 8px", cursor: "pointer",
                          }}
                        >Del</button>
                      ) : (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => handleDeleteQuote(q.id)}
                            style={{ background: "#8b0000", border: "none", borderRadius: 5, color: "#fff", fontSize: 10, padding: "4px 8px", cursor: "pointer" }}>
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, color: T.textFaint, fontSize: 10, padding: "4px 8px", cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Btn onClick={() => { const p = Math.max(0, page - 1); setPage(p); loadQuotes(p, search); }}
              disabled={page === 0} color="#333" style={{ padding: "6px 12px", fontSize: 11 }}>← Prev</Btn>
            <span style={{ fontSize: 11, color: T.textFaint }}>{page + 1} / {totalPages}</span>
            <Btn onClick={() => { const p = Math.min(totalPages - 1, page + 1); setPage(p); loadQuotes(p, search); }}
              disabled={page >= totalPages - 1} color="#333" style={{ padding: "6px 12px", fontSize: 11 }}>Next →</Btn>
          </div>
        )}
      </div>

      {/* ══════════════════════ RIGHT: GENERATION + VIDEOS ═══════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>

        {/* ── Config card ──────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 14 }}>
            🎬 Generate Quote Video
          </div>

          {/* Quote source */}
          <div style={{ marginBottom: 12 }}>
            <Lbl T={T}>Quote Source</Lbl>
            {selectedQuote ? (
              <div style={{ background: "rgba(230,51,41,0.08)", border: "1px solid rgba(230,51,41,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>"{selectedQuote.text}"</div>
                {selectedQuote.author && <div style={{ fontSize: 11, color: "#e63329" }}>— {selectedQuote.author}</div>}
                <button onClick={() => setSelectedQuote(null)} style={{ marginTop: 8, background: "none", border: "none", color: T.textFaint, fontSize: 11, cursor: "pointer", padding: 0 }}>
                  ✕ Clear selection (use custom text instead)
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6 }}>Or type a custom quote:</div>
                <textarea
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  rows={3}
                  placeholder="Type your quote here, or select one from the library →"
                  style={{ ...inp, resize: "vertical", marginBottom: 8 }}
                />
                <Lbl T={T}>Author (optional)</Lbl>
                <input
                  value={customAuthor}
                  onChange={e => setCustomAuthor(e.target.value)}
                  placeholder="e.g. Marcus Aurelius"
                  style={inp}
                />
              </div>
            )}
          </div>

          {/* Aspect ratio */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <Lbl T={T}>Aspect Ratio</Lbl>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                style={{ ...inp }}
              >
                <option value="16:9">16:9 — Landscape (YouTube)</option>
                <option value="9:16">9:16 — Portrait (Shorts / Reels)</option>
                <option value="1:1">1:1 — Square (Instagram)</option>
              </select>
            </div>
            <div>
              <Lbl T={T}>Font Size — {fontSize}px</Lbl>
              <input type="range" min="28" max="96" value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#e63329", marginTop: 6 }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <Lbl T={T}>Typing Speed — {typingSpeed}ms/char</Lbl>
              <input type="range" min="10" max="150" value={typingSpeed}
                onChange={e => setTypingSpeed(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#e63329", marginTop: 6 }} />
            </div>
            <div>
              <Lbl T={T}>Hold Duration — {holdDuration}s</Lbl>
              <input type="range" min="2" max="15" value={holdDuration}
                onChange={e => setHoldDuration(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#e63329", marginTop: 6 }} />
            </div>
          </div>

          <Btn
            onClick={handleGenerate}
            disabled={generating || (!selectedQuote && !customText.trim())}
            style={{ width: "100%", padding: "11px", fontSize: 12 }}
          >
            {generating ? "⏳ Generating…" : "▶ Generate Quote Video"}
          </Btn>
        </div>

        {/* ── Log output ───────────────────────────────────────────────────── */}
        {(genLogs.length > 0 || generating) && (
          <div style={card}>
            <Lbl T={T}>Generation Log</Lbl>
            <div style={{
              background: "#0a0a0a", borderRadius: 8, padding: "10px 12px",
              maxHeight: 160, overflowY: "auto", fontFamily: "monospace", fontSize: 11,
            }}>
              {genLogs.length === 0 ? (
                <span style={{ color: T.textFaint }}>Starting…</span>
              ) : (
                genLogs.map((line, i) => (
                  <div key={i} style={{
                    color: line.includes("[ERROR]") ? "#ff4444"
                         : line.includes("[DONE]")  ? "#44ff88"
                         : "#aaa",
                  }}>{line}</div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* ── Video preview ─────────────────────────────────────────────────── */}
        {preview && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Lbl T={T}>Preview</Lbl>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <video
              src={preview} controls autoPlay
              style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 360 }}
            />
          </div>
        )}

        {/* ── Generated videos list ─────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: T.text }}>
              Generated Quote Videos
            </div>
            <button
              onClick={loadVideos}
              style={{ background: "none", border: "none", color: T.textFaint, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >↻ Refresh</button>
          </div>

          {loadingVids ? (
            <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12, padding: 16 }}>Loading…</div>
          ) : qVideos.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12, padding: 16 }}>
              No quote videos yet — generate one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {qVideos.map(v => {
                const title     = v.title || v.prompt?.slice(0, 60) || v.id.slice(0, 12);
                const isPending = v.status === "processing";
                const isFailed  = v.status === "failed";
                const isReady   = v.status === "ready";
                const pendingDel = vidDeleteConfirm === v.id;

                return (
                  <div key={v.id} style={{
                    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10,
                    padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    {/* Thumbnail / status */}
                    <div style={{
                      width: 80, height: 46, borderRadius: 6, overflow: "hidden",
                      background: "#0a0a0a", flexShrink: 0, position: "relative",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>🎬</span>
                      )}
                      {isPending && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "#fff",
                        }}>⏳</div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, color: T.text, fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3,
                      }}>{title}</div>
                      <div style={{ fontSize: 10, color: T.textFaint, display: "flex", gap: 8 }}>
                        <span style={{ color: isFailed ? "#ff4444" : isPending ? "#ffaa00" : "#44ff88" }}>
                          {isFailed ? "✖ failed" : isPending ? "⏳ processing" : "✓ ready"}
                        </span>
                        <span>{v.resolution}</span>
                        <span>{fmtDate(v.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {isReady && v.file_path && (
                        <>
                          <button
                            onClick={() => setPreview(v.file_path)}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
                          >▶ Preview</button>
                          <button
                            onClick={() => handleDownload(v.file_path, v.title)}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
                          >⬇ Download</button>
                        </>
                      )}
                      <button
                        onClick={() => handleArchiveVideo(v.id)}
                        style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, color: T.textFaint, fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
                      >Archive</button>
                      {!pendingDel ? (
                        <button
                          onClick={() => setVidDeleteConfirm(v.id)}
                          style={{ background: "none", border: "1px solid #8b000060", borderRadius: 5, color: "#ff6666", fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
                        >Delete</button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button onClick={() => handleDeleteVideo(v.id)}
                            style={{ background: "#8b0000", border: "none", borderRadius: 5, color: "#fff", fontSize: 10, padding: "4px 8px", cursor: "pointer" }}>
                            Confirm
                          </button>
                          <button onClick={() => setVidDeleteConfirm(null)}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, color: T.textFaint, fontSize: 10, padding: "4px 8px", cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
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
