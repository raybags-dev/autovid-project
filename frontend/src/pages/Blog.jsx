import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

// ── Theme ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0a0c10",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.18)",
  text: "#e8eef5",
  textMid: "#a0b0c4",
  textDim: "#5a7090",
  navBg: "rgba(10,12,16,0.88)",
  accent: "#60a5fa",
  accentGreen: "#3dd68c",
  accentYellow: "#f5c842",
  accentPurple: "#a78bfa",
  footBg: "rgba(0,0,0,0.5)",
};
const LIGHT = {
  bg: "#f5f5f5",
  bgCard: "#ffffff",
  bgCardHover: "#f0f4f8",
  border: "rgba(0,0,0,0.1)",
  borderHover: "rgba(0,0,0,0.22)",
  text: "#111111",
  textMid: "#374151",
  textDim: "#6b7280",
  navBg: "rgba(245,245,245,0.92)",
  accent: "#2563eb",
  accentGreen: "#059669",
  accentYellow: "#d97706",
  accentPurple: "#7c3aed",
  footBg: "rgba(0,0,0,0.06)",
};

const PAGE_LIMIT = 9;

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function GradientPlaceholder({ title, style = {} }) {
  const hue = title ? (title.charCodeAt(0) * 37 + title.charCodeAt(1 % title.length) * 13) % 360 : 200;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: `linear-gradient(135deg, hsl(${hue},40%,14%) 0%, hsl(${(hue + 60) % 360},50%,20%) 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 32,
        ...style,
      }}
    >
      ◈
    </div>
  );
}

export default function Blog() {
  const navigate = useNavigate();

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("blog_theme");
    return stored ? stored === "dark" : true;
  });
  const T = isDark ? DARK : LIGHT;
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("blog_theme", next ? "dark" : "light");
  };

  // ── Cookie consent ──────────────────────────────────────────────────────────
  const [cookieConsent, setCookieConsent] = useState(
    () => localStorage.getItem("blog_cookie_consent")
  );
  const acceptCookies = () => {
    localStorage.setItem("blog_cookie_consent", "accepted");
    setCookieConsent("accepted");
  };
  const declineCookies = () => {
    localStorage.setItem("blog_cookie_consent", "declined");
    setCookieConsent("declined");
  };

  // ── SEO ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = "4Life Mystery Blog";
    const setMeta = (name, content, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Explore thought-provoking articles on consciousness, philosophy, mental health, and the mysteries of life.");
    setMeta("robots", "index, follow");
    setMeta("og:title", "4Life Mystery Blog", true);
    setMeta("og:description", "Thought-provoking articles on consciousness, philosophy, and the mysteries of life.", true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://4lifemystery.com/blog", true);

    // JSON-LD structured data
    let ld = document.getElementById("blog-jsonld");
    if (!ld) { ld = document.createElement("script"); ld.id = "blog-jsonld"; ld.type = "application/ld+json"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "4Life Mystery Blog",
      "url": "https://4lifemystery.com/blog",
      "description": "Thought-provoking articles on consciousness, philosophy, and the mysteries of life.",
      "publisher": { "@type": "Organization", "name": "4Life Mystery" },
    });
  }, []);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async (off = 0, append = false) => {
    try {
      if (off === 0) setLoading(true); else setLoadingMore(true);
      const res = await fetch(`/api/blog/posts?status=published&limit=${PAGE_LIMIT}&offset=${off}`);
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();
      const items = Array.isArray(data.posts) ? data.posts : (Array.isArray(data) ? data : []);
      const tot = data.total ?? items.length;
      setPosts(prev => append ? [...prev, ...items] : items);
      setTotal(tot);
      setOffset(off + items.length);
    } catch (e) {
      setError(e.message || "Failed to load posts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchPosts(0, false); }, [fetchPosts]);

  const hasMore = posts.length < total;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const styles = {
    page: {
      minHeight: "100vh",
      background: T.bg,
      color: T.text,
      fontFamily: "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace",
      transition: "background 0.2s, color 0.2s",
    },
    nav: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: T.navBg,
      backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${T.border}`,
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      height: 56,
      gap: 16,
    },
    logo: {
      textDecoration: "none",
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: "0.06em",
      color: T.text,
    },
    blogTitle: {
      fontSize: 11,
      letterSpacing: "0.14em",
      color: T.textDim,
      flex: 1,
    },
    themeBtn: {
      padding: "4px 10px",
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      background: "transparent",
      color: T.textMid,
      fontSize: 14,
      cursor: "pointer",
      transition: "all 0.15s",
      lineHeight: 1,
    },
    hero: {
      padding: "64px 24px 48px",
      textAlign: "center",
      borderBottom: `1px solid ${T.border}`,
    },
    heroTitle: {
      fontSize: "clamp(28px, 5vw, 52px)",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      marginBottom: 16,
      lineHeight: 1.1,
    },
    heroBadge: {
      display: "inline-block",
      padding: "3px 12px",
      borderRadius: 20,
      fontSize: 10,
      letterSpacing: "0.16em",
      fontWeight: 700,
      border: `1px solid ${T.accentGreen}50`,
      color: T.accentGreen,
      background: `${T.accentGreen}0f`,
      marginBottom: 20,
    },
    heroDesc: {
      fontSize: 14,
      color: T.textMid,
      maxWidth: 560,
      margin: "0 auto",
      lineHeight: 1.7,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 20,
      padding: "40px 24px",
      maxWidth: 1200,
      margin: "0 auto",
    },
    card: {
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      overflow: "hidden",
      cursor: "pointer",
      transition: "border-color 0.2s, background 0.2s, transform 0.15s",
      display: "flex",
      flexDirection: "column",
    },
    cardBody: {
      padding: "18px 18px 16px",
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: 700,
      color: T.text,
      marginBottom: 8,
      lineHeight: 1.35,
      letterSpacing: "-0.01em",
    },
    cardExcerpt: {
      fontSize: 12,
      color: T.textMid,
      lineHeight: 1.65,
      flex: 1,
      marginBottom: 12,
    },
    pill: {
      display: "inline-block",
      padding: "2px 9px",
      borderRadius: 20,
      fontSize: 9,
      letterSpacing: "0.1em",
      fontWeight: 700,
      border: `1px solid ${T.accentPurple}40`,
      color: T.accentPurple,
      background: `${T.accentPurple}0d`,
      marginRight: 5,
      marginBottom: 4,
    },
    cardMeta: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${T.border}`,
    },
    cardDate: {
      fontSize: 10,
      color: T.textDim,
      letterSpacing: "0.06em",
    },
    readMore: {
      fontSize: 10,
      color: T.accent,
      letterSpacing: "0.1em",
      fontWeight: 700,
      background: "transparent",
      border: `1px solid ${T.accent}40`,
      borderRadius: 6,
      padding: "3px 10px",
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all 0.15s",
    },
    footer: {
      borderTop: `1px solid ${T.border}`,
      background: T.footBg,
      padding: "32px 24px",
      textAlign: "center",
      fontSize: 11,
      color: T.textDim,
      letterSpacing: "0.08em",
    },
    footerLink: {
      color: T.accent,
      textDecoration: "none",
      marginLeft: 6,
    },
    cookieBar: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: isDark ? "rgba(10,12,16,0.97)" : "rgba(255,255,255,0.97)",
      backdropFilter: "blur(12px)",
      borderTop: `1px solid ${T.border}`,
      padding: "14px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
    },
    cookieText: {
      flex: 1,
      fontSize: 11,
      color: T.textMid,
      minWidth: 200,
    },
    cookieAccept: {
      padding: "7px 18px",
      borderRadius: 7,
      border: `1px solid ${T.accentGreen}50`,
      background: `${T.accentGreen}15`,
      color: T.accentGreen,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      cursor: "pointer",
      fontFamily: "inherit",
    },
    cookieDecline: {
      padding: "7px 18px",
      borderRadius: 7,
      border: `1px solid ${T.border}`,
      background: "transparent",
      color: T.textDim,
      fontSize: 11,
      letterSpacing: "0.08em",
      cursor: "pointer",
      fontFamily: "inherit",
    },
    loadMoreBtn: {
      display: "block",
      margin: "0 auto 48px",
      padding: "12px 32px",
      borderRadius: 8,
      border: `1px solid ${T.accent}50`,
      background: `${T.accent}0f`,
      color: T.accent,
      fontSize: 11,
      letterSpacing: "0.12em",
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all 0.15s",
    },
    emptyState: {
      textAlign: "center",
      padding: "80px 24px",
      color: T.textDim,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
      display: "block",
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: T.textMid,
      marginBottom: 8,
      letterSpacing: "0.04em",
    },
    emptyDesc: {
      fontSize: 12,
      color: T.textDim,
    },
  };

  return (
    <div style={styles.page}>
      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav style={styles.nav}>
        <Link to="/" style={styles.logo}>
          <span style={{ background: "linear-gradient(135deg,#3dd68c,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            4LIFE
          </span>
          <span style={{ color: T.text }}>MYSTERY</span>
        </Link>
        <span style={styles.blogTitle}>| BLOG</span>
        <button
          style={styles.themeBtn}
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? "☀" : "◑"}
        </button>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={styles.hero}>
        <span style={styles.heroBadge}>◈ THE BLOG</span>
        <h1 style={styles.heroTitle}>
          <span style={{ background: "linear-gradient(135deg,#e8eef5,#a0b0c4)", WebkitBackgroundClip: "text", WebkitTextFillColor: isDark ? "transparent" : undefined, color: isDark ? undefined : T.text }}>
            Mysteries Worth
          </span>
          <br />
          <span style={{ background: "linear-gradient(135deg,#3dd68c,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Exploring
          </span>
        </h1>
        <p style={styles.heroDesc}>
          Thought-provoking articles on consciousness, philosophy, mental health,
          relationships, and the deeper questions of existence.
        </p>
      </section>

      {/* ── Post Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ ...styles.grid }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ ...styles.card, minHeight: 300 }}>
              <div style={{ height: 170, background: `${T.border}`, animation: "blogPulse 1.4s ease infinite alternate" }} />
              <div style={styles.cardBody}>
                <div style={{ height: 14, background: T.border, borderRadius: 4, marginBottom: 10, width: "75%" }} />
                <div style={{ height: 10, background: T.border, borderRadius: 4, marginBottom: 6, width: "100%" }} />
                <div style={{ height: 10, background: T.border, borderRadius: 4, width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>⚠</span>
          <div style={styles.emptyTitle}>FAILED TO LOAD</div>
          <div style={styles.emptyDesc}>{error}</div>
        </div>
      ) : posts.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>◎</span>
          <div style={styles.emptyTitle}>NO POSTS YET</div>
          <div style={styles.emptyDesc}>Check back soon — content is coming.</div>
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {posts.map(post => {
              const tags = typeof post.tags === "string"
                ? post.tags.split(",").map(t => t.trim()).filter(Boolean)
                : (Array.isArray(post.tags) ? post.tags : []);
              return (
                <div
                  key={post.id}
                  style={styles.card}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = T.borderHover;
                    e.currentTarget.style.background = T.bgCardHover;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.background = T.bgCard;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {/* Cover image */}
                  {post.cover_image_url ? (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                      onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
                    />
                  ) : null}
                  {!post.cover_image_url && <GradientPlaceholder title={post.title || "Post"} />}

                  <div style={styles.cardBody}>
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        {tags.slice(0, 4).map(tag => (
                          <span key={tag} style={styles.pill}>{tag.toUpperCase()}</span>
                        ))}
                      </div>
                    )}

                    <div style={styles.cardTitle}>{post.title}</div>
                    <div style={styles.cardExcerpt}>
                      {truncate(post.excerpt || post.body?.replace(/<[^>]+>/g, "") || "", 150)}
                    </div>

                    <div style={styles.cardMeta}>
                      <span style={styles.cardDate}>{fmtDate(post.published_at || post.created_at)}</span>
                      <button
                        style={styles.readMore}
                        onClick={e => { e.stopPropagation(); navigate(`/blog/${post.slug}`); }}
                      >
                        READ MORE →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              style={styles.loadMoreBtn}
              onClick={() => fetchPosts(offset, true)}
              disabled={loadingMore}
            >
              {loadingMore ? "LOADING…" : `LOAD MORE (${total - posts.length} remaining)`}
            </button>
          )}
        </>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={styles.footer}>
        <div>
          4Life Mystery Blog · Questions worth asking
          <Link to="/" style={styles.footerLink}>← Back to main site</Link>
        </div>
        <div style={{ marginTop: 8, opacity: 0.5 }}>
          © {new Date().getFullYear()} 4Life Mystery. All rights reserved.
        </div>
      </footer>

      {/* ── Cookie consent bar ────────────────────────────────────────────── */}
      {!cookieConsent && (
        <div style={styles.cookieBar}>
          <div style={styles.cookieText}>
            We use cookies to improve your experience and analyse site traffic.
            <Link to="/cookie-policy" style={{ color: T.accent, marginLeft: 4 }}>Learn more</Link>
          </div>
          <button style={styles.cookieDecline} onClick={declineCookies}>Decline</button>
          <button style={styles.cookieAccept} onClick={acceptCookies}>Accept All</button>
        </div>
      )}

      <style>{`
        @keyframes blogPulse { from { opacity: 0.4; } to { opacity: 0.7; } }
        @media (max-width: 600px) {
          .blog-grid { grid-template-columns: 1fr !important; }
          .blog-load-more { width: 100% !important; }
          .blog-cookie-bar { flex-direction: column; }
          .blog-cookie-bar button { width: 100%; }
        }
      `}</style>
    </div>
  );
}
