import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  getBlogComments,
  submitBlogComment,
  replyBlogComment,
  toggleBlogLike,
} from "../api/client";

// ── Themes ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#060810", bgAlt: "#0a0d14", bgCard: "rgba(255,255,255,0.032)",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  text: "#e2e8f0", textMid: "#94a3b8", textDim: "#475569", prose: "#cbd5e1",
  navBg: "rgba(6,8,16,0.9)", accent: "#4f8ef0", accentGreen: "#34d399",
  accentPurple: "#a78bfa", accentYellow: "#fbbf24", footBg: "rgba(0,0,0,0.4)",
  tag: "rgba(167,139,250,0.1)", tagBorder: "rgba(167,139,250,0.25)", tagText: "#a78bfa",
  inputBg: "#0a0d14", sidebarBg: "rgba(255,255,255,0.022)",
};
const LIGHT = {
  bg: "#f8fafc", bgAlt: "#f1f5f9", bgCard: "#ffffff",
  border: "rgba(0,0,0,0.08)", borderHover: "rgba(0,0,0,0.2)",
  text: "#0f172a", textMid: "#374151", textDim: "#6b7280", prose: "#1e293b",
  navBg: "rgba(248,250,252,0.92)", accent: "#2563eb", accentGreen: "#059669",
  accentPurple: "#7c3aed", accentYellow: "#d97706", footBg: "rgba(0,0,0,0.04)",
  tag: "rgba(124,58,237,0.07)", tagBorder: "rgba(124,58,237,0.2)", tagText: "#7c3aed",
  inputBg: "#f8fafc", sidebarBg: "rgba(0,0,0,0.02)",
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function fmtDateShort(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function readTime(body) {
  if (!body) return null;
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

// ── Fingerprint ───────────────────────────────────────────────────────────────
function getFingerprint() {
  let fp = localStorage.getItem("blog_fp");
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("blog_fp", fp);
  }
  return fp;
}

// ── Comment card ──────────────────────────────────────────────────────────────
function CommentCard({ c, T, fp, onLike, depth = 0 }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyName, setReplyName] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");

  const submitReply = async () => {
    if (!replyName.trim() || !replyContent.trim()) { setReplyMsg("Name and message required."); return; }
    setReplySubmitting(true); setReplyMsg("");
    try {
      await replyBlogComment(c.id, { name: replyName, content: replyContent, fingerprint: fp });
      setReplyMsg("Reply submitted — pending moderation.");
      setReplyName(""); setReplyContent(""); setReplyOpen(false);
    } catch (e) {
      setReplyMsg(e?.response?.data?.detail || "Failed to submit reply.");
    } finally { setReplySubmitting(false); }
  };

  const inp = (extra = {}) => ({
    background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 7,
    color: T.text, padding: "8px 12px", fontSize: 12, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box", ...extra,
  });

  return (
    <div style={{ marginLeft: depth > 0 ? 24 : 0, borderLeft: depth > 0 ? `2px solid ${T.border}` : "none", paddingLeft: depth > 0 ? 16 : 0 }}>
      <div style={{ background: c.is_admin_reply ? (T.bg === "#060810" ? "rgba(79,142,240,0.06)" : "rgba(37,99,235,0.04)") : T.bgCard, border: `1px solid ${c.is_admin_reply ? T.accent + "30" : T.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `hsl(${(c.name?.charCodeAt(0) || 65) * 7 % 360},50%,${T.bg === "#060810" ? "30%" : "75%"})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.text, flexShrink: 0 }}>
            {(c.name || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
              {c.name}
              {c.is_admin_reply && <span style={{ fontSize: 8, background: T.accent, color: "#fff", padding: "1px 7px", borderRadius: 20, letterSpacing: "0.1em", fontWeight: 700 }}>AUTHOR</span>}
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{fmtDateShort(c.created_at)}</div>
          </div>
          <button
            onClick={() => onLike(c.id)}
            style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 20, color: T.textDim, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}
          >
            ♥ {c.likes_count || 0}
          </button>
        </div>
        <p style={{ fontSize: 13, color: T.prose, lineHeight: 1.75, margin: 0, whiteSpace: "pre-line" }}>{c.content}</p>
        {depth < 2 && (
          <button
            onClick={() => setReplyOpen(r => !r)}
            style={{ marginTop: 10, background: "transparent", border: "none", color: T.accent, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, letterSpacing: "0.06em" }}
          >
            {replyOpen ? "↩ Cancel" : "↩ Reply"}
          </button>
        )}
        {replyOpen && (
          <div style={{ marginTop: 12, padding: 14, background: T.sidebarBg, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <input placeholder="Your name *" value={replyName} onChange={e => setReplyName(e.target.value)} style={{ ...inp(), marginBottom: 8 }} />
            <textarea placeholder="Your reply..." value={replyContent} onChange={e => setReplyContent(e.target.value)} rows={3} style={{ ...inp({ resize: "vertical" }) }} />
            {replyMsg && <div style={{ fontSize: 11, color: replyMsg.includes("submitted") ? T.accentGreen : "#ef4444", marginTop: 6 }}>{replyMsg}</div>}
            <button onClick={submitReply} disabled={replySubmitting} className="comment-reply-submit-btn" style={{ marginTop: 8, padding: "7px 18px", borderRadius: 7, background: T.accent, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: replySubmitting ? "default" : "pointer", opacity: replySubmitting ? 0.7 : 1 }}>
              {replySubmitting ? "POSTING..." : "POST REPLY"}
            </button>
          </div>
        )}
      </div>
      {/* Nested replies */}
      {(c.replies || []).map(r => (
        <CommentCard key={r.id} c={r} T={T} fp={fp} onLike={onLike} depth={depth + 1} />
      ))}
    </div>
  );
}

// ── Comments section ──────────────────────────────────────────────────────────
function CommentsSection({ T, postId }) {
  const fp = getFingerprint();
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  const load = useCallback(async (p = 1, append = false) => {
    try {
      setLoading(p === 1 && !append);
      const data = await getBlogComments(p, fp, postId);
      const items = Array.isArray(data.comments) ? data.comments : (Array.isArray(data) ? data : []);
      setComments(prev => append ? [...prev, ...items] : items);
      setHasMore(data.has_more || false);
      setPage(p);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [fp, postId]);

  useEffect(() => { load(1); }, [load]);

  const submit = async () => {
    if (!form.name.trim() || !form.content.trim()) { setSubmitErr("Name and message are required."); return; }
    setSubmitting(true); setSubmitErr("");
    try {
      await submitBlogComment({ ...form, fingerprint: fp, blog_post_id: postId });
      setSubmitMsg("Comment submitted! It will appear after review — usually within 24h.");
      setForm({ name: "", email: "", content: "" });
    } catch (e) {
      setSubmitErr(e?.response?.data?.detail || "Failed to submit. Please try again.");
    } finally { setSubmitting(false); }
  };

  const handleLike = async (id) => {
    try { await toggleBlogLike(id, fp); load(1); } catch { /* silent */ }
  };

  const inp = (extra = {}) => ({
    background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text, padding: "10px 13px", fontSize: 13, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box",
    transition: "border-color 0.15s", ...extra,
  });

  return (
    <section style={{ borderTop: `1px solid ${T.border}`, paddingTop: 48, marginTop: 56 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
        Discussion
      </h2>
      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 28 }}>
        Comments are moderated. Be kind and constructive.
      </div>

      {/* Submit form */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 24px 20px", marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, letterSpacing: "0.08em", marginBottom: 16 }}>LEAVE A COMMENT</div>
        <div className="comment-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <input placeholder="Your name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp()} />
          <input placeholder="Email (optional, private)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp()} />
        </div>
        <textarea
          placeholder="Share your thoughts..."
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          rows={5}
          style={{ ...inp({ resize: "vertical" }) }}
        />
        {submitErr && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>✕ {submitErr}</div>}
        {submitMsg && <div style={{ fontSize: 11, color: T.accentGreen, marginTop: 8, lineHeight: 1.5 }}>✓ {submitMsg}</div>}
        <div className="comment-submit-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 10, color: T.textDim }}>All comments are reviewed before publishing.</span>
          <button
            onClick={submit}
            disabled={submitting}
            style={{ padding: "10px 24px", borderRadius: 8, background: T.accent, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.06em", opacity: submitting ? 0.75 : 1 }}
          >
            {submitting ? "POSTING..." : "POST COMMENT"}
          </button>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div style={{ color: T.textDim, fontSize: 12, padding: "24px 0" }}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div style={{ color: T.textDim, fontSize: 13, padding: "32px 0", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          No comments yet — be the first to start the conversation!
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, letterSpacing: "0.06em" }}>
            {comments.length} COMMENT{comments.length !== 1 ? "S" : ""}
          </div>
          {comments.map(c => (
            <CommentCard key={c.id} c={c} T={T} fp={fp} onLike={handleLike} />
          ))}
          {hasMore && (
            <button
              onClick={() => load(page + 1, true)}
              className="comment-load-more-btn"
              style={{ marginTop: 8, padding: "9px 24px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.accent, fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em" }}
            >
              LOAD MORE COMMENTS
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Main BlogPost page ────────────────────────────────────────────────────────
export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const articleRef = useRef(null);

  const [isDark, setIsDark] = useState(() => localStorage.getItem("blog_theme") !== "light");
  const T = isDark ? DARK : LIGHT;
  const toggleTheme = () => {
    setIsDark(d => { const n = !d; localStorage.setItem("blog_theme", n ? "dark" : "light"); return n; });
  };

  const [cookieConsent, setCookieConsent] = useState(() => localStorage.getItem("blog_cookie_consent"));
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (res.status === 404) { setError("Post not found"); return; }
      if (!res.ok) throw new Error("Failed to load post");
      const data = await res.json();
      setPost(data);
      fetch(`/api/blog/posts/${slug}/view`, { method: "POST" }).catch(() => {});
    } catch (e) { setError(e.message || "Failed to load post"); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  // SEO
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | 4Life Mystery`;
    const sm = (name, content, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = post.excerpt || post.body?.replace(/<[^>]+>/g, "").slice(0, 160) || "";
    sm("description", desc); sm("robots", "index, follow");
    sm("og:title", post.title, true); sm("og:description", desc, true);
    sm("og:type", "article", true); sm("og:url", `https://4lifemystery.com/blog/${post.slug}`, true);
    if (post.cover_image_url) sm("og:image", post.cover_image_url, true);
    sm("twitter:card", "summary_large_image"); sm("twitter:title", post.title); sm("twitter:description", desc);
    let ld = document.getElementById("blogpost-jsonld");
    if (!ld) { ld = document.createElement("script"); ld.id = "blogpost-jsonld"; ld.type = "application/ld+json"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", "headline": post.title, "description": desc, "url": `https://4lifemystery.com/blog/${post.slug}`, "datePublished": post.published_at || post.created_at, "dateModified": post.updated_at || post.created_at, "image": post.cover_image_url || undefined, "author": { "@type": "Organization", "name": "4Life Mystery" } });
  }, [post]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => { setCopyMsg("Copied!"); setTimeout(() => setCopyMsg(""), 2200); });
  };
  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post?.title || "")}&url=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer");
  };

  const tags = post ? (Array.isArray(post.tags) ? post.tags : (typeof post.tags === "string" ? post.tags.split(",").map(t => t.trim()).filter(Boolean) : [])) : [];
  const rt = post ? readTime(post.body) : null;

  // ── Shared sub-styles
  const tagPill = { display: "inline-block", padding: "3px 11px", borderRadius: 20, fontSize: 9, letterSpacing: "0.1em", fontWeight: 700, background: T.tag, border: `1px solid ${T.tagBorder}`, color: T.tagText, marginRight: 5, marginBottom: 4 };
  const shareBtn = { padding: "7px 16px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textMid, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'JetBrains Mono','Fira Mono','Courier New',monospace", transition: "background 0.2s,color 0.2s", overflowY: "auto", maxHeight: "98vh" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: T.navBg, backdropFilter: "blur(14px)", borderBottom: `1px solid ${T.border}`, padding: "0 clamp(16px,4vw,48px)", display: "flex", alignItems: "center", height: 58, gap: 12 }}>
        <Link to="/" style={{ textDecoration: "none", fontWeight: 800, fontSize: 14, letterSpacing: "0.06em", color: T.text, flexShrink: 0 }}>
          <span style={{ background: "linear-gradient(135deg,#34d399,#4f8ef0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>4LIFE</span>
          <span style={{ color: T.text }}>MYSTERY</span>
        </Link>
        <div style={{ width: 1, height: 18, background: T.border, flexShrink: 0 }} />
        <Link to="/blog" style={{ textDecoration: "none", fontSize: 10, color: T.textDim, letterSpacing: "0.1em", padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 5, transition: "color 0.15s", flexShrink: 0 }}>← Blog</Link>
        <div style={{ flex: 1 }} />
        {post && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={{ ...shareBtn, color: "#1d9bf0", borderColor: "rgba(29,155,240,0.3)" }} onClick={handleShareTwitter}>𝕏</button>
            <button style={{ ...shareBtn, color: copyMsg ? T.accentGreen : T.textMid, borderColor: copyMsg ? `${T.accentGreen}40` : T.border }} onClick={handleCopy}>{copyMsg || "⎘"}</button>
          </div>
        )}
        <button onClick={toggleTheme} style={{ padding: "5px 11px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textMid, fontSize: 14, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>
          {isDark ? "☀" : "◑"}
        </button>
      </nav>

      {loading ? (
        <div style={{ maxWidth: 860, margin: "100px auto", textAlign: "center", color: T.textDim, fontSize: 12, letterSpacing: "0.12em" }}>
          <div style={{ fontSize: 32, marginBottom: 14, opacity: 0.4 }}>◎</div>LOADING…
        </div>
      ) : error ? (
        <div style={{ maxWidth: 860, margin: "100px auto", textAlign: "center", padding: "0 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>◎</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.textMid, marginBottom: 8 }}>{error.toUpperCase()}</div>
          <Link to="/blog" style={{ color: T.accent, textDecoration: "none", fontSize: 12 }}>← Back to blog</Link>
        </div>
      ) : post ? (
        <>
          {/* ── Cover Image ─────────────────────────────────────────────── */}
          {post.cover_image_url && (
            <div style={{ width: "100%", height: "clamp(220px,30vw,420px)", overflow: "hidden", position: "relative", borderBottom: `1px solid ${T.border}` }}>
              <img
                src={post.cover_image_url}
                alt={post.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { e.currentTarget.parentElement.style.display = "none"; }}
              />
              <div style={{ position: "absolute", inset: 0, background: isDark ? "linear-gradient(to bottom,transparent 40%,rgba(6,8,16,0.7) 100%)" : "linear-gradient(to bottom,transparent 60%,rgba(248,250,252,0.5) 100%)", pointerEvents: "none" }} />
            </div>
          )}

          {/* ── Main layout: article + sidebar ──────────────────────────── */}
          <div className="blog-post-layout" style={{ maxWidth: 1300, margin: "0 auto", padding: "48px clamp(16px,3vw,48px) 80px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 48, alignItems: "start" }}>

            {/* ── Article ──────────────────────────────────────────────── */}
            <article ref={articleRef}>
              {/* Tags */}
              {tags.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {tags.map(tag => <span key={tag} style={tagPill}>{tag.toUpperCase()}</span>)}
                </div>
              )}

              {/* Meta */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10, fontSize: 11, color: T.textDim, letterSpacing: "0.04em" }}>
                <span>{fmtDate(post.published_at || post.created_at)}</span>
                {rt && <span>· {rt}</span>}
                {post.view_count != null && <span>· 👁 {post.view_count.toLocaleString()} views</span>}
              </div>

              {/* Title */}
              <h1 style={{ fontSize: "clamp(24px,4vw,42px)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.12, margin: "0 0 24px", color: T.text }}>
                {post.title}
              </h1>

              {/* Share row */}
              <div className="blog-share-row" style={{ display: "flex", gap: 8, marginBottom: 36, flexWrap: "wrap" }}>
                <button style={{ ...shareBtn, color: "#1d9bf0", borderColor: "rgba(29,155,240,0.3)" }} onClick={handleShareTwitter}>𝕏 Share on X</button>
                <button style={{ ...shareBtn, color: copyMsg ? T.accentGreen : T.textMid, borderColor: copyMsg ? `${T.accentGreen}40` : T.border }} onClick={handleCopy}>{copyMsg || "⎘ Copy link"}</button>
              </div>

              {/* Excerpt */}
              {post.excerpt && (
                <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 17, color: T.textMid, lineHeight: 1.8, borderLeft: `3px solid ${T.accent}`, paddingLeft: 20, marginBottom: 32, fontStyle: "italic" }}>
                  {post.excerpt}
                </div>
              )}

              {/* Body */}
              <div
                style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 16, lineHeight: 1.88, color: T.prose, letterSpacing: "0.005em" }}
                className="blog-prose"
                dangerouslySetInnerHTML={{ __html: post.body || "" }}
              />

              {/* Back link */}
              <div className="blog-post-bottom-row" style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <Link to="/blog" style={{ color: T.accent, textDecoration: "none", fontSize: 11, letterSpacing: "0.1em" }}>← BACK TO BLOG</Link>
                <div className="blog-share-row" style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...shareBtn, color: "#1d9bf0", borderColor: "rgba(29,155,240,0.3)" }} onClick={handleShareTwitter}>𝕏 Share</button>
                  <button style={{ ...shareBtn, color: copyMsg ? T.accentGreen : T.textMid, borderColor: copyMsg ? `${T.accentGreen}40` : T.border }} onClick={handleCopy}>{copyMsg || "⎘ Copy Link"}</button>
                </div>
              </div>

              {/* Comments */}
              <CommentsSection T={T} postId={post?.id} />
            </article>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside style={{ position: "sticky", top: 80 }}>
              {/* Tags card */}
              {tags.length > 0 && (
                <div style={{ background: T.sidebarBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", marginBottom: 12 }}>TOPICS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tags.map(tag => (
                      <Link key={tag} to={`/blog`} style={{ ...tagPill, textDecoration: "none", cursor: "pointer" }}>{tag.toUpperCase()}</Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Article info */}
              <div style={{ background: T.sidebarBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", marginBottom: 14 }}>ARTICLE INFO</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.1em", marginBottom: 3 }}>PUBLISHED</div>
                    <div style={{ fontSize: 12, color: T.text }}>{fmtDate(post.published_at || post.created_at)}</div>
                  </div>
                  {rt && (
                    <div>
                      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.1em", marginBottom: 3 }}>READ TIME</div>
                      <div style={{ fontSize: 12, color: T.text }}>{rt}</div>
                    </div>
                  )}
                  {post.view_count != null && (
                    <div>
                      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.1em", marginBottom: 3 }}>VIEWS</div>
                      <div style={{ fontSize: 12, color: T.text }}>{post.view_count.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Share card */}
              <div style={{ background: T.sidebarBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", marginBottom: 14 }}>SHARE THIS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={handleShareTwitter} style={{ ...shareBtn, color: "#1d9bf0", borderColor: "rgba(29,155,240,0.3)", textAlign: "left", width: "100%" }}>𝕏 Share on X / Twitter</button>
                  <button onClick={handleCopy} style={{ ...shareBtn, color: copyMsg ? T.accentGreen : T.textMid, borderColor: copyMsg ? `${T.accentGreen}40` : T.border, textAlign: "left", width: "100%" }}>{copyMsg ? "✓ Link copied!" : "⎘ Copy article link"}</button>
                </div>
              </div>

              {/* About */}
              <div style={{ background: T.sidebarBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.14em", marginBottom: 12 }}>ABOUT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>4Life Mystery</div>
                <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.65 }}>Exploring consciousness, philosophy, and life's deepest questions.</div>
                <Link to="/blog" style={{ display: "block", marginTop: 12, fontSize: 10, color: T.accent, textDecoration: "none", letterSpacing: "0.08em" }}>← All Articles</Link>
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, background: T.footBg, padding: "32px clamp(16px,4vw,48px)", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.06em", color: T.text, marginBottom: 6 }}>
          <span style={{ background: "linear-gradient(135deg,#34d399,#4f8ef0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>4LIFE</span>
          <span>MYSTERY</span>
        </div>
        <div style={{ fontSize: 10, color: T.textDim, opacity: 0.55 }}>© {new Date().getFullYear()} 4Life Mystery. All rights reserved.</div>
      </footer>

      {/* ── Cookie bar ─────────────────────────────────────────────────────── */}
      {!cookieConsent && (
        <div className="blog-cookie-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: isDark ? "rgba(6,8,16,0.97)" : "rgba(248,250,252,0.97)", backdropFilter: "blur(14px)", borderTop: `1px solid ${T.border}`, padding: "14px clamp(16px,4vw,48px)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontSize: 11, color: T.textMid, minWidth: 200 }}>We use cookies to improve your experience. <Link to="/cookie-policy" style={{ color: T.accent }}>Learn more</Link></div>
          <button onClick={() => { localStorage.setItem("blog_cookie_consent", "declined"); setCookieConsent("declined"); }} style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Decline</button>
          <button onClick={() => { localStorage.setItem("blog_cookie_consent", "accepted"); setCookieConsent("accepted"); }} style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.accentGreen}50`, background: `${T.accentGreen}12`, color: T.accentGreen, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept All</button>
        </div>
      )}

      <style>{`
        .blog-prose { font-family: Georgia,'Times New Roman',serif; }
        .blog-prose h1,.blog-prose h2,.blog-prose h3,.blog-prose h4 {
          font-family: 'JetBrains Mono','Fira Mono',monospace;
          font-weight: 700; letter-spacing: -0.01em; line-height: 1.2;
          margin: 2em 0 0.7em; color: ${T.text};
        }
        .blog-prose h1 { font-size: 1.7em; }
        .blog-prose h2 { font-size: 1.35em; border-bottom: 1px solid ${T.border}; padding-bottom: 8px; }
        .blog-prose h3 { font-size: 1.1em; }
        .blog-prose p { margin: 0 0 1.4em; }
        .blog-prose a { color: ${T.accent}; text-decoration: underline; }
        .blog-prose strong { color: ${T.text}; font-weight: 700; }
        .blog-prose em { font-style: italic; color: ${T.textMid}; }
        .blog-prose blockquote {
          border-left: 3px solid ${T.accentPurple}60; margin: 2em 0;
          padding: 12px 22px; background: ${T.bgCard}; border-radius: 0 10px 10px 0;
          font-style: italic; color: ${T.textMid};
        }
        .blog-prose code {
          font-family: 'JetBrains Mono','Fira Mono',monospace;
          background: ${T.bgCard}; border: 1px solid ${T.border};
          padding: 1px 6px; border-radius: 4px; font-size: 0.85em;
        }
        .blog-prose pre {
          background: ${T.bgCard}; border: 1px solid ${T.border};
          border-radius: 10px; padding: 18px; overflow-x: auto; margin: 1.8em 0;
        }
        .blog-prose pre code { background: none; border: none; padding: 0; font-size: 0.9em; }
        .blog-prose img { max-width: 100%; border-radius: 10px; margin: 1.2em 0; display: block; }
        .blog-prose ul,.blog-prose ol { padding-left: 1.6em; margin: 0 0 1.4em; }
        .blog-prose li { margin-bottom: 0.5em; line-height: 1.75; }
        .blog-prose hr { border: none; border-top: 1px solid ${T.border}; margin: 2.5em 0; }
        .blog-prose .blog-video-embed {
          margin: 2.2em 0; border-radius: 12px; overflow: hidden;
          aspect-ratio: 16/9; background: #000; border: 1px solid ${T.border};
        }
        .blog-prose .blog-video-embed iframe { width: 100%; height: 100%; border: none; display: block; }

        @media (max-width: 900px) {
          .blog-post-layout {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          aside { position: static !important; }
        }

        @media (max-width: 640px) {
          .blog-prose { font-size: 15px; }

          .blog-post-layout {
            padding-top: 28px !important;
            padding-bottom: 48px !important;
          }

          /* Share rows: stack buttons full-width */
          .blog-share-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .blog-share-row > button {
            width: 100% !important;
            text-align: center !important;
            padding: 11px 16px !important;
            box-sizing: border-box !important;
          }

          /* Bottom back-link + share: stack vertically */
          .blog-post-bottom-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .blog-post-bottom-row > a {
            text-align: center !important;
            padding: 11px !important;
            border: 1px solid currentColor !important;
            border-radius: 7px !important;
            box-sizing: border-box !important;
          }

          /* Comment form fields: single column */
          .comment-fields-grid {
            grid-template-columns: 1fr !important;
          }

          /* Comment submit row: stack note + button */
          .comment-submit-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .comment-submit-row > button {
            width: 100% !important;
            padding: 13px !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }

          /* Load more comments + reply submit: full width */
          .comment-load-more-btn,
          .comment-reply-submit-btn {
            width: 100% !important;
            padding: 12px !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }

          /* Cookie bar: stack vertically */
          .blog-cookie-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .blog-cookie-bar > div {
            min-width: unset !important;
          }
          .blog-cookie-bar > button {
            width: 100% !important;
            padding: 12px 18px !important;
            text-align: center !important;
          }
        }
      `}</style>
    </div>
  );
}
