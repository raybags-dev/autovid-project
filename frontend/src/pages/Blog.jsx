import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import freedomImg from "../assets/static/freedom.jpg";

// ── Themes ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#060810",
  bgAlt: "#0a0d14",
  bgCard: "rgba(255,255,255,0.032)",
  bgCardHover: "rgba(255,255,255,0.06)",
  bgFeatured: "rgba(255,255,255,0.028)",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.16)",
  text: "#e2e8f0",
  textMid: "#94a3b8",
  textDim: "#475569",
  navBg: "rgba(6,8,16,0.9)",
  accent: "#4f8ef0",
  accentGreen: "#34d399",
  accentPurple: "#a78bfa",
  accentYellow: "#fbbf24",
  footBg: "rgba(0,0,0,0.4)",
  tag: "rgba(167,139,250,0.1)",
  tagBorder: "rgba(167,139,250,0.25)",
  tagText: "#a78bfa",
};
const LIGHT = {
  bg: "#f8fafc",
  bgAlt: "#f1f5f9",
  bgCard: "#ffffff",
  bgCardHover: "#f0f4f8",
  bgFeatured: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  borderHover: "rgba(0,0,0,0.2)",
  text: "#0f172a",
  textMid: "#374151",
  textDim: "#6b7280",
  navBg: "rgba(248,250,252,0.92)",
  accent: "#2563eb",
  accentGreen: "#059669",
  accentPurple: "#7c3aed",
  accentYellow: "#d97706",
  footBg: "rgba(0,0,0,0.04)",
  tag: "rgba(124,58,237,0.08)",
  tagBorder: "rgba(124,58,237,0.2)",
  tagText: "#7c3aed",
};

const PAGE_SIZE = 9;

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function readTime(body) {
  if (!body) return "";
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
function truncate(str, n) {
  if (!str) return "";
  const plain = str.replace(/<[^>]+>/g, "");
  return plain.length > n ? plain.slice(0, n).trimEnd() + "…" : plain;
}

function GradientPlaceholder({ title, isDark, style = {} }) {
  const hue = title
    ? (title.charCodeAt(0) * 47 + (title.charCodeAt(Math.min(1, title.length - 1)) * 17)) % 360
    : 220;
  const bg = isDark
    ? `linear-gradient(135deg, hsl(${hue},35%,10%) 0%, hsl(${(hue + 80) % 360},45%,16%) 100%)`
    : `linear-gradient(135deg, hsl(${hue},25%,88%) 0%, hsl(${(hue + 80) % 360},35%,82%) 100%)`;
  return (
    <div style={{ width: "100%", height: "100%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)", ...style }}>
      ◈
    </div>
  );
}

function TagPill({ tag, T, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "4px 12px", borderRadius: 20, fontSize: 10, letterSpacing: "0.1em",
        fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
        background: active ? T.accent : T.tag,
        border: `1px solid ${active ? T.accent : T.tagBorder}`,
        color: active ? "#fff" : T.tagText,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {tag.toUpperCase()}
    </button>
  );
}

export default function Blog() {
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => localStorage.getItem("blog_theme") !== "light");
  const T = isDark ? DARK : LIGHT;
  const toggleTheme = () => {
    setIsDark(d => { const n = !d; localStorage.setItem("blog_theme", n ? "dark" : "light"); return n; });
  };

  const [cookieConsent, setCookieConsent] = useState(() => localStorage.getItem("blog_cookie_consent"));

  // SEO
  useEffect(() => {
    document.title = "4Life Mystery Blog";
    const setMeta = (name, content, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Explore thought-provoking articles on consciousness, philosophy, mental health, and the mysteries of life.");
    setMeta("og:title", "4Life Mystery Blog", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://4lifemystery.com/blog", true);
  }, []);

  // Data
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [activeTag, setActiveTag] = useState("");

  const fetchPosts = useCallback(async (off = 0, append = false) => {
    try {
      if (off === 0) setLoading(true); else setLoadingMore(true);
      const res = await fetch(`/api/blog/posts?status=published&limit=${PAGE_SIZE}&offset=${off}`);
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();
      const items = Array.isArray(data.posts) ? data.posts : (Array.isArray(data) ? data : []);
      const tot = data.total ?? items.length;
      setPosts(prev => append ? [...prev, ...items] : items);
      setTotal(tot);
      setOffset(off + items.length);
    } catch (e) { setError(e.message || "Failed to load"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchPosts(0, false); }, [fetchPosts]);

  // All unique tags across loaded posts
  const allTags = [...new Set(posts.flatMap(p => Array.isArray(p.tags) ? p.tags : []))];

  const filteredPosts = activeTag
    ? posts.filter(p => (Array.isArray(p.tags) ? p.tags : []).includes(activeTag))
    : posts;

  const featuredPost = filteredPosts[0] || null;
  const gridPosts = filteredPosts.slice(1);
  const hasMore = posts.length < total && !activeTag;

  const containerRef = useRef(null);
  const heroImgRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = () => {
      if (heroImgRef.current) {
        heroImgRef.current.style.transform = `translateY(${el.scrollTop * 0.3}px) scale(1.2)`;
      }
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'JetBrains Mono','Fira Mono','Courier New',monospace", transition: "background 0.2s,color 0.2s", overflowY: "auto", maxHeight: "98vh" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: T.navBg, backdropFilter: "blur(14px)", borderBottom: `1px solid ${T.border}`, padding: "0 clamp(16px,4vw,48px)", display: "flex", alignItems: "center", height: 58, gap: 16 }}>
        <Link to="/" style={{ textDecoration: "none", fontWeight: 800, fontSize: 15, letterSpacing: "0.06em", color: T.text, flexShrink: 0 }}>
          <span style={{ background: "linear-gradient(135deg,#34d399,#4f8ef0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>4LIFE</span>
          <span style={{ color: T.text }}>MYSTERY</span>
        </Link>
        <div style={{ width: 1, height: 20, background: T.border, flexShrink: 0 }} />
        <span style={{ fontSize: 10, letterSpacing: "0.18em", color: T.textDim, flex: 1 }}>BLOG</span>
        <a href="/" style={{ fontSize: 10, color: T.textMid, textDecoration: "none", letterSpacing: "0.1em", padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 5 }}>HOME</a>
        <button onClick={toggleTheme} style={{ padding: "5px 11px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.textMid, fontSize: 14, cursor: "pointer", lineHeight: 1 }} title="Toggle theme">
          {isDark ? "☀" : "◑"}
        </button>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", height: "clamp(260px,32vw,380px)", overflow: "hidden", borderBottom: `1px solid ${T.border}` }}>
        <div ref={heroImgRef} style={{
          position: "absolute", inset: "-30% 0",
          backgroundImage: `url(${freedomImg})`,
          backgroundSize: "cover", backgroundPosition: "center 40%",
          opacity: isDark ? 0.32 : 0.18, transform: "scale(1.2)", pointerEvents: "none",
          willChange: "transform",
        }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isDark ? "linear-gradient(to bottom,rgba(6,8,16,0.5) 0%,rgba(6,8,16,0.2) 50%,rgba(6,8,16,0.75) 100%)" : "linear-gradient(to bottom,rgba(248,250,252,0.6) 0%,rgba(248,250,252,0.2) 50%,rgba(248,250,252,0.8) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 clamp(16px,4vw,48px)", textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.22em", color: T.accentGreen, fontWeight: 700, marginBottom: 14, textTransform: "uppercase" }}>4Life Mystery</div>
          <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 800, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.08, marginBottom: 14, margin: "0 0 14px" }}>
            Explore the Unknown
          </h1>
          <p style={{ fontSize: "clamp(12px,1.4vw,15px)", color: T.textMid, maxWidth: 520, lineHeight: 1.7, margin: "0 auto 20px" }}>
            Thought-provoking articles on consciousness, philosophy, and the mysteries of life.
          </p>
          {total > 0 && (
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em" }}>
              {total} ARTICLE{total !== 1 ? "S" : ""} PUBLISHED
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 clamp(16px,3vw,48px)" }}>

        {loading ? (
          <div style={{ padding: "80px 0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20, marginTop: 40 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", minHeight: 320 }}>
                <div style={{ height: 190, background: T.border, animation: "blogPulse 1.4s ease infinite alternate" }} />
                <div style={{ padding: 18 }}>
                  <div style={{ height: 12, background: T.border, borderRadius: 4, marginBottom: 8, width: "70%", animation: "blogPulse 1.4s ease infinite alternate" }} />
                  <div style={{ height: 10, background: T.border, borderRadius: 4, width: "100%", animation: "blogPulse 1.4s ease infinite alternate" }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "100px 0", color: T.textDim }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>FAILED TO LOAD</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{error}</div>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "100px 0", color: T.textDim }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>◎</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>NO POSTS YET</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Content is coming — check back soon.</div>
          </div>
        ) : (
          <>
            {/* ── Tag Filter ───────────────────────────────────────────────── */}
            {allTags.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "28px 0 20px", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.14em", marginRight: 4 }}>FILTER</span>
                <TagPill tag="All" T={T} active={!activeTag} onClick={() => setActiveTag("")} />
                {allTags.map(tag => (
                  <TagPill key={tag} tag={tag} T={T} active={activeTag === tag} onClick={() => setActiveTag(t => t === tag ? "" : tag)} />
                ))}
              </div>
            )}

            {filteredPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: T.textDim }}>
                <div style={{ fontSize: 13 }}>No posts tagged "{activeTag}"</div>
              </div>
            ) : (
              <>
                {/* ── Featured Post ─────────────────────────────────────── */}
                {featuredPost && (
                  <div
                    onClick={() => navigate(`/blog/${featuredPost.slug}`)}
                    className="blog-featured"
                    style={{ display: "flex", flexDirection: "row", background: T.bgFeatured, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 36, cursor: "pointer", transition: "border-color 0.2s,transform 0.15s", minHeight: 280 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {/* Cover image */}
                    <div className="blog-featured-cover" style={{ flex: "0 0 45%", minWidth: 0, position: "relative", overflow: "hidden" }}>
                      {featuredPost.cover_image_url ? (
                        <img
                          src={featuredPost.cover_image_url}
                          alt={featuredPost.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 280 }}
                          onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = "flex"); }}
                        />
                      ) : (
                        <GradientPlaceholder title={featuredPost.title} isDark={isDark} style={{ minHeight: 280 }} />
                      )}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right,transparent 70%,rgba(0,0,0,0.4) 100%)", pointerEvents: "none" }} />
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, padding: "clamp(20px,3vw,40px)", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                        <span style={{ fontSize: 9, background: T.accent, color: "#fff", padding: "2px 9px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.1em" }}>FEATURED</span>
                        {(Array.isArray(featuredPost.tags) ? featuredPost.tags : []).slice(0, 2).map(tag => (
                          <span key={tag} style={{ fontSize: 9, padding: "2px 9px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.1em", background: T.tag, border: `1px solid ${T.tagBorder}`, color: T.tagText }}>{tag.toUpperCase()}</span>
                        ))}
                      </div>
                      <h2 style={{ fontSize: "clamp(18px,2.4vw,30px)", fontWeight: 800, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 14px" }}>
                        {featuredPost.title}
                      </h2>
                      <p style={{ fontSize: "clamp(12px,1.2vw,14px)", color: T.textMid, lineHeight: 1.75, margin: "0 0 20px", flex: 1 }}>
                        {truncate(featuredPost.excerpt || featuredPost.body, 220)}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.06em" }}>
                          {fmtDate(featuredPost.published_at || featuredPost.created_at)}
                          {featuredPost.body && <span style={{ marginLeft: 10 }}>· {readTime(featuredPost.body)}</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: "0.08em", padding: "6px 16px", border: `1px solid ${T.accent}50`, borderRadius: 7 }}>
                          READ NOW →
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Post Grid ─────────────────────────────────────────── */}
                {gridPosts.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.16em", marginBottom: 16 }}>
                      {activeTag ? `${filteredPosts.length - 1} MORE IN "${activeTag.toUpperCase()}"` : "MORE ARTICLES"}
                    </div>
                    <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 20, marginBottom: 40 }}>
                      {gridPosts.map(post => {
                        const tags = Array.isArray(post.tags) ? post.tags : [];
                        return (
                          <div
                            key={post.id}
                            onClick={() => navigate(`/blog/${post.slug}`)}
                            style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", transition: "border-color 0.2s,background 0.2s,transform 0.15s", display: "flex", flexDirection: "column" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.background = T.bgCardHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bgCard; e.currentTarget.style.transform = "translateY(0)"; }}
                          >
                            {/* Cover */}
                            <div style={{ height: 190, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                              {post.cover_image_url ? (
                                <img src={post.cover_image_url} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                              ) : (
                                <GradientPlaceholder title={post.title} isDark={isDark} style={{ height: "100%" }} />
                              )}
                            </div>
                            {/* Body */}
                            <div style={{ padding: "18px 18px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                              {tags.length > 0 && (
                                <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {tags.slice(0, 3).map(tag => (
                                    <span key={tag} style={{ fontSize: 8, padding: "2px 8px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.1em", background: T.tag, border: `1px solid ${T.tagBorder}`, color: T.tagText }}>{tag.toUpperCase()}</span>
                                  ))}
                                </div>
                              )}
                              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                                {post.title}
                              </div>
                              <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, flex: 1, marginBottom: 14 }}>
                                {truncate(post.excerpt || post.body, 130)}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                                <span style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.04em" }}>
                                  {fmtDate(post.published_at || post.created_at)}
                                  {post.body && <span style={{ marginLeft: 8 }}>· {readTime(post.body)}</span>}
                                </span>
                                <span style={{ fontSize: 10, color: T.accent, letterSpacing: "0.1em", fontWeight: 700, padding: "3px 10px", border: `1px solid ${T.accent}40`, borderRadius: 5 }}>READ →</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Load More ────────────────────────────────────────────── */}
            {hasMore && (
              <div style={{ textAlign: "center", paddingBottom: 48 }}>
                <button
                  onClick={() => fetchPosts(offset, true)}
                  disabled={loadingMore}
                  className="blog-load-more-btn"
                  style={{ padding: "12px 36px", borderRadius: 9, border: `1px solid ${T.accent}50`, background: `${T.accent}0c`, color: T.accent, fontSize: 11, letterSpacing: "0.12em", fontWeight: 700, cursor: loadingMore ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s", opacity: loadingMore ? 0.6 : 1 }}
                >
                  {loadingMore ? "LOADING…" : `LOAD MORE  (${total - posts.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, background: T.footBg, padding: "36px clamp(16px,4vw,48px)", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.06em", color: T.text }}>
          <span style={{ background: "linear-gradient(135deg,#34d399,#4f8ef0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>4LIFE</span>
          <span>MYSTERY</span>
        </div>
        <div style={{ fontSize: 11, color: T.textDim, letterSpacing: "0.08em" }}>Questions worth asking.</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/" style={{ fontSize: 10, color: T.accent, textDecoration: "none" }}>← Main Site</Link>
        </div>
        <div style={{ fontSize: 10, color: T.textDim, opacity: 0.5, marginTop: 4 }}>
          © {new Date().getFullYear()} 4Life Mystery. All rights reserved.
        </div>
      </footer>

      {/* ── Cookie bar ─────────────────────────────────────────────────────── */}
      {!cookieConsent && (
        <div className="blog-cookie-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: isDark ? "rgba(6,8,16,0.97)" : "rgba(248,250,252,0.97)", backdropFilter: "blur(14px)", borderTop: `1px solid ${T.border}`, padding: "14px clamp(16px,4vw,48px)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontSize: 11, color: T.textMid, minWidth: 200 }}>
            We use cookies to improve your experience.{" "}
            <Link to="/cookie-policy" style={{ color: T.accent }}>Learn more</Link>
          </div>
          <button onClick={() => { localStorage.setItem("blog_cookie_consent", "declined"); setCookieConsent("declined"); }} style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Decline</button>
          <button onClick={() => { localStorage.setItem("blog_cookie_consent", "accepted"); setCookieConsent("accepted"); }} style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.accentGreen}50`, background: `${T.accentGreen}12`, color: T.accentGreen, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept All</button>
        </div>
      )}

      <style>{`
        @keyframes blogPulse { from { opacity: 0.35; } to { opacity: 0.65; } }

        @media (max-width: 640px) {
          .blog-featured {
            flex-direction: column !important;
            min-height: unset !important;
          }
          .blog-featured-cover {
            flex: none !important;
            width: 100% !important;
            height: 200px !important;
          }
          .blog-featured-cover img {
            min-height: unset !important;
            height: 200px !important;
          }
          .blog-grid {
            grid-template-columns: 1fr !important;
          }
          .blog-load-more-btn {
            width: 100% !important;
            padding: 14px 20px !important;
            box-sizing: border-box !important;
          }
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
