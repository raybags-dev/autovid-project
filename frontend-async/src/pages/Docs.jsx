import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SECTIONS = [
  {
    id: "quickstart", label: "Quick start",
    content: [
      { type: "h2", text: "Getting started with async-mode" },
      { type: "p", text: "Welcome! This guide will walk you through creating your first video and understanding all the features available to you." },
      { type: "h3", text: "Step 1 — Request access" },
      { type: "p", text: "After registration, your account is manually reviewed (usually within 24 hours). You'll receive an email when approved. During this time you have a 24-hour trial with 2 video credits." },
      { type: "h3", text: "Step 2 — Set up your channels" },
      { type: "p", text: "Go to Account → Publishing Channels and enter your YouTube and/or TikTok channel URLs. This tells AutoVid where your content lives. Click 'Verify ↗' to confirm the links open your actual channels." },
      { type: "h3", text: "Step 3 — Create your first video" },
      { type: "p", text: "Go to the Create tab. Enter a topic or idea — be specific for best results. Example: 'The psychology of procrastination and how successful people beat it'. Select a style, then click Generate." },
      { type: "h3", text: "Step 4 — Review & publish" },
      { type: "p", text: "Videos are generated in 8–15 minutes. When ready, you'll get an email. Your video is uploaded to YouTube as a private draft — log in to YouTube Studio to review it and make it public when ready." },
    ],
  },
  {
    id: "video-topics", label: "Writing good topics",
    content: [
      { type: "h2", text: "Writing topics that produce great videos" },
      { type: "p", text: "The quality of your topic directly impacts the quality of your video. Here's how to write effective prompts." },
      { type: "h3", text: "Be specific" },
      { type: "p", text: "❌ Bad: 'Healthy eating'\n✅ Good: 'The 5 biggest diet myths debunked by nutritional science'" },
      { type: "h3", text: "Include a hook or angle" },
      { type: "p", text: "Give the AI a perspective to write from. 'Why most productivity advice fails introverts' is more compelling than 'productivity tips'." },
      { type: "h3", text: "Match to your style" },
      { type: "p", text: "Educational → factual, structured, Kurzgesagt-style. Documentary → serious, measured. Inspirational → emotional, motivational. Entertaining → witty, fast-paced." },
      { type: "h3", text: "Avoid vague commands" },
      { type: "p", text: "Topics like 'make a good video' or 'something interesting' won't produce good results. The AI needs a subject to research and write about." },
    ],
  },
  {
    id: "video-styles", label: "Video styles",
    content: [
      { type: "h2", text: "Video styles explained" },
      { type: "p", text: "AutoVid supports 5 video styles that control the tone, pacing, and structure of your script." },
      { type: "h3", text: "Educational" },
      { type: "p", text: "Clear, curious, fact-driven. Great for explainer content, science topics, history, and 'how things work' videos. Think Kurzgesagt or Veritasium." },
      { type: "h3", text: "Inspirational" },
      { type: "p", text: "Warm, motivational, story-driven. Best for personal development, success stories, and audience-empowerment content." },
      { type: "h3", text: "Documentary" },
      { type: "p", text: "Serious, measured, authoritative. Ideal for investigation, current events, deep-dives, and premium-feeling content." },
      { type: "h3", text: "Entertaining" },
      { type: "p", text: "Witty, sharp, fast-paced. Perfect for comedy-adjacent content, list videos, and pop-culture topics." },
      { type: "h3", text: "Reflective" },
      { type: "p", text: "Philosophical, slow, contemplative. Great for journaling-style content, life advice, and thought-provoking observations." },
    ],
  },
  {
    id: "private-videos", label: "Private video uploads",
    content: [
      { type: "h2", text: "Why videos are uploaded privately" },
      { type: "p", text: "Every video AutoVid generates is automatically uploaded to your YouTube channel as a private draft." },
      { type: "h3", text: "The reason" },
      { type: "p", text: "AI-generated content is improving rapidly, but it still benefits from a human review. Uploading privately first means no AI content ever goes live on your channel without your approval — protecting your brand." },
      { type: "h3", text: "What to check before publishing" },
      { type: "p", text: "• Is the information accurate? AI can hallucinate facts — especially in niche topics.\n• Does the title represent your brand?\n• Are the captions readable and well-timed?\n• Does the thumbnail look good on your channel?" },
      { type: "h3", text: "Making it public" },
      { type: "p", text: "Log in to YouTube Studio, find the private video, review it, then change visibility from Private to Public (or Scheduled). You can also edit the title, description, and tags before publishing." },
    ],
  },
  {
    id: "trial", label: "Trial & plans",
    content: [
      { type: "h2", text: "Trial accounts & plans" },
      { type: "h3", text: "Free trial" },
      { type: "p", text: "After approval, you get a 24-hour trial with 2 video credits. This is enough to generate 2 full videos and evaluate the platform. Trial videos have all features enabled — no watermarks, no quality limits." },
      { type: "h3", text: "What happens when the trial expires" },
      { type: "p", text: "You can still log in and download your trial videos. You won't be able to create new videos until you upgrade. Your account data is retained." },
      { type: "h3", text: "Upgrading" },
      { type: "p", text: "Email help@async-mode.com with subject 'Upgrade Request' to discuss plan options. We'll confirm your plan, process payment, and upgrade your account — usually within 24 hours." },
      { type: "h3", text: "Plans" },
      { type: "p", text: "Starter ($29/mo): 10 videos/month, YouTube auto-publish, basic analytics.\nCreator ($79/mo): Unlimited videos, all features, priority queue.\nStudio (Custom): Multi-channel, dedicated worker, white-label, API access." },
    ],
  },
  {
    id: "troubleshooting", label: "Troubleshooting",
    content: [
      { type: "h2", text: "Common issues & solutions" },
      { type: "h3", text: "Video stuck in 'Processing'" },
      { type: "p", text: "Videos occasionally get stuck if a pipeline step fails silently. If your video has been processing for more than 30 minutes, go to My Videos and click '↺ Retry' on the failed card. If the issue persists, email help@async-mode.com." },
      { type: "h3", text: "Video shows 'Failed'" },
      { type: "p", text: "Click the retry button on the video card. Common causes: the AI API was temporarily unavailable, or the topic triggered a content filter. Try rephrasing the topic if retry fails repeatedly." },
      { type: "h3", text: "I can't log in" },
      { type: "p", text: "Ensure your account has been approved (check your email). If approved, try resetting your password. If the issue persists, email help@async-mode.com." },
      { type: "h3", text: "My YouTube video isn't appearing" },
      { type: "p", text: "Videos are uploaded as private — check YouTube Studio under All videos, filtering by 'Private'. YouTube processing can take 10–60 minutes for HD content before the video is watchable." },
      { type: "h3", text: "Email notifications not arriving" },
      { type: "p", text: "Check your spam folder. Add help@async-mode.com to your contacts. Some email providers delay transactional emails — wait up to 30 minutes." },
    ],
  },
];

function renderContent(item, i) {
  if (item.type === "h2") return <h2 key={i} style={{ fontSize: 22, fontWeight: 800, color: "#e0eaf5", margin: "0 0 16px", letterSpacing: "-0.02em" }}>{item.text}</h2>;
  if (item.type === "h3") return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: "#c8d8e8", margin: "28px 0 10px" }}>{item.text}</h3>;
  if (item.type === "p") return (
    <p key={i} style={{ fontSize: 14, color: "#8a9ab8", lineHeight: 1.9, margin: "0 0 14px", whiteSpace: "pre-line" }}>{item.text}</p>
  );
  return null;
}

export default function Docs() {
  const { user } = useAuth();
  const [active, setActive] = useState("quickstart");
  const section = SECTIONS.find((s) => s.id === active);

  return (
    <div style={{ background: "#08080f", minHeight: "100vh", color: "#e0eaf5", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <nav style={{ borderBottom: "1px solid #0d1b2a", padding: "0 24px", display: "flex", alignItems: "center", height: 56, background: "#050a14", position: "sticky", top: 0, zIndex: 10 }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: 18, color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
        </Link>
        <span style={{ marginLeft: 12, fontSize: 12, color: "#4a6a8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Docs</span>
        <div style={{ flex: 1 }} />
        {user
          ? <Link to="/dashboard" style={{ fontSize: 13, color: "#818cf8", fontWeight: 600 }}>→ Dashboard</Link>
          : <Link to="/login" style={{ fontSize: 13, color: "#4a6a8a" }}>Log in</Link>
        }
      </nav>

      <div style={{ maxWidth: 1060, margin: "0 auto", display: "flex", minHeight: "calc(100vh - 56px)" }}>
        {/* Sidebar */}
        <div style={{
          width: 220, flexShrink: 0, padding: "32px 0",
          borderRight: "1px solid #0d1b2a",
          position: "sticky", top: 56, alignSelf: "flex-start", height: "calc(100vh - 56px)", overflowY: "auto",
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 20px 12px" }}>
            Documentation
          </div>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "9px 20px", fontSize: 13, cursor: "pointer",
              background: active === s.id ? "#0d1b2a" : "transparent",
              color: active === s.id ? "#e0eaf5" : "#6a8ab0",
              border: "none", borderLeft: active === s.id ? "2px solid #4f46e5" : "2px solid transparent",
              fontFamily: "inherit", fontWeight: active === s.id ? 600 : 400,
              transition: "all 0.15s",
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "40px 48px 80px" }}>
          {section && section.content.map((item, i) => renderContent(item, i))}
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #0d1b2a", display: "flex", gap: 12 }}>
            <a href="mailto:help@async-mode.com" style={{
              background: "#4f46e5", color: "#fff", padding: "10px 24px",
              borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              Email support →
            </a>
            {user && (
              <Link to="/dashboard" style={{
                background: "transparent", border: "1px solid #1a2a3a", color: "#8a9ab8",
                padding: "10px 24px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              }}>
                Back to dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
