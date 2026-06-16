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
  footer: { borderTop: "1px solid #0d1b2a", padding: "20px 24px", textAlign: "center", fontSize: 12, color: "#4a6a8a" },
};

export default function PrivacyPolicy() {
  return (
    <div style={S.wrap}>
      <nav style={S.nav}>
        <Link to="/" style={S.brand}>async<span style={{ color: "#4f46e5" }}>-mode</span></Link>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ fontSize: 13, color: "#4a6a8a" }}>← Back to home</Link>
      </nav>
      <div style={S.inner}>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={S.meta}>Last updated: June 2026 · async-mode.com</p>

        <p style={S.p}>This Privacy Policy describes how async-mode.com ("we", "our", or "us") collects, uses, and shares information about you when you use our AI video automation platform.</p>

        <h2 style={S.h2}>1. Information We Collect</h2>
        <p style={S.p}><strong style={{ color: "#c8d8e8" }}>Account information:</strong> When you register, we collect your email address and password (hashed). We never store plaintext passwords.</p>
        <p style={S.p}><strong style={{ color: "#c8d8e8" }}>Usage data:</strong> We collect information about how you use the platform — video topics, styles selected, generation timestamps, and error logs. This helps us improve the service.</p>
        <p style={S.p}><strong style={{ color: "#c8d8e8" }}>Channel URLs:</strong> If you enter YouTube or TikTok channel URLs in your account settings, we store these to route your content. We do not access your channels without explicit OAuth authorization.</p>
        <p style={S.p}><strong style={{ color: "#c8d8e8" }}>Payment information:</strong> Payments are processed by third-party providers (Stripe). We do not store credit card numbers or full payment details.</p>
        <p style={S.p}><strong style={{ color: "#c8d8e8" }}>Cookies:</strong> We use essential cookies for authentication and session management. See our <Link to="/cookies" style={{ color: "#818cf8" }}>Cookie Policy</Link> for details.</p>

        <h2 style={S.h2}>2. How We Use Your Information</h2>
        <p style={S.p}>We use your information to provide and improve the platform, send transactional emails (video ready notifications, trial reminders), respond to support requests, detect and prevent fraud, and comply with legal obligations.</p>

        <h2 style={S.h2}>3. Information Sharing</h2>
        <p style={S.p}>We do not sell your personal information. We share data only with trusted service providers who help operate our platform (cloud hosting, email delivery, AI APIs) and only as necessary to provide the service. All third parties are required to protect your data.</p>
        <p style={S.p}>We may disclose information if required by law, court order, or to protect the rights and safety of our users.</p>

        <h2 style={S.h2}>4. Data Retention</h2>
        <p style={S.p}>We retain your account data for as long as your account is active. Generated video files are stored for 30 days after creation, then deleted. You may request deletion of your account and associated data at any time by emailing <a href="mailto:help@async-mode.com" style={{ color: "#818cf8" }}>help@async-mode.com</a>.</p>

        <h2 style={S.h2}>5. Your Rights</h2>
        <p style={S.p}>Depending on your location, you may have rights to access, correct, delete, or export your personal data. To exercise these rights, contact us at <a href="mailto:help@async-mode.com" style={{ color: "#818cf8" }}>help@async-mode.com</a>. We will respond within 30 days.</p>

        <h2 style={S.h2}>6. Security</h2>
        <p style={S.p}>We use industry-standard security measures including TLS encryption for data in transit, hashed passwords, and access-controlled infrastructure. No system is 100% secure — please use a strong, unique password.</p>

        <h2 style={S.h2}>7. Children</h2>
        <p style={S.p}>async-mode.com is not directed to children under 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, contact us immediately.</p>

        <h2 style={S.h2}>8. Changes to This Policy</h2>
        <p style={S.p}>We may update this policy from time to time. We'll notify you by email or a notice on the platform before changes take effect. Continued use after changes constitutes acceptance.</p>

        <h2 style={S.h2}>9. Contact</h2>
        <p style={S.p}>Questions about this policy? Email us at <a href="mailto:help@async-mode.com" style={{ color: "#818cf8" }}>help@async-mode.com</a>.</p>
      </div>
      <footer style={S.footer}>
        <Link to="/terms" style={{ color: "#4a6a8a", marginRight: 16 }}>Terms of Service</Link>
        <Link to="/refund" style={{ color: "#4a6a8a", marginRight: 16 }}>Refund Policy</Link>
        <Link to="/cookies" style={{ color: "#4a6a8a", marginRight: 16 }}>Cookie Policy</Link>
        <Link to="/" style={{ color: "#4a6a8a" }}>← Home</Link>
      </footer>
    </div>
  );
}
