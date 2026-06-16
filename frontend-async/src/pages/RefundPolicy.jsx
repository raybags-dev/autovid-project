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
  callout: { background: "#0d1a2a", border: "1px solid #1a3a5a", borderRadius: 10, padding: "20px 24px", marginBottom: 24 },
  footer: { borderTop: "1px solid #0d1b2a", padding: "20px 24px", textAlign: "center", fontSize: 12, color: "#4a6a8a" },
};

export default function RefundPolicy() {
  return (
    <div style={S.wrap}>
      <nav style={S.nav}>
        <Link to="/" style={S.brand}>async<span style={{ color: "#4f46e5" }}>-mode</span></Link>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ fontSize: 13, color: "#4a6a8a" }}>← Back to home</Link>
      </nav>
      <div style={S.inner}>
        <h1 style={S.h1}>Refund Policy</h1>
        <p style={S.meta}>Last updated: June 2026 · async-mode.com</p>

        <div style={S.callout}>
          <p style={{ ...S.p, margin: 0, color: "#a8c8e8" }}>
            <strong>Summary:</strong> Full refund within 7 days of first charge. After 7 days, refunds are case-by-case. Failed video generations do not count against your limits.
          </p>
        </div>

        <p style={S.p}>We want you to be happy with async-mode.com. This policy outlines when and how refunds are issued.</p>

        <h2 style={S.h2}>1. 7-Day Money-Back Guarantee</h2>
        <p style={S.p}>If you are not satisfied with your paid subscription, you may request a full refund within <strong style={{ color: "#c8d8e8" }}>7 calendar days</strong> of your first subscription charge. To request a refund, email <a href="mailto:help@async-mode.com" style={{ color: "#818cf8" }}>help@async-mode.com</a> with your account email and the reason. Refunds are processed within 5–10 business days to your original payment method.</p>

        <h2 style={S.h2}>2. After 7 Days</h2>
        <p style={S.p}>Refund requests after 7 days are evaluated on a case-by-case basis. We may offer a partial refund or account credit at our discretion. Factors considered include: extent of service usage, technical issues caused by our platform, and billing errors.</p>

        <h2 style={S.h2}>3. Failed Video Generations</h2>
        <p style={S.p}>If a video fails to generate due to a platform error (not user-side issues like invalid topics), no credit will be deducted from your limit. You can retry the video from your dashboard with one click at no additional cost.</p>

        <h2 style={S.h2}>4. Trial Accounts</h2>
        <p style={S.p}>Trial accounts are free — no charge, no refund needed. Trial credits expire after 24 hours and are non-transferable. There is no refund for unused trial credits as they carry no monetary value.</p>

        <h2 style={S.h2}>5. Renewals</h2>
        <p style={S.p}>Monthly subscriptions renew automatically. You will receive an email reminder before each renewal. If you cancel before the renewal date, you won't be charged for the next period. Cancellations take effect at the end of the current billing cycle — you retain access until then.</p>

        <h2 style={S.h2}>6. Exceptions</h2>
        <p style={S.p}>Refunds will not be issued for: accounts terminated for violating our Terms of Service, partial months following downgrade, or subscription fees already refunded in a previous billing period.</p>

        <h2 style={S.h2}>7. How to Request a Refund</h2>
        <p style={S.p}>Email <a href="mailto:help@async-mode.com?subject=Refund%20Request" style={{ color: "#818cf8" }}>help@async-mode.com</a> with subject "Refund Request" and include your account email and a brief description of the issue. We'll respond within 2 business days.</p>
      </div>
      <footer style={S.footer}>
        <Link to="/privacy" style={{ color: "#4a6a8a", marginRight: 16 }}>Privacy Policy</Link>
        <Link to="/terms" style={{ color: "#4a6a8a", marginRight: 16 }}>Terms of Service</Link>
        <Link to="/cookies" style={{ color: "#4a6a8a", marginRight: 16 }}>Cookie Policy</Link>
        <Link to="/" style={{ color: "#4a6a8a" }}>← Home</Link>
      </footer>
    </div>
  );
}
