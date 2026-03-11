import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import lifeLogoLong from "../assets/logo/life-logo-long.png";
import uncoverLogo  from "../assets/logo/uncover-unknown-logo.png";
import profileImg   from "../assets/4life_mystery.png";
import faceImg         from "../assets/static/face.jpg";
import brokenThumb     from "../assets/static/broken-video-placeholder.png";
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
    text: "Found this through TikTok and binged every single episode. The Spotify podcast is incredible.",
    likes: 45, color: "#a855f7" },
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

export default function LandingPage() {
  const [theme,         setTheme]         = useState("dark");
  const [scrolled,      setScrolled]      = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [carouselIdx,   setCarouselIdx]   = useState(0);
  const [slideDir,      setSlideDir]      = useState("right");
  const [ytVideos,      setYtVideos]      = useState([]);
  const [ytLoading,     setYtLoading]     = useState(true);
  const [modalVideo,    setModalVideo]    = useState(null);   // { id, title, url }
  const [showBackTop,   setShowBackTop]   = useState(false);
  const wrapperRef  = useRef(null);
  const autoRef     = useRef(null);
  const heroVidRef  = useRef(null);

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

  // Back-to-top visibility (uses wrapper scroll, same as nav scroll detection)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = () => setShowBackTop(el.scrollTop > 600);
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

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

        /* ── YOUTUBE VIDEO GRID ──────────────────────── */
        .yt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:40px; }
        .yt-card { border-radius:16px; overflow:hidden; cursor:pointer; text-decoration:none; display:block;
          background:var(--card-bg); border:1px solid var(--card-br); box-shadow:var(--card-sh,none);
          transition:transform 0.28s, box-shadow 0.28s, border-color 0.28s; position:relative; }
        .yt-card:hover { transform:translateY(-5px); border-color:rgba(200,40,40,0.4); box-shadow:0 14px 44px rgba(180,30,30,0.18); }
        .yt-thumb { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; background:#080808; }
        .yt-thumb img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s; display:block; }
        .yt-card:hover .yt-thumb img { transform:scale(1.04); }
        /* glassmorphic play overlay — always visible, intensifies on hover */
        .yt-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          background:rgba(0,0,0,0.08); opacity:0.65; transition:opacity 0.3s, background 0.3s; pointer-events:none; }
        .yt-card:hover .yt-play { opacity:1; background:rgba(0,0,0,0.22); }
        /* glassmorphic circle — mirrors dashboard .play-btn but in red */
        .yt-play-btn { width:clamp(52px,30%,88px); aspect-ratio:1/1; border-radius:50%;
          background:rgba(195,38,38,0.18); border:2px solid rgba(210,50,50,0.55);
          backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 24px rgba(160,20,20,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          transform:scale(0.9); transition:transform 0.25s, background 0.25s, box-shadow 0.25s; }
        .yt-card:hover .yt-play-btn { transform:scale(1.05); background:rgba(195,38,38,0.32);
          box-shadow:0 6px 32px rgba(180,20,20,0.55), inset 0 1px 0 rgba(255,255,255,0.12); }
        .yt-play-btn svg { width:36%; height:36%; fill:#fff; margin-left:7%;
          filter:drop-shadow(0 1px 4px rgba(0,0,0,0.6)); }
        .yt-play-btn.disabled { opacity:0.28; border-color:rgba(150,150,150,0.3);
          background:rgba(80,80,80,0.15); box-shadow:none; cursor:default; }
        .yt-info { padding:14px 16px 16px; }
        .yt-title { font-size:13px; font-weight:600; line-height:1.45; margin-bottom:8px;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .yt-meta { display:flex; gap:14px; font-size:10px; letter-spacing:0.06em; }
        .yt-skeleton { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);
          background-size:200% 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:10px; }
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
        /* ── BACK TO TOP ─────────────────────────────── */
        .back-to-top { position:fixed; bottom:28px; right:28px; z-index:800;
          width:46px; height:46px; border-radius:50%; border:2px solid rgba(210,50,50,0.5);
          background:rgba(195,38,38,0.16); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          box-shadow:0 4px 20px rgba(160,20,20,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
          transition:opacity 0.3s, transform 0.3s, background 0.25s, box-shadow 0.25s;
          color:#fff; font-size:18px; }
        .back-to-top:hover { background:rgba(195,38,38,0.32); transform:translateY(-3px) scale(1.07);
          box-shadow:0 8px 28px rgba(180,20,20,0.5), inset 0 1px 0 rgba(255,255,255,0.12); }
        .back-to-top.hidden { opacity:0; pointer-events:none; transform:translateY(12px); }
        @media (max-width:900px) { .yt-grid { grid-template-columns:repeat(2,1fr)!important; } .yt-modal-box { width:95vw; } .back-to-top { bottom:80px; right:18px; } }
        @media (max-width:540px) { .yt-grid { grid-template-columns:1fr!important; } }

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
          #hero { min-height:100svh!important; height:auto!important; }
          .hero-content-pad { padding-top:80px!important; }
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
        <div className="mob-menu" style={{ background: theme === "dark" ? "rgba(3,6,15,0.94)" : "rgba(245,242,235,0.94)" }}>
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
      <section id="hero" style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
          padding: "110px 24px 32px", gap: 0 }}>

          {/* Badge */}
          <div className="anim-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px",
            borderRadius: 100, background: "rgba(255,80,30,0.1)", border: "1px solid rgba(255,80,30,0.25)", marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5533", display: "inline-block", animation: "glow 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "#ff8866", letterSpacing: "0.18em" }}>LIFE · MYSTERY · CONNECTION</span>
          </div>

          {/* Headline */}
          <h1 className="syne anim-2" style={{ fontWeight: 800, fontSize: "clamp(34px,7vw,80px)", lineHeight: 1.06,
            letterSpacing: "-0.03em", marginBottom: 20, color: "#fff", textShadow: "0 2px 40px rgba(0,0,0,0.6)", maxWidth: 900 }}>
            The questions{" "}<span className="grad-fire">worth asking</span>{" "}live here.
          </h1>

          {/* Description */}
          <p className="anim-3" style={{ fontSize: "clamp(13px,1.5vw,15px)", color: "rgba(220,230,245,0.75)",
            lineHeight: 1.85, maxWidth: 580, marginBottom: 28, textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
            4Life Mystery is a space for real conversations about life — its meaning, its mysteries, and everything between.
            No algorithm. No noise. Just honest human thought.
          </p>

          {/* Stats */}
          <div className="hero-stats anim-3" style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", marginBottom: 32 }}>
            {[["10K+","FOLLOWERS"],["50+","EPISODES"],["∞","QUESTIONS"]].map(([n,l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div className="syne grad-fire" style={{ fontWeight: 800, fontSize: "clamp(20px,3vw,30px)" }}>{n}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="anim-4 btn-group" style={{ justifyContent: "center", width: "100%", maxWidth: 500 }}>
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
          <span className="section-tag">WHAT IS 4LIFE MYSTERY</span>
          <div style={{ marginBottom: 32 }}>
            <img src={uncoverLogo} alt="Uncover the Unknown"
              style={{ height: "clamp(36px,5vw,64px)", width: "auto", objectFit: "contain",
                opacity: theme === "dark" ? 0.92 : 0.85,
                filter: theme === "dark" ? "drop-shadow(0 2px 16px rgba(255,80,30,0.25))" : "none" }} />
          </div>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>

            {/* Face image — fills the container completely */}
            <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", minHeight: 520,
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,80,30,0.15)" }}
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
      <section id="content" style={{ padding: "100px 20px", borderTop: `1px solid ${c.secBr}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
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
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire" style={{ alignSelf:"flex-start" }}>
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
      <section id="videos" style={{ padding:"100px 20px", borderTop:`1px solid ${c.secBr}` }}>
        <div style={{ maxWidth:1180, margin:"0 auto" }}>
          <span className="section-tag" style={{ color:"#ff0000" }}>YOUTUBE</span>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:16, marginBottom:4 }}>
            <h2 className="syne" style={{ fontWeight:800, fontSize:"clamp(26px,4vw,38px)", color:c.text }}>
              Latest <span className="grad-fire">videos</span>
            </h2>
            <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer"
              className="lp-btn lp-btn-ghost" style={{ fontSize:11 }}>
              VIEW CHANNEL →
            </a>
          </div>

          {/* Loading skeletons */}
          {ytLoading && (
            <div className="yt-grid">
              {[...Array(6)].map((_,i) => (
                <div key={i} style={{ borderRadius:16, overflow:"hidden", background:c.cardBg, border:`1px solid ${c.cardBr}` }}>
                  <div className="yt-skeleton" style={{ width:"100%", aspectRatio:"16/9" }} />
                  <div style={{ padding:"14px 16px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                    <div className="yt-skeleton" style={{ height:14, width:"90%", borderRadius:6 }} />
                    <div className="yt-skeleton" style={{ height:14, width:"60%", borderRadius:6 }} />
                    <div className="yt-skeleton" style={{ height:10, width:"40%", borderRadius:6, marginTop:4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Video grid */}
          {!ytLoading && ytVideos.length > 0 && (
            <div className="yt-grid" style={{ "--card-bg":c.cardBg, "--card-br":c.cardBr, "--card-sh":c.cardSh }}>
              {ytVideos.map((v, idx) => {
                const isBroken = !v.id;
                return (
                  <div key={v.id || idx}
                    className="yt-card"
                    style={{ "--card-bg":c.cardBg, "--card-br":c.cardBr, "--card-sh":c.cardSh, cursor: isBroken ? "default" : "pointer" }}
                    onClick={() => !isBroken && setModalVideo(v)}
                  >
                    <div className="yt-thumb">
                      <img
                        src={v.thumbnail || brokenThumb}
                        alt={v.title}
                        onError={e => { e.currentTarget.src = brokenThumb; }}
                      />
                      <div className="yt-play">
                        <div className={`yt-play-btn${isBroken ? " disabled" : ""}`}>
                          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                      {v.duration && (
                        <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.75)",
                          color:"#fff", fontSize:10, padding:"2px 6px", borderRadius:4, letterSpacing:"0.04em" }}>
                          {v.duration}
                        </div>
                      )}
                    </div>
                    <div className="yt-info">
                      <div className="yt-title syne" style={{ color:c.text }}>{v.title}</div>
                      <div className="yt-meta" style={{ color:c.textD }}>
                        <span>▶ {Number(v.views||0).toLocaleString()} views</span>
                        <span>♥ {Number(v.likes||0).toLocaleString()}</span>
                        {v.comments > 0 && <span>💬 {Number(v.comments).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty / error state */}
          {!ytLoading && ytVideos.length === 0 && (
            <div className="yt-grid" style={{ "--card-bg":c.cardBg, "--card-br":c.cardBr }}>
              {[...Array(6)].map((_,i) => (
                <div key={i} className="yt-card" style={{ "--card-bg":c.cardBg, "--card-br":c.cardBr, cursor:"default" }}>
                  <div className="yt-thumb">
                    <img src={brokenThumb} alt="Video unavailable" style={{ opacity:0.45 }} />
                    <div className="yt-play" style={{ opacity:1 }}>
                      <div className="yt-play-btn disabled">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="yt-info">
                    <div style={{ fontSize:11, color:c.textD, letterSpacing:"0.08em" }}>VIDEO UNAVAILABLE</div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
            <div style={{ borderRadius:16,overflow:"hidden",border:"1px solid rgba(29,185,84,0.18)",boxShadow:c.cardSh }}>
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
      <section id="topics" style={{ padding:"100px 20px",background:c.bgAlt,borderTop:`1px solid ${c.secBr}`,borderBottom:`1px solid ${c.secBr}` }}>
        <div style={{ maxWidth:1180,margin:"0 auto" }}>
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
      <section id="community" style={{ padding:"100px 20px 120px",position:"relative",overflow:"clip" }}>
        <div className="grid-bg" />
        <div style={{ position:"absolute",width:"60vw",height:"60vw",maxWidth:700,maxHeight:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(150,40,0,0.05),transparent 70%)",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none" }} />

        <div style={{ maxWidth:1180,margin:"0 auto",position:"relative",zIndex:1 }}>
          <span className="section-tag">COMMUNITY</span>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40,flexWrap:"wrap",gap:16 }}>
            <div>
              <h2 className="syne" style={{ fontWeight:800,fontSize:"clamp(26px,4vw,42px)",lineHeight:1.15,color:c.text }}>
                The conversation is just{" "}<span className="grad-fire">getting started.</span>
              </h2>
              <p style={{ color:c.textM,fontSize:13,lineHeight:1.84,maxWidth:560,marginTop:14 }}>
                Join the discussion — share what moves you, what you're questioning, or what you want explored next.
              </p>
            </div>
            <div className="btn-group" style={{ marginTop: 4 }}>
              <a href={SOCIAL.youtube} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-fire" style={{ flex: 1, justifyContent: "center" }}>▶ YOUTUBE</a>
              <a href={SOCIAL.tiktok}  target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center", borderColor:"rgba(0,242,234,0.3)",color:"#00f2ea" }}>♪ TIKTOK</a>
              <a href={SOCIAL.spotify} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={{ flex: 1, justifyContent: "center", borderColor:"rgba(29,185,84,0.3)",color:"#1db954" }}>◎ SPOTIFY</a>
            </div>
          </div>

          {/* Disabled comment form */}
          <div style={{ position:"relative",marginBottom:40 }}>
            <div style={{ background:c.cardBg,border:`1px solid ${c.cardBr}`,boxShadow:c.cardSh,borderRadius:16,padding:"24px 24px 20px",filter:"blur(1.5px)",pointerEvents:"none",userSelect:"none" }}>
              <div style={{ display:"flex",gap:14,marginBottom:16 }}>
                <div style={{ width:40,height:40,borderRadius:"50%",background:"rgba(255,80,30,0.12)",border:"1px solid rgba(255,80,30,0.2)",flexShrink:0 }} />
                <input readOnly placeholder="Your name" className="comment-input" style={{ minHeight:"unset",height:40,background:c.inputBg,border:`1px solid ${c.inputBr}`,color:c.text }} />
              </div>
              <textarea readOnly placeholder="Share your thoughts…" className="comment-input" style={{ background:c.inputBg,border:`1px solid ${c.inputBr}`,color:c.text }} />
              <div style={{ display:"flex",justifyContent:"flex-end",marginTop:12 }}>
                <div className="lp-btn lp-btn-fire" style={{ opacity:0.5 }}>POST COMMENT</div>
              </div>
            </div>
            <div className="coming-soon-overlay" style={{ background:theme==="dark"?"rgba(3,6,15,0.72)":"rgba(245,242,235,0.72)" }}>
              <div style={{ fontSize:28,color:"#ff5533" }}>◉</div>
              <div className="syne" style={{ fontWeight:700,fontSize:16,color:c.text }}>Comments Coming Soon</div>
              <div style={{ fontSize:11,color:c.textM,letterSpacing:"0.1em",textAlign:"center",maxWidth:280,lineHeight:1.7 }}>
                Full community features — post, comment, and connect — are in the works.
              </div>
            </div>
          </div>

          <div style={{ fontSize:10,color:c.textD,letterSpacing:"0.16em",marginBottom:20 }}>
            RECENT DISCUSSION · {STATIC_COMMENTS.length} COMMENTS
          </div>
          <div className="comments-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            {STATIC_COMMENTS.map(cc => (
              <div key={cc.id} className="comment-card" style={{ "--card-bg":c.cardBg,"--card-br":c.cardBr }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                  <div style={{ width:38,height:38,borderRadius:"50%",background:`${cc.color}18`,border:`1px solid ${cc.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:cc.color,flexShrink:0 }}>{cc.initials}</div>
                  <div>
                    <div className="syne" style={{ fontWeight:700,fontSize:13,color:c.text }}>{cc.name}</div>
                    <div style={{ fontSize:10,color:c.textD,letterSpacing:"0.06em" }}>{cc.time}</div>
                  </div>
                </div>
                <p style={{ fontSize:12,color:c.textM,lineHeight:1.78,marginBottom:14 }}>{cc.text}</p>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ fontSize:14,color:c.textD }}>♥</span>
                  <span style={{ fontSize:11,color:c.textD }}>{cc.likes}</span>
                </div>
              </div>
            ))}
          </div>
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
              <div style={{ display:"flex",gap:10 }}>
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

          <div style={{ borderTop:`1px solid ${c.secBr}`,paddingTop:22,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
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
