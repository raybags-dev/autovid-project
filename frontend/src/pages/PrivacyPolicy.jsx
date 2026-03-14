import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "14 March 2026";
const APP_NAME = "4Life Mystery";
const APP_URL = "https://4lifemystery.com";
const CONTACT_EMAIL = "support@4lifemystery.com";
const CONTACT_GENERAL = "contact@4lifemystery.com";

const SECTIONS = [
  { id: "introduction", num: "01", title: "Introduction" },
  { id: "information-collected", num: "02", title: "Information We Collect" },
  { id: "how-we-use", num: "03", title: "How We Use Information" },
  { id: "third-party", num: "04", title: "Third-Party Platforms" },
  { id: "cookies", num: "05", title: "Cookies & Tracking" },
  { id: "data-retention", num: "06", title: "Data Retention" },
  { id: "security", num: "07", title: "Security" },
  { id: "childrens-privacy", num: "08", title: "Children's Privacy" },
  { id: "your-rights", num: "09", title: "Your Rights" },
  { id: "changes", num: "10", title: "Changes to This Policy" },
  { id: "contact", num: "11", title: "Contact Us" },
];

const CONTENT = {
  introduction: `${APP_NAME} (also referred to as the "4Life Mystery App", "4Life Mystery TikTok Integration", and "4Life Mystery YouTube Integration") ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy applies to the ${APP_NAME} application and website at ${APP_URL}, as well as all associated integrations including our TikTok developer application, YouTube API integration, Spotify embedded content, and any other connected platforms.

This policy is intended to meet the requirements of the TikTok Developer Platform, Google API Services, and other third-party platform review processes.

Please read this policy carefully. If you disagree with its terms, please discontinue use of our site.`,

  "information-collected": `We may collect the following categories of information:

Automatically Collected
• IP address and approximate geolocation
• Browser type, device type, and operating system
• Pages visited, time on site, and referring URLs
• Cookie identifiers and session data

Voluntarily Provided
• Email address (if you subscribe to content notifications)
• Name and comment content (if you submit a public comment on our blog)
• Any information you provide when contacting us directly

Platform Analytics (aggregated, non-personal)
• YouTube: view counts, like counts, comment counts, channel analytics
• TikTok: video performance metrics
• Spotify: listener statistics and episode performance`,

  "how-we-use": `We use collected information for the following purposes:

• To operate, maintain, and improve our website and content
• To publish automated AI-generated video and podcast content to connected platforms
• To moderate and respond to community comments
• To analyse content performance and guide creative decisions
• To send notification emails to subscribers (with explicit opt-in only)
• To detect and prevent fraudulent or abusive activity on our services
• To comply with legal obligations

We do not sell, rent, or trade your personal information to any third party for marketing purposes.`,

  "third-party": `The ${APP_NAME} application ("4Life Mystery") integrates with the following third-party platforms via their official developer APIs. When you interact with these platforms, their own privacy policies govern your data:

TikTok (via 4Life Mystery TikTok Integration)
The ${APP_NAME} application uses the TikTok API to upload AI-generated video content directly to the connected TikTok creator account. We do not collect, store, or share any TikTok user data from visitors to our website. The TikTok integration is used solely for automated content publishing from our own account.
• TikTok Privacy Policy — https://www.tiktok.com/legal/page/row/privacy-policy/en

Google / YouTube (via 4Life Mystery YouTube Integration)
The ${APP_NAME} application uses the YouTube Data API v3 (Google API Services) to upload, manage, and retrieve analytics for AI-generated video content on our own YouTube channel. Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
• Google Privacy Policy — https://policies.google.com/privacy

Spotify
Spotify podcast episodes are embedded on our website for public listening. We do not access Spotify user account data.
• Spotify Privacy Policy — https://www.spotify.com/legal/privacy-policy/

ElevenLabs (AI voice synthesis)
Used internally to generate narration audio. No visitor data is shared with ElevenLabs.
• ElevenLabs Privacy Policy — https://elevenlabs.io/privacy

We are not responsible for the privacy practices of these third parties. We encourage you to review their policies before interacting with their services.`,

  cookies: `We use cookies and similar tracking technologies to enhance your experience on our website.

Essential Cookies
These are necessary for the website to function and cannot be disabled. They include session management, security tokens, and your cookie consent preference.

Analytics Cookies (optional)
We may use analytics tools to understand how visitors interact with our site. These cookies collect aggregate, anonymised data and do not identify you personally.

Preference Cookies (optional)
These remember your choices and settings (e.g. whether you have dismissed certain banners).

You may manage your cookie preferences at any time via the cookie settings banner on our site, or by clearing cookies in your browser settings. Disabling non-essential cookies will not affect your ability to use the site.

For full details on our cookie use, see our Cookie Policy.`,

  "data-retention": `We retain personal data only for as long as necessary to fulfil the purposes outlined in this policy or as required by law:

• Comment data: retained for the lifetime of the associated content, or until you request deletion
• Email subscriber data: retained until you unsubscribe
• Analytics data: retained for up to 24 months in aggregated form
• Temporary production files (audio/video intermediates): automatically deleted within 1 hour of creation
• Server logs: retained for up to 30 days for security purposes`,

  security: `We implement appropriate technical and organisational measures to protect your information, including:

• Encrypted storage of API credentials and access tokens
• HTTPS encryption for all data transmitted to and from our site
• Restricted access to personal data on a need-to-know basis
• Regular review of our data handling practices

No method of electronic transmission or storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee its absolute security. If you believe your data has been compromised, please contact us immediately at ${CONTACT_EMAIL}.`,

  "childrens-privacy": `${APP_NAME} is not directed at children under the age of 13, and we do not knowingly collect personal information from children under 13.

If we learn that we have inadvertently collected personal information from a child under 13, we will delete that information promptly. If you believe a child under 13 has provided us with personal information, please contact us at ${CONTACT_EMAIL}.`,

  "your-rights": `Depending on your jurisdiction, you may have the following rights regarding your personal data:

• Right of Access — request a copy of the personal data we hold about you
• Right to Rectification — request correction of inaccurate or incomplete data
• Right to Erasure — request deletion of your personal data ("right to be forgotten")
• Right to Object — object to our processing of your personal data
• Right to Data Portability — receive your data in a structured, machine-readable format
• Right to Withdraw Consent — withdraw consent at any time where processing is based on consent

To exercise any of these rights, please contact us at ${CONTACT_EMAIL}. We will respond within 30 days. We may need to verify your identity before processing your request.`,

  changes: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons.

When we make material changes, we will update the "Last Updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of our services after any changes constitutes your acceptance of the revised policy.`,

  contact: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

General enquiries:  ${CONTACT_GENERAL}
Support & data requests:  ${CONTACT_EMAIL}
Website:  ${APP_URL}

We aim to respond to all enquiries within 5 business days.`,
};

export default function PrivacyPolicy() {
  const [activeId, setActiveId] = useState("introduction");
  const contentRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); });
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ maxHeight: "100vh", overflowY: "auto", background: "#080a10", color: "#c8d4e0", fontFamily: "'DM Mono','Fira Code',monospace", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .legal-link { color: #5a9fd4; text-decoration: none; transition: color 0.15s; }
        .legal-link:hover { color: #7fc0f5; }
        .toc-btn { display: block; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-family: inherit; padding: 7px 12px; border-radius: 7px; font-size: 11px; letter-spacing: 0.04em; transition: all 0.15s; }
        .toc-btn:hover { background: rgba(255,255,255,0.05); color: #c8d4e0; }
        .toc-btn.active { background: rgba(255,120,60,0.1); color: #ff7844; }
        @media (max-width: 860px) { .legal-sidebar { display: none !important; } .legal-layout { padding: 0 20px !important; } }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,10,16,0.94)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href={APP_URL} style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "0.14em", background: "linear-gradient(135deg,#ff8844,#ff3300,#0088ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            4LIFE MYSTERY
          </span>
        </a>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <a href={APP_URL} className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>← Home</a>
          <Link to="/terms-of-service" className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>Terms of Service</Link>
          <Link to="/cookie-policy" className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>Cookie Policy</Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "48px 32px 40px", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#ff7844", marginBottom: 12, fontFamily: "sans-serif" }}>LEGAL</div>
          <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,46px)", color: "#eef4ff", letterSpacing: "-0.02em", lineHeight: 1.08, marginBottom: 16 }}>
            Privacy Policy
          </h1>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#3d5a72" }}>Last updated: {LAST_UPDATED}</span>
            <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#3d5a72" }}>Applies to: {APP_URL}</span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="legal-layout" style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 80px", display: "flex", gap: 56, alignItems: "flex-start" }}>

        {/* Sidebar TOC */}
        <aside className="legal-sidebar" style={{ width: 220, flexShrink: 0, position: "sticky", top: 80 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3d5a72", marginBottom: 14, fontFamily: "sans-serif" }}>ON THIS PAGE</div>
          <nav>
            {SECTIONS.map(({ id, num, title }) => (
              <button key={id} className={`toc-btn${activeId === id ? " active" : ""}`} onClick={() => scrollTo(id)} style={{ color: activeId === id ? "#ff7844" : "#4a6a8a" }}>
                <span style={{ opacity: 0.45, marginRight: 8, fontSize: 9 }}>{num}</span>{title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main ref={contentRef} style={{ flex: 1, minWidth: 0 }}>
          {/* Intro card */}
          <div style={{ background: "rgba(255,120,60,0.06)", border: "1px solid rgba(255,120,60,0.15)", borderRadius: 12, padding: "18px 22px", marginBottom: 48, fontSize: 13, lineHeight: 1.85, color: "#8a9bb0" }}>
            This document describes how {APP_NAME} collects, uses, and protects your information. Please read it carefully before using our services.
          </div>

          {SECTIONS.map(({ id, num, title }) => (
            <section key={id} id={id} style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid rgba(255,255,255,0.05)", scrollMarginTop: 80 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
                <span style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 700, color: "#ff7844", letterSpacing: "0.1em", opacity: 0.6 }}>{num}</span>
                <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 18, color: "#eef4ff", letterSpacing: "-0.01em" }}>{title}</h2>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.95, color: "#7a9bb0", whiteSpace: "pre-line" }}>
                {CONTENT[id]}
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 32px", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#2a3a4a" }}>© {new Date().getFullYear()} 4Life Mystery. All rights reserved.</div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/terms-of-service" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Terms of Service</Link>
            <Link to="/cookie-policy" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Cookie Policy</Link>
            <a href="mailto:contact@4lifemystery.com" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>contact@4lifemystery.com</a>
            <a href="mailto:support@4lifemystery.com" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>support@4lifemystery.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
