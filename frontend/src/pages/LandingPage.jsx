import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import mainLogo     from "../assets/logo/main-logo.png";
import lifeLogoLong from "../assets/logo/life-logo-long.png";
import uncoverLogo  from "../assets/logo/uncover-unknown-logo.png";
import profileImg   from "../assets/4life_mystery.png";

// ── Social links ──────────────────────────────────────────────────────────────
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

const STATIC_COMMENTS = [
  { id: 1, initials: "AM", name: "Alex M.",  time: "2 days ago",
    text: "This channel completely changed how I think about my daily struggles. Thank you for always asking the right questions.",
    likes: 24, color: "#ff5533" },
  { id: 2, initials: "SK", name: "Sarah K.", time: "5 days ago",
    text: "The episode about consciousness had me thinking for weeks. When's the next one dropping?",
    likes: 18, color: "#0088ff" },
  { id: 3, initials: "JT", name: "James T.", time: "1 week ago",
    text: "Rarely do I find content that makes me genuinely uncomfortable in the best way possible. Keep going!",
    likes: 31, color: "#1db954" },
  { id: 4, initials: "LP", name: "Lisa P.",  time: "2 weeks ago",
    text: "Found this through TikTok and binged every single episode. The Spotify podcast is absolutely incredible.",
    likes: 45, color: "#a855f7" },
];

export default function LandingPage() {
  const [scrolled,      setScrolled]      = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [carouselIdx,   setCarouselIdx]   = useState(0);
  const autoRef = useRef(null);

  // nav scroll shadow
  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 60);
      if (window.scrollY > 100 && menuOpen) setMenuOpen(false);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [menuOpen]);

  // active section tracker
  useEffect(() => {
    const observers = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveSection(id); },
        { rootMargin: "-35% 0px -35% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  // carousel auto-advance
  useEffect(() => {
    autoRef.current = setInterval(
      () => setCarouselIdx(i => (i + 1) % CAROUSEL.length), 5500
    );
    return () => clearInterval(autoRef.current);
  }, []);

  const goPrev  = () => { clearInterval(autoRef.current); setCarouselIdx(i => (i - 1 + CAROUSEL.length) % CAROUSEL.length); };
  const goNext  = () => { clearInterval(autoRef.current); setCarouselIdx(i => (i + 1) % CAROUSEL.length); };
  const goTo    = (i) => { clearInterval(autoRef.current); setCarouselIdx(i); };
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const item = CAROUSEL[carouselIdx];

  return (
    <div style={{ background: "#03060f", color: "#e0eaf5", fontFamily: "'DM Mono','Fira Code',monospace", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #03060f; }

        /* NAV */
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 300; transition: background 0.35s, border-color 0.35s; border-bottom: 1px solid transparent; }
        .lp-nav.scrolled { background: rgba(3,6,15,0.97); backdrop-filter: blur(24px); border-bottom-color: rgba(255,255,255,0.06); }
        .lp-navlink { color: #2a5070; text-decoration: none; font-size: 10px; letter-spacing: 0.14em; transition: color 0.2s; padding-bottom: 3px; border-bottom: 1px solid transparent; background: none; border-top: none; border-left: none; border-right: none; cursor: pointer; font-family: inherit; }
        .lp-navlink:hover { color: #ff6633; }
        .lp-navlink.active { color: #ff6633; border-bottom-color: rgba(255,80,30,0.7); }

        /* BUTTONS */
        .lp-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 10px; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.1em; cursor: pointer; transition: all 0.22s; text-decoration: none; border: none; white-space: nowrap; }
        .lp-btn-fire { background: linear-gradient(135deg,#cc2200,#ff5533,#ff8844); color: #fff; }
        .lp-btn-fire:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,80,30,0.35); }
        .lp-btn-ghost { background: transparent; color: #c0d4e8; border: 1px solid rgba(255,255,255,0.13); }
        .lp-btn-ghost:hover { border-color: rgba(255,80,30,0.45); color: #ff6633; background: rgba(255,80,30,0.05); }
        .lp-btn-blue { background: linear-gradient(135deg,#0055cc,#0088ff); color: #fff; }
        .lp-btn-blue:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,136,255,0.3); }
        .lp-btn-green { background: linear-gradient(135deg,#1db954,#1ed760); color: #fff; }
        .lp-btn-green:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(29,185,84,0.3); }

        /* CARDS */
        .lp-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; transition: border-color 0.25s, transform 0.25s; }
        .lp-card:hover { border-color: rgba(255,80,30,0.22); transform: translateY(-3px); }

        /* HELPERS */
        .syne { font-family: 'Syne', sans-serif; }
        .grad-fire { background: linear-gradient(135deg,#ff8844,#ff3300,#0088ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .grad-blue { background: linear-gradient(135deg,#0088ff,#44ccff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .section-tag { font-size: 10px; letter-spacing: 0.22em; color: #ff6633; margin-bottom: 14px; display: block; }
        .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,60,20,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0,100,255,0.018) 1px, transparent 1px); background-size: 64px 64px; pointer-events: none; }

        /* SIDE NAV INDICATOR */
        .side-nav { position: fixed; left: 18px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 200; }
        .side-dot { display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 2px 0; }
        .side-bar { height: 7px; border-radius: 4px; transition: all 0.32s; }
        .side-label { font-size: 8px; letter-spacing: 0.14em; color: #ff6633; opacity: 0; transition: opacity 0.2s; white-space: nowrap; pointer-events: none; }
        .side-dot:hover .side-label { opacity: 1; }

        /* ANIMATIONS */
        @keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow   { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
        .anim-1 { animation: fadeUp 0.7s ease both; }
        .anim-2 { animation: fadeUp 0.7s 0.12s ease both; }
        .anim-3 { animation: fadeUp 0.7s 0.24s ease both; }
        .anim-4 { animation: fadeUp 0.7s 0.36s ease both; }

        /* SOCIAL ICONS */
        .soc-icon { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); color: #2a5070; text-decoration: none; font-size: 16px; transition: all 0.2s; }
        .soc-icon:hover { border-color: rgba(255,80,30,0.5); color: #ff6633; background: rgba(255,80,30,0.08); transform: translateY(-2px); }

        /* FOOTER */
        .ft-link { display: block; font-size: 12px; color: #1a3a5a; text-decoration: none; margin-bottom: 10px; transition: color 0.2s; letter-spacing: 0.04em; }
        .ft-link:hover { color: #ff6633; }

        /* TOPICS */
        .topic-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 100px; cursor: pointer; transition: all 0.2s; text-decoration: none; color: #4a6a8a; font-size: 11px; letter-spacing: 0.04em; }
        .topic-pill:hover { border-color: rgba(255,80,30,0.4); color: #ff6633; background: rgba(255,80,30,0.06); transform: translateY(-2px); }

        /* CAROUSEL */
        .c-dot { height: 7px; border-radius: 4px; border: none; cursor: pointer; transition: all 0.32s; padding: 0; }

        /* MOBILE FULLSCREEN MENU */
        .mob-menu { position: fixed; inset: 0; background: rgba(3,6,15,0.98); backdrop-filter: blur(24px); z-index: 280; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
        .mob-navlink { font-size: 20px; letter-spacing: 0.16em; color: #4a6a8a; background: none; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-weight: 700; transition: color 0.2s; padding: 8px 0; }
        .mob-navlink.active { color: #ff6633; }
        .mob-navlink:hover { color: #ff6633; }
        .mob-close { position: absolute; top: 20px; right: 24px; background: none; border: none; color: #4a6a8a; font-size: 28px; cursor: pointer; transition: color 0.2s; }
        .mob-close:hover { color: #ff6633; }

        /* COMMENT FORM */
        .comment-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; color: #e0eaf5; font-family: inherit; font-size: 13px; outline: none; resize: vertical; min-height: 90px; }
        .coming-soon-overlay { position: absolute; inset: 0; background: rgba(3,6,15,0.75); backdrop-filter: blur(4px); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; z-index: 10; }

        /* HAMBURGER */
        .hamburger { display: none; background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e0eaf5; width: 38px; height: 38px; cursor: pointer; font-size: 18px; align-items: center; justify-content: center; transition: border-color 0.2s; }
        .hamburger:hover { border-color: rgba(255,80,30,0.4); color: #ff6633; }

        /* ── RESPONSIVE ─────────────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .side-nav { display: none !important; }
          .hide-mobile { display: none !important; }
          .hamburger { display: flex !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-logo-col { order: -1; }
          .about-grid { grid-template-columns: 1fr !important; }
          .podcast-grid { grid-template-columns: 1fr !important; }
          .carousel-main { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .mini-grid { grid-template-columns: 1fr 1fr !important; }
          .comments-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 540px) {
          .footer-grid { grid-template-columns: 1fr !important; }
          .about-pillars { grid-template-columns: 1fr !important; }
          .mini-grid { grid-template-columns: 1fr !important; }
          .hero-stats { gap: 28px !important; }
        }
      `}</style>

      {/* ══ LEFT SECTION INDICATOR (desktop) ══════════════════════════════════ */}
      <div className="side-nav">
        {SECTIONS.map(s => (
          <button key={s.id} className="side-dot" onClick={() => scrollTo(s.id)} title={s.label}>
            <div className="side-bar" style={{
              width: activeSection === s.id ? 22 : 7,
              background: activeSection === s.id
                ? "linear-gradient(90deg,#ff5533,#ff8844)"
                : "rgba(255,255,255,0.13)",
            }} />
            <span className="side-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ══ MOBILE FULL-SCREEN MENU ═══════════════════════════════════════════ */}
      {menuOpen && (
        <div className="mob-menu">
          <button className="mob-close" onClick={() => setMenuOpen(false)}>✕</button>
          <img src={lifeLogoLong} alt="4Life Mystery" style={{ height: 48, width: "auto", objectFit: "contain", marginBottom: 16 }} />
          {SECTIONS.map(({ id, label }) => (
            <button key={id} className={`mob-navlink${activeSection === id ? " active" : ""}`} onClick={() => scrollTo(id)}>
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
      <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          {/* Logo */}
          <a href="/" onClick={e => { e.preventDefault(); scrollTo("hero"); }} style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src={lifeLogoLong} alt="4Life Mystery"
              style={{ height: 42, width: "auto", objectFit: "contain", maxWidth: 180 }} />
          </a>

          {/* Desktop nav links */}
          <div className="hide-mobile" style={{ display: "flex", gap: 26, alignItems: "center" }}>
            {SECTIONS.filter(s => s.id !== "hero").map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className={`lp-navlink${activeSection === id ? " active" : ""}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Right: social + hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="YouTube">▶</a>
            <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="TikTok">♪</a>
            <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="Spotify">◎</a>
            <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Open menu">☰</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section id="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", padding: "100px 20px 80px" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", width: "60vw", height: "60vw", maxWidth: 700, maxHeight: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(180,40,0,0.07),transparent 68%)", top: "10%", right: "-10%", pointerEvents: "none", animation: "glow 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: "40vw", height: "40vw", maxWidth: 500, maxHeight: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,80,200,0.06),transparent 68%)", bottom: "10%", left: "-5%", pointerEvents: "none", animation: "glow 9s 2s ease-in-out infinite" }} />

        <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 48, alignItems: "center" }}>

            {/* Text col */}
            <div>
              <div className="anim-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 100, background: "rgba(255,80,30,0.08)", border: "1px solid rgba(255,80,30,0.2)", marginBottom: 28 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5533", display: "inline-block", animation: "glow 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#ff6633", letterSpacing: "0.16em" }}>LIFE · MYSTERY · CONNECTION</span>
              </div>

              <h1 className="syne anim-2" style={{ fontWeight: 800, fontSize: "clamp(34px, 6vw, 66px)", lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 20 }}>
                The questions<br />
                <span className="grad-fire">worth asking</span><br />
                <span style={{ color: "#e0eaf5" }}>live here.</span>
              </h1>

              {/* Uncover tagline logo */}
              <div className="anim-2" style={{ marginBottom: 22 }}>
                <img src={uncoverLogo} alt="Uncover the Unknown"
                  style={{ height: "clamp(28px, 4vw, 44px)", width: "auto", objectFit: "contain", opacity: 0.9 }} />
              </div>

              <p className="anim-3" style={{ fontSize: "clamp(13px, 1.5vw, 15px)", color: "#4a6a8a", lineHeight: 1.85, maxWidth: 520, marginBottom: 36 }}>
                4Life Mystery is a space for real conversations about life — its meaning, its mysteries, and everything between. No algorithm. No noise. Just honest human thought.
              </p>

              <div className="anim-4" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
                <button onClick={() => scrollTo("content")} className="lp-btn lp-btn-fire">EXPLORE CONTENT</button>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost">▶ WATCH ON YOUTUBE</a>
              </div>

              <div className="hero-stats anim-4" style={{ display: "flex", gap: 44, flexWrap: "wrap" }}>
                {[["10K+","FOLLOWERS"],["50+","EPISODES"],["∞","QUESTIONS"]].map(([n,l]) => (
                  <div key={l}>
                    <div className="syne grad-fire" style={{ fontWeight: 800, fontSize: "clamp(24px,3vw,32px)" }}>{n}</div>
                    <div style={{ fontSize: 9, color: "#1a3a5a", letterSpacing: "0.2em", marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logo col */}
            <div className="hero-logo-col" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img src={mainLogo} alt="4Life Mystery"
                style={{ width: "100%", maxWidth: 380, height: "auto", objectFit: "contain", filter: "drop-shadow(0 0 60px rgba(200,60,0,0.25))" }} />
            </div>
          </div>

          {/* Privacy visible above fold – addresses Google OAuth requirement */}
          <div className="anim-4" style={{ marginTop: 60, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#0a1a2a", letterSpacing: "0.08em" }}>4LIFEMYSTERY.COM</span>
            <Link to="/privacy-policy" style={{ fontSize: 10, color: "#1a3a5a", textDecoration: "none", letterSpacing: "0.08em", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ff6633"}
              onMouseLeave={e => e.currentTarget.style.color = "#1a3a5a"}>
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" style={{ fontSize: 10, color: "#1a3a5a", textDecoration: "none", letterSpacing: "0.08em", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ff6633"}
              onMouseLeave={e => e.currentTarget.style.color = "#1a3a5a"}>
              Terms of Service
            </Link>
          </div>
        </div>
      </section>

      {/* ══ ABOUT ═════════════════════════════════════════════════════════════ */}
      <section id="about" style={{ padding: "100px 20px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <span className="section-tag">WHAT IS 4LIFE MYSTERY</span>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>

            {/* Profile image */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative", maxWidth: 400, width: "100%" }}>
                <img src={profileImg} alt="4Life Mystery"
                  style={{ width: "100%", height: "auto", borderRadius: 20, objectFit: "cover", filter: "drop-shadow(0 0 40px rgba(150,40,0,0.3))", display: "block" }} />
                <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, background: "rgba(3,6,15,0.8)", backdropFilter: "blur(12px)", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(255,80,30,0.2)" }}>
                  <div className="syne" style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>4Life Mystery</div>
                  <div style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: "0.1em" }}>CREATOR · THINKER · STORYTELLER</div>
                </div>
              </div>
            </div>

            {/* Text */}
            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.18, marginBottom: 20 }}>
                A community built on{" "}
                <span className="grad-fire">radical honesty.</span>
              </h2>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 16 }}>
                We live in a world that moves fast and talks loud, but rarely stops to ask the questions that actually matter. 4Life Mystery is the pause — the space where you can sit with the uncomfortable, the unexplained, and the deeply human.
              </p>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 32 }}>
                Whether you're questioning your purpose, processing grief, navigating relationships, or just curious about what it means to be alive — you belong here.
              </p>

              <div className="about-pillars" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
                {[
                  { icon: "◈", title: "Depth",     desc: "No surface-level takes. Every piece goes deep into what actually matters." },
                  { icon: "◇", title: "Honesty",   desc: "Real experiences, real feelings, real talk — no performance." },
                  { icon: "◉", title: "Community", desc: "A growing space of thinkers, feelers, and honest questioners." },
                  { icon: "◐", title: "Mystery",   desc: "We sit with questions that don't have easy answers — that's the point." },
                ].map(p => (
                  <div key={p.title} className="lp-card" style={{ padding: 18 }}>
                    <div style={{ fontSize: 20, color: "#ff5533", marginBottom: 10 }}>{p.icon}</div>
                    <div className="syne" style={{ fontWeight: 700, fontSize: 13, marginBottom: 7, color: "#e0eaf5" }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "#4a6a8a", lineHeight: 1.7 }}>{p.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire">JOIN THE CONVERSATION</a>
                <button onClick={() => scrollTo("community")} className="lp-btn lp-btn-ghost">COMMUNITY →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CONTENT CAROUSEL ══════════════════════════════════════════════════ */}
      <section id="content" style={{ padding: "100px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <span className="section-tag">FEATURED CONTENT</span>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,38px)" }}>
                Latest from <span className="grad-fire">4Life Mystery</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["←", goPrev],["→", goNext]].map(([lbl, fn]) => (
                <button key={lbl} onClick={fn} style={{ width: 42, height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#c0d4e8", cursor: "pointer", fontSize: 18, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,80,30,0.45)"; e.currentTarget.style.color = "#ff6633"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c0d4e8"; }}
                >{lbl}</button>
              ))}
            </div>
          </div>

          {/* Main slide */}
          <div className="carousel-main" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${item.color}28`, borderRadius: 18, padding: "30px 28px", display: "flex", flexDirection: "column", transition: "all 0.4s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 9, padding: "5px 12px", borderRadius: 100, background: `${item.color}14`, color: item.color, border: `1px solid ${item.color}28`, letterSpacing: "0.12em" }}>{item.platform}</span>
                <span style={{ fontSize: 9, color: "#1a3a5a", letterSpacing: "0.1em" }}>{item.tag}</span>
              </div>
              <h3 className="syne" style={{ fontWeight: 800, fontSize: "clamp(20px,2.5vw,27px)", lineHeight: 1.28, marginBottom: 16, color: "#e0eaf5" }}>{item.title}</h3>
              <p style={{ color: "#4a6a8a", lineHeight: 1.84, fontSize: 13, flex: 1, marginBottom: 28 }}>{item.excerpt}</p>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire" style={{ alignSelf: "flex-start" }}>
                {item.icon} WATCH / LISTEN NOW
              </a>
            </div>

            <div style={{ background: `linear-gradient(145deg,rgba(0,0,0,0.5),${item.color}0c)`, border: `1px solid ${item.color}1a`, borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 240, transition: "all 0.4s", padding: 24 }}>
              <div style={{ fontSize: 52, color: item.color, opacity: 0.55 }}>{item.icon}</div>
              <div style={{ fontSize: 10, color: "#2a5070", letterSpacing: "0.18em" }}>AVAILABLE ON {item.platform}</div>
              <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: item.color, textDecoration: "none", letterSpacing: "0.1em", border: `1px solid ${item.color}30`, padding: "8px 18px", borderRadius: 8, transition: "all 0.2s" }}>OPEN →</a>
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 24 }}>
            {CAROUSEL.map((_, i) => (
              <button key={i} className="c-dot" onClick={() => goTo(i)}
                style={{ width: i === carouselIdx ? 26 : 8, background: i === carouselIdx ? "#ff5533" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>

          {/* Mini grid */}
          <div className="mini-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {CAROUSEL.map((c, i) => (
              <div key={c.id} onClick={() => goTo(i)} className="lp-card" style={{ padding: "14px 16px", cursor: "pointer", border: `1px solid ${i === carouselIdx ? "#ff553440" : "rgba(255,255,255,0.07)"}`, background: i === carouselIdx ? "rgba(255,80,30,0.04)" : undefined }}>
                <div style={{ fontSize: 9, color: c.color, letterSpacing: "0.12em", marginBottom: 7 }}>{c.platform}</div>
                <div className="syne" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, color: "#c0d4e8" }}>{c.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TIKTOK STRIP ══════════════════════════════════════════════════════ */}
      <section style={{ padding: "56px 20px", background: "rgba(0,242,234,0.013)", borderTop: "1px solid rgba(0,242,234,0.06)", borderBottom: "1px solid rgba(0,242,234,0.06)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,242,234,0.08)", border: "1px solid rgba(0,242,234,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#00f2ea", flexShrink: 0 }}>♪</div>
            <div>
              <div className="syne" style={{ fontWeight: 700, fontSize: "clamp(15px,2.5vw,18px)", marginBottom: 4 }}>@lifemystery183284 on TikTok</div>
              <div style={{ fontSize: 12, color: "#4a6a8a" }}>60-second truths. Bite-sized thoughts that hit hard.</div>
            </div>
          </div>
          <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(0,242,234,0.3)", color: "#00f2ea" }}>
            ♪ FOLLOW ON TIKTOK
          </a>
        </div>
      </section>

      {/* ══ PODCAST / SPOTIFY ═════════════════════════════════════════════════ */}
      <section id="podcast" style={{ padding: "100px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <span className="section-tag" style={{ color: "#1db954" }}>PODCAST</span>
          <div className="podcast-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.18, marginBottom: 20 }}>
                Listen on <span style={{ color: "#1db954" }}>Spotify.</span>
              </h2>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 16 }}>
                The 4Life Mystery podcast goes even deeper. Long-form conversations exploring life's biggest questions — no time limits, no edits, no filter.
              </p>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 32 }}>
                From the mystery of consciousness to navigating grief, love, and the everyday strangeness of being human. New episodes every week.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-green">◎ LISTEN NOW</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost">ALL EPISODES →</a>
              </div>
            </div>

            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(29,185,84,0.18)" }}>
              <iframe
                src={`https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`}
                width="100%" height="352"
                style={{ border: "none", display: "block" }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="4Life Mystery Podcast"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOPICS ════════════════════════════════════════════════════════════ */}
      <section id="topics" style={{ padding: "100px 20px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <span className="section-tag">EXPLORE TOPICS</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
            <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,38px)" }}>
              What moves <span className="grad-fire">you?</span>
            </h2>
            <p style={{ color: "#4a6a8a", fontSize: 12, lineHeight: 1.7, maxWidth: 340 }}>
              Every topic is a doorway. Pick one that resonates — or sit with all of them.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
            {TOPICS.map(t => (
              <a key={t.name} href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="topic-pill">
                <span style={{ color: "#ff5533" }}>{t.icon}</span>
                <span>{t.name}</span>
                <span style={{ fontSize: 9, color: "#1a3a5a" }}>{t.count}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMMUNITY + COMMENTS ══════════════════════════════════════════════ */}
      <section id="community" style={{ padding: "100px 20px", position: "relative", overflow: "hidden" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", width: "60vw", height: "60vw", maxWidth: 700, maxHeight: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(150,40,0,0.05),transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1180, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <span className="section-tag">COMMUNITY</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,42px)", lineHeight: 1.15 }}>
                The conversation is just{" "}
                <span className="grad-fire">getting started.</span>
              </h2>
              <p style={{ color: "#4a6a8a", fontSize: 13, lineHeight: 1.84, maxWidth: 560, marginTop: 14 }}>
                Join the discussion below — share what moves you, what you're questioning, or what you want explored next.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire">▶ YOUTUBE</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(0,242,234,0.3)", color: "#00f2ea" }}>♪ TIKTOK</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(29,185,84,0.3)", color: "#1db954" }}>◎ SPOTIFY</a>
            </div>
          </div>

          {/* Comment form — disabled, coming soon */}
          <div style={{ position: "relative", marginBottom: 40 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px 24px 20px", filter: "blur(1.5px)", pointerEvents: "none" }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,80,30,0.12)", border: "1px solid rgba(255,80,30,0.2)", flexShrink: 0 }} />
                <input readOnly placeholder="Your name" style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#e0eaf5", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
              </div>
              <textarea readOnly placeholder="Share your thoughts, questions, or what you'd like us to explore…" className="comment-input" />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <div className="lp-btn lp-btn-fire" style={{ opacity: 0.5 }}>POST COMMENT</div>
              </div>
            </div>
            {/* Coming soon overlay */}
            <div className="coming-soon-overlay">
              <div style={{ fontSize: 28, color: "#ff5533" }}>◉</div>
              <div className="syne" style={{ fontWeight: 700, fontSize: 16, color: "#e0eaf5" }}>Comments Coming Soon</div>
              <div style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: "0.1em", textAlign: "center", maxWidth: 280, lineHeight: 1.7 }}>
                Full community features — post, comment, and connect — are in the works.
              </div>
            </div>
          </div>

          {/* Static sample comments */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#1a3a5a", letterSpacing: "0.16em", marginBottom: 20 }}>RECENT DISCUSSION · {STATIC_COMMENTS.length} COMMENTS</div>
            <div className="comments-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {STATIC_COMMENTS.map(c => (
                <div key={c.id} className="comment-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${c.color}18`, border: `1px solid ${c.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.color, flexShrink: 0 }}>{c.initials}</div>
                    <div>
                      <div className="syne" style={{ fontWeight: 700, fontSize: 13, color: "#e0eaf5" }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: "#1a3a5a", letterSpacing: "0.06em" }}>{c.time}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "#6a8aa8", lineHeight: 1.78, marginBottom: 14 }}>{c.text}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, color: "#1a3a5a" }}>♥</span>
                    <span style={{ fontSize: 11, color: "#1a3a5a" }}>{c.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "60px 20px 36px", background: "rgba(0,0,0,0.4)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 36, marginBottom: 48 }}>

            {/* Brand */}
            <div>
              <img src={lifeLogoLong} alt="4Life Mystery" style={{ height: 40, width: "auto", objectFit: "contain", marginBottom: 16 }} />
              <p style={{ fontSize: 12, color: "#1a3a5a", lineHeight: 1.84, maxWidth: 250, marginBottom: 20 }}>
                A space for real conversations about life — its meaning, its mysteries, and everything in between.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon" title="YouTube">▶</a>
                <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon" title="TikTok">♪</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon" title="Spotify">◎</a>
              </div>
            </div>

            {/* Explore */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>EXPLORE</div>
              {SECTIONS.map(({ id, label }) => (
                <button key={id} onClick={() => scrollTo(id)} className="ft-link" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>
                  {label === "HOME" ? "Home" : label.charAt(0) + label.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Watch & Listen */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>WATCH & LISTEN</div>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="ft-link">▶ YouTube</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="ft-link">♪ TikTok</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="ft-link">◎ Spotify Podcast</a>
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>LEGAL</div>
              <Link to="/privacy-policy"   className="ft-link">Privacy Policy</Link>
              <Link to="/terms-of-service" className="ft-link">Terms of Service</Link>
              <Link to="/login"            className="ft-link" style={{ marginTop: 16, color: "#0a1520" }}>Studio</Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#0a1a2a" }}>© 2026 4Life Mystery · 4lifemystery.com · All rights reserved.</div>
            <div style={{ display: "flex", gap: 20 }}>
              <Link to="/privacy-policy"   style={{ fontSize: 10, color: "#0f2030", textDecoration: "none" }}>Privacy</Link>
              <Link to="/terms-of-service" style={{ fontSize: 10, color: "#0f2030", textDecoration: "none" }}>Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
