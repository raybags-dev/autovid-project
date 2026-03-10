export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#08080f",
      color: "#e0e0e0",
      fontFamily: "'Inter', sans-serif",
      padding: "60px 24px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#00a0dc", marginBottom: 12 }}>
            4LIFE MYSTERY
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, color: "#fff" }}>
            Privacy Policy
          </h1>
          <p style={{ color: "#666", marginTop: 10, fontSize: 13 }}>
            Last updated: March 2026
          </p>
        </div>

        {[
          {
            title: "1. Introduction",
            body: `4Life Mystery ("we", "us", or "our") operates an automated video creation and publishing platform. This Privacy Policy explains how we collect, use, and protect information when you interact with our services, including content published on YouTube and TikTok.`,
          },
          {
            title: "2. Information We Collect",
            body: `We may collect the following types of information:
• Channel analytics and performance data from connected platforms (YouTube, TikTok)
• Publicly available comment data on published videos
• Usage data from our internal dashboard
• No personally identifiable information is collected from viewers of our content.`,
          },
          {
            title: "3. How We Use Information",
            body: `Information collected is used solely to:
• Generate and publish automated video content
• Moderate and respond to comments using AI
• Analyse content performance and improve output quality
• We do not sell, rent, or share any data with third parties for marketing purposes.`,
          },
          {
            title: "4. Third-Party Platforms",
            body: `Our service integrates with third-party platforms including YouTube (Google LLC) and TikTok. When publishing content to these platforms, their respective privacy policies and terms of service govern the handling of data on those platforms. We encourage you to review:
• YouTube Privacy Policy: https://policies.google.com/privacy
• TikTok Privacy Policy: https://www.tiktok.com/legal/page/row/privacy-policy/en`,
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
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
              {title}
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "#aaa", whiteSpace: "pre-line", margin: 0 }}>
              {body}
            </p>
          </div>
        ))}

        <div style={{
          marginTop: 60,
          paddingTop: 24,
          borderTop: "1px solid #1a1a2e",
          fontSize: 12,
          color: "#444",
        }}>
          © 2026 4Life Mystery. All rights reserved.
        </div>
      </div>
    </div>
  );
}
