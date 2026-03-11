import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// ── Social links ──────────────────────────────────────────────────────────────
const SOCIAL = {
  youtube: "https://www.youtube.com/@4lifemystery",
  tiktok:  "https://www.tiktok.com/@lifemystery183284",
  spotify: "https://open.spotify.com/show/2ZIZRXomO55COqXyJXgy5s",
};

// YouTube video IDs from @4lifemystery — paste the 11-char ID from each video URL
// e.g. for https://youtu.be/dQw4w9WgXcQ the ID is dQw4w9WgXcQ
const VIDEOS = [
  { id: 1, videoId: "", title: "Video 1", desc: "", tag: "Life" },
  { id: 2, videoId: "", title: "Video 2", desc: "", tag: "Life" },
  { id: 3, videoId: "", title: "Video 3", desc: "", tag: "Life" },
  { id: 4, videoId: "", title: "Video 4", desc: "", tag: "Life" },
  { id: 5, videoId: "", title: "Video 5", desc: "", tag: "Life" },
];

const CAROUSEL = [
  {
    id: 1, platform: "YOUTUBE", icon: "▶", color: "#ff4444",
    title: "Why Does Life Feel Meaningless?",
    excerpt: "An honest exploration of existential emptiness and what it's actually trying to tell you.",
    tag: "Existence", link: SOCIAL.youtube,
  },
  {
    id: 2, platform: "TIKTOK", icon: "♪", color: "#00f2ea",
    title: "The 60-Second Truth About Fear",
    excerpt: "Fear isn't your enemy. It's a signal. Here's how to read it before it controls you.",
    tag: "Mental Health", link: SOCIAL.tiktok,
  },
  {
    id: 3, platform: "PODCAST", icon: "◎", color: "#1db954",
    title: "Connection in a Disconnected World",
    excerpt: "Episode 12 — Why modern life made us more reachable but less truly reached.",
    tag: "Relationships", link: SOCIAL.spotify,
  },
  {
    id: 4, platform: "YOUTUBE", icon: "▶", color: "#ff4444",
    title: "The Mystery of Consciousness",
    excerpt: "What is it that makes you *you*? This question has haunted philosophers for centuries.",
    tag: "Philosophy", link: SOCIAL.youtube,
  },
];

const TOPICS = [
  { name: "Identity & Purpose", icon: "◈", count: 24 },
  { name: "Mental Health",      icon: "◎", count: 18 },
  { name: "Relationships",      icon: "◇", count: 31 },
  { name: "Mortality & Meaning",icon: "◉", count: 15 },
  { name: "Consciousness",      icon: "◐", count: 12 },
  { name: "Spirituality",       icon: "◑", count: 20 },
  { name: "Philosophy",         icon: "◒", count: 27 },
  { name: "Society & Culture",  icon: "◓", count: 22 },
];

const SPOTIFY_SHOW_ID = "2ZIZRXomO55COqXyJXgy5s";

export default function LandingPage() {
  const [scrolled,     setScrolled]     = useState(false);
  const [carouselIdx,  setCarouselIdx]  = useState(0);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const autoRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    autoRef.current = setInterval(() =>
      setCarouselIdx(i => (i + 1) % CAROUSEL.length), 5500
    );
    return () => clearInterval(autoRef.current);
  }, []);

  const goPrev = () => { clearInterval(autoRef.current); setCarouselIdx(i => (i - 1 + CAROUSEL.length) % CAROUSEL.length); };
  const goNext = () => { clearInterval(autoRef.current); setCarouselIdx(i => (i + 1) % CAROUSEL.length); };
  const goTo   = (i) => { clearInterval(autoRef.current); setCarouselIdx(i); };

  const item = CAROUSEL[carouselIdx];

  return (
    <div style={{ background: "#03060f", color: "#e0eaf5", fontFamily: "'DM Mono','Fira Code',monospace", overflowX: "hidden", lineHeight: 1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #03060f; }

        /* Nav */
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 200; transition: background 0.35s, border-color 0.35s; border-bottom: 1px solid transparent; }
        .lp-nav.scrolled { background: rgba(3,6,15,0.96); backdrop-filter: blur(24px); border-bottom-color: rgba(255,255,255,0.05); }
        .lp-navlink { color: #2a5070; text-decoration: none; font-size: 10px; letter-spacing: 0.14em; transition: color 0.2s; }
        .lp-navlink:hover { color: #00b4ff; }

        /* Buttons */
        .lp-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 28px; border-radius: 10px; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.1em; cursor: pointer; transition: all 0.22s; text-decoration: none; border: none; }
        .lp-btn-fill { background: linear-gradient(135deg,#0070cc,#00b4ff); color: #fff; }
        .lp-btn-fill:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 10px 36px rgba(0,180,255,0.28); }
        .lp-btn-ghost { background: transparent; color: #c0d4e8; border: 1px solid rgba(255,255,255,0.14); }
        .lp-btn-ghost:hover { border-color: rgba(0,180,255,0.45); color: #00b4ff; background: rgba(0,180,255,0.05); }
        .lp-btn-green { background: linear-gradient(135deg,#1db954,#1ed760); color: #fff; }
        .lp-btn-green:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 10px 36px rgba(29,185,84,0.28); }

        /* Cards */
        .lp-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; transition: border-color 0.25s, background 0.25s, transform 0.25s; }
        .lp-card:hover { border-color: rgba(0,180,255,0.22); background: rgba(0,180,255,0.035); transform: translateY(-4px); }

        /* Grid */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .grid-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }

        /* Text helpers */
        .syne { font-family: 'Syne', sans-serif; }
        .grad-blue { background: linear-gradient(135deg,#00b4ff,#00ff88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .grad-purple { background: linear-gradient(135deg,#a855f7,#00b4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .grad-red { background: linear-gradient(135deg,#ff4444,#ff8844); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .section-tag { font-size: 10px; letter-spacing: 0.22em; color: #00b4ff; margin-bottom: 14px; display: block; }

        /* Backgrounds */
        .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(0,150,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(0,150,255,0.022) 1px, transparent 1px); background-size: 64px 64px; pointer-events: none; }

        /* Animations */
        @keyframes fadeUp   { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn  { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes glow     { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        .anim-1 { animation: fadeUp 0.65s ease both; }
        .anim-2 { animation: fadeUp 0.65s 0.12s ease both; }
        .anim-3 { animation: fadeUp 0.65s 0.24s ease both; }
        .anim-4 { animation: fadeUp 0.65s 0.36s ease both; }

        /* Social icons */
        .soc-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); color: #2a5070; text-decoration: none; font-size: 15px; transition: all 0.2s; }
        .soc-icon:hover { border-color: rgba(0,180,255,0.4); color: #00b4ff; background: rgba(0,180,255,0.07); transform: translateY(-2px); }

        /* Footer links */
        .ft-link { display: block; font-size: 12px; color: #1a3a5a; text-decoration: none; margin-bottom: 11px; transition: color 0.2s; letter-spacing: 0.04em; }
        .ft-link:hover { color: #00b4ff; }

        /* Pill tags */
        .topic-pill { display: inline-flex; align-items: center; gap: 9px; padding: 11px 20px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 100px; cursor: pointer; transition: all 0.2s; text-decoration: none; color: #4a6a8a; font-size: 11px; letter-spacing: 0.04em; }
        .topic-pill:hover { border-color: rgba(0,180,255,0.35); color: #00b4ff; background: rgba(0,180,255,0.05); transform: translateY(-2px); }

        /* Embed */
        .embed-wrap { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 14px; border: 1px solid rgba(255,255,255,0.07); }
        .embed-wrap iframe { position: absolute; top:0; left:0; width:100%; height:100%; border: none; }

        /* Carousel dot */
        .c-dot { height: 7px; border-radius: 4px; border: none; cursor: pointer; transition: all 0.32s; padding: 0; }

        /* Mobile */
        @media (max-width: 900px) {
          .grid-2, .grid-2-1, .grid-3, .grid-4 { grid-template-columns: 1fr !important; }
          .hide-mobile { display: none !important; }
          .hero-h1 { font-size: 36px !important; }
          .section-inner { padding-left: 20px !important; padding-right: 20px !important; }
        }
      `}</style>

      {/* ═══════════════════ NAV ═══════════════════ */}
      <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#0070cc,#00ff88)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>4</div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }} className="grad-blue">4loughs</span>
          </a>

          {/* Center links */}
          <div className="hide-mobile" style={{ display: "flex", gap: 30, alignItems: "center" }}>
            {[["#about","ABOUT"],["#content","CONTENT"],["#podcast","PODCAST"],["#topics","TOPICS"],["#community","COMMUNITY"]].map(([h,l]) => (
              <a key={l} href={h} className="lp-navlink">{l}</a>
            ))}
          </div>

          {/* Right — social icons only, no login button */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="YouTube">▶</a>
            <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="TikTok">♪</a>
            <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon hide-mobile" title="Spotify">◎</a>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "140px 28px 100px", textAlign: "center" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,100,255,0.055),transparent 68%)", top: "15%", left: "5%", pointerEvents: "none", animation: "glow 6s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,255,136,0.035),transparent 68%)", bottom: "10%", right: "8%", pointerEvents: "none", animation: "glow 8s 2s ease-in-out infinite" }} />

        <div style={{ maxWidth: 820, position: "relative", zIndex: 1 }}>
          <div className="anim-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px", borderRadius: 100, background: "rgba(0,180,255,0.07)", border: "1px solid rgba(0,180,255,0.18)", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00b4ff", display: "inline-block", animation: "glow 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "#00b4ff", letterSpacing: "0.16em" }}>LIFE · MYSTERY · CONNECTION</span>
          </div>

          <h1 className="hero-h1 syne anim-2" style={{ fontWeight: 800, fontSize: 68, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 26 }}>
            The questions<br />
            <span className="grad-blue">worth asking</span><br />
            <span style={{ color: "#e0eaf5" }}>live here.</span>
          </h1>

          <p className="anim-3" style={{ fontSize: 14, color: "#4a6a8a", lineHeight: 1.85, maxWidth: 540, margin: "0 auto 44px" }}>
            4loughs is a space for real conversations about life — its meaning, its mysteries, and everything between. No algorithm. No noise. Just honest human thought.
          </p>

          <div className="anim-4" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#content" className="lp-btn lp-btn-fill">EXPLORE CONTENT</a>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost">▶ WATCH ON YOUTUBE</a>
          </div>

          {/* Stats */}
          <div className="anim-4" style={{ display: "flex", gap: 48, justifyContent: "center", marginTop: 72 }}>
            {[["10K+","FOLLOWERS"],["50+","EPISODES"],["∞","QUESTIONS"]].map(([n,l]) => (
              <div key={l}>
                <div className="syne grad-blue" style={{ fontWeight: 800, fontSize: 30 }}>{n}</div>
                <div style={{ fontSize: 9, color: "#1a3a5a", letterSpacing: "0.22em", marginTop: 5 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ ABOUT ═══════════════════ */}
      <section id="about" style={{ padding: "110px 28px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <span className="section-tag">WHAT IS 4LOUGHS</span>
          <div className="grid-2" style={{ alignItems: "center" }}>
            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: 44, lineHeight: 1.18, marginBottom: 22 }}>
                A community built on <span className="grad-purple">radical honesty.</span>
              </h2>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 18 }}>
                We live in a world that moves fast and talks loud, but rarely stops to ask the questions that actually matter. 4loughs is the pause — the space where you can sit with the uncomfortable, the unexplained, and the deeply human.
              </p>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 36 }}>
                Whether you're questioning your purpose, processing grief, navigating relationships, or just curious about what it means to be alive — you belong here.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fill">JOIN THE CONVERSATION</a>
                <a href="#community" className="lp-btn lp-btn-ghost">LEARN MORE</a>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { icon: "◈", title: "Depth",     desc: "No surface-level takes. Every piece goes deep into what actually matters." },
                { icon: "◇", title: "Honesty",   desc: "Real experiences, real feelings, real talk — no performance." },
                { icon: "◉", title: "Community", desc: "A growing space of thinkers, feelers, and honest questioners." },
                { icon: "◐", title: "Mystery",   desc: "We sit with questions that don't have easy answers, and that's the point." },
              ].map(p => (
                <div key={p.title} className="lp-card" style={{ padding: 22 }}>
                  <div style={{ fontSize: 22, color: "#00b4ff", marginBottom: 12 }}>{p.icon}</div>
                  <div className="syne" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#e0eaf5" }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#4a6a8a", lineHeight: 1.7 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CAROUSEL ═══════════════════ */}
      <section id="content" style={{ padding: "110px 28px", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.045)", borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 44 }}>
            <div>
              <span className="section-tag">FEATURED CONTENT</span>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: 38 }}>
                Latest from <span className="grad-blue">4loughs</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["←", goPrev],["→", goNext]].map(([label, fn]) => (
                <button key={label} onClick={fn} style={{ width: 42, height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#c0d4e8", cursor: "pointer", fontSize: 18, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,180,255,0.4)"; e.currentTarget.style.color = "#00b4ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c0d4e8"; }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Main slide */}
          <div className="grid-2" style={{ alignItems: "stretch", marginBottom: 28 }}>
            {/* Info card */}
            <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${item.color}28`, borderRadius: 20, padding: "36px 32px", display: "flex", flexDirection: "column", transition: "all 0.4s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 9, padding: "5px 13px", borderRadius: 100, background: `${item.color}14`, color: item.color, border: `1px solid ${item.color}28`, letterSpacing: "0.12em" }}>{item.platform}</span>
                <span style={{ fontSize: 9, color: "#1a3a5a", letterSpacing: "0.1em" }}>{item.tag}</span>
              </div>
              <h3 className="syne" style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.28, marginBottom: 18, color: "#e0eaf5" }}>{item.title}</h3>
              <p style={{ color: "#4a6a8a", lineHeight: 1.84, fontSize: 13, flex: 1, marginBottom: 30 }}>{item.excerpt}</p>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fill" style={{ alignSelf: "flex-start" }}>
                {item.icon} WATCH / LISTEN NOW
              </a>
            </div>

            {/* Visual */}
            <div style={{ background: `linear-gradient(145deg, rgba(0,0,0,0.45), ${item.color}0a)`, border: `1px solid ${item.color}1a`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, minHeight: 260, transition: "all 0.4s" }}>
              <div style={{ fontSize: 56, color: item.color, opacity: 0.55 }}>{item.icon}</div>
              <div style={{ fontSize: 10, color: "#2a5070", letterSpacing: "0.18em" }}>AVAILABLE ON {item.platform}</div>
              <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: item.color, textDecoration: "none", letterSpacing: "0.1em", border: `1px solid ${item.color}30`, padding: "8px 18px", borderRadius: 8, transition: "all 0.2s" }}>
                OPEN →
              </a>
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 28 }}>
            {CAROUSEL.map((_, i) => (
              <button key={i} className="c-dot" onClick={() => goTo(i)} style={{ width: i === carouselIdx ? 26 : 8, background: i === carouselIdx ? "#00b4ff" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>

          {/* Mini grid */}
          <div className="grid-4">
            {CAROUSEL.map((c, i) => (
              <div key={c.id} onClick={() => goTo(i)} className="lp-card" style={{ padding: "16px 18px", cursor: "pointer", border: `1px solid ${i === carouselIdx ? "#00b4ff40" : "rgba(255,255,255,0.07)"}`, background: i === carouselIdx ? "rgba(0,180,255,0.045)" : undefined }}>
                <div style={{ fontSize: 9, color: c.color, letterSpacing: "0.12em", marginBottom: 8 }}>{c.platform}</div>
                <div className="syne" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, color: "#c0d4e8" }}>{c.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ VIDEOS ═══════════════════ */}
      <section style={{ padding: "110px 28px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <span className="section-tag">WATCH</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
            <h2 className="syne" style={{ fontWeight: 800, fontSize: 38 }}>
              Latest <span className="grad-red">YouTube</span> drops
            </h2>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ fontSize: 10 }}>VIEW CHANNEL →</a>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 20 }}>
            {VIDEOS.filter(v => v.videoId).map(v => (
              <div key={v.id} className="lp-card" style={{ overflow: "hidden" }}>
                {/* Embedded player */}
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${v.videoId}?rel=0&modestbranding=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
                <div style={{ padding: "16px 18px 18px" }}>
                  <span style={{ fontSize: 9, padding: "4px 10px", borderRadius: 100, background: "rgba(0,180,255,0.08)", color: "#00b4ff", border: "1px solid rgba(0,180,255,0.18)", letterSpacing: "0.1em", marginBottom: 10, display: "inline-block" }}>{v.tag}</span>
                  <div className="syne" style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4, marginBottom: 8, color: "#e0eaf5" }}>{v.title}</div>
                  {v.desc && <p style={{ fontSize: 11, color: "#4a6a8a", lineHeight: 1.7, marginBottom: 12 }}>{v.desc}</p>}
                  <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "#ff4444", textDecoration: "none", letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    ▶ WATCH ON YOUTUBE →
                  </a>
                </div>
              </div>
            ))}

            {/* Channel CTA card — always shown */}
            <div className="lp-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, padding: 28, textAlign: "center", background: "linear-gradient(145deg,rgba(255,68,68,0.05),rgba(0,0,0,0.3))" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#ff4444", marginBottom: 18 }}>▶</div>
              <div className="syne" style={{ fontWeight: 700, fontSize: 15, color: "#e0eaf5", marginBottom: 8 }}>More on YouTube</div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 22, lineHeight: 1.7 }}>Watch all episodes on the channel</div>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fill" style={{ fontSize: 10, padding: "10px 22px" }}>
                VIEW CHANNEL →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TIKTOK STRIP ═══════════════════ */}
      <section style={{ padding: "60px 28px", background: "rgba(0,242,234,0.015)", borderTop: "1px solid rgba(0,242,234,0.06)", borderBottom: "1px solid rgba(0,242,234,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,242,234,0.08)", border: "1px solid rgba(0,242,234,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#00f2ea" }}>♪</div>
            <div>
              <div className="syne" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>@lifemystery183284 on TikTok</div>
              <div style={{ fontSize: 12, color: "#4a6a8a" }}>60-second truths. Bite-sized thoughts that hit hard.</div>
            </div>
          </div>
          <a href={SOCIAL.tiktok} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(0,242,234,0.3)", color: "#00f2ea" }}>
            ♪ FOLLOW ON TIKTOK
          </a>
        </div>
      </section>

      {/* ═══════════════════ PODCAST / SPOTIFY ═══════════════════ */}
      <section id="podcast" style={{ padding: "110px 28px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <span className="section-tag" style={{ color: "#1db954" }}>PODCAST</span>
          <div className="grid-2" style={{ alignItems: "center" }}>
            <div>
              <h2 className="syne" style={{ fontWeight: 800, fontSize: 44, lineHeight: 1.18, marginBottom: 22 }}>
                Listen on <span style={{ color: "#1db954" }}>Spotify.</span>
              </h2>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 18 }}>
                The 4loughs podcast goes even deeper. Long-form conversations exploring life's biggest questions — no time limits, no edits, no filter.
              </p>
              <p style={{ color: "#4a6a8a", lineHeight: 1.92, fontSize: 13, marginBottom: 36 }}>
                From the mystery of consciousness to navigating grief, love, and the everyday strangeness of being human. New episodes every week.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-green">◎ LISTEN NOW</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost">ALL EPISODES →</a>
              </div>
            </div>

            {/* Spotify embed — update SPOTIFY_SHOW_ID constant at the top */}
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(29,185,84,0.18)" }}>
              {SPOTIFY_SHOW_ID !== "YOUR_SHOW_ID" ? (
                <iframe
                  src={`https://open.spotify.com/embed/show/${SPOTIFY_SHOW_ID}?utm_source=generator&theme=0`}
                  width="100%" height="352"
                  style={{ border: "none", display: "block" }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  title="4loughs Podcast"
                />
              ) : (
                /* Placeholder until show ID is set */
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 352, background: "linear-gradient(145deg,rgba(29,185,84,0.06),rgba(0,0,0,0.4))", textDecoration: "none", gap: 16 }}>
                  <div style={{ fontSize: 48, color: "#1db954", opacity: 0.6 }}>◎</div>
                  <div className="syne" style={{ fontWeight: 700, fontSize: 16, color: "#1db954" }}>4loughs Podcast</div>
                  <div style={{ fontSize: 11, color: "#2a5070", letterSpacing: "0.1em" }}>LISTEN ON SPOTIFY →</div>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TOPICS ═══════════════════ */}
      <section id="topics" style={{ padding: "110px 28px", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.045)", borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <span className="section-tag">EXPLORE TOPICS</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
            <h2 className="syne" style={{ fontWeight: 800, fontSize: 38 }}>
              What moves <span className="grad-purple">you?</span>
            </h2>
            <p style={{ color: "#4a6a8a", fontSize: 12, lineHeight: 1.7, maxWidth: 360 }}>
              Every topic is a doorway. Pick one that resonates — or sit with all of them.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            {TOPICS.map(t => (
              <a key={t.name} href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="topic-pill">
                <span style={{ color: "#00b4ff" }}>{t.icon}</span>
                <span>{t.name}</span>
                <span style={{ fontSize: 9, color: "#1a3a5a", fontWeight: 500 }}>{t.count}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ COMMUNITY CTA ═══════════════════ */}
      <section id="community" style={{ padding: "120px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div className="grid-bg" />
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.04),transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto" }}>
          <span className="section-tag" style={{ color: "#a855f7" }}>COMMUNITY</span>
          <h2 className="syne" style={{ fontWeight: 800, fontSize: 48, lineHeight: 1.15, marginBottom: 22 }}>
            The conversation is just{" "}
            <span className="grad-purple">getting started.</span>
          </h2>
          <p style={{ color: "#4a6a8a", fontSize: 13, lineHeight: 1.88, marginBottom: 40 }}>
            A full community platform — where you can post, comment, and connect with others thinking deeply about life — is coming soon. For now, join us where the conversation is already happening.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fill">▶ YOUTUBE</a>
            <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(0,242,234,0.3)", color: "#00f2ea" }}>♪ TIKTOK</a>
            <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ borderColor: "rgba(29,185,84,0.3)", color: "#1db954" }}>◎ SPOTIFY</a>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "64px 28px 40px", background: "rgba(0,0,0,0.35)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 52 }}>

            {/* Brand */}
            <div>
              <div className="syne grad-blue" style={{ fontWeight: 800, fontSize: 24, marginBottom: 14 }}>4loughs</div>
              <p style={{ fontSize: 12, color: "#1a3a5a", lineHeight: 1.84, maxWidth: 260 }}>
                A space for real conversations about life — its meaning, its mysteries, and everything in between.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="soc-icon" title="YouTube">▶</a>
                <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="soc-icon" title="TikTok">♪</a>
                <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="soc-icon" title="Spotify">◎</a>
              </div>
            </div>

            {/* Explore */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>EXPLORE</div>
              {[["#about","About"],["#content","Content"],["#podcast","Podcast"],["#topics","Topics"],["#community","Community"]].map(([h,l]) => (
                <a key={l} href={h} className="ft-link">{l}</a>
              ))}
            </div>

            {/* Watch & Listen */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>WATCH & LISTEN</div>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="ft-link">▶ YouTube</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="ft-link">♪ TikTok</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="ft-link">◎ Spotify</a>
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#1a3a5a", marginBottom: 18 }}>LEGAL & ACCESS</div>
              <Link to="/privacy-policy"   className="ft-link">Privacy Policy</Link>
              <Link to="/terms-of-service" className="ft-link">Terms of Service</Link>
              <Link to="/login"            className="ft-link">Studio Login</Link>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#0a1a2a" }}>© 2026 4loughs · 4lifemystery.com · All rights reserved.</div>
            <div style={{ fontSize: 11, color: "#0a1a2a" }}>Made with ♥ for curious minds.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
