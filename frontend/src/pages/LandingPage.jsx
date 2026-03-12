import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import lifeLogoLong from "../assets/logo/life-logo-long.png";
import uncoverLogo  from "../assets/logo/uncover-unknown-logo.png";
import faceImg         from "../assets/static/face.jpg";
import jajja2         from "../assets/static/jajja2.jpg";
import freedomImg     from "../assets/static/freedom.jpg";
import faceVideo    from "../assets/static/face.mp4";
import nebularVideo from "../assets/static/nebular.mp4";
import metrixVideo  from "../assets/static/metrix.mp4";

const SOCIAL = {
  youtube: "https://www.youtube.com/@4life_mystery",
  tiktok:  "https://www.tiktok.com/@lifemystery183284",
  spotify: "https://open.spotify.com/show/2ZIZRXomO55COqXyJXgy5s",
};
const SPOTIFY_SHOW_ID = "2ZIZRXomO55COqXyJXgy5s";

const SECTIONS = [
  { id: "hero",      label: "HOME" },
  { id: "about",     label: "ABOUT" },
  { id: "content",   label: "CONTENT" },
  { id: "videos",    label: "VIDEOS" },
  { id: "podcast",   label: "PODCAST" },
  { id: "topics",    label: "TOPICS" },
  { id: "community", label: "COMMUNITY" },
];

const CAROUSEL = [
  { id: 1, platform: "YOUTUBE", icon: "▶", color: "#ff5533",
    title: "Why Does Life Feel Meaningless?",
    excerpt: "An honest exploration of existential emptiness and what it's actually trying to tell you.",
    tag: "Existence", link: SOCIAL.youtube },
  { id: 2, platform: "TIKTOK", icon: "♪", color: "#00f2ea",
    title: "The 60-Second Truth About Fear",
    excerpt: "Fear isn't your enemy. It's a signal. Here's how to read it before it controls you.",
    tag: "Mental Health", link: SOCIAL.tiktok },
  { id: 3, platform: "PODCAST", icon: "◎", color: "#1db954",
    title: "Connection in a Disconnected World",
    excerpt: "Why modern life made us more reachable but less truly reached.",
    tag: "Relationships", link: SOCIAL.spotify },
  { id: 4, platform: "YOUTUBE", icon: "▶", color: "#ff5533",
    title: "The Mystery of Consciousness",
    excerpt: "What is it that makes you *you*? This question has haunted philosophers for centuries.",
    tag: "Philosophy", link: SOCIAL.youtube },
];

const TOPICS = [
  { name: "Identity & Purpose",  icon: "◈", count: 24 },
  { name: "Mental Health",       icon: "◎", count: 18 },
  { name: "Relationships",       icon: "◇", count: 31 },
  { name: "Mortality & Meaning", icon: "◉", count: 15 },
  { name: "Consciousness",       icon: "◐", count: 12 },
  { name: "Spirituality",        icon: "◑", count: 20 },
  { name: "Philosophy",          icon: "◒", count: 27 },
  { name: "Society & Culture",   icon: "◓", count: 22 },
];

// ── Theme tokens ──────────────────────────────────────────────────────────────
const DARK = {
  bg:        "#03060f",
  bgAlt:     "rgba(255,255,255,0.012)",
  text:      "#e0eaf5",
  textM:     "#4a6a8a",
  textD:     "#1a3a5a",
  textD2:    "#0a1a2a",
  cardBg:    "rgba(255,255,255,0.025)",
  cardBr:    "rgba(255,255,255,0.07)",
  cardSh:    "none",
  navBg:     "rgba(3,6,15,0.82)",
  secBr:     "rgba(255,255,255,0.045)",
  footBg:    "rgba(0,0,0,0.4)",
  ftLink:    "#1a3a5a",
  inputBg:   "rgba(255,255,255,0.03)",
  inputBr:   "rgba(255,255,255,0.07)",
  socBr:     "rgba(255,255,255,0.08)",
  togBg:     "rgba(255,255,255,0.06)",
  togBr:     "rgba(255,255,255,0.1)",
  togText:   "#4a6a8a",
};
const LIGHT = {
  bg:        "#f5f2eb",
  bgAlt:     "rgba(0,0,0,0.025)",
  text:      "#18181e",
  textM:     "#55697a",
  textD:     "#8899aa",
  textD2:    "#c0ccd8",
  cardBg:    "rgba(255,255,255,0.88)",
  cardBr:    "rgba(0,0,0,0.09)",
  cardSh:    "0 4px 28px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
  navBg:     "rgba(245,242,235,0.85)",
  secBr:     "rgba(0,0,0,0.08)",
  footBg:    "rgba(0,0,0,0.035)",
  ftLink:    "#8899aa",
  inputBg:   "rgba(0,0,0,0.03)",
  inputBr:   "rgba(0,0,0,0.1)",
  socBr:     "rgba(0,0,0,0.1)",
  togBg:     "rgba(0,0,0,0.04)",
  togBr:     "rgba(0,0,0,0.12)",
  togText:   "#556677",
};

function BlogSection({ c, theme }) {
  const FP_KEY = "blog_fp";
  const getOrCreateFP = () => {
    let fp = localStorage.getItem(FP_KEY);
    if (!fp) { fp = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem(FP_KEY, fp); }
    return fp;
  };

  const [comments, setComments] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", content: "" });
  const [formError, setFormError] = React.useState("");
  const [formSuccess, setFormSuccess] = React.useState("");
  const [likingId, setLikingId] = React.useState(null);
  const [replyForm, setReplyForm] = React.useState(null);    // comment id with open reply form
  const [replyData, setReplyData] = React.useState({});      // { [commentId]: { name, content, submitting, error, success } }
  const [pendingComment, setPendingComment] = React.useState(null); // optimistic placeholder

  const fp = getOrCreateFP();

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/comments?page=${p}&limit=20&fp=${fp}`);
      const data = await res.json();
      setComments(data.comments || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(1); }, []); // eslint-disable-line

  const handleSubmit = async () => {
    setFormError(""); setFormSuccess("");
    if (!form.name.trim() || !form.content.trim()) { setFormError("Name and comment are required."); return; }
    if (form.content.trim().length < 5) { setFormError("Comment too short."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fingerprint: fp })
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.detail || "Submission failed."); return; }
      setFormSuccess("✓ Submitted! Your comment will appear after review.");
      setPendingComment({ name: form.name, content: form.content, _pending: true });
      setForm({ name: "", email: "", content: "" });
    } catch(e) { setFormError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleLike = async (commentId) => {
    if (likingId) return;
    setLikingId(commentId);
    try {
      const res = await fetch(`/api/blog/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp })
      });
      const data = await res.json();
      if (res.ok) {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) return { ...c, likes_count: data.likes_count, liked_by_me: data.liked };
          if (c.replies?.some(r => r.id === commentId)) {
            return { ...c, replies: c.replies.map(r => r.id === commentId ? { ...r, likes_count: data.likes_count, liked_by_me: data.liked } : r) };
          }
          return c;
        }));
      }
    } catch(e) {}
    finally { setLikingId(null); }
  };

  const handleReplySubmit = async (commentId) => {
    const rd = replyData[commentId] || {};
    if (!rd.name?.trim() || !rd.content?.trim()) return;
    setReplyData(prev => ({ ...prev, [commentId]: { ...prev[commentId], submitting: true, error: "" } }));
    try {
      const res = await fetch(`/api/blog/comments/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rd.name, content: rd.content, fingerprint: fp })
      });
      const data = await res.json();
      if (!res.ok) {
        setReplyData(prev => ({ ...prev, [commentId]: { ...prev[commentId], submitting: false, error: data.detail || "Submission failed." } }));
        return;
      }
      setReplyData(prev => ({ ...prev, [commentId]: { name: "", content: "", submitting: false, error: "", success: "✓ Reply submitted for review." } }));
      setReplyForm(null);
      // append a pending reply placeholder so it's immediately visible
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, replies: [...(c.replies || []), { id: `pending-${Date.now()}`, name: rd.name, content: rd.content, created_at: new Date().toISOString(), _pending: true }] }
        : c));
    } catch(e) {
      setReplyData(prev => ({ ...prev, [commentId]: { ...prev[commentId], submitting: false, error: "Network error." } }));
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isDark = theme === "dark";
  const inputSt = { padding: "10px 13px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${c.cardBr}`, borderRadius: 9, color: c.text, fontFamily: "inherit", fontSize: 12, outline: "none" };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 10, color: c.textD, letterSpacing: "0.16em" }}>DISCUSSION · {total} COMMENT{total !== 1 ? "S" : ""}</span>
      </div>

      {/* Submit form */}
      <div style={{ background: c.cardBg, border: `1px solid ${c.cardBr}`, borderRadius: 14, padding: "22px 22px 18px", marginBottom: 32, boxShadow: c.cardSh }}>
        <div style={{ fontSize: 10, color: c.textM, letterSpacing: "0.1em", marginBottom: 16 }}>LEAVE A COMMENT</div>
        <div className="comment-name-row">
          <input placeholder="Your name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputSt} />
          <input placeholder="Email (optional)" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputSt} />
        </div>
        <textarea placeholder="Share your thoughts, questions, or feedback…" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          rows={3} style={{ display: "block", width: "100%", ...inputSt, resize: "vertical", marginBottom: 10 }} />
        {formError && <div style={{ color: "#ff6060", fontSize: 11, marginBottom: 8 }}>⚠ {formError}</div>}
        {formSuccess && <div style={{ color: "#1db954", fontSize: 11, marginBottom: 8 }}>{formSuccess}</div>}
        <div className="comment-submit-row">
          <span style={{ fontSize: 10, color: c.textD }}>Comments are reviewed before appearing.</span>
          <button onClick={handleSubmit} disabled={submitting} className="comment-submit-btn"
            style={{ padding: "9px 20px", background: "linear-gradient(135deg,#cc2200,#ff5533)", border: "none", borderRadius: 9, color: "#fff", fontFamily: "inherit", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "SENDING…" : "POST COMMENT →"}
          </button>
        </div>
      </div>

      {/* Comments list — scrollable */}
      <div style={{ maxHeight: "80vh", overflowY: "auto", paddingRight: 4 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: c.textD, letterSpacing: "0.1em", fontSize: 11 }}>LOADING…</div>
        ) : (comments.length === 0 && !pendingComment) ? (
          <div style={{ textAlign: "center", padding: 60, color: c.textD, fontSize: 12, letterSpacing: "0.1em" }}>BE THE FIRST TO COMMENT</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Pending placeholder */}
            {pendingComment && (
              <div style={{ position: "relative", overflow: "hidden", background: c.cardBg, border: `1px solid ${c.cardBr}`, borderRadius: 14, padding: "22px 24px", opacity: 0.75 }}>
                <div style={{ filter: "blur(3px)", userSelect: "none", pointerEvents: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,80,30,0.12)", border: "1px solid rgba(255,80,30,0.2)" }} />
                    <div style={{ width: 100, height: 13, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderRadius: 6 }} />
                  </div>
                  <div style={{ height: 12, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", borderRadius: 5, marginBottom: 6, width: "88%" }} />
                  <div style={{ height: 12, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", borderRadius: 5, width: "65%" }} />
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#ff7755", letterSpacing: "0.12em", fontWeight: 600 }}>PENDING REVIEW</span>
                  <span style={{ fontSize: 10, color: c.textD }}>Your comment will appear once approved.</span>
                </div>
              </div>
            )}

            {comments.map(comment => (
              <div key={comment.id}>
                {/* Main comment — compact */}
                <div style={{ background: c.cardBg, border: `1px solid ${c.cardBr}`, borderRadius: 12, padding: "14px 16px", boxShadow: c.cardSh }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* Avatar */}
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `hsl(${comment.name.charCodeAt(0)*13%360},48%,32%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: "'Syne',sans-serif" }}>
                      {comment.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span className="syne" style={{ fontWeight: 700, fontSize: 12, color: c.text }}>{comment.name}</span>
                        <span style={{ fontSize: 10, color: c.textM }}>{formatDate(comment.created_at)}</span>
                      </div>
                      {/* Body */}
                      <p style={{ fontSize: 12, color: c.textM, lineHeight: 1.7, margin: 0, marginBottom: 10 }}>{comment.content}</p>
                      {/* Action row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <button onClick={() => handleLike(comment.id)} disabled={likingId === comment.id}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: comment.liked_by_me ? "#ff5533" : c.textM, fontSize: 11, fontFamily: "inherit", padding: 0, transition: "color 0.2s" }}>
                          <span style={{ fontSize: 13 }}>{comment.liked_by_me ? "♥" : "♡"}</span>
                          <span>{comment.likes_count}</span>
                        </button>
                        <button onClick={() => { setReplyForm(replyForm === comment.id ? null : comment.id); setReplyData(p => ({ ...p, [comment.id]: p[comment.id] || { name: "", content: "" } })); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: replyForm === comment.id ? "#ff6644" : c.textM, fontSize: 11, fontFamily: "inherit", padding: 0, transition: "color 0.2s" }}>
                          ↩ {replyForm === comment.id ? "CANCEL" : "REPLY"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline reply form — indented */}
                {replyForm === comment.id && (
                  <div style={{ marginLeft: 42, marginTop: 6, background: c.cardBg, border: `1px solid ${c.cardBr}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <input placeholder="Your name *" value={replyData[comment.id]?.name || ""}
                        onChange={e => setReplyData(p => ({ ...p, [comment.id]: { ...p[comment.id], name: e.target.value } }))}
                        style={{ ...inputSt, fontSize: 11 }} />
                      <input placeholder="Email (optional)" value={replyData[comment.id]?.email || ""}
                        onChange={e => setReplyData(p => ({ ...p, [comment.id]: { ...p[comment.id], email: e.target.value } }))}
                        style={{ ...inputSt, fontSize: 11 }} />
                    </div>
                    <textarea placeholder="Write a reply…" rows={2}
                      value={replyData[comment.id]?.content || ""}
                      onChange={e => setReplyData(p => ({ ...p, [comment.id]: { ...p[comment.id], content: e.target.value } }))}
                      style={{ display: "block", width: "100%", ...inputSt, fontSize: 11, resize: "vertical", marginBottom: 8 }} />
                    {replyData[comment.id]?.error && <div style={{ color: "#ff6060", fontSize: 11, marginBottom: 6 }}>⚠ {replyData[comment.id].error}</div>}
                    {replyData[comment.id]?.success && <div style={{ color: "#1db954", fontSize: 11, marginBottom: 6 }}>{replyData[comment.id].success}</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setReplyForm(null)} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${c.cardBr}`, borderRadius: 6, color: c.textM, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>CANCEL</button>
                      <button onClick={() => handleReplySubmit(comment.id)} disabled={replyData[comment.id]?.submitting}
                        style={{ padding: "6px 14px", background: "linear-gradient(135deg,#cc2200,#ff5533)", border: "none", borderRadius: 6, color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: replyData[comment.id]?.submitting ? 0.6 : 1 }}>
                        {replyData[comment.id]?.submitting ? "SENDING…" : "POST REPLY →"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies — always visible, indented subtree */}
                {comment.replies?.length > 0 && (
                  <div style={{ marginLeft: 42, marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    {comment.replies.map(reply => (
                      <div key={reply.id} style={{ display: "flex", gap: 9, padding: "10px 14px", borderLeft: `2px solid ${reply.is_admin_reply ? "rgba(255,80,30,0.35)" : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`, opacity: reply._pending ? 0.65 : 1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: reply.is_admin_reply ? "linear-gradient(135deg,#cc2200,#ff5533)" : `hsl(${reply.name.charCodeAt(0)*13%360},45%,30%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: "'Syne',sans-serif" }}>
                          {reply.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                            <span className="syne" style={{ fontWeight: 700, fontSize: 11, color: reply.is_admin_reply ? "#ff7755" : c.text }}>{reply.name}</span>
                            {reply.is_admin_reply && <span style={{ fontSize: 8, background: "rgba(255,80,30,0.15)", color: "#ff7755", padding: "1px 5px", borderRadius: 8, letterSpacing: "0.08em" }}>CREATOR</span>}
                            {reply._pending && <span style={{ fontSize: 8, background: "rgba(245,158,11,0.12)", color: "#f59e0b", padding: "1px 5px", borderRadius: 8, letterSpacing: "0.08em" }}>PENDING</span>}
                            <span style={{ fontSize: 10, color: c.textM }}>{formatDate(reply.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 12, color: c.textM, lineHeight: 1.65, margin: 0, marginBottom: reply._pending ? 0 : 6 }}>{reply.content}</p>
                          {!reply._pending && (
                            <button onClick={() => handleLike(reply.id)} disabled={likingId === reply.id}
                              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: reply.liked_by_me ? "#ff5533" : c.textM, fontSize: 10, fontFamily: "inherit", padding: 0, transition: "color 0.2s" }}>
                              <span style={{ fontSize: 11 }}>{reply.liked_by_me ? "♥" : "♡"}</span>
                              <span>{reply.likes_count || 0}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {total > 20 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 8, paddingBottom: 8 }}>
                {page > 1 && (
                  <button onClick={() => load(page - 1)} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${c.cardBr}`, borderRadius: 8, color: c.textM, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>← PREV</button>
                )}
                {page * 20 < total && (
                  <button onClick={() => load(page + 1)} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${c.cardBr}`, borderRadius: 8, color: c.textM, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>NEXT →</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [theme,         setTheme]         = useState("dark");
  const [scrolled,      setScrolled]      = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [carouselIdx,   setCarouselIdx]   = useState(0);
  const [slideDir,      setSlideDir]      = useState("right");
  const [ytVideos,      setYtVideos]      = useState([]);
  const [ytLoading,     setYtLoading]     = useState(true);
  const [ytIdx,         setYtIdx]         = useState(0);
  const [modalVideo,    setModalVideo]    = useState(null);   // { id, title, url }
  const [showBackTop,   setShowBackTop]   = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [ytCols,        setYtCols]        = useState(3);
  const [heroStats,     setHeroStats]     = useState(null);
  const wrapperRef    = useRef(null);
  const autoRef       = useRef(null);
  const heroVidRef    = useRef(null);
  const topicsBgRef    = useRef(null);
  const communityBgRef = useRef(null);
  const contentBgRef   = useRef(null);
  const videoBgRef     = useRef(null);
  const ytAutoRef      = useRef(null);
  const ytWinRef       = useRef(null);
  const [ytStepPx,    setYtStepPx]    = useState(0);

  const c = theme === "dark" ? DARK : LIGHT;

  // Scroll detection on the wrapper (not window)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = () => {
      setScrolled(el.scrollTop > 60);
      if (el.scrollTop > 100 && menuOpen) setMenuOpen(false);
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [menuOpen]);

  // Section tracking with wrapper as root
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const observers = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveSection(id); },
        { root: wrapper, rootMargin: "-35% 0px -35% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  // Fetch public YouTube videos
  useEffect(() => {
    fetch("/api/public/channel-videos")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setYtVideos(d.videos || []))
      .catch(() => setYtVideos([]))
      .finally(() => setYtLoading(false));
  }, []);

  // Back-to-top visibility + scroll progress (uses wrapper scroll)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = () => {
      setShowBackTop(el.scrollTop > 600);
      const maxScroll = el.scrollHeight - el.clientHeight;
      setScrollProgress(maxScroll > 0 ? Math.min(1, el.scrollTop / maxScroll) : 0);
      // Parallax backgrounds — direct DOM, no re-render
      if (topicsBgRef.current) {
        const rect = document.getElementById("topics")?.getBoundingClientRect();
        if (rect) topicsBgRef.current.style.transform = `translateY(${-rect.top * 0.28}px) scale(1.35)`;
      }
      if (communityBgRef.current) {
        const rect = document.getElementById("community")?.getBoundingClientRect();
        if (rect) communityBgRef.current.style.transform = `translateY(${-rect.top * 0.28}px) scale(1.35)`;
      }
      if (contentBgRef.current) {
        const rect = document.getElementById("content")?.getBoundingClientRect();
        if (rect) contentBgRef.current.style.transform = `translateY(${-rect.top * 0.22}px) scale(1.3)`;
      }
      if (videoBgRef.current) {
        const rect = document.getElementById("videos")?.getBoundingClientRect();
        if (rect) videoBgRef.current.style.transform = `translateY(${-rect.top * 0.25}px) scale(1.35)`;
      }
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

  // Responsive ytCols + pixel step measurement
  useEffect(() => {
    const upd = () => {
      const cols = window.innerWidth < 540 ? 1 : window.innerWidth < 900 ? 2 : 3;
      setYtCols(cols);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // Measure carousel step in pixels whenever ytCols changes
  useEffect(() => {
    const measure = () => {
      if (ytWinRef.current) {
        const w = ytWinRef.current.offsetWidth;
        if (w > 0) setYtStepPx((w - (ytCols - 1) * 22) / ytCols + 22);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ytCols]);

  // Reset carousel position when column count changes
  useEffect(() => { setYtIdx(0); }, [ytCols]);

  // YouTube hero auto-advance (3 videos max, loop)
  useEffect(() => {
    const total = Math.min(ytVideos.length, 3);
    if (total > 1) {
      ytAutoRef.current = setInterval(() => {
        setYtIdx(i => (i + 1) % total);
      }, 5500);
    }
    return () => clearInterval(ytAutoRef.current);
  }, [ytVideos]);

  // Close modal on Escape
  useEffect(() => {
    const fn = e => { if (e.key === "Escape") setModalVideo(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // Slow down hero video
  useEffect(() => {
    if (heroVidRef.current) heroVidRef.current.playbackRate = 0.55;
  }, []);

  // Fetch aggregated hero stats
  useEffect(() => {
    fetch("/api/public/stats")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setHeroStats(d))
      .catch(() => {});
  }, []);

  // Carousel auto-advance
  useEffect(() => {
    autoRef.current = setInterval(
      () => setCarouselIdx(i => (i + 1) % CAROUSEL.length), 5500
    );
    return () => clearInterval(autoRef.current);
  }, []);


  const goPrev   = () => { clearInterval(autoRef.current); setSlideDir("left");  setCarouselIdx(i => (i - 1 + CAROUSEL.length) % CAROUSEL.length); };
  const goNext   = () => { clearInterval(autoRef.current); setSlideDir("right"); setCarouselIdx(i => (i + 1) % CAROUSEL.length); };
  const goTo     = (i) => { clearInterval(autoRef.current); setSlideDir(i > carouselIdx ? "right" : "left"); setCarouselIdx(i); };
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const ytPause  = () => clearInterval(ytAutoRef.current);
  const ytResume = () => {
    const total = Math.min(ytVideos.length, 3);
    if (total > 1) {
      ytAutoRef.current = setInterval(() => setYtIdx(i => (i + 1) % total), 5500);
    }
  };
  const ytPrev = () => { ytPause(); const t = Math.min(ytVideos.length, 3); setYtIdx(i => (i - 1 + t) % t); };
  const ytNext = () => { ytPause(); const t = Math.min(ytVideos.length, 3); setYtIdx(i => (i + 1) % t); };

  const item = CAROUSEL[carouselIdx];

  return (
    <div
      ref={wrapperRef}
      data-theme={theme}
      style={{
        maxHeight: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        background: c.bg,
        color: c.text,
        fontFamily: "'DM Mono','Fira Code',monospace",
        scrollBehavior: "smooth",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 17px; }

        /* ── DISABLE COPY ─────────────────────────────── */
        [data-theme] { -webkit-user-select:none; -moz-user-select:none; user-select:none; }
        img { -webkit-user-drag:none; pointer-events:none; }
        a, button, iframe, input, textarea { pointer-events:auto; }

        /* ── NAV ──────────────────────────────────────── */
        .lp-nav {
          position: sticky; top: 0; left: 0; right: 0; z-index: 300;
          transition: background 0.35s, border-color 0.35s, backdrop-filter 0.35s;
          border-bottom: 1px solid transparent;
          /* always float transparent over hero video */
          background: transparent;
        }
        .lp-nav.scrolled {
          background: var(--nav-bg);
          backdrop-filter: blur(28px) saturate(180%) brightness(0.95);
          -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(0.95);
          border-bottom-color: rgba(255,80,30,0.12);
          box-shadow: 0 2px 32px rgba(0,0,0,0.18);
        }
        /* Force nav text white on hero video */
        .lp-nav:not(.scrolled) .lp-navlink { color: rgba(255,255,255,0.65)!important; }
        .lp-nav:not(.scrolled) .lp-navlink:hover,
        .lp-nav:not(.scrolled) .lp-navlink.active { color: #ff8866!important; }
        .lp-nav:not(.scrolled) .soc-icon { color: rgba(255,255,255,0.6)!important; border-color: rgba(255,255,255,0.18)!important; }
        .lp-nav:not(.scrolled) .theme-toggle { color: rgba(255,255,255,0.55)!important; border-color: rgba(255,255,255,0.2)!important; background: rgba(255,255,255,0.06)!important; }
        .lp-navlink {
          color: var(--text-m);
          text-decoration: none;
          font-size: 10px;
          letter-spacing: 0.14em;
          transition: color 0.2s;
          padding-bottom: 4px;
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .lp-navlink::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 0; height: 1px;
          background: linear-gradient(90deg,#ff5533,#ff8844);
          transition: width 0.3s ease;
        }
        .lp-navlink:hover { color: #ff6633; }
        .lp-navlink:hover::after { width: 100%; }
        .lp-navlink.active { color: #ff6633; }
        .lp-navlink.active::after { width: 100%; }

        /* ── BUTTONS ──────────────────────────────────── */
        .lp-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 15px 28px; border-radius: 12px;
          font-family: 'DM Mono', monospace; font-size: 12px;
          font-weight: 500; letter-spacing: 0.12em;
          cursor: pointer; transition: all 0.22s;
          text-decoration: none; border: none;
          white-space: nowrap; position: relative; overflow: hidden;
        }
        .lp-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
          transform: translateX(-110%);
          transition: transform 0.55s ease;
          pointer-events: none;
        }
        .lp-btn:hover::after { transform: translateX(110%); }
        .lp-btn-fire { background: linear-gradient(135deg,#cc2200,#ff5533,#ff8844); color:#fff; box-shadow: 0 4px 20px rgba(255,80,30,0.25); }
        .lp-btn-fire:hover { opacity:0.92; transform:translateY(-3px) scale(1.03); box-shadow:0 12px 36px rgba(255,80,30,0.5); }
        .lp-btn-ghost { background:transparent; color: var(--text-light,#c0d4e8); border:1px solid rgba(255,255,255,0.18); }
        [data-theme="light"] .lp-btn-ghost { color:#444; border-color:rgba(0,0,0,0.18); }
        .lp-btn-ghost:hover { border-color:rgba(255,80,30,0.5); color:#ff6633; background:rgba(255,80,30,0.07); transform:translateY(-2px); }
        .lp-btn-green { background:linear-gradient(135deg,#1db954,#1ed760); color:#fff; box-shadow: 0 4px 20px rgba(29,185,84,0.25); }
        .lp-btn-green:hover { opacity:0.92; transform:translateY(-3px) scale(1.03); box-shadow:0 12px 36px rgba(29,185,84,0.45); }

        /* ── CARDS ────────────────────────────────────── */
        .lp-card {
          background: var(--card-bg);
          border: 1px solid var(--card-br);
          box-shadow: var(--card-sh,none);
          border-radius: 16px;
          transition: border-color 0.28s, transform 0.28s, box-shadow 0.28s;
          position: relative; overflow: hidden;
        }
        .lp-card::before {
          content: '';
          position: absolute;
          top: -60%; left: -60%;
          width: 220%; height: 220%;
          background: radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.07) 0%, transparent 60%);
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.45s, transform 0.45s;
          pointer-events: none;
        }
        [data-theme="light"] .lp-card::before {
          background: radial-gradient(ellipse at 35% 35%, rgba(255,140,80,0.07) 0%, transparent 60%);
        }
        .lp-card:hover { border-color:rgba(255,80,30,0.28); transform:translateY(-4px); box-shadow:0 12px 40px rgba(255,80,30,0.12); }
        .lp-card:hover::before { opacity:1; transform:scale(1); }

        /* ── COMMENT CARD ─────────────────────────────── */
        .comment-card {
          background: var(--card-bg);
          border: 1px solid var(--card-br);
          box-shadow: var(--card-sh,none);
          border-radius: 14px; padding: 20px;
          transition: transform 0.25s, box-shadow 0.25s;
          position: relative; overflow: hidden;
        }
        .comment-card::before {
          content: '';
          position: absolute; top:0; left:0; right:0; height:2px;
          background: linear-gradient(90deg,transparent,rgba(255,80,30,0.4),transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .comment-card:hover { transform:translateY(-3px); box-shadow:0 8px 32px rgba(255,80,30,0.1); }
        .comment-card:hover::before { opacity:1; }

        /* ── HELPERS ──────────────────────────────────── */
        .syne { font-family:'Syne',sans-serif; }
        .grad-fire { background:linear-gradient(135deg,#ff8844,#ff3300,#0088ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .section-tag { font-size:10px; letter-spacing:0.22em; color:#ff6633; margin-bottom:14px; display:block; }
        .grid-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(255,60,20,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,100,255,0.018) 1px,transparent 1px); background-size:64px 64px; pointer-events:none; }

        /* ── SIDE NAV ─────────────────────────────────── */
        .side-nav { position:sticky; top:50vh; float:left; margin-left:18px; margin-top:-40px; display:flex; flex-direction:column; gap:10px; z-index:200; transform:translateY(-50%); }
        .side-dot { display:flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; padding:2px 0; }
        .side-bar { height:7px; border-radius:4px; transition:all 0.32s; }
        .side-label { font-size:8px; letter-spacing:0.14em; color:#ff6633; opacity:0; transition:opacity 0.2s; white-space:nowrap; pointer-events:none; }
        .side-dot:hover .side-label { opacity:1; }

        /* ── ANIMATIONS ───────────────────────────────── */
        @keyframes fadeUp     { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow       { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes scrollPulse{ 0%,100%{opacity:0.25;transform:translateY(0)} 50%{opacity:0.9;transform:translateY(6px)} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(48px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-48px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInUp    { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .anim-1 { animation:fadeUp 0.7s ease both; }
        .anim-2 { animation:fadeUp 0.7s 0.12s ease both; }
        .anim-3 { animation:fadeUp 0.7s 0.24s ease both; }
        .anim-4 { animation:fadeUp 0.7s 0.36s ease both; }
        .carousel-slide { animation:slideInRight 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .carousel-slide-icon { animation:slideInLeft 0.42s 0.06s cubic-bezier(0.22,1,0.36,1) both; }

        /* ── SOCIAL ICONS ─────────────────────────────── */
        .soc-icon {
          display:flex; align-items:center; justify-content:center;
          width:38px; height:38px; border-radius:10px;
          border:1px solid var(--soc-br,rgba(255,255,255,0.08));
          color:var(--text-m); text-decoration:none; font-size:16px;
          transition:all 0.25s; position:relative; overflow:hidden;
        }
        .soc-icon::before {
          content:'';
          position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,80,30,0.15),transparent);
          opacity:0; transition:opacity 0.3s;
        }
        .soc-icon:hover { border-color:rgba(255,80,30,0.5); color:#ff6633; transform:translateY(-3px) scale(1.08); box-shadow:0 6px 20px rgba(255,80,30,0.2); }
        .soc-icon:hover::before { opacity:1; }

        /* ── FOOTER LINKS ─────────────────────────────── */
        .ft-link { display:block; font-size:12px; text-decoration:none; margin-bottom:10px; transition:color 0.2s, padding-left 0.2s; letter-spacing:0.04em; }
        .ft-link:hover { color:#ff6633 !important; padding-left:4px; }
        button.ft-link { background:none; border:none; cursor:pointer; font-family:inherit; text-align:left; padding:0; padding-bottom:10px; }
        button.ft-link:hover { color:#ff6633 !important; padding-left:4px; }

        /* ── TOPIC PILLS ──────────────────────────────── */
        .topic-pill {
          display:inline-flex; align-items:center; gap:8px;
          padding:10px 18px; border-radius:100px;
          cursor:pointer; transition:all 0.25s;
          text-decoration:none; font-size:11px; letter-spacing:0.04em;
          position:relative; overflow:hidden;
        }
        .topic-pill::before {
          content:'';
          position:absolute; inset:0; border-radius:100px;
          background:radial-gradient(circle at center,rgba(255,80,30,0.15),transparent 70%);
          opacity:0; transition:opacity 0.35s;
        }
        .topic-pill:hover { border-color:rgba(255,80,30,0.5)!important; color:#ff6633!important; transform:translateY(-3px) scale(1.04); box-shadow:0 4px 16px rgba(255,80,30,0.15); }
        .topic-pill:hover::before { opacity:1; }

        /* ── CAROUSEL DOT ─────────────────────────────── */
        .c-dot { height:7px; border-radius:4px; border:none; cursor:pointer; transition:all 0.32s; padding:0; }

        /* ── MOBILE MENU ──────────────────────────────── */
        .mob-menu { position:fixed; inset:0; z-index:280; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; backdrop-filter:blur(28px) saturate(160%); -webkit-backdrop-filter:blur(28px) saturate(160%); }
        .mob-navlink { font-size:20px; letter-spacing:0.16em; background:none; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-weight:700; transition:color 0.2s, transform 0.2s; padding:8px 0; }
        .mob-navlink:hover { transform:translateX(6px); }
        .mob-close { position:absolute; top:20px; right:24px; background:none; border:none; font-size:28px; cursor:pointer; transition:all 0.2s; }
        .mob-close:hover { color:#ff6633!important; transform:rotate(90deg); }

        /* ── COMMENT FORM ─────────────────────────────── */
        .comment-input { width:100%; padding:12px 16px; border-radius:10px; font-family:inherit; font-size:13px; outline:none; resize:vertical; min-height:90px; }
        .coming-soon-overlay { position:absolute; inset:0; backdrop-filter:blur(6px) saturate(140%); -webkit-backdrop-filter:blur(6px) saturate(140%); border-radius:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; z-index:10; }
        .comment-name-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px; }
        .comment-name-row input { flex:1 1 180px; min-width:0; }
        .comment-submit-row { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
        @media (max-width:540px) {
          .comment-name-row input { flex:1 1 100%; }
          .comment-submit-row { flex-direction:column; align-items:stretch; }
          .comment-submit-row span { order:2; text-align:center; }
          .comment-submit-btn { width:100%!important; justify-content:center; order:1; }
        }

        /* ── HAMBURGER ────────────────────────────────── */
        .hamburger { display:none; background:none; border-radius:8px; width:38px; height:38px; cursor:pointer; font-size:18px; align-items:center; justify-content:center; transition:all 0.2s; }
        .hamburger:hover { color:#ff6633!important; }

        /* ── THEME TOGGLE ─────────────────────────────── */
        .theme-toggle {
          display:flex; align-items:center; gap:7px;
          padding:6px 12px; border-radius:20px;
          cursor:pointer; font-family:inherit; font-size:10px;
          letter-spacing:0.08em; transition:all 0.25s;
          border:1px solid;
        }
        .theme-toggle:hover { transform:scale(1.06); }

        /* ── HERO VIDEO OVERLAP — nav overlays video ── */
        #hero { margin-top: -62px; }

        /* ── FACE FEATURE IMAGE ───────────────────────── */
        @keyframes hairSway {
          0%   { transform: rotate(-0.6deg) translateX(-3px) scale(1.018); filter: brightness(1) saturate(1); }
          30%  { transform: rotate(0.3deg)  translateX(1px)  scale(1.022); filter: brightness(1.03) saturate(1.04); }
          60%  { transform: rotate(0.7deg)  translateX(4px)  scale(1.02);  filter: brightness(1.01) saturate(1.02); }
          100% { transform: rotate(-0.6deg) translateX(-3px) scale(1.018); filter: brightness(1) saturate(1); }
        }
        @keyframes hairOverlay {
          0%,100% { opacity: 0.18; transform: translateX(-8px); }
          50%      { opacity: 0.08; transform: translateX(8px); }
        }
        .face-feature { pointer-events: auto; overflow: hidden; }
        .face-sway { animation: hairSway 6s ease-in-out infinite; transform-origin: bottom center; will-change: transform; }
        .face-feature img { pointer-events: none; }
        .face-wind-overlay {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background: linear-gradient(105deg, transparent 40%, rgba(255,220,180,0.08) 55%, transparent 65%);
          animation: hairOverlay 6s ease-in-out infinite;
        }
        @media (max-width:900px) { .face-feature { min-height: 360px!important; } }

        /* ── YT CAROUSEL ─────────────────────────────── */
        .yt-stage-wrap { padding:0 78px; }
        @media (max-width:900px) { .yt-stage-wrap { padding:0 60px; } }
        @media (max-width:600px) { .yt-stage-wrap { padding:0 50px; } }
        .yt-stage { position:relative; }
        /* overflow-x:clip allows overflow-y:visible for hover card lift */
        .yt-carousel-win { overflow-x:clip; overflow-y:visible; border-radius:20px; padding-top:16px; margin-top:-16px; }
        .yt-carousel-track { display:flex; gap:22px; transition:transform 0.55s cubic-bezier(0.4,0,0.2,1); }
        .yt-card { flex-shrink:0; border-radius:18px; overflow:hidden; cursor:pointer;
          background:rgba(8,8,18,0.9); border:1px solid rgba(255,255,255,0.1);
          box-shadow:0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5);
          transition:transform 0.35s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.35s, border-color 0.3s; }
        .yt-card:hover { transform:translateY(-12px) scale(1.015); border-color:rgba(220,50,40,0.6);
          box-shadow:0 36px 90px rgba(0,0,0,0.8), 0 8px 28px rgba(200,40,30,0.4); }
        .yt-thumb { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; background:#050510; }
        .yt-thumb img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.55s; display:block; }
        .yt-card:hover .yt-thumb img { transform:scale(1.08); }
        .yt-thumb-grad { position:absolute; inset:0; background:linear-gradient(to top,rgba(4,4,16,0.98) 0%,rgba(4,4,16,0.5) 42%,transparent 68%); pointer-events:none; }
        .yt-thumb-title { position:absolute; bottom:0; left:0; right:0; padding:16px 18px 14px; }
        .yt-thumb-title .ttl { font-family:'Syne',sans-serif; font-weight:800; font-size:15px; line-height:1.38; color:#fff;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          text-shadow:0 2px 12px rgba(0,0,0,0.9); }
        .yt-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          opacity:0; transition:opacity 0.3s; pointer-events:none; }
        .yt-card:hover .yt-play { opacity:1; }
        .yt-play-btn { width:clamp(52px,18%,72px); aspect-ratio:1/1; border-radius:50%;
          background:rgba(195,38,38,0.9); border:2.5px solid rgba(255,100,70,0.7);
          backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 6px 32px rgba(180,20,20,0.65);
          transform:scale(0.85); transition:transform 0.25s, background 0.25s; }
        .yt-card:hover .yt-play-btn { transform:scale(1.08); background:rgba(220,38,38,0.95); }
        .yt-play-btn svg { width:60%; height:60%; fill:#fff; margin-left:8%; filter:drop-shadow(0 1px 6px rgba(0,0,0,0.6)); }
        .yt-play-btn.disabled { opacity:0.18; border-color:rgba(150,150,150,0.25); background:rgba(50,50,50,0.2); box-shadow:none; }
        .yt-badge-yt { position:absolute; top:12px; left:12px; background:rgba(195,28,28,0.92); color:#fff;
          font-size:9px; font-weight:700; letter-spacing:0.12em; padding:4px 9px; border-radius:5px; backdrop-filter:blur(4px); }
        .yt-badge-dur { position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.85); color:#fff;
          font-size:10px; padding:3px 9px; border-radius:5px; letter-spacing:0.04em; backdrop-filter:blur(4px); }
        .yt-meta-row { display:flex; gap:16px; align-items:center; padding:14px 18px 16px; font-size:11px; letter-spacing:0.06em; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.06); }
        .yt-skeleton { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%);
          background-size:200% 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:10px; }
        /* Arrows — full height, transparent, outside track */
        .yt-arr { position:absolute; top:0; height:100%; width:54px;
          border-radius:0; border:none; background:transparent;
          color:rgba(255,255,255,0.45); font-size:4rem; line-height:1;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; z-index:10; transition:color 0.2s; padding:0; }
        .yt-arr:hover:not(:disabled) { color:rgba(255,255,255,0.95); }
        .yt-arr:disabled { opacity:0.15; cursor:default; }
        .yt-arr.prev { right:calc(100% + 16px); }
        .yt-arr.next { left:calc(100% + 16px); }
        .yt-dots { display:flex; gap:8px; justify-content:center; margin-top:28px; align-items:center; }
        .yt-dot { width:7px; height:7px; border-radius:50%; border:none; cursor:pointer; transition:all 0.32s; padding:0; }
        @media (max-width:900px) { .yt-arr { width:42px; font-size:3rem; } }
        @media (max-width:600px) { .yt-arr { width:34px; font-size:2.4rem; } }
        /* ── VIDEO MODAL ─────────────────────────────── */
        .yt-modal-backdrop { position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center;
          background:rgba(0,0,0,0.72); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
          animation:fadeIn 0.22s ease; padding:20px; }
        .yt-modal-box { width:min(82vw,1100px); display:flex; flex-direction:column; gap:0;
          border-radius:18px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.6);
          border:1px solid rgba(200,40,40,0.25); animation:modalIn 0.28s cubic-bezier(0.34,1.3,0.64,1); }
        .yt-modal-frame { width:100%; aspect-ratio:16/9; background:#000; }
        .yt-modal-frame iframe { width:100%; height:100%; border:none; display:block; }
        .yt-modal-bar { display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:14px 18px; background:#0d0d12; border-top:1px solid rgba(255,255,255,0.06); }
        .yt-modal-title { font-size:13px; font-weight:600; color:#e8f4ff; flex:1; min-width:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; }
        .yt-modal-actions { display:flex; gap:10px; flex-shrink:0; }
        .yt-modal-btn { padding:7px 16px; border-radius:8px; border:none; cursor:pointer; font-size:11px;
          font-weight:700; letter-spacing:0.06em; font-family:sans-serif; transition:opacity 0.2s; }
        .yt-modal-btn:hover { opacity:0.8; }
        .yt-modal-btn.yt { background:rgba(195,40,40,0.9); color:#fff; }
        .yt-modal-btn.close { background:rgba(255,255,255,0.1); color:#cdd8e8; }
        @keyframes modalIn { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        /* ── BACKDROP FILTER ON INTERACTIVE / VISIBLE ELEMENTS ── */
        .lp-card { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .lp-btn  { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .topic-pill { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .soc-icon   { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .yt-card    { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }

        /* ── NETFLIX HERO ─────────────────────────────── */
        .yt-hero { position:relative; width:100%; height:clamp(280px,42vw,560px); overflow:hidden; border-radius:20px; cursor:pointer; }
        .yt-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; transition:transform 0.8s ease; }
        .yt-hero:hover .yt-hero-bg { transform:scale(1.04); }
        .yt-hero-overlay { position:absolute; inset:0; background:linear-gradient(to right, rgba(3,6,15,0.92) 0%, rgba(3,6,15,0.6) 55%, rgba(3,6,15,0.1) 85%, transparent 100%); pointer-events:none; }
        .yt-hero-content { position:absolute; inset:0; display:flex; align-items:flex-end; padding:clamp(22px,4vw,52px); pointer-events:none; }
        .yt-hero-text { max-width:min(520px,70%); transition:transform 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.42s ease; pointer-events:auto; }
        .yt-hero:hover .yt-hero-text { transform:translateX(-36px); opacity:0; pointer-events:none; }
        .yt-hero-badge { display:inline-block; padding:5px 12px; border-radius:6px; background:rgba(195,28,28,0.9); color:#fff; font-size:9px; font-weight:700; letter-spacing:0.14em; margin-bottom:14px; }
        .yt-hero-title { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(16px,2.8vw,34px); color:#fff; line-height:1.25; margin-bottom:12px; text-shadow:0 2px 20px rgba(0,0,0,0.8); }
        .yt-hero-meta { display:flex; gap:14px; font-size:11px; color:rgba(255,255,255,0.55); margin-bottom:20px; letter-spacing:0.04em; flex-wrap:wrap; }
        .yt-hero-cta { display:inline-flex; align-items:center; gap:8px; padding:11px 22px; border-radius:10px; background:rgba(195,38,38,0.9); color:#fff; border:none; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:0.1em; font-family:inherit; transition:background 0.2s, transform 0.2s; }
        .yt-hero-cta:hover { background:rgba(220,38,38,1); transform:scale(1.04); }
        .yt-hero-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.42s; pointer-events:none; }
        .yt-hero:hover .yt-hero-play { opacity:1; pointer-events:auto; }
        .yt-hero-play-btn { width:74px; height:74px; border-radius:50%; background:rgba(195,38,38,0.9); border:3px solid rgba(255,100,70,0.7); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); box-shadow:0 8px 40px rgba(180,20,20,0.7); transition:transform 0.25s, background 0.2s; cursor:pointer; }
        .yt-hero-play-btn:hover { transform:scale(1.12); background:rgba(220,38,38,1); }
        .yt-hero-play-btn svg { width:36px; height:36px; fill:#fff; margin-left:5px; }
        .yt-hero-side-arr { position:absolute; top:50%; transform:translateY(-50%); z-index:10; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.15); border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(255,255,255,0.7); font-size:1.6rem; line-height:1; transition:all 0.2s; backdrop-filter:blur(6px); }
        .yt-hero-side-arr:hover { background:rgba(195,38,38,0.8); color:#fff; border-color:rgba(200,40,40,0.5); }
        .yt-hero-side-arr.left { left:16px; }
        .yt-hero-side-arr.right { right:16px; }
        .yt-hero-dots { display:flex; gap:8px; justify-content:center; margin-top:18px; align-items:center; }
        .yt-hero-dot { border:none; cursor:pointer; padding:0; transition:all 0.32s; height:7px; border-radius:4px; }
        @media (max-width:600px) { .yt-hero { height:clamp(220px,56vw,360px); } .yt-hero-side-arr { width:36px; height:36px; font-size:1.3rem; } }

        /* ── FEATURED CONTENT BUTTON — full width on mobile ── */
        @media (max-width:640px) { .feat-cta-btn { align-self:stretch!important; justify-content:center!important; width:100%!important; } }

        /* ── FOOTER MOBILE ────────────────────────────── */
        @media (max-width:540px) {
          .footer-grid > div { text-align:center; display:flex; flex-direction:column; align-items:center; }
          .footer-grid .soc-icon-row { justify-content:center; }
          .ft-link { text-align:center; padding-left:0!important; }
          button.ft-link:hover { padding-left:0!important; }
          .footer-bottom-bar { flex-direction:column!important; align-items:center!important; gap:14px!important; text-align:center; width:100%; }
        }


        /* ── BACK TO TOP ─────────────────────────────── */
        .back-to-top { position:fixed; bottom:28px; right:28px; z-index:800;
          width:46px; height:46px; border-radius:50%; border:none;
          background:transparent;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          transition:opacity 0.3s, transform 0.3s, background 0.25s;
          color:rgba(255,255,255,0.5); font-size:18px; }
        .back-to-top:hover { background:rgba(195,38,38,0.28); color:#fff; transform:translateY(-3px) scale(1.07); }
        .back-to-top.hidden { opacity:0; pointer-events:none; transform:translateY(12px); }
        @media (max-width:900px) { .yt-modal-box { width:95vw; } .back-to-top { bottom:80px; right:18px; } }
        @media (max-width:540px) { .yt-dot { display:none; } .yt-dot:nth-child(-n+5) { display:block; } }

        /* ── BUTTON GROUPS ────────────────────────────── */
        .btn-group { display:flex; gap:12px; flex-wrap:wrap; }

        /* ── TOPIC PILLS ──────────────────────────────── */
        .topics-grid { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }

        /* ── RESPONSIVE ───────────────────────────────── */
        @media (max-width:900px) {
          .side-nav { display:none!important; }
          .hide-mobile { display:none!important; }
          .hamburger { display:flex!important; }
          .hero-grid { grid-template-columns:1fr!important; }
          .hero-logo-col { order:-1; }
          .about-grid { grid-template-columns:1fr!important; }
          .podcast-grid { grid-template-columns:1fr!important; }
          .carousel-main { grid-template-columns:1fr!important; }
          .footer-grid { grid-template-columns:1fr 1fr!important; }
          .mini-grid { grid-template-columns:1fr 1fr!important; }
          .comments-grid { grid-template-columns:1fr!important; }
        }
        @media (max-width:640px) {
          /* Buttons: equal width, full container, stacked */
          .btn-group { flex-direction:column; width:100%; align-items:stretch; }
          .btn-group .lp-btn { width:100%; justify-content:center; text-align:center; }
          /* Topics: full width, left-justified icon + label + count */
          .topics-grid { flex-direction:column; }
          .topic-pill { width:100%!important; justify-content:space-between!important; border-radius:12px!important; }
          /* Podcast buttons */
          .podcast-btns { flex-direction:column!important; width:100%!important; align-items:stretch!important; }
          .podcast-btns .lp-btn { width:100%!important; justify-content:center!important; }
          /* Hero: reduce padding so content fits */
          #hero { height:100svh!important; min-height:560px!important; }
          .hero-content-pad { padding-top:70px!important; padding-bottom:16px!important; }
          .hero-stats { gap:20px!important; }
          .hero-bottom-bar { flex-direction:column!important; align-items:center!important; gap:8px!important; }
          /* Single buttons span full width */
          .tiktok-btn { width:100%!important; justify-content:center!important; }
        }
        @media (max-width:540px) {
          .footer-grid { grid-template-columns:1fr!important; }
          .about-pillars { grid-template-columns:1fr!important; }
          .mini-grid { grid-template-columns:1fr!important; }
        }
      `}</style>


      {/* ══ SIDE SECTION INDICATOR ════════════════════════════════════════════ */}
      <div className="side-nav" style={{ position: "fixed", left: 18, top: "50%", transform: "translateY(-50%)" }}>
        {SECTIONS.map(s => (
          <button key={s.id} className="side-dot" onClick={() => scrollTo(s.id)} title={s.label}>
            <div className="side-bar" style={{
              width: activeSection === s.id ? 22 : 7,
              background: activeSection === s.id
                ? "linear-gradient(90deg,#ff5533,#ff8844)"
                : `rgba(${theme==="dark"?"255,255,255":"0,0,0"},0.15)`,
            }} />
            <span className="side-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ══ MOBILE FULLSCREEN MENU ════════════════════════════════════════════ */}
      {menuOpen && (
        <div className="mob-menu" style={{ background: theme === "dark" ? "rgba(3,6,15,0.97)" : "rgba(245,242,235,0.97)" }}>
          <button className="mob-close" onClick={() => setMenuOpen(false)} style={{ color: c.textM }}>✕</button>
          <img src={lifeLogoLong} alt="4Life Mystery" style={{ height: 44, width: "auto", objectFit: "contain", marginBottom: 12 }} />
          {SECTIONS.map(({ id, label }) => (
            <button key={id} className={`mob-navlink${activeSection === id ? " active" : ""}`}
              onClick={() => scrollTo(id)}
              style={{ color: activeSection === id ? "#ff6633" : c.textM }}>
              {label}
            </button>
          ))}
          <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon">▶</a>
            <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon">♪</a>
            <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon">◎</a>
          </div>
        </div>
      )}

      {/* ══ NAV ═══════════════════════════════════════════════════════════════ */}
      <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}
        style={{ "--nav-bg": c.navBg }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          <a href="/" onClick={e => { e.preventDefault(); scrollTo("hero"); }} style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src={lifeLogoLong} alt="4Life Mystery" style={{ height: 40, width: "auto", objectFit: "contain", maxWidth: 170 }} />
          </a>

          <div className="hide-mobile" style={{ display: "flex", gap: 24, alignItems: "center" }}>
            {SECTIONS.filter(s => s.id !== "hero").map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className={`lp-navlink${activeSection === id ? " active" : ""}`}
                style={{ "--text-m": c.textM }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="YouTube" style={{ "--text-m": c.textM, "--soc-br": c.socBr }}>▶</a>
            <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="TikTok"  style={{ "--text-m": c.textM, "--soc-br": c.socBr }}>♪</a>
            <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="Spotify" style={{ "--text-m": c.textM, "--soc-br": c.socBr }}>◎</a>

            {/* Theme toggle */}
            <button onClick={toggleTheme} className="theme-toggle hide-mobile"
              style={{ background: c.togBg, borderColor: c.togBr, color: c.togText }}>
              {theme === "dark" ? "☀ LIGHT" : "☾ DARK"}
            </button>

            <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
              style={{ border: `1px solid ${c.togBr}`, color: c.text }}>☰</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO — full-screen nebula video banner ════════════════════════════ */}
      <section id="hero" style={{ position: "relative", height: "100vh", minHeight: 560, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Video background */}
        <video
          ref={heroVidRef}
          autoPlay muted loop playsInline
          onCanPlay={() => { if (heroVidRef.current) heroVidRef.current.playbackRate = 0.55; }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        >
          <source src={nebularVideo} type="video/mp4" />
        </video>

        {/* Gradient overlay — dark vignette */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(to bottom, rgba(3,6,15,0.38) 0%, rgba(3,6,15,0.55) 50%, rgba(3,6,15,0.92) 100%)" }} />

        {/* Main content — centred over video */}
        <div className="hero-content-pad" style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          padding: "90px 24px 24px", gap: 0 }}>

          {/* Headline */}
          <h1 className="syne anim-1" style={{ fontWeight: 800, fontSize: "clamp(24px,4vw,50px)", lineHeight: 1.1,
            letterSpacing: "-0.03em", marginBottom: 18, color: "#fff", textShadow: "0 2px 40px rgba(0,0,0,0.6)", maxWidth: 820 }}>
            The questions{" "}<span className="grad-fire">worth asking</span>{" "}live here.
          </h1>

          {/* Description */}
          <p className="anim-2" style={{ fontSize: "clamp(12px,1.4vw,14px)", color: "rgba(220,230,245,0.75)",
            lineHeight: 1.85, maxWidth: 560, marginBottom: 24, textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
            4Life Mystery is a space for real conversations about life — its meaning, its mysteries, and everything between.
            No algorithm. No noise. Just honest human thought.
          </p>

          {/* Stats */}
          <div className="hero-stats anim-3" style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
            {[
              [heroStats ? (heroStats.followers >= 1000 ? (heroStats.followers >= 1000000 ? (heroStats.followers/1000000).toFixed(1)+"M" : Math.round(heroStats.followers/1000)+"K") : heroStats.followers) : "10K+", "FOLLOWERS"],
              [heroStats ? (heroStats.episodes || "50+") : "50+", "EPISODES"],
              [heroStats ? (heroStats.comments >= 1000 ? Math.round(heroStats.comments/1000)+"K+" : heroStats.comments || "∞") : "∞", "COMMENTS"],
            ].map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div className="syne grad-fire" style={{ fontWeight: 800, fontSize: "clamp(20px,3vw,30px)", filter: heroStats ? "none" : "blur(6px)", transition: "filter 0.5s" }}>{n}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="anim-4 btn-group" style={{ justifyContent: "center", width: "100%", maxWidth: 500, marginBottom: 8 }}>
            <button onClick={() => scrollTo("content")} className="lp-btn lp-btn-fire" style={{ flex: 1 }}>EXPLORE CONTENT</button>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost"
              style={{ flex: 1, color: "#fff", borderColor: "rgba(255,255,255,0.22)", justifyContent: "center" }}>▶ WATCH ON YOUTUBE</a>
          </div>
        </div>

        {/* Bottom bar — privacy links + scroll nudge */}
        <div className="hero-bottom-bar" style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px 20px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>4LIFEMYSTERY.COM</span>
            <Link to="/privacy-policy" style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", textDecoration: "none", letterSpacing: "0.08em", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ff7755"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.42)"}>Privacy Policy</Link>
            <Link to="/terms-of-service" style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", textDecoration: "none", letterSpacing: "0.08em", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ff7755"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.42)"}>Terms of Service</Link>
          </div>
          <button onClick={() => scrollTo("about")} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.2em" }}>SCROLL</span>
            <div style={{ width: 24, height: 38, border: "1px solid rgba(255,80,30,0.4)", borderRadius: 12, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#ff5533", animation: "scrollPulse 1.8s ease-in-out infinite" }} />
            </div>
          </button>
        </div>
      </section>

      {/* ══ ABOUT ═════════════════════════════════════════════════════════════ */}
      <section id="about" style={{ padding: "100px 20px", background: c.bgAlt, borderTop: `1px solid ${c.secBr}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "stretch" }}>

            {/* Face image — fills the container completely */}
            <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", minHeight: 520,
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,80,30,0.15)",
              height: "100%" }}
              className="face-feature">
              {/* Poster image — always rendered, hidden once video plays */}
              <img src={faceImg} alt="4Life Mystery" className="face-sway face-poster"
                style={{ position: "absolute", inset: 0, width: "100%", height: "105%",
                  objectFit: "cover", objectPosition: "center top", zIndex: 1, transition: "opacity 0.8s ease" }} />
              {/* Video — invisible until canplay, then fades in over the image */}
              <video
                autoPlay muted loop playsInline
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "center top", zIndex: 2, opacity: 0, transition: "opacity 0.8s ease" }}
                onCanPlay={e => {
                  e.currentTarget.style.opacity = "1";
                  const poster = e.currentTarget.previousElementSibling;
                  if (poster) poster.style.opacity = "0";
                }}
              >
                <source src={faceVideo} type="video/mp4" />
              </video>
              {/* Gradient overlay with name badge */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                background: "linear-gradient(to top, rgba(3,6,15,0.92) 0%, transparent 55%)",
                padding: "32px 24px 24px" }}>
                <div className="syne" style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>4Life Mystery</div>
                <div style={{ fontSize: 10, color: "rgba(255,160,100,0.8)", letterSpacing: "0.14em" }}>CREATOR · THINKER · STORYTELLER</div>
              </div>
              {/* Fire glow corners */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 24, boxShadow: "inset 0 0 60px rgba(255,60,20,0.08)", pointerEvents: "none" }} />
            </div>

            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.18, marginBottom: 20, color: c.text }}>
                A community built on{" "}<span className="grad-fire">radical honesty.</span>
              </h2>
              <p style={{ color: c.textM, lineHeight: 1.92, fontSize: 13, marginBottom: 16 }}>
                We live in a world that moves fast and talks loud, but rarely stops to ask the questions that actually matter. 4Life Mystery is the pause — the space where you sit with the uncomfortable, the unexplained, and the deeply human.
              </p>
              <p style={{ color: c.textM, lineHeight: 1.92, fontSize: 13, marginBottom: 32 }}>
                Whether you're questioning your purpose, processing grief, navigating relationships, or just curious about what it means to be alive — you belong here.
              </p>

              <div className="about-pillars" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
                {[
                  { icon:"◈", title:"Depth",     desc:"No surface-level takes. Every piece goes deep." },
                  { icon:"◇", title:"Honesty",   desc:"Real experiences, real feelings — no performance." },
                  { icon:"◉", title:"Community", desc:"A growing space of thinkers and honest questioners." },
                  { icon:"◐", title:"Mystery",   desc:"Questions without easy answers — that's the point." },
                ].map(p => (
                  <div key={p.title} className="lp-card" style={{ padding: 18, "--card-bg": c.cardBg, "--card-br": c.cardBr, "--card-sh": c.cardSh }}>
                    <div style={{ fontSize: 20, color: "#ff5533", marginBottom: 10 }}>{p.icon}</div>
                    <div className="syne" style={{ fontWeight: 700, fontSize: 13, marginBottom: 7, color: c.text }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: c.textM, lineHeight: 1.7 }}>{p.desc}</div>
                  </div>
                ))}
              </div>

              <div className="btn-group">
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire" style={{ flex: 1, justifyContent: "center" }}>JOIN THE CONVERSATION</a>
                <button onClick={() => scrollTo("community")} className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>COMMUNITY →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CAROUSEL ══════════════════════════════════════════════════════════ */}
      <section id="content" style={{ padding: "100px 20px", borderTop: `1px solid ${c.secBr}`, position: "relative", overflow: "hidden" }}>
        {/* Parallax photo background — face */}
        <div ref={contentBgRef} style={{
          position: "absolute", inset: "-30% 0",
          backgroundImage: `url(${faceImg})`,
          backgroundSize: "cover", backgroundPosition: "center 35%",
          opacity: theme === "dark" ? 0.10 : 0.05,
          willChange: "transform", transform: "scale(1.3)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          background: theme === "dark"
            ? "linear-gradient(160deg,rgba(3,6,15,0.94) 0%,rgba(5,2,10,0.88) 50%,rgba(3,6,15,0.94) 100%)"
            : "linear-gradient(160deg,rgba(245,242,235,0.96) 0%,rgba(245,242,235,0.92) 50%,rgba(245,242,235,0.96) 100%)" }} />
        <div style={{ maxWidth: 1180, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <span className="section-tag">FEATURED CONTENT</span>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,38px)", color: c.text }}>
                Latest from <span className="grad-fire">4Life Mystery</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["←",goPrev],["→",goNext]].map(([lbl,fn]) => (
                <button key={lbl} onClick={fn} style={{ width:42,height:42,borderRadius:10,border:`1px solid ${c.cardBr}`,background:c.cardBg,color:c.textM,cursor:"pointer",fontSize:18,transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:c.cardSh }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(255,80,30,0.45)"; e.currentTarget.style.color="#ff6633"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=c.cardBr; e.currentTarget.style.color=c.textM; }}
                >{lbl}</button>
              ))}
            </div>
          </div>

          <div className="carousel-main" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24 }}>
            <div key={`slide-${carouselIdx}`} className={slideDir === "right" ? "carousel-slide" : "carousel-slide-icon"}
              style={{ background:c.cardBg,border:`1px solid ${item.color}28`,borderRadius:18,padding:"30px 28px",display:"flex",flexDirection:"column",boxShadow:c.cardSh }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
                <span style={{ fontSize:9,padding:"5px 12px",borderRadius:100,background:`${item.color}14`,color:item.color,border:`1px solid ${item.color}28`,letterSpacing:"0.12em" }}>{item.platform}</span>
                <span style={{ fontSize:9,color:c.textD,letterSpacing:"0.1em" }}>{item.tag}</span>
              </div>
              <h3 className="syne" style={{ fontWeight:800,fontSize:"clamp(20px,2.5vw,27px)",lineHeight:1.28,marginBottom:16,color:c.text }}>{item.title}</h3>
              <p style={{ color:c.textM,lineHeight:1.84,fontSize:13,flex:1,marginBottom:28 }}>{item.excerpt}</p>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire feat-cta-btn" style={{ alignSelf:"flex-start" }}>
                {item.icon} WATCH / LISTEN NOW
              </a>
            </div>
            <div key={`icon-${carouselIdx}`} className={slideDir === "right" ? "carousel-slide-icon" : "carousel-slide"}
              style={{ background:`linear-gradient(145deg,${theme==="dark"?"rgba(0,0,0,0.5)":c.cardBg},${item.color}0c)`,border:`1px solid ${item.color}1a`,borderRadius:18,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,minHeight:240,padding:24,boxShadow:c.cardSh }}>
              <div style={{ fontSize:60,color:item.color,opacity:0.6,transition:"transform 0.3s,opacity 0.3s" }}
                onMouseEnter={e => { e.currentTarget.style.transform="scale(1.18)"; e.currentTarget.style.opacity="0.9"; }}
                onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.opacity="0.6"; }}
              >{item.icon}</div>
              <div style={{ fontSize:10,color:c.textD,letterSpacing:"0.18em" }}>AVAILABLE ON {item.platform}</div>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ fontSize:10,padding:"10px 20px" }}>OPEN →</a>
            </div>
          </div>

          <div style={{ display:"flex",justifyContent:"center",gap:7,marginBottom:24 }}>
            {CAROUSEL.map((_,i) => (
              <button key={i} className="c-dot" onClick={() => goTo(i)}
                style={{ width:i===carouselIdx?26:8,background:i===carouselIdx?"#ff5533":c.cardBr }} />
            ))}
          </div>

          <div className="mini-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
            {CAROUSEL.map((cc,i) => (
              <div key={cc.id} onClick={() => goTo(i)} className="lp-card"
                style={{ padding:"14px 16px",cursor:"pointer","--card-bg":i===carouselIdx?`rgba(255,80,30,0.06)`:c.cardBg,"--card-br":i===carouselIdx?"#ff553440":c.cardBr,"--card-sh":c.cardSh }}>
                <div style={{ fontSize:9,color:cc.color,letterSpacing:"0.12em",marginBottom:7 }}>{cc.platform}</div>
                <div className="syne" style={{ fontSize:12,fontWeight:700,lineHeight:1.45,color:c.text }}>{cc.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TIKTOK STRIP ══════════════════════════════════════════════════════ */}
      <section style={{ padding:"56px 20px",background:"rgba(0,242,234,0.013)",borderTop:"1px solid rgba(0,242,234,0.06)",borderBottom:"1px solid rgba(0,242,234,0.06)" }}>
        <div style={{ maxWidth:1180,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:24 }}>
          <div style={{ display:"flex",alignItems:"center",gap:18 }}>
            <div style={{ width:52,height:52,borderRadius:14,background:"rgba(0,242,234,0.08)",border:"1px solid rgba(0,242,234,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#00f2ea",flexShrink:0,transition:"transform 0.3s" }}
              onMouseEnter={e => e.currentTarget.style.transform="scale(1.1) rotate(5deg)"}
              onMouseLeave={e => e.currentTarget.style.transform="scale(1) rotate(0deg)"}
            >♪</div>
            <div>
              <div className="syne" style={{ fontWeight:700,fontSize:"clamp(15px,2.5vw,18px)",marginBottom:4,color:c.text }}>@lifemystery183284 on TikTok</div>
              <div style={{ fontSize:12,color:c.textM }}>60-second truths. Bite-sized thoughts that hit hard.</div>
            </div>
          </div>
          <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost tiktok-btn" style={{ borderColor:"rgba(0,242,234,0.3)",color:"#00f2ea" }}>♪ FOLLOW ON TIKTOK</a>
        </div>
      </section>

      {/* ══ YOUTUBE VIDEOS ════════════════════════════════════════════════════ */}
      <section id="videos" style={{ padding:"50px 20px 110px", borderTop:`1px solid ${c.secBr}`, position:"relative", overflow:"hidden" }}>
        {/* Parallax background — freedom.jpg */}
        <div ref={videoBgRef} style={{
          position:"absolute", inset:"-35% 0",
          backgroundImage:`url(${freedomImg})`,
          backgroundSize:"cover", backgroundPosition:"center 45%",
          opacity: 1,
          willChange:"transform", transform:"scale(1.35)",
          pointerEvents:"none",
        }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background: theme === "dark"
            ? "linear-gradient(160deg,rgba(3,6,15,0.93) 0%,rgba(3,6,15,0.76) 50%,rgba(3,6,15,0.93) 100%)"
            : "linear-gradient(160deg,rgba(245,242,235,0.96) 0%,rgba(245,242,235,0.88) 50%,rgba(245,242,235,0.96) 100%)" }} />

        <div style={{ maxWidth:1220, margin:"0 auto", position:"relative", zIndex:1 }}>
          {/* Header — centered */}
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <span className="section-tag" style={{ color:"#ff0000" }}>YOUTUBE</span>
            <h2 className="syne" style={{ fontWeight:800, fontSize:"clamp(26px,4vw,42px)", color:c.text, marginBottom:10 }}>
              Latest <span className="grad-fire">videos</span>
            </h2>
            <p style={{ fontSize:13, color:c.textM, letterSpacing:"0.04em", marginBottom:22 }}>Watch on YouTube · New content weekly</p>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer"
              className="lp-btn lp-btn-ghost" style={{ fontSize:11, borderColor:"rgba(200,30,30,0.35)", color:"#ff5533", display:"inline-flex" }}>
              ▶ VIEW CHANNEL →
            </a>
          </div>

          {/* Netflix Hero */}
          {ytLoading ? (
            <div className="yt-skeleton" style={{ width:"100%", height:"clamp(280px,42vw,560px)", borderRadius:20 }} />
          ) : (() => {
            const heroVideos = ytVideos.slice(0, 3);
            if (heroVideos.length === 0) return null;
            const v = heroVideos[ytIdx % heroVideos.length];
            const total = heroVideos.length;
            return (
              <div onMouseEnter={ytPause} onMouseLeave={ytResume}>
                <div className="yt-hero" onClick={() => setModalVideo(v)}>
                  {/* Background */}
                  <div className="yt-hero-bg" style={{ backgroundImage: v.thumbnail ? `url(${v.thumbnail})` : "none" }} />
                  {/* Left-heavy dark overlay */}
                  <div className="yt-hero-overlay" />
                  {/* Text content */}
                  <div className="yt-hero-content">
                    <div className="yt-hero-text">
                      <div className="yt-hero-badge">▶ YOUTUBE</div>
                      <div className="yt-hero-title">{v.title}</div>
                      <div className="yt-hero-meta">
                        <span>▶ {Number(v.views||0).toLocaleString()} views</span>
                        <span>♥ {Number(v.likes||0).toLocaleString()}</span>
                        {v.duration && <span>⏱ {v.duration}</span>}
                      </div>
                      <button className="yt-hero-cta" onClick={e => { e.stopPropagation(); setModalVideo(v); }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="white" style={{ marginRight:2 }}><path d="M8 5v14l11-7z"/></svg>
                        WATCH NOW
                      </button>
                    </div>
                  </div>
                  {/* Centered play on hover */}
                  <div className="yt-hero-play">
                    <div className="yt-hero-play-btn" onClick={e => { e.stopPropagation(); setModalVideo(v); }}>
                      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  {/* Side arrows */}
                  {total > 1 && <>
                    <button className="yt-hero-side-arr left" onClick={e => { e.stopPropagation(); ytPrev(); }}>‹</button>
                    <button className="yt-hero-side-arr right" onClick={e => { e.stopPropagation(); ytNext(); }}>›</button>
                  </>}
                  {/* Duration badge */}
                  {v.duration && <div className="yt-badge-dur" style={{ position:"absolute", top:14, right:14 }}>{v.duration}</div>}
                </div>
                {/* Dots */}
                {total > 1 && (
                  <div className="yt-hero-dots">
                    {heroVideos.map((_,i) => (
                      <button key={i} className="yt-hero-dot"
                        onClick={() => { ytPause(); setYtIdx(i); }}
                        style={{
                          background: i === ytIdx ? "#ff5533" : "rgba(255,255,255,0.2)",
                          width: i === ytIdx ? 24 : 8,
                          borderRadius: i === ytIdx ? 4 : "50%",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Video modal */}
          {modalVideo && (
            <div className="yt-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModalVideo(null); }}>
              <div className="yt-modal-box">
                <div className="yt-modal-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${modalVideo.id}?autoplay=1&rel=0&modestbranding=1`}
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                    title={modalVideo.title}
                  />
                </div>
                <div className="yt-modal-bar">
                  <div className="yt-modal-title">{modalVideo.title}</div>
                  <div className="yt-modal-actions">
                    <a href={`https://www.youtube.com/watch?v=${modalVideo.id}`} target="_blank" rel="noopener noreferrer"
                      className="yt-modal-btn yt" style={{ textDecoration:"none" }}>
                      ↗ YouTube
                    </a>
                    <button className="yt-modal-btn close" onClick={() => setModalVideo(null)}>✕ Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══ PODCAST ═══════════════════════════════════════════════════════════ */}
      <section id="podcast" style={{ padding:"100px 20px",borderTop:`1px solid ${c.secBr}` }}>
        <div style={{ maxWidth:1180,margin:"0 auto" }}>
          <span className="section-tag" style={{ color:"#1db954" }}>PODCAST</span>
          <div className="podcast-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center" }}>
            <div>
              <h2 className="syne" style={{ fontWeight:800,fontSize:"clamp(28px,4vw,44px)",lineHeight:1.18,marginBottom:20,color:c.text }}>
                Listen on <span style={{ color:"#1db954" }}>Spotify.</span>
              </h2>
              <p style={{ color:c.textM,lineHeight:1.92,fontSize:13,marginBottom:16 }}>
                The 4Life Mystery podcast goes even deeper. Long-form conversations — no time limits, no edits, no filter.
              </p>
              <p style={{ color:c.textM,lineHeight:1.92,fontSize:13,marginBottom:32 }}>
                From the mystery of consciousness to navigating grief, love, and the strangeness of being human. New episodes every week.
              </p>
              <div className="btn-group podcast-btns">
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-green" style={{ flex: 1, justifyContent: "center" }}>◎ LISTEN NOW</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>ALL EPISODES →</a>
              </div>
            </div>
            <div style={{ borderRadius:16,overflow:"hidden",border:"1px solid rgba(29,185,84,0.25)",boxShadow:"0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(29,185,84,0.08)",background:"rgba(3,6,15,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)" }}>
              <iframe
                src={`https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`}
                width="100%" height="352"
                style={{ border:"none",display:"block" }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy" title="4Life Mystery Podcast"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOPICS ════════════════════════════════════════════════════════════ */}
      <section id="topics" style={{ padding:"100px 20px", position:"relative", overflow:"hidden", borderTop:`1px solid ${c.secBr}`, borderBottom:`1px solid ${c.secBr}` }}>
        {/* Parallax photo background — jajja2 */}
        <div ref={topicsBgRef} style={{
          position:"absolute", inset:"-35% 0",
          backgroundImage:`url(${jajja2})`,
          backgroundSize:"cover", backgroundPosition:"center 30%",
          opacity: 1,
          willChange:"transform", transform:"scale(1.35)",
          pointerEvents:"none",
        }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background: theme === "dark"
            ? "linear-gradient(160deg,rgba(3,6,15,0.94) 0%,rgba(3,6,15,0.78) 50%,rgba(3,6,15,0.94) 100%)"
            : "linear-gradient(160deg,rgba(245,242,235,0.96) 0%,rgba(245,242,235,0.88) 50%,rgba(245,242,235,0.96) 100%)" }} />
        <div style={{ maxWidth:1180, margin:"0 auto", position:"relative", zIndex:1 }}>
          <span className="section-tag">EXPLORE TOPICS</span>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16,flexWrap:"wrap",gap:16 }}>
            <h2 className="syne" style={{ fontWeight:800,fontSize:"clamp(26px,4vw,38px)",color:c.text }}>
              What moves <span className="grad-fire">you?</span>
            </h2>
            <p style={{ color:c.textM,fontSize:12,lineHeight:1.7,maxWidth:340 }}>Every topic is a doorway. Pick one that resonates.</p>
          </div>
          <div className="topics-grid">
            {TOPICS.map(t2 => (
              <a key={t2.name} href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="topic-pill"
                style={{ background:c.cardBg,border:`1px solid ${c.cardBr}`,color:c.textM,boxShadow:c.cardSh }}>
                <span style={{ color:"#ff5533" }}>{t2.icon}</span>
                <span style={{ flex: 1 }}>{t2.name}</span>
                <span style={{ fontSize:9,color:c.textD,flexShrink:0 }}>{t2.count}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MATRIX VIDEO BREAK ════════════════════════════════════════════════ */}
      <div style={{ position: "relative", width: "100%", height: "min(420px,55vw)", overflow: "hidden" }}>
        <video autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}>
          <source src={metrixVideo} type="video/mp4" />
        </video>
        {/* vignette + tinted overlay */}
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(3,6,15,0.65) 0%, rgba(3,6,15,0.35) 50%, rgba(3,6,15,0.72) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: "0 24px" }}>
          <div className="syne" style={{ fontWeight: 800, fontSize: "clamp(20px,4vw,42px)", color: "#fff",
            letterSpacing: "-0.02em", textShadow: "0 2px 30px rgba(0,0,0,0.7)" }}>
            The answers are{" "}<span className="grad-fire">out there.</span>
          </div>
          <p style={{ fontSize: "clamp(12px,1.4vw,15px)", color: "rgba(200,215,235,0.7)", maxWidth: 560, lineHeight: 1.75 }}>
            Every mystery starts with a question. Join the community.
          </p>
          <button onClick={() => scrollTo("community")} className="lp-btn lp-btn-fire" style={{ marginTop: 8 }}>
            JOIN THE COMMUNITY
          </button>
        </div>
      </div>

      {/* ══ COMMUNITY ═════════════════════════════════════════════════════════ */}
      <section id="community" style={{ padding:"100px 20px 120px",position:"relative",overflow:"hidden" }}>
        {/* Parallax photo background — jajja2 */}
        <div ref={communityBgRef} style={{
          position:"absolute", inset:"-35% 0",
          backgroundImage:`url(${jajja2})`,
          backgroundSize:"cover", backgroundPosition:"center 20%",
          opacity: 1,
          willChange:"transform", transform:"scale(1.35)",
          pointerEvents:"none",
        }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background: theme === "dark"
            ? "linear-gradient(160deg,rgba(3,6,15,0.92) 0%,rgba(5,2,10,0.80) 50%,rgba(3,6,15,0.92) 100%)"
            : "linear-gradient(160deg,rgba(245,242,235,0.95) 0%,rgba(245,242,235,0.87) 50%,rgba(245,242,235,0.95) 100%)" }} />

        <div style={{ maxWidth:1180,margin:"0 auto",position:"relative",zIndex:1 }}>
          <span className="section-tag">COMMUNITY</span>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40,flexWrap:"wrap",gap:16 }}>
            <div>
              <h2 className="syne" style={{ fontWeight:800,fontSize:"clamp(26px,4vw,42px)",lineHeight:1.15,color:c.text }}>
                The conversation is just{" "}<span className="grad-fire">getting started.</span>
              </h2>
              <p style={{ color:c.textM,fontSize:13,lineHeight:1.84,maxWidth:560,marginTop:14 }}>
                Share your thoughts, ask questions, or tell us what you want explored next.
              </p>
            </div>
            <div className="btn-group" style={{ marginTop: 4 }}>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire" style={{ flex: 1, justifyContent: "center" }}>▶ YOUTUBE</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center", borderColor:"rgba(0,242,234,0.3)",color:"#00f2ea" }}>♪ TIKTOK</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center", borderColor:"rgba(29,185,84,0.3)",color:"#1db954" }}>◎ SPOTIFY</a>
            </div>
          </div>
          <BlogSection c={c} theme={theme} />
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop:`1px solid ${c.secBr}`,padding:"60px 20px 40px",background:c.footBg }}>
        <div style={{ maxWidth:1180,margin:"0 auto" }}>
          <div className="footer-grid" style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:36,marginBottom:48 }}>

            <div>
              <img src={lifeLogoLong} alt="4Life Mystery" style={{ height:40,width:"auto",objectFit:"contain",marginBottom:16 }} />
              <p style={{ fontSize:12,color:c.ftLink,lineHeight:1.84,maxWidth:250,marginBottom:20 }}>
                A space for real conversations about life — its meaning, its mysteries, and everything in between.
              </p>
              <div className="soc-icon-row" style={{ display:"flex",gap:10 }}>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon" title="YouTube" style={{ "--text-m":c.ftLink,"--soc-br":c.socBr }}>▶</a>
                <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon" title="TikTok"  style={{ "--text-m":c.ftLink,"--soc-br":c.socBr }}>♪</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon" title="Spotify" style={{ "--text-m":c.ftLink,"--soc-br":c.socBr }}>◎</a>
              </div>
            </div>

            <div>
              <div style={{ fontSize:10,letterSpacing:"0.18em",color:c.textD,marginBottom:18 }}>EXPLORE</div>
              {SECTIONS.map(({ id, label }) => (
                <button key={id} onClick={() => scrollTo(id)} className="ft-link"
                  style={{ color:c.ftLink }}>
                  {label === "HOME" ? "Home" : label.charAt(0)+label.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize:10,letterSpacing:"0.18em",color:c.textD,marginBottom:18 }}>WATCH & LISTEN</div>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="ft-link" style={{ color:c.ftLink }}>▶ YouTube</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="ft-link" style={{ color:c.ftLink }}>♪ TikTok</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="ft-link" style={{ color:c.ftLink }}>◎ Spotify Podcast</a>
            </div>

            <div>
              <div style={{ fontSize:10,letterSpacing:"0.18em",color:c.textD,marginBottom:18 }}>LEGAL</div>
              <Link to="/privacy-policy"   className="ft-link" style={{ color:c.ftLink }}>Privacy Policy</Link>
              <Link to="/terms-of-service" className="ft-link" style={{ color:c.ftLink }}>Terms of Service</Link>
              <Link to="/login"            className="ft-link" style={{ color:c.textD2,marginTop:16,display:"block" }}>Studio</Link>
            </div>
          </div>

          <div className="footer-bottom-bar" style={{ borderTop:`1px solid ${c.secBr}`,paddingTop:22,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
            <div style={{ fontSize:11,color:c.textD }}>© 2026 4Life Mystery · 4lifemystery.com · All rights reserved.</div>
            <div style={{ display:"flex",gap:20,alignItems:"center" }}>
              <Link to="/privacy-policy"   style={{ fontSize:10,color:c.textD,textDecoration:"none" }}>Privacy</Link>
              <Link to="/terms-of-service" style={{ fontSize:10,color:c.textD,textDecoration:"none" }}>Terms</Link>
              <button onClick={toggleTheme} className="theme-toggle"
                style={{ background:c.togBg,borderColor:c.togBr,color:c.togText }}>
                {theme === "dark" ? "☀ LIGHT" : "☾ DARK"}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <button
        className={`back-to-top${showBackTop ? "" : " hidden"}`}
        onClick={() => wrapperRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        title="Back to top"
        aria-label="Back to top"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
      </button>
    </div>
  );
}
