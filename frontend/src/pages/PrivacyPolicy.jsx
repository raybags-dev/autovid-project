const CURRENT_DATE = new Date().toLocaleDateString("en-GB", {
  day: "numeric", month: "long", year: "numeric",
});

const SECTIONS = [
  {
    title: "1. Introduction",
    body: `4Life Mystery ("we", "us", or "our") operates an automated video creation and publishing platform. This Privacy Policy explains how we collect, use, and protect information when you interact with our services, including content published on YouTube and TikTok.`,
  },
  {
    title: "2. Information We Collect",
    body: `We may collect the following types of information:\n• Channel analytics and performance data from connected platforms (YouTube, TikTok)\n• Publicly available comment data on published videos\n• Usage data from our internal dashboard\n• No personally identifiable information is collected from viewers of our content.`,
  },
  {
    title: "3. How We Use Information",
    body: `Information collected is used solely to:\n• Generate and publish automated video content\n• Moderate and respond to comments using AI\n• Analyse content performance and improve output quality\n• We do not sell, rent, or share any data with third parties for marketing purposes.`,
  },
  {
    title: "4. Third-Party Platforms",
    body: `Our service integrates with third-party platforms including YouTube (Google LLC) and TikTok. When publishing content to these platforms, their respective privacy policies and terms of service govern the handling of data on those platforms. We encourage you to review:\n• YouTube Privacy Policy: https://policies.google.com/privacy\n• TikTok Privacy Policy: https://www.tiktok.com/legal/page/row/privacy-policy/en`,
  },
  {
    title: "5. Data Retention",
    body: `Temporary files (audio, video intermediates) generated during content production are automatically deleted within 1 hour of creation. Published content metadata is retained in our database for operational purposes.`,
  },
  {
    title: "6. Security",
    body: `We implement appropriate technical measures to protect our systems, including encrypted storage of API credentials and access tokens. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "7. Children's Privacy",
    body: `Our service is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us so we can delete it.`,
  },
  {
    title: "8. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last updated" date at the top of this page. Continued use of our service after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "9. Contact",
    body: `If you have questions about this Privacy Policy, you can reach us at: support@4lifemystery.com`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      overflowY: "auto",
      background: "#07080f",
      color: "#cdd8e8",
      fontFamily: "'DM Mono', 'Fira Code', monospace",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* ── Nav ── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(7,8,15,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #12233a",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
      }}>
        <a href="https://4lifemystery.com/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "sans-serif",
            fontWeight: 800,
            fontSize: 17,
            background: "linear-gradient(135deg,#00b4ff,#00e080)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>4LIFE</span>
          <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 17, color: "#cdd8e8" }}>MYSTERY</span>
        </a>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <a href="https://4lifemystery.com/" style={{ fontSize: 11, color: "#5a7a9a", textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => e.target.style.color = "#00b4ff"} onMouseLeave={e => e.target.style.color = "#5a7a9a"}>
            ← Home
          </a>
          <a href="/terms-of-service" style={{ fontSize: 11, color: "#5a7a9a", textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => e.target.style.color = "#00b4ff"} onMouseLeave={e => e.target.style.color = "#5a7a9a"}>
            Terms of Service
          </a>
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#00a0dc", marginBottom: 14, fontFamily: "sans-serif" }}>
            4LIFE MYSTERY
          </div>
          <h1 style={{
            fontSize: 38,
            fontWeight: 800,
            margin: 0,
            color: "#e8f4ff",
            fontFamily: "sans-serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}>
            Privacy Policy
          </h1>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 16,
          }}>
            <span style={{ fontSize: 12, color: "#3d5a72" }}>Last updated: {CURRENT_DATE}</span>
            <span style={{ width: 1, height: 14, background: "#12233a", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#3d5a72" }}>Version 1.0</span>
          </div>
        </div>

        {/* Intro card */}
        <div style={{
          background: "rgba(0,160,220,0.06)",
          border: "1px solid rgba(0,160,220,0.18)",
          borderRadius: 12,
          padding: "18px 22px",
          marginBottom: 44,
          fontSize: 13,
          lineHeight: 1.8,
          color: "#7a9bb5",
        }}>
          This document describes how 4Life Mystery handles information in connection with its automated content creation platform. Please read it carefully.
        </div>

        {/* Sections */}
        {SECTIONS.map(({ title, body }) => (
          <div key={title} style={{
            marginBottom: 36,
            paddingBottom: 36,
            borderBottom: "1px solid #0d1e30",
          }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#e8f4ff",
              marginBottom: 12,
              fontFamily: "sans-serif",
              letterSpacing: "0.02em",
            }}>
              {title}
            </h2>
            <p style={{
              fontSize: 13,
              lineHeight: 1.9,
              color: "#7a9bb5",
              whiteSpace: "pre-line",
              margin: 0,
            }}>
              {body}
            </p>
          </div>
        ))}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid #0d1e30",
        padding: "32px 24px",
        background: "#050608",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#cdd8e8", fontFamily: "sans-serif", marginBottom: 6 }}>4Life Mystery</div>
              <div style={{ fontSize: 11, color: "#3d5a72" }}>© {new Date().getFullYear()} 4Life Mystery. All rights reserved.</div>
              <div style={{ fontSize: 11, color: "#3d5a72", marginTop: 4 }}>{CURRENT_DATE}</div>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <a href="https://www.youtube.com/@4lifemystery" target="_blank" rel="noreferrer" style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, color: "#5a7a9a", textDecoration: "none",
                padding: "6px 12px", borderRadius: 7, border: "1px solid #12233a",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff0000"; e.currentTarget.style.color = "#ff0000"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#12233a"; e.currentTarget.style.color = "#5a7a9a"; }}>
                ▶ YouTube
              </a>
              <a href="https://www.tiktok.com/@4lifemystery" target="_blank" rel="noreferrer" style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, color: "#5a7a9a", textDecoration: "none",
                padding: "6px 12px", borderRadius: 7, border: "1px solid #12233a",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff2d55"; e.currentTarget.style.color = "#ff2d55"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#12233a"; e.currentTarget.style.color = "#5a7a9a"; }}>
                ♪ TikTok
              </a>
              <a href="/terms-of-service" style={{ fontSize: 11, color: "#3d5a72", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color = "#00b4ff"} onMouseLeave={e => e.target.style.color = "#3d5a72"}>
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
