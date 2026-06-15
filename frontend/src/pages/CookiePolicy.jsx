import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "14 March 2026";
import { SITE } from "../config/site";

const APP_NAME = SITE.name;
const APP_URL = SITE.url;
const CONTACT_EMAIL = SITE.contact.support;
const CONSENT_KEY = "4lm_cookie_consent";

const SECTIONS = [
  { id: "introduction",   num: "01", title: "Introduction" },
  { id: "what-are",       num: "02", title: "What Are Cookies?" },
  { id: "types",          num: "03", title: "Types of Cookies We Use" },
  { id: "essential",      num: "04", title: "Essential Cookies" },
  { id: "analytics",      num: "05", title: "Analytics Cookies" },
  { id: "preference",     num: "06", title: "Preference Cookies" },
  { id: "third-party",    num: "07", title: "Third-Party Cookies" },
  { id: "your-choices",   num: "08", title: "Your Cookie Choices" },
  { id: "manage",         num: "09", title: "How to Manage Cookies" },
  { id: "changes",        num: "10", title: "Changes to This Policy" },
  { id: "contact",        num: "11", title: "Contact Us" },
];

const CONTENT = {
  introduction: `This Cookie Policy explains how ${APP_NAME} ("we", "us", or "our") uses cookies and similar tracking technologies when you visit our website at ${APP_URL}.

By continuing to use our website, you consent to the use of cookies in accordance with this policy. You may update your preferences at any time using the settings below or via the cookie consent banner on our site.`,

  "what-are": `Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website. They are widely used to make websites work efficiently, improve user experience, and provide information to website owners.

Cookies can be:
• Session cookies — temporary, deleted when you close your browser
• Persistent cookies — remain on your device for a set period or until manually deleted
• First-party cookies — set by the website you are visiting
• Third-party cookies — set by a different domain (e.g. analytics or ad platforms)

Similar technologies such as web beacons, pixel tags, and local storage may also be used for related purposes.`,

  types: `We categorise the cookies used on our website as follows:

• Essential Cookies — strictly necessary for the website to function; cannot be disabled
• Analytics Cookies — help us understand how visitors use our site (optional)
• Preference Cookies — remember your settings and choices (optional)
• Third-Party Cookies — set by external platforms embedded on our site

You have control over optional cookies. Essential cookies cannot be turned off as the site cannot function without them.`,

  essential: `Essential cookies are necessary for our website to operate and cannot be disabled in our systems. They are usually only set in response to actions you take that amount to a service request, such as setting your privacy preferences or logging in.

Cookies in this category include:

• Cookie consent preference — stores your cookie consent choice so we do not ask again (key: ${CONSENT_KEY})
• Session management — maintains your authenticated session if you are a logged-in user
• Security tokens — CSRF protection to prevent cross-site request forgery

These cookies do not store any personally identifiable information beyond what is necessary for site function.

Legal basis: Legitimate interests (necessary for service operation)`,

  analytics: `Analytics cookies help us understand how visitors interact with our website. This information is collected in aggregate and anonymised form — it does not identify you personally.

Data collected may include:
• Pages visited and time spent on each page
• Referring URLs and search terms
• Browser type, device type, and screen resolution
• General geographic region (country/city level only)

We use this data solely to improve our website content and user experience. We do not share this aggregated data with third parties for advertising purposes.

Legal basis: Consent
Default state: Disabled until you opt in`,

  preference: `Preference cookies allow our website to remember choices you have made and personalise your experience accordingly. These may include:

• Whether you have dismissed notification banners
• Your preferred content display settings
• Any accessibility preferences you have set

These cookies improve your experience but are not required for the site to function.

Legal basis: Consent
Default state: Disabled until you opt in`,

  "third-party": `Our website may embed content from third-party platforms, which may set their own cookies. These platforms include:

• YouTube (Google LLC) — video embeds may set cookies for playback tracking and ad measurement. Google Privacy Policy: https://policies.google.com/privacy
• Spotify — podcast embeds may set cookies for playback. Spotify Privacy Policy: https://www.spotify.com/legal/privacy-policy/
• TikTok — social media embeds. TikTok Privacy Policy: https://www.tiktok.com/legal/page/row/privacy-policy/en

We do not control these third-party cookies and are not responsible for them. Blocking these cookies may prevent embedded content from functioning correctly.

To opt out of third-party tracking, visit each provider's privacy controls or use a browser extension such as uBlock Origin.`,

  "your-choices": `You are in control of your cookie preferences. You can:

• Accept all cookies — enables all categories including analytics and preference cookies
• Accept essential only — only strictly necessary cookies are set; analytics and preference cookies are disabled
• Manage preferences — choose individually which optional categories to enable

Your preferences are saved to your browser's local storage under the key "${CONSENT_KEY}" and will persist across visits until you clear your browser data or update your preferences.

You can update your consent preferences at any time using the button below.`,

  manage: `In addition to the consent settings on this site, you can control cookies through your browser settings:

Google Chrome: Settings → Privacy and Security → Cookies and other site data
Mozilla Firefox: Settings → Privacy & Security → Cookies and Site Data
Safari: Preferences → Privacy → Manage Website Data
Microsoft Edge: Settings → Cookies and site permissions

Please note that disabling cookies may affect the functionality of our website and other websites you visit.

You can also use browser extensions such as Privacy Badger or uBlock Origin to block specific tracking technologies. The Digital Advertising Alliance opt-out tool at https://optout.aboutads.info may also be relevant for interest-based advertising.`,

  changes: `We may update this Cookie Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.

When we make material changes, we will update the "Last Updated" date at the top of this page. We encourage you to review this policy periodically.

If we make significant changes that affect how we use cookies requiring fresh consent, we will display a new consent banner on your next visit.`,

  contact: `If you have any questions about our use of cookies or this Cookie Policy, please contact us:

Email: ${CONTACT_EMAIL}
Website: ${APP_URL}

We aim to respond to all enquiries within 5 business days.`,
};

function ConsentManager() {
  const [consent, setConsent] = useState(null);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, preference: false });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConsent(parsed);
        setPrefs({ analytics: !!parsed.analytics, preference: !!parsed.preference });
      }
    } catch {/* ignore */}
  }, []);

  const save = (analytics, preference) => {
    const val = { analytics, preference, essential: true, accepted_at: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(val));
    setConsent(val);
    setPrefs({ analytics, preference });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const status = consent
    ? `Saved ${new Date(consent.accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : "Not yet set";

  return (
    <div style={{ background: "rgba(255,120,60,0.05)", border: "1px solid rgba(255,120,60,0.2)", borderRadius: 14, padding: "24px 28px", marginTop: 48 }}>
      <div style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 14, color: "#eef4ff", marginBottom: 6 }}>Cookie Preferences</div>
      <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 24 }}>Status: <span style={{ color: consent ? "#4ade80" : "#ff7844" }}>{status}</span></div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
        {/* Essential — locked on */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontFamily: "sans-serif", fontWeight: 600, fontSize: 13, color: "#c8d4e0", marginBottom: 3 }}>Essential Cookies</div>
            <div style={{ fontSize: 11, color: "#3d5a72" }}>Always active — required for site function</div>
          </div>
          <div style={{ fontSize: 11, color: "#4ade80", fontFamily: "sans-serif", fontWeight: 600 }}>Always On</div>
        </div>

        {/* Analytics */}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${prefs.analytics ? "rgba(255,120,60,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "border-color 0.2s" }}>
          <div>
            <div style={{ fontFamily: "sans-serif", fontWeight: 600, fontSize: 13, color: "#c8d4e0", marginBottom: 3 }}>Analytics Cookies</div>
            <div style={{ fontSize: 11, color: "#3d5a72" }}>Help us understand site usage (anonymised)</div>
          </div>
          <div style={{ position: "relative", width: 42, height: 24, flexShrink: 0 }}>
            <input type="checkbox" checked={prefs.analytics} onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: prefs.analytics ? "#ff7844" : "rgba(255,255,255,0.1)", transition: "background 0.2s" }} />
            <div style={{ position: "absolute", top: 3, left: prefs.analytics ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
          </div>
        </label>

        {/* Preference */}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${prefs.preference ? "rgba(255,120,60,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "border-color 0.2s" }}>
          <div>
            <div style={{ fontFamily: "sans-serif", fontWeight: 600, fontSize: 13, color: "#c8d4e0", marginBottom: 3 }}>Preference Cookies</div>
            <div style={{ fontSize: 11, color: "#3d5a72" }}>Remember your settings and display choices</div>
          </div>
          <div style={{ position: "relative", width: 42, height: 24, flexShrink: 0 }}>
            <input type="checkbox" checked={prefs.preference} onChange={e => setPrefs(p => ({ ...p, preference: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: prefs.preference ? "#ff7844" : "rgba(255,255,255,0.1)", transition: "background 0.2s" }} />
            <div style={{ position: "absolute", top: 3, left: prefs.preference ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
          </div>
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => save(prefs.analytics, prefs.preference)} style={{ padding: "10px 22px", background: "#ff7844", border: "none", borderRadius: 8, color: "#fff", fontFamily: "sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", letterSpacing: "0.04em", transition: "opacity 0.15s" }} onMouseEnter={e => e.target.style.opacity = "0.85"} onMouseLeave={e => e.target.style.opacity = "1"}>
          {saved ? "Saved!" : "Save Preferences"}
        </button>
        <button onClick={() => save(true, true)} style={{ padding: "10px 22px", background: "rgba(255,120,60,0.12)", border: "1px solid rgba(255,120,60,0.25)", borderRadius: 8, color: "#ff7844", fontFamily: "sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", letterSpacing: "0.04em" }}>
          Accept All
        </button>
        <button onClick={() => save(false, false)} style={{ padding: "10px 22px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#4a6a8a", fontFamily: "sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer", letterSpacing: "0.04em" }}>
          Essential Only
        </button>
      </div>
    </div>
  );
}

export default function CookiePolicy() {
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
          <Link to="/terms-of-service" className="legal-link" style={{ fontSize: 11, letterSpacing: "0.06em" }}>Terms of Service</Link>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "48px 32px 40px", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#ff7844", marginBottom: 12, fontFamily: "sans-serif" }}>LEGAL</div>
          <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,46px)", color: "#eef4ff", letterSpacing: "-0.02em", lineHeight: 1.08, marginBottom: 16 }}>
            Cookie Policy
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
            This Cookie Policy explains what cookies are, how {APP_NAME} uses them, and how you can manage your preferences. Your consent choices are saved locally and can be updated at any time.
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
              {id === "your-choices" && <ConsentManager />}
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
            <Link to="/privacy-policy" style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Privacy Policy</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 11, color: "#2a3a4a", textDecoration: "none" }} onMouseEnter={e => e.target.style.color="#ff7844"} onMouseLeave={e => e.target.style.color="#2a3a4a"}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
