import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "🎬",
    title: "Script to Video",
    desc: "Enter a topic and AutoVid writes the script, generates narration, sources visuals, and assembles a complete video — automatically.",
  },
  {
    icon: "🗣️",
    title: "AI Narration",
    desc: "Professional-grade voice synthesis via ElevenLabs. No mic, no recording sessions — just crisp narration on every video.",
  },
  {
    icon: "📡",
    title: "Auto Publish",
    desc: "Push directly to YouTube on a schedule. Titles, descriptions, tags, and thumbnails — all handled by the pipeline.",
  },
  {
    icon: "✂️",
    title: "Shorts & Clips",
    desc: "Turn long-form videos into vertical Shorts automatically. Reach more platforms with less effort.",
  },
  {
    icon: "🎧",
    title: "Podcast Pipeline",
    desc: "Every video becomes a podcast episode too. AutoVid publishes to Spotify and Buzzsprout without extra work.",
  },
  {
    icon: "📊",
    title: "Full Dashboard",
    desc: "Monitor your queue, track video performance, manage captions, and control every setting from one clean interface.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    features: ["10 videos / month", "YouTube auto-publish", "AI narration", "Basic analytics"],
    cta: "Request access",
    highlight: false,
  },
  {
    name: "Creator",
    price: "$79",
    period: "/mo",
    features: ["Unlimited videos", "Shorts automation", "Podcast pipeline", "Priority queue", "Full dashboard"],
    cta: "Request access",
    highlight: true,
  },
  {
    name: "Studio",
    price: "Custom",
    period: "",
    features: ["Everything in Creator", "Dedicated worker", "Custom AI models", "White-label output", "SLA support"],
    cta: "Contact us",
    highlight: false,
  },
];

export default function Landing() {
  return (
    <div style={{ background: "#08080f", minHeight: "100vh", color: "#e0eaf5" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,8,15,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #0d1b2a",
        padding: "0 32px", display: "flex", alignItems: "center", height: 60,
      }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "#e0eaf5", flex: 1 }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="#features" style={{ color: "#8a9ab8", fontSize: 14, padding: "6px 12px" }}>Features</a>
          <a href="#pricing" style={{ color: "#8a9ab8", fontSize: 14, padding: "6px 12px" }}>Pricing</a>
          <Link to="/login" style={{
            color: "#8a9ab8", fontSize: 14, padding: "6px 16px",
            border: "1px solid #1a2a3a", borderRadius: 6,
          }}>
            Log in
          </Link>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff", fontSize: 14,
            padding: "7px 18px", borderRadius: 6, fontWeight: 600,
          }}>
            Get access
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 860, margin: "0 auto", padding: "100px 32px 80px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block", background: "#0d1b2a",
          border: "1px solid #1a2a3a", borderRadius: 20,
          padding: "5px 14px", fontSize: 12, color: "#4f9de8",
          letterSpacing: "0.04em", marginBottom: 28,
        }}>
          AI-POWERED VIDEO AUTOMATION
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800,
          lineHeight: 1.1, letterSpacing: "-0.03em",
          color: "#e0eaf5", marginBottom: 24,
        }}>
          From idea to published<br />
          <span style={{ color: "#4f46e5" }}>video — fully automated</span>
        </h1>
        <p style={{
          fontSize: 18, color: "#8a9ab8", lineHeight: 1.7,
          maxWidth: 560, margin: "0 auto 40px",
        }}>
          AutoVid writes the script, generates narration, assembles footage,
          adds captions, and publishes to YouTube — all from a single prompt.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/register" style={{
            background: "#4f46e5", color: "#fff",
            padding: "14px 32px", borderRadius: 8, fontWeight: 700, fontSize: 15,
            display: "inline-block",
          }}>
            Request access →
          </Link>
          <a href="#features" style={{
            border: "1px solid #1a2a3a", color: "#8a9ab8",
            padding: "14px 32px", borderRadius: 8, fontWeight: 500, fontSize: 15,
            display: "inline-block",
          }}>
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Everything included
        </h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 16, marginBottom: 56 }}>
          One platform handles your entire content production stack.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "#080e1a", border: "1px solid #0d1b2a",
              borderRadius: 12, padding: "28px 24px",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#e0eaf5" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#8a9ab8", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a", borderBottom: "1px solid #0d1b2a",
        padding: "80px 32px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 48, letterSpacing: "-0.02em" }}>
            How it works
          </h2>
          <div style={{ display: "flex", gap: 0, flexDirection: "column" }}>
            {[
              ["1", "Request access", "Register with your email. Your account is reviewed and approved within 24 hours."],
              ["2", "Log in to your dashboard", "After approval, log in and access your personal AutoVid workspace."],
              ["3", "Enter a topic", "Type any topic or idea. AutoVid handles everything from script to finished video."],
              ["4", "Publish automatically", "Videos go straight to YouTube. Shorts, podcast episodes, and captions included."],
            ].map(([n, title, desc]) => (
              <div key={n} style={{
                display: "flex", gap: 24, alignItems: "flex-start",
                padding: "24px 0", borderBottom: "1px solid #0d1b2a",
                textAlign: "left",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#0d1b2a", border: "1px solid #1a2a3a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: "#4f46e5", flexShrink: 0,
                }}>
                  {n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#e0eaf5" }}>{title}</div>
                  <div style={{ fontSize: 14, color: "#8a9ab8", lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 32px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Simple pricing
        </h2>
        <p style={{ textAlign: "center", color: "#8a9ab8", fontSize: 16, marginBottom: 56 }}>
          All plans include a free trial period after approval.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#0d1020" : "#080e1a",
              border: `1px solid ${plan.highlight ? "#4f46e5" : "#0d1b2a"}`,
              borderRadius: 14, padding: "32px 24px",
              position: "relative",
            }}>
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "#4f46e5", color: "#fff", fontSize: 11, fontWeight: 700,
                  padding: "3px 14px", borderRadius: 20, letterSpacing: "0.05em",
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#8a9ab8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {plan.name}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: "#e0eaf5" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "#8a9ab8" }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: "none", marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 14, color: "#8a9ab8", padding: "5px 0", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#4f46e5", fontWeight: 700 }}>✓</span> {f}
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
      </section>

      {/* CTA */}
      <section style={{
        background: "#050a14", borderTop: "1px solid #0d1b2a",
        padding: "80px 32px", textAlign: "center",
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Ready to automate your channel?
        </h2>
        <p style={{ color: "#8a9ab8", fontSize: 16, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          Request access today. Accounts are approved manually — limited spots per month.
        </p>
        <Link to="/register" style={{
          background: "#4f46e5", color: "#fff",
          padding: "14px 36px", borderRadius: 8, fontWeight: 700, fontSize: 15,
          display: "inline-block",
        }}>
          Request access →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #0d1b2a", padding: "32px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16, maxWidth: 1100, margin: "0 auto",
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </span>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#4a6a8a" }}>
          <Link to="/login" style={{ color: "#4a6a8a" }}>Log in</Link>
          <Link to="/register" style={{ color: "#4a6a8a" }}>Register</Link>
        </div>
        <span style={{ fontSize: 12, color: "#4a6a8a" }}>© 2026 async-mode.com</span>
      </footer>
    </div>
  );
}
