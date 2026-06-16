import { useState } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "🎬",
    title: "Script to finished video",
    desc: "Type a topic. AutoVid writes the script, selects visuals, generates narration, adds captions, and assembles a broadcast-quality video — completely hands-free.",
    detail: "Powered by Groq LLaMA 70B for scripts and ElevenLabs for voice.",
  },
  {
    icon: "🗣️",
    title: "AI narration, zero recording",
    desc: "Professional-grade voice synthesis on every video. No microphone, no recording sessions, no editing. Just crisp, natural narration.",
    detail: "15+ voice profiles. Adjustable speed, emotion, and emphasis.",
  },
  {
    icon: "📡",
    title: "Auto-publish to YouTube",
    desc: "Videos land on your channel on schedule. Titles, descriptions, tags, thumbnails — all generated and uploaded automatically.",
    detail: "Full YouTube Data API v3 integration. Custom upload profiles.",
  },
  {
    icon: "✂️",
    title: "Shorts automation",
    desc: "Every long-form video becomes a vertical Short automatically. Reach more viewers on YouTube Shorts and TikTok with zero extra effort.",
    detail: "Auto-crop, re-caption, and push to Shorts queue.",
  },
  {
    icon: "🎧",
    title: "Podcast pipeline",
    desc: "Every video is also a podcast episode. AutoVid publishes to Spotify, Buzzsprout, and Podbean without any extra steps.",
    detail: "RSS feed generation, episode art, chapter markers.",
  },
  {
    icon: "📊",
    title: "Full production dashboard",
    desc: "Monitor your queue, track video status, manage captions, review analytics, and control every setting from one interface.",
    detail: "Real-time job queue. Celery-backed task processing.",
  },
  {
    icon: "🖼️",
    title: "Stick figure & visual generation",
    desc: "Unique animated stick-figure overlays and AI-generated visuals give your content a distinctive look no other creator has.",
    detail: "Stable Diffusion + custom compositor pipeline.",
  },
  {
    icon: "📝",
    title: "Auto-captions",
    desc: "Accurate burned-in captions on every video using Whisper. Increases watch time and reaches viewers watching without sound.",
    detail: "Word-level timestamps. Custom font, color, and position.",
  },
  {
    icon: "🔁",
    title: "Scheduled & recurring content",
    desc: "Set a publishing cadence and AutoVid keeps your channel active — generating and publishing on your schedule without manual input.",
    detail: "Cron-style scheduling. Holiday and blackout dates.",
  },
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
    name: "Starter",
    price: "$29",
    period: "/mo",
    desc: "Perfect for solo creators getting started with automation.",
    features: [
      "10 videos per month",
      "YouTube auto-publish",
      "AI narration (5 voices)",
      "Auto-captions",
      "Basic analytics",
      "Email support",
    ],
    cta: "Request access",
    highlight: false,
  },
  {
    name: "Creator",
    price: "$79",
    period: "/mo",
    desc: "For serious creators who want to scale their channel output.",
    features: [
      "Unlimited videos",
      "Shorts automation",
      "Podcast pipeline (Spotify + Buzzsprout)",
      "All voice profiles",
      "Priority queue",
      "Stick figure visuals",
      "Full production dashboard",
      "Priority support",
    ],
    cta: "Request access",
    highlight: true,
  },
  {
    name: "Studio",
    price: "Custom",
    period: "",
    desc: "For agencies and teams running multiple channels.",
    features: [
      "Everything in Creator",
      "Dedicated worker instance",
      "Custom AI model selection",
      "White-label video output",
      "API access",
      "SLA + dedicated support",
    ],
    cta: "Contact us",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "How long does it take to generate a video?",
    a: "Most videos are ready in 8–15 minutes depending on length. Short-form content (under 3 minutes) typically finishes in under 5 minutes. You can monitor progress live in your dashboard.",
  },
  {
    q: "Do I need any technical knowledge to use AutoVid?",
    a: "No. If you can type a topic, AutoVid handles everything else — script, voice, visuals, captions, and publishing. The dashboard is designed for creators, not engineers.",
  },
  {
    q: "Can I use my own voice or custom branding?",
    a: "Yes. You can clone your voice (ElevenLabs Professional tier), upload a custom intro/outro, add your logo as an overlay, and configure default video styles per channel.",
  },
  {
    q: "What happens if a video generation fails?",
    a: "AutoVid automatically retries failed jobs. If a video still fails after retries, you'll be notified and can review the error log in your dashboard. No credits are deducted for failed jobs.",
  },
  {
    q: "Is my account approved instantly?",
    a: "Accounts are reviewed manually — usually within 24 hours. This helps us maintain quality and ensure every user gets proper onboarding.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. Cancel any time from your account settings. Your access continues until the end of the billing period. No lock-ins.",
  },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" style={{ maxWidth: 760, margin: "0 auto", padding: "80px 32px" }}>
      <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
        Frequently asked questions
      </h2>
      <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 48 }}>
        Still have questions? Email us at <a href="mailto:help@async-mode.com" style={{ color: "#4f46e5" }}>help@async-mode.com</a>
      </p>
      {FAQS.map((item, i) => (
        <div
          key={i}
          style={{
            borderBottom: "1px solid #0d1b2a",
            cursor: "pointer",
          }}
          onClick={() => setOpen(open === i ? null : i)}
        >
          <div style={{
            padding: "18px 0", display: "flex", justifyContent: "space-between",
            alignItems: "center", gap: 16,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#c8d8e8", lineHeight: 1.4 }}>{item.q}</span>
            <span style={{ color: "#4f46e5", fontSize: 18, flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(45deg)" : "none" }}>+</span>
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

export default function Landing() {
  return (
    <div style={{ background: "#08080f", minHeight: "100vh", color: "#e0eaf5" }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,8,15,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #0d1b2a",
        padding: "0 40px", display: "flex", alignItems: "center", height: 60,
      }}>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1, letterSpacing: "-0.02em" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[["#features", "Features"], ["#integrations", "Integrations"], ["#pricing", "Pricing"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} style={{ color: "#8a9ab8", fontSize: 13, padding: "6px 12px", borderRadius: 6 }}>{label}</a>
          ))}
          <div style={{ width: 1, height: 20, background: "#1a2a3a", margin: "0 8px" }} />
          <Link to="/login" style={{ color: "#8a9ab8", fontSize: 13, padding: "6px 14px", border: "1px solid #1a2a3a", borderRadius: 6 }}>
            Log in
          </Link>
          <Link to="/register" style={{ background: "#4f46e5", color: "#fff", fontSize: 13, padding: "7px 16px", borderRadius: 6, fontWeight: 600, marginLeft: 4 }}>
            Get access
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "96px 32px 72px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#0d1020", border: "1px solid #2a2060",
          borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#a78bfa",
          letterSpacing: "0.06em", marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4f46e5", display: "inline-block" }} />
          AI-POWERED VIDEO AUTOMATION PLATFORM
        </div>

        <h1 style={{
          fontSize: "clamp(38px, 6vw, 68px)", fontWeight: 800,
          lineHeight: 1.08, letterSpacing: "-0.035em", marginBottom: 24,
        }}>
          Your YouTube channel,<br />
          <span style={{ color: "#4f46e5" }}>running on autopilot</span>
        </h1>

        <p style={{ fontSize: 18, color: "#8a9ab8", lineHeight: 1.75, maxWidth: 580, margin: "0 auto 20px" }}>
          AutoVid turns a single text prompt into a fully produced, captioned, and published video.
          Script, voice, visuals, captions, Shorts, podcast — all automated.
        </p>

        <p style={{ fontSize: 14, color: "#4a6a8a", marginBottom: 40 }}>
          No video editing. No recording. No manual uploads.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff",
            padding: "14px 36px", borderRadius: 8, fontWeight: 700, fontSize: 15,
          }}>
            Request access →
          </Link>
          <a href="#features" style={{
            border: "1px solid #1a2a3a", color: "#8a9ab8",
            padding: "14px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15,
          }}>
            See all features
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 0, justifyContent: "center", marginTop: 64, flexWrap: "wrap" }}>
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

      {/* How it works */}
      <section style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a", borderBottom: "1px solid #0d1b2a",
        padding: "72px 32px",
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, marginBottom: 56, letterSpacing: "-0.02em" }}>
            From idea to published video in one step
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
            {[
              ["01", "Type a topic", "Enter any subject, story, or idea. AutoVid handles all research and scripting."],
              ["02", "Script is written", "LLaMA 70B writes a structured, engaging script optimised for your format."],
              ["03", "Voice is generated", "ElevenLabs synthesises professional narration matched to your selected voice profile."],
              ["04", "Visuals are sourced", "Stock footage, AI images, and stick-figure animations are selected and assembled."],
              ["05", "Captions are added", "Whisper transcribes and burns accurate captions directly into the video."],
              ["06", "Published automatically", "Video, Shorts, and podcast episode are pushed to YouTube, Spotify, and more."],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ padding: "24px 20px", background: "#080e1a", border: "1px solid #0d1b2a" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#4f46e5", letterSpacing: "0.1em", marginBottom: 10 }}>{n}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#c8d8e8", marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#4a6a8a", lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Everything your channel needs
        </h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 52 }}>
          One platform replaces your entire content production stack.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "#080e1a", border: "1px solid #0d1b2a",
              borderRadius: 12, padding: "28px 24px",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a5a")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#0d1b2a")}
            >
              <div style={{ fontSize: 26, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#e0eaf5" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#8a9ab8", lineHeight: 1.7, marginBottom: 12 }}>{f.desc}</p>
              <p style={{ fontSize: 11, color: "#4a6a8a", margin: 0, borderTop: "1px solid #0d1b2a", paddingTop: 10 }}>{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a", borderBottom: "1px solid #0d1b2a",
        padding: "64px 32px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Connects to your entire ecosystem
          </h2>
          <p style={{ color: "#8a9ab8", fontSize: 15, marginBottom: 44 }}>
            AutoVid publishes to every platform your audience is on.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {INTEGRATIONS.map((p) => (
              <div key={p.name} style={{
                background: "#080e1a", border: "1px solid #0d1b2a",
                borderRadius: 10, padding: "14px 20px",
                display: "flex", alignItems: "center", gap: 10,
                minWidth: 130,
              }}>
                <span style={{ fontSize: 18, color: p.color }}>{p.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c8d8e8" }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1040, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Simple, transparent pricing
        </h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 15, marginBottom: 52 }}>
          All plans include a free trial period after manual approval. No credit card required to request access.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#090c1e" : "#080e1a",
              border: `1px solid ${plan.highlight ? "#4f46e5" : "#0d1b2a"}`,
              borderRadius: 14, padding: "32px 28px",
              position: "relative",
            }}>
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "#4f46e5", color: "#fff", fontSize: 10, fontWeight: 800,
                  padding: "3px 14px", borderRadius: 20, letterSpacing: "0.08em", whiteSpace: "nowrap",
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {plan.name}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: "#e0eaf5", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "#8a9ab8" }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 24, lineHeight: 1.6 }}>{plan.desc}</p>
              <ul style={{ listStyle: "none", marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "#8a9ab8", padding: "5px 0", display: "flex", gap: 8, alignItems: "flex-start", borderBottom: "1px solid #0d1b2a" }}>
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
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#4a6a8a", marginTop: 28 }}>
          All plans billed monthly. Cancel anytime. Pricing in USD.
        </p>
      </section>

      {/* FAQ */}
      <div style={{ background: "#050a14", borderTop: "1px solid #0d1b2a" }}>
        <FAQ />
      </div>

      {/* Final CTA */}
      <section style={{
        borderTop: "1px solid #0d1b2a", padding: "80px 32px", textAlign: "center",
      }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.025em" }}>
          Ready to automate your channel?
        </h2>
        <p style={{ color: "#8a9ab8", fontSize: 16, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          Request access today. Accounts are approved manually and limited per month.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff",
            padding: "14px 36px", borderRadius: 8, fontWeight: 700, fontSize: 15,
          }}>
            Request access →
          </Link>
          <a href="mailto:help@async-mode.com" style={{
            border: "1px solid #1a2a3a", color: "#8a9ab8",
            padding: "14px 28px", borderRadius: 8, fontWeight: 500, fontSize: 15,
          }}>
            Contact us
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #0d1b2a", padding: "28px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16, maxWidth: 1100, margin: "0 auto",
      }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </span>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#4a6a8a", flexWrap: "wrap" }}>
          <a href="#features" style={{ color: "#4a6a8a" }}>Features</a>
          <a href="#pricing" style={{ color: "#4a6a8a" }}>Pricing</a>
          <a href="#faq" style={{ color: "#4a6a8a" }}>FAQ</a>
          <Link to="/login" style={{ color: "#4a6a8a" }}>Log in</Link>
          <Link to="/register" style={{ color: "#4a6a8a" }}>Register</Link>
          <a href="mailto:help@async-mode.com" style={{ color: "#4a6a8a" }}>help@async-mode.com</a>
        </div>
        <span style={{ fontSize: 12, color: "#4a6a8a" }}>© 2026 async-mode.com</span>
      </footer>
    </div>
  );
}
