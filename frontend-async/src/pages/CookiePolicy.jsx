import { Link } from "react-router-dom";

const S = {
  wrap: { background: "#08080f", minHeight: "100vh", color: "#e0eaf5", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  nav: { borderBottom: "1px solid #0d1b2a", padding: "0 24px", display: "flex", alignItems: "center", height: 56, background: "#050a14" },
  brand: { fontWeight: 800, fontSize: 18, color: "#e0eaf5" },
  inner: { maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" },
  h1: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8, color: "#e0eaf5" },
  meta: { fontSize: 13, color: "#4a6a8a", marginBottom: 48 },
  h2: { fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "36px 0 12px" },
  p: { fontSize: 14, color: "#8a9ab8", lineHeight: 1.9, margin: "0 0 16px" },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 24 },
  th: { fontSize: 11, fontWeight: 700, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 14px", background: "#050a14", borderBottom: "1px solid #0d1b2a", textAlign: "left" },
  td: { fontSize: 13, color: "#8a9ab8", padding: "10px 14px", borderBottom: "1px solid #0d1b2a" },
  footer: { borderTop: "1px solid #0d1b2a", padding: "20px 24px", textAlign: "center", fontSize: 12, color: "#4a6a8a" },
};

export default function CookiePolicy() {
  return (
    <div style={S.wrap}>
      <nav style={S.nav}>
        <Link to="/" style={S.brand}>async<span style={{ color: "#4f46e5" }}>-mode</span></Link>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ fontSize: 13, color: "#4a6a8a" }}>← Back to home</Link>
      </nav>
      <div style={S.inner}>
        <h1 style={S.h1}>Cookie Policy</h1>
        <p style={S.meta}>Last updated: June 2026 · async-mode.com</p>

        <p style={S.p}>This Cookie Policy explains how async-mode.com uses cookies and similar technologies when you visit our website and use our platform.</p>

        <h2 style={S.h2}>What are cookies?</h2>
        <p style={S.p}>Cookies are small text files placed on your device by a website. They help websites remember your preferences, keep you logged in, and understand how you use the site. Some cookies are essential for the site to function; others are optional.</p>

        <h2 style={S.h2}>Cookies we use</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Cookie</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Purpose</th>
              <th style={S.th}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["async_token", "Essential", "JWT authentication token — keeps you logged in", "Session / 30 days"],
              ["am_cookies_accepted", "Functional", "Records your cookie consent decision", "1 year"],
            ].map(([name, type, purpose, duration]) => (
              <tr key={name}>
                <td style={{ ...S.td, fontFamily: "monospace", color: "#818cf8" }}>{name}</td>
                <td style={S.td}>{type}</td>
                <td style={S.td}>{purpose}</td>
                <td style={S.td}>{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={S.h2}>Essential cookies</h2>
        <p style={S.p}>Essential cookies are required for the platform to function. Without them, you cannot log in or use the dashboard. These cookies do not require your consent as they are strictly necessary for service delivery.</p>

        <h2 style={S.h2}>Functional cookies</h2>
        <p style={S.p}>Functional cookies remember your preferences and choices (like cookie consent) to improve your experience. They do not track you across websites.</p>

        <h2 style={S.h2}>Third-party services</h2>
        <p style={S.p}>We use the following third-party services which may set their own cookies:</p>
        <p style={S.p}>
          • <strong style={{ color: "#c8d8e8" }}>Supabase</strong> — Database and authentication infrastructure<br />
          • <strong style={{ color: "#c8d8e8" }}>Stripe</strong> — Payment processing (only on checkout pages)<br />
          • <strong style={{ color: "#c8d8e8" }}>YouTube</strong> — Video embedding and uploads via OAuth
        </p>
        <p style={S.p}>We do not use Google Analytics, Facebook Pixel, or any advertising tracking cookies.</p>

        <h2 style={S.h2}>Managing cookies</h2>
        <p style={S.p}>You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. Note that disabling essential cookies will prevent you from logging in to the platform.</p>
        <p style={S.p}>To clear your cookie consent choice, clear your browser's local storage for async-mode.com.</p>

        <h2 style={S.h2}>Changes to this policy</h2>
        <p style={S.p}>We may update this Cookie Policy. Changes will be posted on this page with an updated date. Continued use of the platform after changes constitutes acceptance.</p>

        <h2 style={S.h2}>Contact</h2>
        <p style={S.p}>Questions? Email <a href="mailto:help@async-mode.com" style={{ color: "#818cf8" }}>help@async-mode.com</a>.</p>
      </div>
      <footer style={S.footer}>
        <Link to="/privacy" style={{ color: "#4a6a8a", marginRight: 16 }}>Privacy Policy</Link>
        <Link to="/terms" style={{ color: "#4a6a8a", marginRight: 16 }}>Terms of Service</Link>
        <Link to="/refund" style={{ color: "#4a6a8a", marginRight: 16 }}>Refund Policy</Link>
        <Link to="/" style={{ color: "#4a6a8a" }}>← Home</Link>
      </footer>
    </div>
  );
}
