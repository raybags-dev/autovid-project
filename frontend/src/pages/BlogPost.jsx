import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

// ── Theme ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0a0c10",
  bgCard: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text: "#e8eef5",
  textMid: "#a0b0c4",
  textDim: "#5a7090",
  navBg: "rgba(10,12,16,0.88)",
  accent: "#60a5fa",
  accentGreen: "#3dd68c",
  accentYellow: "#f5c842",
  accentPurple: "#a78bfa",
  footBg: "rgba(0,0,0,0.5)",
  prose: "#c8d8e8",
};
const LIGHT = {
  bg: "#f5f5f5",
  bgCard: "#ffffff",
  border: "rgba(0,0,0,0.1)",
  text: "#111111",
  textMid: "#374151",
  textDim: "#6b7280",
  navBg: "rgba(245,245,245,0.92)",
  accent: "#2563eb",
  accentGreen: "#059669",
  accentYellow: "#d97706",
  accentPurple: "#7c3aed",
  footBg: "rgba(0,0,0,0.06)",
  prose: "#1f2937",
};

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPost() {
  const { slug } = useParams();
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

  // ── Data ───────────────────────────────────────────────────────────────────
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

      // increment view count (fire and forget)
      fetch(`/api/blog/posts/${slug}/view`, { method: "POST" }).catch(() => {});
    } catch (e) {
      setError(e.message || "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  // ── SEO meta tags ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | 4Life Mystery`;
    const setMeta = (name, content, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = post.excerpt || post.body?.replace(/<[^>]+>/g, "").slice(0, 160) || "";
    setMeta("description", desc);
    setMeta("robots", "index, follow");
    setMeta("og:title", post.title, true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "article", true);
    setMeta("og:url", `https://4lifemystery.com/blog/${post.slug}`, true);
    if (post.cover_image_url) setMeta("og:image", post.cover_image_url, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", post.title);
    setMeta("twitter:description", desc);
    if (post.cover_image_url) setMeta("twitter:image", post.cover_image_url);

    // JSON-LD BlogPosting
    let ld = document.getElementById("blogpost-jsonld");
    if (!ld) { ld = document.createElement("script"); ld.id = "blogpost-jsonld"; ld.type = "application/ld+json"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": desc,
      "url": `https://4lifemystery.com/blog/${post.slug}`,
      "datePublished": post.published_at || post.created_at,
      "dateModified": post.updated_at || post.published_at || post.created_at,
      "image": post.cover_image_url || undefined,
      "author": { "@type": "Organization", "name": "4Life Mystery" },
      "publisher": { "@type": "Organization", "name": "4Life Mystery", "url": "https://4lifemystery.com" },
    });
  }, [post]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };
  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post?.title || "")}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const tags = post
    ? (typeof post.tags === "string"
        ? post.tags.split(",").map(t => t.trim()).filter(Boolean)
        : (Array.isArray(post.tags) ? post.tags : []))
    : [];

  // ── Styles ─────────────────────────────────────────────────────────────────
  const st = {
    page: {
      height: "100%",
      overflowY: "auto",
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
    backLink: {
      textDecoration: "none",
      fontSize: 10,
      color: T.textDim,
      letterSpacing: "0.1em",
      padding: "3px 10px",
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      transition: "color 0.15s",
    },
    themeBtn: {
      padding: "4px 10px",
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      background: "transparent",
      color: T.textMid,
      fontSize: 14,
      cursor: "pointer",
      marginLeft: "auto",
    },
    content: {
      maxWidth: 780,
      margin: "0 auto",
      padding: "40px 24px 80px",
    },
    coverImg: {
      width: "100%",
      maxHeight: 440,
      objectFit: "cover",
      borderRadius: 12,
      display: "block",
      marginBottom: 32,
      border: `1px solid ${T.border}`,
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
    meta: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: 12,
    },
    metaDate: {
      fontSize: 11,
      color: T.textDim,
      letterSpacing: "0.06em",
    },
    metaViews: {
      fontSize: 11,
      color: T.textDim,
      letterSpacing: "0.04em",
    },
    title: {
      fontSize: "clamp(22px, 4vw, 38px)",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      lineHeight: 1.15,
      marginBottom: 24,
      color: T.text,
    },
    shareRow: {
      display: "flex",
      gap: 8,
      marginBottom: 32,
      flexWrap: "wrap",
    },
    shareBtn: {
      padding: "6px 14px",
      borderRadius: 7,
      border: `1px solid ${T.border}`,
      background: "transparent",
      color: T.textMid,
      fontSize: 10,
      letterSpacing: "0.08em",
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all 0.15s",
    },
    prose: {
      fontSize: 14,
      lineHeight: 1.85,
      color: T.prose,
      letterSpacing: "0.01em",
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
  };

  return (
    <div style={st.page}>
      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav style={st.nav}>
        <Link to="/" style={st.logo}>
          <span style={{ background: "linear-gradient(135deg,#3dd68c,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>4LIFE</span>
          <span style={{ color: T.text }}>MYSTERY</span>
        </Link>
        <Link to="/blog" style={st.backLink}>← Blog</Link>
        <button style={st.themeBtn} onClick={toggleTheme} title="Toggle theme">
          {isDark ? "☀" : "◑"}
        </button>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ ...st.content, paddingTop: 80, textAlign: "center", color: T.textDim, fontSize: 12, letterSpacing: "0.12em" }}>
          LOADING…
        </div>
      ) : error ? (
        <div style={{ ...st.content, paddingTop: 80, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
          <div style={{ fontSize: 16, color: T.textMid, fontWeight: 700, marginBottom: 8 }}>{error.toUpperCase()}</div>
          <Link to="/blog" style={{ color: T.accent, textDecoration: "none", fontSize: 12 }}>← Back to blog</Link>
        </div>
      ) : post ? (
        <article style={st.content}>
          {/* Cover image */}
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              style={st.coverImg}
              onError={e => { e.currentTarget.style.display = "none"; }}
            />
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {tags.map(tag => <span key={tag} style={st.pill}>{tag.toUpperCase()}</span>)}
            </div>
          )}

          {/* Meta */}
          <div style={st.meta}>
            <span style={st.metaDate}>{fmtDate(post.published_at || post.created_at)}</span>
            {post.view_count != null && (
              <span style={st.metaViews}>👁 {post.view_count.toLocaleString()} views</span>
            )}
          </div>

          {/* Title */}
          <h1 style={st.title}>{post.title}</h1>

          {/* Share buttons */}
          <div style={st.shareRow}>
            <button style={{ ...st.shareBtn, color: "#1d9bf0", borderColor: "rgba(29,155,240,0.3)" }} onClick={handleShareTwitter}>
              𝕏 SHARE ON X
            </button>
            <button
              style={{ ...st.shareBtn, color: copyMsg ? T.accentGreen : T.textMid, borderColor: copyMsg ? `${T.accentGreen}40` : T.border }}
              onClick={handleCopyLink}
            >
              {copyMsg || "⎘ COPY LINK"}
            </button>
          </div>

          {/* Body rendered as HTML */}
          <div
            style={st.prose}
            className="blog-prose"
            dangerouslySetInnerHTML={{ __html: post.body || "" }}
          />

          {/* Back link */}
          <div style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
            <Link
              to="/blog"
              style={{ color: T.accent, textDecoration: "none", fontSize: 11, letterSpacing: "0.1em" }}
            >
              ← BACK TO BLOG
            </Link>
          </div>
        </article>
      ) : null}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={st.footer}>
        <div>
          4Life Mystery Blog
          <Link to="/" style={{ color: T.accent, textDecoration: "none", marginLeft: 8 }}>← Main site</Link>
        </div>
        <div style={{ marginTop: 8, opacity: 0.5 }}>
          © {new Date().getFullYear()} 4Life Mystery. All rights reserved.
        </div>
      </footer>

      {/* ── Cookie consent bar ───────────────────────────────────────────── */}
      {!cookieConsent && (
        <div style={st.cookieBar}>
          <div style={{ flex: 1, fontSize: 11, color: T.textMid, minWidth: 200 }}>
            We use cookies to improve your experience.
            <Link to="/cookie-policy" style={{ color: T.accent, marginLeft: 4 }}>Learn more</Link>
          </div>
          <button
            onClick={declineCookies}
            style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          >
            Decline
          </button>
          <button
            onClick={acceptCookies}
            style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${T.accentGreen}50`, background: `${T.accentGreen}15`, color: T.accentGreen, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Accept All
          </button>
        </div>
      )}

      <style>{`
        .blog-prose h1,.blog-prose h2,.blog-prose h3 {
          font-weight: 700;
          margin: 1.8em 0 0.6em;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .blog-prose h1 { font-size: 1.6em; }
        .blog-prose h2 { font-size: 1.3em; }
        .blog-prose h3 { font-size: 1.1em; }
        .blog-prose p { margin: 0 0 1.3em; }
        .blog-prose a { color: ${T.accent}; text-decoration: underline; }
        .blog-prose blockquote {
          border-left: 3px solid ${T.accentPurple}60;
          margin: 1.5em 0;
          padding: 10px 20px;
          background: ${T.bgCard};
          border-radius: 0 8px 8px 0;
          font-style: italic;
          color: ${T.textMid};
        }
        .blog-prose code {
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.88em;
        }
        .blog-prose pre {
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 1.5em 0;
        }
        .blog-prose img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1em 0;
          display: block;
        }
        .blog-prose ul,.blog-prose ol { padding-left: 1.5em; margin: 0 0 1.3em; }
        .blog-prose li { margin-bottom: 0.4em; }
        .blog-prose .blog-video-embed {
          margin: 2em 0;
          border-radius: 10px;
          overflow: hidden;
          aspect-ratio: 16/9;
          background: #000;
        }
        .blog-prose .blog-video-embed iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }
        @media (max-width: 600px) {
          .blog-prose { font-size: 13px; }
        }
      `}</style>
    </div>
  );
}
