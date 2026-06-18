import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* ─── Data ──────────────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: "🎬", title: "Script to finished video", desc: "Type a topic. AutoVid writes the script, selects visuals, generates narration, adds captions, and assembles a broadcast-quality video — hands-free.", detail: "Powered by Groq LLaMA 70B + ElevenLabs voice synthesis." },
  { icon: "🗣️", title: "AI narration, zero recording", desc: "Professional-grade voice synthesis on every video. No microphone, no recording sessions, no editing. Just crisp, natural narration.", detail: "15+ voice profiles. Adjustable speed, emotion, and emphasis." },
  { icon: "📡", title: "Auto-publish to YouTube", desc: "Videos land on your channel on schedule. Titles, descriptions, tags, thumbnails — all generated and uploaded automatically as private drafts.", detail: "Full YouTube Data API v3. Custom upload profiles." },
  { icon: "✂️", title: "Shorts automation", desc: "Every long-form video becomes a vertical Short automatically. Reach more viewers on YouTube Shorts and TikTok with zero extra effort.", detail: "Auto-crop, re-caption, and push to Shorts queue." },
  { icon: "🎧", title: "Podcast pipeline", desc: "Every video is also a podcast episode. AutoVid publishes to Spotify, Buzzsprout, and Podbean without any extra steps.", detail: "RSS feed generation, episode art, chapter markers." },
  { icon: "📊", title: "Full production dashboard", desc: "Monitor your queue, track video status, manage captions, review analytics, and control every setting from one interface.", detail: "Real-time job queue. Celery-backed task processing." },
  { icon: "🖼️", title: "Stick figure & visual generation", desc: "Unique animated stick-figure overlays and AI-generated visuals give your content a distinctive look no other creator has.", detail: "Stable Diffusion + custom compositor pipeline." },
  { icon: "📝", title: "Auto-captions", desc: "Accurate burned-in captions on every video using Whisper. Increases watch time and reaches viewers watching without sound.", detail: "Word-level timestamps. Custom font, color, and position." },
  { icon: "🔁", title: "Scheduled & recurring content", desc: "Set a publishing cadence and AutoVid keeps your channel active — generating and publishing on your schedule without manual input.", detail: "Cron-style scheduling. Holiday and blackout dates." },
];

const STEPS = [
  { n: "01", icon: "💡", title: "Type a topic", desc: "Enter any subject, story, or idea. AutoVid handles all research and scripting." },
  { n: "02", icon: "✍️", title: "Script is written", desc: "LLaMA 70B writes a structured, engaging script optimised for your format." },
  { n: "03", icon: "🎙️", title: "Voice is generated", desc: "ElevenLabs synthesises professional narration matched to your selected voice profile." },
  { n: "04", icon: "🎞️", title: "Visuals are sourced", desc: "Stock footage, AI images, and stick-figure animations are selected and assembled." },
  { n: "05", icon: "💬", title: "Captions are added", desc: "Whisper transcribes and burns accurate captions directly into the video." },
  { n: "06", icon: "🚀", title: "Published privately", desc: "Video is uploaded to YouTube as a private draft — you review it, then make it public." },
];

const INTEGRATIONS = [
  { name: "YouTube",    icon: "▶", color: "#ff0000" },
  { name: "Spotify",    icon: "♪", color: "#1db954" },
  { name: "TikTok",     icon: "♬", color: "#69c9d0" },
  { name: "Buzzsprout", icon: "🎙", color: "#f97316" },
  { name: "Podbean",    icon: "🎧", color: "#f59e0b" },
  { name: "ElevenLabs", icon: "🗣", color: "#8b5cf6" },
  { name: "Groq",       icon: "⚡", color: "#00d4aa" },
  { name: "Pexels",     icon: "📷", color: "#05a081" },
];

const PLANS = [
  {
    name: "Starter", price: "$29", period: "/mo",
    desc: "Perfect for solo creators getting started with automation.",
    features: ["10 videos per month", "YouTube auto-publish (private)", "AI narration (5 voices)", "Auto-captions", "Basic analytics", "Email support"],
    cta: "Request access", highlight: false,
  },
  {
    name: "Creator", price: "$79", period: "/mo",
    desc: "For serious creators who want to scale their channel output.",
    features: ["Unlimited videos", "Shorts automation", "Podcast pipeline (Spotify + Buzzsprout)", "All 15+ voice profiles", "Priority queue", "Stick figure visuals", "Full production dashboard", "Priority support"],
    cta: "Request access", highlight: true,
  },
  {
    name: "Studio", price: "Custom", period: "",
    desc: "For agencies and teams running multiple channels.",
    features: ["Everything in Creator", "Dedicated worker instance", "Custom AI model selection", "White-label video output", "API access", "SLA + dedicated support"],
    cta: "Contact us", highlight: false,
  },
];

const FAQS = [
  { q: "How long does it take to generate a video?", a: "Most videos are ready in 8–15 minutes depending on length. Short-form content (under 3 minutes) typically finishes in under 5 minutes. You can monitor progress live in your dashboard." },
  { q: "Why are videos uploaded as private?", a: "All auto-generated videos are uploaded to YouTube as private drafts. This gives you a chance to review the content, add your personal touch, and decide when to publish. This avoids accidental publishing of raw AI content without your approval." },
  { q: "Do I need any technical knowledge?", a: "No. If you can type a topic, AutoVid handles everything else — script, voice, visuals, captions, and publishing. The dashboard is designed for creators, not engineers." },
  { q: "Can I use my own voice or custom branding?", a: "Yes. You can clone your voice (ElevenLabs Professional tier), upload a custom intro/outro, add your logo as an overlay, and configure default video styles per channel." },
  { q: "What happens if a video generation fails?", a: "AutoVid automatically retries failed jobs. If a video still fails, you'll be notified and can retry with one click from your dashboard. No credits are deducted for failed jobs." },
  { q: "Is my account approved instantly?", a: "Accounts are reviewed manually — usually within 24 hours. This helps us maintain quality and ensure every user gets proper onboarding." },
  { q: "Can I cancel at any time?", a: "Yes. Cancel any time from your account settings. Your access continues until the end of the billing period. No lock-ins, no questions asked." },
  { q: "What is your refund policy?", a: "We offer a full refund within 7 days of your first charge if you're not satisfied. After 7 days, refunds are evaluated case-by-case. See our Refund Policy for full details." },
];

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const accepted = localStorage.getItem("am_cookies_accepted");
    if (!accepted) setVisible(true);
  }, []);
  const accept = () => { localStorage.setItem("am_cookies_accepted", "1"); setVisible(false); };
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#0d1b2a", borderTop: "1px solid #1a2a4a",
      padding: "16px 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 16, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 13, color: "#8a9ab8", lineHeight: 1.6, flex: 1 }}>
        We use cookies to improve your experience. By continuing, you agree to our{" "}
        <Link to="/cookies" style={{ color: "#818cf8" }}>Cookie Policy</Link>.
      </span>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={accept} style={{
          background: "#4f46e5", color: "#fff", border: "none",
          padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>Accept</button>
        <button onClick={() => setVisible(false)} style={{
          background: "transparent", color: "#6a8ab0", border: "1px solid #1a2a4a",
          padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
        }}>Dismiss</button>
      </div>
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handler = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      style={{
        position: "fixed", bottom: 80, right: 24, zIndex: 999,
        width: 42, height: 42, borderRadius: "50%",
        background: "#4f46e5", border: "none", color: "#fff",
        fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 4px 20px rgba(79,70,229,0.4)",
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
      aria-label="Back to top"
    >↑</button>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px" }}>
      <h2 className="am-section-title">Frequently asked questions</h2>
      <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 48 }}>
        Still have questions?{" "}
        <a href="mailto:help@async-mode.com" style={{ color: "#4f46e5" }}>Email us</a>
      </p>
      {FAQS.map((item, i) => (
        <div key={i} style={{ borderBottom: "1px solid #0d1b2a", cursor: "pointer" }}
          onClick={() => setOpen(open === i ? null : i)}>
          <div style={{ padding: "18px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#c8d8e8", lineHeight: 1.4 }}>{item.q}</span>
            <span style={{
              color: "#4f46e5", fontSize: 20, flexShrink: 0,
              transition: "transform 0.25s",
              transform: open === i ? "rotate(45deg)" : "none",
              display: "inline-block",
            }}>+</span>
          </div>
          {open === i && (
            <p style={{ fontSize: 14, color: "#8a9ab8", lineHeight: 1.8, paddingBottom: 18, margin: 0 }}>
              {item.a}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function FeatureCard({ f, i }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="am-feature-card"
      style={{
        background: hovered ? "#0a1428" : "#080e1a",
        border: `1px solid ${hovered ? "#2a2a6a" : "#0d1b2a"}`,
        borderRadius: 14, padding: "28px 24px",
        transition: "all 0.25s",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 12px 40px rgba(79,70,229,0.12)" : "none",
        animationDelay: `${i * 0.06}s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        fontSize: 32, marginBottom: 16,
        filter: hovered ? "drop-shadow(0 0 8px rgba(79,70,229,0.5))" : "none",
        transition: "filter 0.25s",
      }}>{f.icon}</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#e0eaf5" }}>{f.title}</h3>
      <p style={{ fontSize: 13, color: "#8a9ab8", lineHeight: 1.7, marginBottom: 12 }}>{f.desc}</p>
      <p style={{ fontSize: 11, color: "#4a6a8a", margin: 0, borderTop: "1px solid #0d1b2a", paddingTop: 10 }}>{f.detail}</p>
    </div>
  );
}

const STEP_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#3b82f6", "#10b981"];

function StepCard({ step, i }) {
  const [hovered, setHovered] = useState(false);
  const color = STEP_COLORS[i] || "#6366f1";
  return (
    <div
      className="am-step-card"
      style={{
        padding: "24px 22px 22px",
        background: hovered ? "#080e1a" : "#060c18",
        border: `1px solid ${hovered ? color + "55" : "#0d1b2a"}`,
        borderTop: `2px solid ${hovered ? color : color + "50"}`,
        borderRadius: 14,
        transition: "all 0.25s",
        transform: hovered ? "translateY(-6px)" : "none",
        boxShadow: hovered
          ? `0 20px 48px ${color}18, 0 4px 16px rgba(0,0,0,0.35)`
          : "0 2px 8px rgba(0,0,0,0.25)",
        animationDelay: `${i * 0.08}s`,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Radial glow bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% -10%, ${color}14 0%, transparent 65%)`,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.3s",
      }} />

      {/* Step badge + icon row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: hovered ? color : color + "1a",
          border: `1px solid ${color}50`,
          fontSize: 11, fontWeight: 800,
          color: hovered ? "#fff" : color,
          transition: "all 0.25s",
          letterSpacing: "0.04em",
        }}>
          {step.n}
        </div>
        <div style={{
          fontSize: 28,
          filter: hovered ? `drop-shadow(0 0 8px ${color}90)` : "none",
          transition: "filter 0.3s",
        }}>{step.icon}</div>
      </div>

      <div style={{
        fontSize: 13, fontWeight: 700,
        color: hovered ? "#e0eaf5" : "#b8cce0",
        marginBottom: 8, transition: "color 0.25s",
        lineHeight: 1.3,
      }}>{step.title}</div>
      <div style={{ fontSize: 12, color: "#4a6080", lineHeight: 1.75 }}>{step.desc}</div>
    </div>
  );
}

/* ─── Main Landing ───────────────────────────────────────────────────────────── */

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close menu on route change (scroll anchor click)
  const handleNavLink = () => setMenuOpen(false);

  return (
    <div style={{ background: "#08080f", minHeight: "100vh", color: "#e0eaf5", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ─── Injected CSS ────────────────────────────────────────────────────────── */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        a { text-decoration: none; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }

        .am-hero-badge { animation: fadeInUp 0.5s ease both; }
        .am-hero-title { animation: fadeInUp 0.5s 0.1s ease both; }
        .am-hero-sub   { animation: fadeInUp 0.5s 0.2s ease both; }
        .am-hero-cta   { animation: fadeInUp 0.5s 0.3s ease both; }
        .am-hero-stats { animation: fadeInUp 0.5s 0.4s ease both; }

        .am-feature-card { animation: fadeInUp 0.5s ease both; }
        .am-step-card    { animation: fadeInUp 0.5s ease both; }

        .am-section-title {
          text-align: center;
          font-size: clamp(22px, 4vw, 32px);
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
          color: #e0eaf5;
        }

        .am-gradient-text {
          background: linear-gradient(135deg, #818cf8 0%, #4f46e5 50%, #7c3aed 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
        }

        /* Nav links (desktop visible, mobile hidden) */
        .am-nav-links { display: flex; gap: 4px; align-items: center; }
        .am-hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 6px; background: none; border: none; }
        .am-hamburger span { display: block; width: 22px; height: 2px; background: #8a9ab8; border-radius: 2px; transition: all 0.3s; }
        .am-mobile-menu { display: none; }

        /* Step cards grid */
        .am-steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .am-step-arrow { display: none; }

        /* Features grid */
        .am-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* Footer grid */
        .am-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          padding: 64px 40px 40px;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* Pricing grid */
        .am-pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          align-items: start;
        }

        /* Integrations flex */
        .am-integrations-wrap { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

        /* ── Mobile ─────────────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .am-nav-links { display: none; }
          .am-hamburger { display: flex; }

          .am-mobile-menu {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 56px; left: 0; right: 0;
            background: rgba(8,8,15,0.98);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid #0d1b2a;
            padding: 16px 24px 24px;
            gap: 4px;
            z-index: 99;
            animation: fadeInUp 0.2s ease both;
          }
          .am-mobile-menu a, .am-mobile-menu button {
            display: block;
            padding: 12px 16px;
            font-size: 15px;
            color: #c8d8e8 !important;
            border-radius: 8px;
            border: none;
            background: transparent;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            text-decoration: none;
            transition: background 0.15s;
          }
          .am-mobile-menu a:hover, .am-mobile-menu button:hover { background: #0d1b2a; }
          .am-mobile-menu .am-mobile-divider { height: 1px; background: #0d1b2a; margin: 8px 0; }
          .am-mobile-menu .am-mobile-cta {
            background: #4f46e5 !important;
            color: #fff !important;
            font-weight: 700;
            text-align: center;
            margin-top: 8px;
          }

          .am-steps-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .am-features-grid { grid-template-columns: 1fr; }

          .am-footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
            padding: 48px 24px 32px;
          }

          .am-footer-bottom {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .am-hero-cta { flex-direction: column; }
          .am-hero-cta a, .am-hero-cta button {
            width: 100%;
            text-align: center;
          }

          .am-hero-stats {
            flex-direction: column;
            gap: 16px;
          }
          .am-hero-stats > div {
            border-left: none !important;
            border-top: 1px solid #0d1b2a;
            padding: 16px 0 !important;
          }
          .am-hero-stats > div:first-child { border-top: none; }

          .am-section-title { font-size: 22px; }

          .am-integrations-wrap { gap: 8px; }
          .am-pricing-grid { grid-template-columns: 1fr; }

          .am-cta-btns { flex-direction: column; align-items: stretch; }
          .am-cta-btns a { text-align: center; }
        }

        @media (max-width: 480px) {
          .am-steps-grid { grid-template-columns: 1fr; }
          .am-hero-section { padding: 56px 16px 44px !important; }
          .am-section { padding: 64px 16px !important; }
          .am-hero-badge { font-size: 11px !important; }
          .am-section-title { font-size: 20px !important; }
          .am-footer-grid { padding: 36px 16px 24px !important; }
          .am-faq-question { font-size: 14px !important; }
        }
      `}</style>

      {/* ─── Nav ─────────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,8,15,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #0d1b2a",
        padding: "0 24px", display: "flex", alignItems: "center", height: 56,
      }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: 18, flex: 1, letterSpacing: "-0.02em", color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </Link>

        {/* Desktop nav */}
        <div className="am-nav-links">
          {[["#features", "Features"], ["#integrations", "Integrations"], ["#pricing", "Pricing"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} style={{ color: "#8a9ab8", fontSize: 13, padding: "6px 12px", borderRadius: 6, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.target.style.color = "#e0eaf5")}
              onMouseLeave={(e) => (e.target.style.color = "#8a9ab8")}
            >{label}</a>
          ))}
          <div style={{ width: 1, height: 20, background: "#1a2a3a", margin: "0 8px" }} />
          <Link to="/login" style={{ color: "#8a9ab8", fontSize: 13, padding: "6px 14px", border: "1px solid #1a2a3a", borderRadius: 6, transition: "border-color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a2a3a")}
          >Log in</Link>
          <Link to="/register" style={{ background: "#4f46e5", color: "#fff", fontSize: 13, padding: "7px 16px", borderRadius: 6, fontWeight: 700, marginLeft: 4 }}>
            Get access
          </Link>
        </div>

        {/* Hamburger */}
        <button className="am-hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" ref={menuRef}>
          <span style={{ transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
          <span style={{ opacity: menuOpen ? 0 : 1 }} />
          <span style={{ transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="am-mobile-menu" ref={menuRef}>
          {[["#features", "Features"], ["#integrations", "Integrations"], ["#pricing", "Pricing"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} onClick={handleNavLink}>{label}</a>
          ))}
          <div className="am-mobile-divider" />
          <Link to="/login" onClick={handleNavLink}>Log in</Link>
          <Link to="/register" className="am-mobile-cta" onClick={handleNavLink}>Get access →</Link>
        </div>
      )}

      {/* ─── Hero ────────────────────────────────────────────────────────────────── */}
      <section className="am-hero-section" style={{ maxWidth: 920, margin: "0 auto", padding: "88px 24px 72px", textAlign: "center" }}>
        <div className="am-hero-badge" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#0d1020", border: "1px solid #2a2060",
          borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#a78bfa",
          letterSpacing: "0.06em", marginBottom: 28,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "#4f46e5",
            display: "inline-block", animation: "pulse-ring 1.5s ease-out infinite",
          }} />
          AI-POWERED VIDEO AUTOMATION PLATFORM
        </div>

        <h1 className="am-hero-title" style={{
          fontSize: "clamp(34px, 6vw, 68px)", fontWeight: 800,
          lineHeight: 1.08, letterSpacing: "-0.035em", marginBottom: 24,
        }}>
          Your YouTube channel,<br />
          <span className="am-gradient-text">running on autopilot</span>
        </h1>

        <p className="am-hero-sub" style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "#8a9ab8", lineHeight: 1.75, maxWidth: 580, margin: "0 auto 16px" }}>
          AutoVid turns a single text prompt into a fully produced, captioned, and
          published video. Script, voice, visuals, captions, Shorts, podcast — all automated.
        </p>

        <p className="am-hero-sub" style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 36 }}>
          No video editing. No recording. No manual uploads.
        </p>

        <div className="am-hero-cta" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff",
            padding: "14px 36px", borderRadius: 8, fontWeight: 700, fontSize: 15,
            transition: "transform 0.15s, box-shadow 0.15s",
            display: "inline-block",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            Request access →
          </Link>
          <a href="#features" style={{
            border: "1px solid #1a2a3a", color: "#8a9ab8",
            padding: "14px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15,
            transition: "border-color 0.15s, color 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4f46e5"; e.currentTarget.style.color = "#e0eaf5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1a2a3a"; e.currentTarget.style.color = "#8a9ab8"; }}
          >
            See all features
          </a>
        </div>

        {/* Stats */}
        <div className="am-hero-stats" style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          {[
            ["8–15 min", "avg. video generation time"],
            ["9 platforms", "publish targets supported"],
            ["100%", "hands-free after setup"],
          ].map(([stat, label], i) => (
            <div key={i} style={{
              padding: "20px 40px",
              borderLeft: i > 0 ? "1px solid #0d1b2a" : "none",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#e0eaf5", marginBottom: 4 }}>{stat}</div>
              <div style={{ fontSize: 12, color: "#4a6a8a" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────────────── */}
      <section style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a", borderBottom: "1px solid #0d1b2a",
        padding: "72px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 className="am-section-title">From idea to published video in one step</h2>
          <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 52 }}>
            Videos are uploaded privately so you can review before going public.
          </p>
          <div className="am-steps-grid" style={{ padding: "0.3rem" }}>
            {STEPS.map((step, i) => <StepCard key={step.n} step={step} i={i} />)}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <h2 className="am-section-title">Everything your channel needs</h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 52 }}>
          One platform replaces your entire content production stack.
        </p>
        <div className="am-features-grid">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
        </div>
      </section>

      {/* ─── Privacy notice ──────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg, #0a0f1e 0%, #060c1a 100%)",
        border: "1px solid #1a2a4a", borderRadius: 16,
        maxWidth: 860, margin: "0 auto 60px", padding: "36px 40px",
        display: "flex", alignItems: "flex-start", gap: 20,
      }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>🔒</div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#e0eaf5", marginBottom: 8 }}>
            Videos uploaded privately by default
          </h3>
          <p style={{ fontSize: 13, color: "#6a8ab0", lineHeight: 1.7, margin: 0 }}>
            Every video AutoVid generates is uploaded to YouTube as a <strong style={{ color: "#818cf8" }}>private draft</strong>.
            This means only you can see it. Review the content, add your finishing touches, then choose when
            to make it public — all on your timeline. No AI content goes live without your approval.
          </p>
        </div>
      </section>

      {/* ─── Integrations ────────────────────────────────────────────────────────── */}
      <section id="integrations" style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a", borderBottom: "1px solid #0d1b2a",
        padding: "64px 24px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 className="am-section-title">Connects to your entire ecosystem</h2>
          <p style={{ color: "#8a9ab8", fontSize: 15, marginBottom: 44 }}>
            AutoVid publishes to every platform your audience is on.
          </p>
          <div className="am-integrations-wrap">
            {INTEGRATIONS.map((p) => (
              <div key={p.name} style={{
                background: "#080e1a", border: "1px solid #0d1b2a",
                borderRadius: 10, padding: "14px 20px",
                display: "flex", alignItems: "center", gap: 10,
                minWidth: 120, transition: "border-color 0.2s, transform 0.2s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#0d1b2a"; e.currentTarget.style.transform = "none"; }}
              >
                <span style={{ fontSize: 18, color: p.color }}>{p.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c8d8e8" }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ maxWidth: 1040, margin: "0 auto", padding: "80px 24px" }}>
        <h2 className="am-section-title">Simple, transparent pricing</h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 52 }}>
          All plans include a free trial period after manual approval. No credit card required to request access.
        </p>
        <div className="am-pricing-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#090c1e" : "#080e1a",
              border: `1px solid ${plan.highlight ? "#4f46e5" : "#0d1b2a"}`,
              borderRadius: 14, padding: "32px 28px",
              position: "relative",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = plan.highlight ? "0 16px 48px rgba(79,70,229,0.2)" : "0 8px 32px rgba(0,0,0,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "#4f46e5", color: "#fff", fontSize: 10, fontWeight: 800,
                  padding: "3px 14px", borderRadius: 20, letterSpacing: "0.08em", whiteSpace: "nowrap",
                }}>MOST POPULAR</div>
              )}
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {plan.name}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: "#e0eaf5", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "#8a9ab8" }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 24, lineHeight: 1.6 }}>{plan.desc}</p>
              <ul style={{ listStyle: "none", marginBottom: 28, padding: 0 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "#8a9ab8", padding: "6px 0", display: "flex", gap: 8, alignItems: "flex-start", borderBottom: "1px solid #0d1b2a" }}>
                    <span style={{ color: "#4f46e5", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" style={{
                display: "block", textAlign: "center",
                background: plan.highlight ? "#4f46e5" : "transparent",
                color: plan.highlight ? "#fff" : "#4f46e5",
                border: `1px solid ${plan.highlight ? "#4f46e5" : "#1a2a4a"}`,
                padding: "11px 0", borderRadius: 8, fontWeight: 600, fontSize: 14,
                transition: "background 0.15s, transform 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = plan.highlight ? "#4338ca" : "#0d1b2a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = plan.highlight ? "#4f46e5" : "transparent"; }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#4a6a8a", marginTop: 28 }}>
          All plans billed monthly. Cancel anytime. Pricing in USD.{" "}
          <Link to="/refund" style={{ color: "#4a6a8a", textDecoration: "underline" }}>Refund policy</Link>
        </p>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────────────────── */}
      <div style={{ background: "#050a14", borderTop: "1px solid #0d1b2a" }}>
        <FAQ />
      </div>

      {/* ─── Final CTA ───────────────────────────────────────────────────────────── */}
      <section style={{
        borderTop: "1px solid #0d1b2a", padding: "88px 24px", textAlign: "center",
        background: "radial-gradient(ellipse at center, rgba(79,70,229,0.06) 0%, transparent 70%)",
      }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.025em" }}>
          Ready to automate your channel?
        </h2>
        <p style={{ color: "#8a9ab8", fontSize: 16, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Request access today. Accounts are approved manually and limited per month.
        </p>
        <div className="am-cta-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff",
            padding: "14px 36px", borderRadius: 8, fontWeight: 700, fontSize: 15,
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            Request access →
          </Link>
          <a href="mailto:help@async-mode.com" style={{
            border: "1px solid #1a2a3a", color: "#8a9ab8",
            padding: "14px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15,
            transition: "border-color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a2a3a")}
          >
            Contact us
          </a>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #0d1b2a", background: "#050a14" }}>
        <div className="am-footer-grid">
          {/* Brand + mission */}
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#e0eaf5", marginBottom: 12 }}>
              async<span style={{ color: "#4f46e5" }}>-mode</span>
            </div>
            <p style={{ fontSize: 13, color: "#4a6a8a", lineHeight: 1.8, maxWidth: 300, margin: "0 0 20px" }}>
              Our mission is to make professional video content creation accessible to every creator —
              regardless of technical skill, budget, or team size. Automation shouldn't be a luxury.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="mailto:help@async-mode.com" style={{ fontSize: 12, color: "#4a6a8a", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.target.style.color = "#818cf8")}
                onMouseLeave={(e) => (e.target.style.color = "#4a6a8a")}
              >help@async-mode.com</a>
            </div>
          </div>

          {/* Product */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Product</div>
            {[
              ["#features", "Features"],
              ["#integrations", "Integrations"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
              ["/docs", "Documentation"],
            ].map(([href, label]) => (
              href.startsWith("#")
                ? <a key={href} href={href} style={{ display: "block", fontSize: 13, color: "#6a8ab0", marginBottom: 10, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.target.style.color = "#c8d8e8")}
                    onMouseLeave={(e) => (e.target.style.color = "#6a8ab0")}
                  >{label}</a>
                : <Link key={href} to={href} style={{ display: "block", fontSize: 13, color: "#6a8ab0", marginBottom: 10, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#c8d8e8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#6a8ab0")}
                  >{label}</Link>
            ))}
          </div>

          {/* Company */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Company</div>
            {[
              ["/register", "Get access"],
              ["/login", "Log in"],
              ["mailto:help@async-mode.com", "Support"],
              ["mailto:hello@async-mode.com", "Contact"],
            ].map(([href, label]) => (
              href.startsWith("mailto")
                ? <a key={href} href={href} style={{ display: "block", fontSize: 13, color: "#6a8ab0", marginBottom: 10 }}
                    onMouseEnter={(e) => (e.target.style.color = "#c8d8e8")}
                    onMouseLeave={(e) => (e.target.style.color = "#6a8ab0")}
                  >{label}</a>
                : <Link key={href} to={href} style={{ display: "block", fontSize: 13, color: "#6a8ab0", marginBottom: 10 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#c8d8e8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#6a8ab0")}
                  >{label}</Link>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Legal</div>
            {[
              ["/privacy", "Privacy Policy"],
              ["/terms", "Terms of Service"],
              ["/refund", "Refund Policy"],
              ["/cookies", "Cookie Policy"],
            ].map(([href, label]) => (
              <Link key={href} to={href} style={{ display: "block", fontSize: 13, color: "#6a8ab0", marginBottom: 10 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#c8d8e8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6a8ab0")}
              >{label}</Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="am-footer-bottom" style={{
          borderTop: "1px solid #0d1b2a", padding: "20px 40px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          maxWidth: 1100, margin: "0 auto", flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "#4a6a8a" }}>
            © 2026 async-mode.com · All rights reserved
          </span>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
              ["/refund", "Refunds"],
              ["/cookies", "Cookies"],
            ].map(([href, label]) => (
              <Link key={href} to={href} style={{ fontSize: 12, color: "#4a6a8a" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#818cf8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4a6a8a")}
              >{label}</Link>
            ))}
          </div>
        </div>
      </footer>

      <BackToTop />
      <CookieBanner />
    </div>
  );
}
