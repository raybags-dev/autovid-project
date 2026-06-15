import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config/site";

const LAST_UPDATED = SITE.legal.termsUpdated;
const APP_NAME = SITE.name;
const APP_URL = SITE.url;
const CONTACT_EMAIL = SITE.contact.support;

const SECTIONS = [
  { id: "introduction",  num: "01", title: "Introduction" },
  { id: "acceptance",    num: "02", title: "Acceptance of Terms" },
  { id: "services",      num: "03", title: "Our Services" },
  { id: "intellectual",  num: "04", title: "Intellectual Property" },
  { id: "user-conduct",  num: "05", title: "User Conduct" },
  { id: "comments",      num: "06", title: "Comments & Submissions" },
  { id: "third-party",   num: "07", title: "Third-Party Platforms" },
  { id: "disclaimers",   num: "08", title: "Disclaimers" },
  { id: "limitation",    num: "09", title: "Limitation of Liability" },
  { id: "governing-law", num: "10", title: "Governing Law" },
  { id: "changes",       num: "11", title: "Changes to Terms" },
  { id: "contact",       num: "12", title: "Contact Us" },
];

const CONTENT = {
  introduction: `Welcome to ${APP_NAME}. These Terms of Service ("Terms") govern your access to and use of our website at ${APP_URL} and all related content, including AI-generated videos, podcasts, and blog articles published across connected platforms.

By accessing or using our services, you agree to be bound by these Terms. Please read them carefully.`,

  acceptance: `By accessing ${APP_URL}, subscribing to our content, or interacting with our services in any way, you confirm that you:

• Are at least 13 years of age
• Have read, understood, and agree to these Terms
• Have read and accept our Privacy Policy and Cookie Policy

If you do not agree to these Terms, please discontinue use of our services immediately.`,

  services: `${APP_NAME} is an AI-powered content creation platform that produces and distributes:

• Long-form and short-form mystery, history, and educational videos published to YouTube and TikTok
• Podcast episodes published to Spotify and other audio platforms
• Written blog articles and commentary published on our website
• Email notifications to subscribers who have opted in

All content is produced using artificial intelligence tools including AI-generated scripts, voice synthesis, and image generation. Content is reviewed before publication but may contain inaccuracies. We do not represent our AI-generated content as definitive fact.`,

  intellectual: `All content published by ${APP_NAME} — including but not limited to videos, audio, scripts, images, graphics, and written articles — is the intellectual property of ${APP_NAME} and is protected by applicable copyright and intellectual property laws.

You may not:
• Reproduce, redistribute, or republish our content without written permission
• Use our content for commercial purposes without prior authorisation
• Remove any copyright notices or branding from our content
• Create derivative works from our content without permission

You may share links to our content on social media and other platforms, provided you attribute ${APP_NAME} as the source.

${APP_NAME} makes use of AI tools and third-party assets under licence. Any user-submitted content (e.g. blog comments) remains the intellectual property of the submitter, but by submitting you grant ${APP_NAME} a non-exclusive, royalty-free licence to display and moderate that content on our platform.`,

  "user-conduct": `When accessing our website or interacting with our content, you agree not to:

• Post or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or obscene
• Impersonate any person or entity
• Attempt to gain unauthorised access to our systems or servers
• Use automated tools to scrape, crawl, or harvest our content without permission
• Engage in any activity that disrupts or interferes with our services
• Submit spam, unsolicited communications, or advertisements through our contact forms or comment system
• Circumvent, disable, or interfere with any security features of our website

We reserve the right to remove any content and restrict access for users who violate these standards.`,

  comments: `Our blog allows users to submit public comments. By submitting a comment, you agree that:

• Your comment is your own original content and does not infringe any third-party rights
• You grant ${APP_NAME} the right to display, moderate, edit, or remove your comment at any time
• Your comment does not contain personal attacks, hate speech, spam, or illegal content
• Your comment may be reviewed before publication (pre-moderation may apply)

We reserve the right to refuse or remove any comment without prior notice. We are not liable for user-submitted content but will remove content that violates these Terms upon notification.`,

  "third-party": `Our website contains links to and embeds from third-party platforms including YouTube, TikTok, and Spotify. We also use third-party services such as ElevenLabs for voice synthesis.

We are not responsible for the content, privacy practices, or terms of service of these third parties. Links to third-party sites do not constitute endorsement.

Third-party platforms' terms of service govern your use of those platforms:
• Google / YouTube — https://www.youtube.com/t/terms
• TikTok — https://www.tiktok.com/legal/page/row/terms-of-service/en
• Spotify — https://www.spotify.com/legal/end-user-agreement/
• ElevenLabs — https://elevenlabs.io/terms`,

  disclaimers: `Our services are provided on an "as is" and "as available" basis without warranties of any kind, either express or implied.

We do not warrant that:
• Our website will be uninterrupted, error-free, or free of viruses or harmful components
• The content we produce is accurate, complete, or up to date
• Any errors or defects will be corrected

Content on ${APP_NAME} is for informational and entertainment purposes only. Nothing on our platform constitutes professional advice of any kind (legal, medical, financial, etc.). Always seek qualified professional advice for such matters.

AI-generated content may contain errors, hallucinations, or outdated information. We encourage critical engagement with all content.`,

  limitation: `To the maximum extent permitted by applicable law, ${APP_NAME} and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:

• Your use of or inability to use our services
• Any errors or inaccuracies in our content
• Unauthorised access to or alteration of your data
• Any other matter relating to our services

Our total liability to you for any claims arising from these Terms shall not exceed the amount you paid to us in the twelve months preceding the claim (which is £0 for free services).

Some jurisdictions do not allow limitation of liability for certain types of damages, so some of the above may not apply to you.`,

  "governing-law": `These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to conflict of law provisions.

Any disputes arising from these Terms or your use of our services shall be subject to the exclusive jurisdiction of the courts of England and Wales.

If any provision of these Terms is found to be unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall continue in full force and effect.`,

  changes: `We reserve the right to modify these Terms of Service at any time. When we make material changes, we will update the "Last Updated" date at the top of this page.

Your continued use of our services after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.

If you do not agree to the revised Terms, you must discontinue use of our services.`,

  contact: `If you have any questions, concerns, or requests regarding these Terms of Service, please contact us:

Email: ${CONTACT_EMAIL}
Website: ${APP_URL}

We aim to respond to all enquiries within 5 business days.`,
};

export default function TermsOfService() {
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
          <Link to="/privacy-policy" className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>Privacy Policy</Link>
          <Link to="/cookie-policy" className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>Cookie Policy</Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "48px 32px 40px", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#ff7844", marginBottom: 12, fontFamily: "sans-serif" }}>LEGAL</div>
          <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,46px)", color: "#eef4ff", letterSpacing: "-0.02em", lineHeight: 1.08, marginBottom: 16 }}>
            Terms of Service
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
            Please read these Terms carefully before using {APP_NAME}. By accessing our website or content, you agree to be bound by these Terms.
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
            <Link to="/privacy-policy" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Privacy Policy</Link>
            <Link to="/cookie-policy" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Cookie Policy</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
