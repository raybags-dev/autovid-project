/**
 * AutoVid Documentation — Protected, login-required docs page.
 * Covers every feature, API endpoint, and the product subscription model.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const T = {
  bg:        "#080810",
  bgCard:    "#0d0d1a",
  bgSub:     "#0a0a14",
  bgDeep:    "#06060e",
  border:    "rgba(255,255,255,0.07)",
  borderHi:  "rgba(0,180,255,0.25)",
  text:      "#e8eaf0",
  textMid:   "#b0b8cc",
  textDim:   "#7080a0",
  textFaint: "#404860",
  accent:    "#0090d0",
  accentGreen: "#00c070",
  accentRed:   "#e03050",
  accentYellow:"#e09000",
  accentPurple:"#a855f7",
  code:      "#0d0d1a",
  codeBorder:"rgba(0,180,255,0.18)",
};

// ── Navigation tree ────────────────────────────────────────────────────────────
const NAV = [
  {
    section: "Introduction",
    items: [
      { id: "overview",      label: "What is AutoVid?" },
      { id: "architecture",  label: "Architecture" },
      { id: "quickstart",    label: "Quick Start" },
    ],
  },
  {
    section: "Core Pipelines",
    items: [
      { id: "video-studio",   label: "Video Studio" },
      { id: "shorts-studio",  label: "Shorts Studio" },
      { id: "script-studio",  label: "Script Studio" },
      { id: "podcast",        label: "Podcast Pipeline" },
      { id: "compilations",   label: "Compilations" },
    ],
  },
  {
    section: "Automation",
    items: [
      { id: "auto-video",   label: "Auto-Generate Videos" },
      { id: "auto-shorts",  label: "Auto-Generate Shorts" },
      { id: "auto-podcast", label: "Auto-Podcast" },
      { id: "auto-reply",   label: "Auto-Reply & Comments" },
    ],
  },
  {
    section: "Integrations",
    items: [
      { id: "youtube",  label: "YouTube" },
      { id: "tiktok",   label: "TikTok" },
      { id: "spotify",  label: "Spotify" },
    ],
  },
  {
    section: "API Reference",
    items: [
      { id: "api-auth",       label: "Authentication" },
      { id: "api-videos",     label: "Videos" },
      { id: "api-shorts",     label: "Shorts" },
      { id: "api-podcast",    label: "Podcast" },
      { id: "api-automation", label: "Automation" },
      { id: "api-stats",      label: "Stats & Quota" },
    ],
  },
  {
    section: "Product & Plans",
    items: [
      { id: "plans",     label: "Subscription Plans" },
      { id: "api-keys",  label: "API Keys & Access" },
      { id: "roadmap",   label: "Roadmap" },
    ],
  },
];

// ── Small helpers ──────────────────────────────────────────────────────────────
function Code({ children, lang = "json" }) {
  return (
    <pre style={{
      background: T.code, border: `1px solid ${T.codeBorder}`,
      borderRadius: 8, padding: "14px 18px", overflowX: "auto",
      fontSize: 12, lineHeight: 1.7, color: "#90d8ff",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      margin: "10px 0",
    }}>
      <code>{children}</code>
    </pre>
  );
}

function Note({ type = "info", children }) {
  const colors = {
    info:    { bg: "rgba(0,144,208,0.08)", border: "rgba(0,144,208,0.25)", icon: "ℹ", color: T.accent },
    warning: { bg: "rgba(224,144,0,0.08)", border: "rgba(224,144,0,0.25)", icon: "⚠", color: T.accentYellow },
    success: { bg: "rgba(0,192,112,0.08)", border: "rgba(0,192,112,0.25)", icon: "✓", color: T.accentGreen },
    danger:  { bg: "rgba(224,48,80,0.08)", border: "rgba(224,48,80,0.25)", icon: "!", color: T.accentRed },
  };
  const c = colors[type] || colors.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px", margin: "12px 0", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ color: c.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
      <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function H1({ id, children }) {
  return (
    <h1 id={id} style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: T.text, marginBottom: 6, marginTop: 0, letterSpacing: "-0.02em", scrollMarginTop: 80 }}>
      {children}
    </h1>
  );
}
function H2({ id, children }) {
  return (
    <h2 id={id} style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: T.text, margin: "28px 0 10px", letterSpacing: "-0.01em", scrollMarginTop: 80, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
      {children}
    </h2>
  );
}
function H3({ children }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textMid, margin: "20px 0 8px", letterSpacing: "0.02em" }}>{children}</h3>;
}
function P({ children }) {
  return <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.8, margin: "8px 0" }}>{children}</p>;
}
function Li({ children }) {
  return <li style={{ fontSize: 14, color: T.textMid, lineHeight: 1.8, marginBottom: 4 }}>{children}</li>;
}

function Badge({ color = T.accent, children }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}40`, borderRadius: 5, fontSize: 10, padding: "2px 8px", fontWeight: 700, letterSpacing: "0.06em", verticalAlign: "middle" }}>
      {children}
    </span>
  );
}

function Method({ method }) {
  const colors = { GET: "#22c55e", POST: "#0090d0", DELETE: "#e03050", PATCH: "#e09000", PUT: "#a855f7" };
  return (
    <span style={{ background: (colors[method] || T.accent) + "18", color: colors[method] || T.accent, border: `1px solid ${(colors[method] || T.accent)}40`, borderRadius: 5, fontSize: 11, padding: "2px 8px", fontWeight: 700, fontFamily: "monospace", marginRight: 8 }}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, desc, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: T.bgCard }}>
        <Method method={method} />
        <code style={{ fontSize: 13, color: T.text, fontFamily: "monospace", flex: 1 }}>{path}</code>
        <span style={{ fontSize: 12, color: T.textDim, marginRight: 8 }}>{desc}</span>
        <span style={{ color: T.textFaint, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "14px 18px", background: T.bgDeep, borderTop: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PlanCard({ name, price, badge, color, features, cta }) {
  return (
    <div style={{ background: T.bgCard, border: `2px solid ${color}40`, borderRadius: 14, padding: 24, flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif", color }}>{name}</div>
        {badge && <Badge color={color}>{badge}</Badge>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: T.text, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>{price}</div>
      {typeof price === "string" && price !== "Free" && <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16 }}>per month</div>}
      <div style={{ marginBottom: 16, marginTop: price === "Free" ? 20 : 0 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
            <span style={{ color: f.no ? T.accentRed : T.accentGreen, flexShrink: 0, marginTop: 1 }}>{f.no ? "✕" : "✓"}</span>
            <span style={{ fontSize: 13, color: f.no ? T.textFaint : T.textMid }}>{f.text}</span>
          </div>
        ))}
      </div>
      <button style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${color}60`, background: `${color}12`, color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
        {cta}
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Docs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef(null);

  // Scroll spy
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => {
      const headings = el.querySelectorAll("[id]");
      let current = "overview";
      headings.forEach(h => {
        if (h.getBoundingClientRect().top < 140) current = h.id;
      });
      setActiveSection(current);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      contentRef.current?.scrollTo({ top: el.offsetTop - 72, behavior: "smooth" });
    }
    setActiveSection(id);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter','system-ui',sans-serif", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: sidebarOpen ? 260 : 0,
        flexShrink: 0,
        background: T.bgSub,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.2s",
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
              <span style={{ background: "linear-gradient(135deg,#00b4ff,#00e080)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AUTO</span>
              <span style={{ color: T.text }}>VID</span>
            </div>
            <Badge color={T.accent}>DOCS</Badge>
          </div>
          <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.14em" }}>DEVELOPER DOCUMENTATION</div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          {NAV.map(group => (
            <div key={group.section} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.14em", padding: "0 8px", marginBottom: 4 }}>{group.section.toUpperCase()}</div>
              {group.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontSize: 13,
                    color: activeSection === item.id ? T.accent : T.textDim,
                    background: activeSection === item.id ? `${T.accent}12` : "transparent",
                    fontWeight: activeSection === item.id ? 600 : 400,
                    transition: "all 0.12s",
                    borderLeft: `2px solid ${activeSection === item.id ? T.accent : "transparent"}`,
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navigate("/dashboard")} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${T.accent}40`, background: `${T.accent}08`, color: T.accent, fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div ref={contentRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,16,0.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${T.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }}>☰</button>
          <div style={{ fontSize: 12, color: T.textFaint }}>
            <span style={{ color: T.textDim }}>AutoVid</span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: T.accent }}>{NAV.flatMap(g => g.items).find(i => i.id === activeSection)?.label || "Docs"}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Badge color={T.accentGreen}>v1.0</Badge>
            <Badge color={T.accent}>REST API</Badge>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 80px", width: "100%" }}>

          {/* ── OVERVIEW ──────────────────────────────────────────────────────────── */}
          <H1 id="overview">What is AutoVid?</H1>
          <P>AutoVid is an AI-powered video automation engine that takes a text prompt and produces a fully narrated, captioned, music-backed YouTube video — end to end, no human editing required. It handles script generation, text-to-speech narration, visual sourcing, caption burning, YouTube upload, and post-publish analytics — all from a single API call.</P>
          <P>Whether you're running a faceless YouTube channel, a podcast network, a Shorts feed, or building a content-as-a-service product on top of AutoVid's API — the system handles the entire pipeline autonomously.</P>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "20px 0" }}>
            {[
              { icon: "🎬", title: "Full Video Pipeline", desc: "Prompt → Script → Voice → Visuals → Captions → YouTube in ~3 minutes" },
              { icon: "⚡", title: "Shorts Pipeline", desc: "90-second portrait videos with custom or AI-generated scripts" },
              { icon: "🤖", title: "Full Automation", desc: "Scheduled daily generation for videos, shorts, and podcast episodes" },
            ].map(c => (
              <div key={c.icon} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>

          {/* ── ARCHITECTURE ─────────────────────────────────────────────────────── */}
          <H2 id="architecture">Architecture</H2>
          <P>AutoVid is built as a containerised microservice stack deployed on Hetzner Cloud:</P>
          <Code>{`Docker Compose services
┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  nginx-lb       │   │  backend-1 &    │   │  celery-worker   │
│  (load balancer)│──▶│  backend-2      │──▶│  (heavy tasks)   │
│  :8000          │   │  FastAPI :8000  │   │  + Redis queue   │
└─────────────────┘   └────────┬────────┘   └──────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Supabase (PostgreSQL) │
                    │  + Storage bucket     │
                    └───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  frontend (nginx)     │
                    │  React + Vite :80     │
                    └───────────────────────┘

External APIs: Groq (LLM) · ElevenLabs (TTS) · Pexels (footage)
               YouTube Data API v3 · TikTok API · Spotify API`}</Code>
          <P>Every video pipeline runs as a FastAPI background task. Logs are streamed in real-time to the frontend via a polling endpoint. Completed video files are uploaded to Supabase Storage and served via signed URLs.</P>

          {/* ── QUICK START ───────────────────────────────────────────────────────── */}
          <H2 id="quickstart">Quick Start</H2>
          <H3>1. Authenticate</H3>
          <Code>{`POST /api/auth/login
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "your_password"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</Code>
          <P>Include the token in all subsequent requests:</P>
          <Code>{`Authorization: Bearer <token>`}</Code>

          <H3>2. Generate your first video</H3>
          <Code>{`POST /api/videos/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Why deep sleep is more important than you think",
  "profile": "educational",
  "visual_mood": "rain",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04,
  "auto_upload": false
}

// Response
{
  "video_id": "a3f2e1d0-...",
  "message": "Pipeline started"
}`}</Code>

          <H3>3. Poll for progress</H3>
          <Code>{`GET /api/videos/{video_id}/logs?since=0

// Response
{
  "lines": ["[SCRIPT] Generating script...", "[VOICE] Synthesizing audio..."],
  "done": false,
  "total": 2
}`}</Code>

          <Note type="info">Poll every 1.5s while <code>done: false</code>. Once <code>done: true</code>, the video is ready.</Note>

          {/* ── VIDEO STUDIO ──────────────────────────────────────────────────────── */}
          <H2 id="video-studio">Video Studio</H2>
          <P>The Video Studio is the primary pipeline for generating long-form YouTube videos (16:9, 1080p, ~3 minutes). A single prompt goes through 7 sequential pipeline stages:</P>

          <div style={{ margin: "16px 0" }}>
            {[
              { step: 1, name: "Script",    desc: "Groq LLM generates a 420–480 word essay: title, description, 8–12 segments with visual cues, hook, and outro." },
              { step: 2, name: "Voice",     desc: "ElevenLabs TTS narrates the full script. Audio is speed-adjusted to hit the target duration." },
              { step: 3, name: "Clips",     desc: "Pexels stock footage is fetched based on each segment's visual_query. Clips are downloaded and trimmed." },
              { step: 4, name: "Assembly",  desc: "FFmpeg assembles all clips into a continuous 16:9 video matching the audio duration." },
              { step: 5, name: "Captions",  desc: "WhisperX transcribes the narration and burns word-level captions with animated highlighting." },
              { step: 6, name: "Labels",    desc: "Groq auto-generates SEO labels, tags, and category for YouTube metadata." },
              { step: 7, name: "Upload",    desc: "Optional: video is uploaded to YouTube with title, description, tags, and privacy settings." },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: 14, marginBottom: 10, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${T.accent}18`, border: `1px solid ${T.accent}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{s.step}</div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.name} — </span>
                  <span style={{ fontSize: 13, color: T.textMid }}>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <H3>Channel Profiles</H3>
          <P>Profiles control the LLM's writing style, tone, and essay structure:</P>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}>
            {[
              { id: "educational",   emoji: "🧠", desc: "Kurzgesagt-style essay. Curious, layered, emotionally resonant." },
              { id: "serious",       emoji: "🎯", desc: "Documentary narrator. Measured, weighty, no fluff." },
              { id: "inspirational", emoji: "🔥", desc: "TED talk style. Warm, intimate, emotionally powerful." },
              { id: "reflective",    emoji: "🌊", desc: "Alan Watts style. Philosophical, unhurried, contemplative." },
              { id: "funny",         emoji: "😄", desc: "Sharp comedy with insight. Absurd hooks, comic timing." },
            ].map(p => (
              <div key={p.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                <code style={{ fontSize: 11, color: T.accent }}>{p.emoji} {p.id}</code>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          <H3>Ambience Options</H3>
          <P>Controls which Pexels footage mood is used for the background visuals:</P>
          <Code>{`"stars"   // Deep space drift
"aurora"  // Northern lights
"ocean"   // Underwater rays
"fire"    // Floating embers
"rain"    // Night city window  ← default
"galaxy"  // Spiral rotation`}</Code>

          <H3>Music Options</H3>
          <P>File-based MP3 tracks mixed at the specified volume:</P>
          <Code>{`"Birds_Atmosphere_Piano"  // Birds atmosphere + piano
"Birds_Atmosphere_Wing"   // Birds atmosphere + wing pads
"Laidback_Fevorite"       // Smooth laidback favourite  ← default
"Pads_EPiano"             // Deep smooth pads + e-piano
"Pads"                    // Chill heavy pads
"none"                    // Voice only, no music`}</Code>
          <Note type="info">Default music volume is <strong>4% (0.04)</strong>. Range: 0.0 – 0.5. Voices sit at 100%; music is ducked underneath.</Note>

          {/* ── SHORTS STUDIO ─────────────────────────────────────────────────────── */}
          <H2 id="shorts-studio">Shorts Studio</H2>
          <P>The Shorts pipeline generates portrait 9:16 videos (1080×1920) targeting a 90-second maximum — the YouTube Shorts limit. Three input modes are available:</P>

          <H3>Mode 1: AI Prompt</H3>
          <P>Provide a topic and the LLM writes a concise 180–210 word script (5–6 segments, ~90s at natural speaking pace). The pipeline applies a "creative angle" on repeat generations of the same topic to prevent duplicate content.</P>
          <Code>{`POST /api/shorts/generate
{
  "prompt": "The quiet grief nobody talks about",
  "ambience": "rain",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>

          <H3>Mode 2: Custom Script</H3>
          <P>Bypass AI script generation entirely. Provide your own narration text — the pipeline uses it verbatim with the TTS voice. Target ~180–210 words for a 90-second short.</P>
          <Code>{`POST /api/shorts/generate
{
  "prompt": "My custom short title",
  "custom_script": "We don't talk about the grief that has no name...",
  "ambience": "rain",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>
          <Note type="info">When <code>custom_script</code> is provided, <code>prompt</code> is used only as the title label. The script is narrated exactly as written.</Note>

          <H3>Mode 3: Clip from Existing Video</H3>
          <P>Automatically clips the best 59 seconds from an existing library video, crops it to 9:16 portrait, and saves it as a Short. The source video is marked <code>used_for_short</code> and excluded from future clip operations to prevent duplicates.</P>
          <Code>{`POST /api/videos/{video_id}/create-short`}</Code>

          <H3>Global Shorts Config</H3>
          <P>Settings changed in any shorts pipeline (Shorts Studio, Script Studio, Auto-Short) are persisted to <code>localStorage</code> and synced to the backend Auto-Short scheduler. Once set, they apply everywhere until explicitly changed.</P>

          {/* ── SCRIPT STUDIO ─────────────────────────────────────────────────────── */}
          <H2 id="script-studio">Script Studio</H2>
          <P>Script Studio lets you write your own full-length script and render it into a complete video. You control the exact words the narrator speaks — the pipeline handles everything else (voice, visuals, captions, music, upload).</P>
          <P><strong>Inputs:</strong> Title (max 70 chars), full script body (min 50 words, target 420–480 for a 3-minute video), channel profile (controls visual mood framing), ambience, and background music.</P>
          <Note type="warning">Script Studio posts to <code>/api/script-studio/generate</code> with the raw script text. It does NOT call the LLM — the text you write is narrated exactly as provided.</Note>

          <H3>Writing Great Scripts</H3>
          <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
            <Li>Target 420–480 words for a 3-minute video (150 wpm natural pace)</Li>
            <Li>Use commas, periods, and ellipsis (<code>...</code>) for breathing room</Li>
            <Li>Never use <code>[PAUSE]</code>, asterisks, or markdown — speak directly</Li>
            <Li>End with <code>. . .</code> (three spaced dots) to prevent voice fade at end</Li>
            <Li>Start with a question or striking image — the first 3 seconds determine retention</Li>
          </ul>

          {/* ── PODCAST ───────────────────────────────────────────────────────────── */}
          <H2 id="podcast">Podcast Pipeline</H2>
          <P>The Podcast pipeline generates an audio-first episode: a narrated MP3 with optional visuals and YouTube upload. It is suitable for philosophy, essay, and long-form spoken content.</P>
          <Code>{`POST /api/podcast-episode/generate
{
  "topic": "Why boredom is necessary for creativity",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}

// OR provide a pre-written essay:
{
  "title": "The Necessity of Boredom",
  "essay": "Full essay text here...",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>
          <P>The episode generates a narration MP3 accessible from the Videos tab and playable inline in the dashboard. Optional YouTube upload posts it as an unlisted or public video.</P>

          {/* ── COMPILATIONS ──────────────────────────────────────────────────────── */}
          <H2 id="compilations">Compilations</H2>
          <P>Compilations stitch multiple existing videos together into a single long-form video with a title card. Useful for "Best of" or topic-grouped playlists.</P>
          <Code>{`POST /api/compilations/create
{
  "title": "The Best Philosophy Videos of 2025",
  "video_ids": ["uuid1", "uuid2", "uuid3"],
  "add_title_card": true
}`}</Code>

          {/* ── AUTO-VIDEO ────────────────────────────────────────────────────────── */}
          <H2 id="auto-video">Auto-Generate Videos</H2>
          <P>The auto-generator runs on a cron schedule, picks a topic from a configured list, and runs the full video pipeline autonomously — no human input required.</P>
          <H3>Configuration</H3>
          <Code>{`POST /api/auto-generate/settings
{
  "enabled": true,
  "days": [0, 2, 4],          // 0=Mon, 1=Tue, ..., 6=Sun
  "hour": 8,                   // UTC hour to run
  "topics": [
    "The science of dreams",
    "Why silence is powerful",
    "The hidden cost of perfectionism"
  ],
  "profile": "educational",
  "visual_mood": "rain",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>
          <Note type="info">Topics are rotated through in order. A random "creative angle" is applied to each generation to prevent near-duplicate content even if the same topic repeats.</Note>

          {/* ── AUTO-SHORTS ───────────────────────────────────────────────────────── */}
          <H2 id="auto-shorts">Auto-Generate Shorts</H2>
          <P>Mirrors the auto-video scheduler but produces portrait 9:16 Shorts. Configuration also controls the global shorts ambience/music defaults used everywhere in the app.</P>
          <Code>{`POST /api/auto-short/settings
{
  "enabled": true,
  "days": [1, 3, 5],
  "hour": 10,
  "topics": ["Overthinking", "Present moment", "Solitude"],
  "ambience": "rain",
  "music_style": "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>

          {/* ── AUTO-PODCAST ──────────────────────────────────────────────────────── */}
          <H2 id="auto-podcast">Auto-Podcast</H2>
          <Code>{`POST /api/podcast-episode/settings
{
  "enabled": true,
  "days": [6],           // Sunday
  "hour": 9,
  "topics": ["The examined life"],
  "music_style": "Laidback_Fevorite"
}`}</Code>

          {/* ── AUTO-REPLY ────────────────────────────────────────────────────────── */}
          <H2 id="auto-reply">Auto-Reply & Comments</H2>
          <P>AutoVid can monitor YouTube comments and auto-reply using an LLM-generated response tuned to the channel's voice. It also supports manual comment moderation (approve / hold / reject / ban) from the dashboard Reviews tab.</P>
          <Code>{`POST /api/auto-reply/toggle  { "enabled": true }
POST /api/auto-comment/trigger   // Manual run
POST /api/auto-reply/trigger     // Manual run`}</Code>
          <Note type="warning">Auto-reply consumes YouTube Data API quota. The dashboard displays remaining quota and pauses auto-reply when nearing limits.</Note>

          {/* ── YOUTUBE ───────────────────────────────────────────────────────────── */}
          <H2 id="youtube">YouTube Integration</H2>
          <P>AutoVid connects to YouTube via OAuth 2.0. Once connected, it can:</P>
          <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
            <Li>Upload videos with full metadata (title, description, tags, category, privacy)</Li>
            <Li>Sync published videos and fetch live view/like counts</Li>
            <Li>Fetch and moderate comments (approve, reject, reply, ban)</Li>
            <Li>Delete videos from YouTube</Li>
            <Li>Track YouTube API quota (6 uploads/day on standard quota)</Li>
          </ul>
          <Code>{`// Upload with metadata
POST /api/videos/{id}/upload
{
  "title": "Why Deep Sleep Changes Everything",
  "description": "Full description here...",
  "tags": ["sleep", "health", "science"],
  "privacy": "public",           // public | unlisted | private
  "category": "Education"
}

// Update YouTube metadata after upload
PATCH /api/videos/{id}/youtube-settings
{ "privacy": "public", "title": "Updated Title" }`}</Code>

          {/* ── TIKTOK ────────────────────────────────────────────────────────────── */}
          <H2 id="tiktok">TikTok Integration</H2>
          <P>Upload Shorts directly to TikTok via OAuth. After connecting in Settings → TikTok, any Short can be published with a single click or API call.</P>
          <Code>{`POST /api/videos/{id}/upload-tiktok
{ "privacy": "PUBLIC_TO_EVERYONE" }   // or "SELF_ONLY" for draft`}</Code>

          {/* ── SPOTIFY ───────────────────────────────────────────────────────────── */}
          <H2 id="spotify">Spotify Integration</H2>
          <P>Connect your Spotify account to display your top tracks and artists on the landing page's Spotify showcase card. Read-only — AutoVid does not post to Spotify.</P>
          <Code>{`GET /api/spotify/top-tracks?limit=10&time_range=long_term
GET /api/spotify/top-artists?limit=10&time_range=long_term`}</Code>

          {/* ── API AUTH ──────────────────────────────────────────────────────────── */}
          <H2 id="api-auth">API Reference — Authentication</H2>
          <Note type="info">All API endpoints (except <code>/auth/login</code>) require a valid JWT in the <code>Authorization: Bearer</code> header. Tokens expire after 30 days.</Note>

          <Endpoint method="POST" path="/api/auth/login" desc="Get access token">
            <H3>Request</H3>
            <Code>{`{ "email": "string", "password": "string" }`}</Code>
            <H3>Response</H3>
            <Code>{`{ "token": "eyJ...", "email": "user@example.com" }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/auth/me" desc="Current user">
            <H3>Response</H3>
            <Code>{`{ "email": "user@example.com", "role": "superuser" }`}</Code>
          </Endpoint>

          {/* ── API VIDEOS ────────────────────────────────────────────────────────── */}
          <H2 id="api-videos">API Reference — Videos</H2>

          <Endpoint method="POST" path="/api/videos/generate" desc="Start video pipeline">
            <H3>Request</H3>
            <Code>{`{
  "prompt":       "string (required)",
  "profile":      "educational | serious | inspirational | reflective | funny",
  "visual_mood":  "stars | aurora | ocean | fire | rain | galaxy",
  "music_style":  "Birds_Atmosphere_Piano | Birds_Atmosphere_Wing | Laidback_Fevorite | Pads_EPiano | Pads | none",
  "music_volume": 0.04,           // float 0.0–0.5
  "auto_upload":  false           // boolean
}`}</Code>
            <H3>Response</H3>
            <Code>{`{ "video_id": "uuid", "message": "Pipeline started" }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/videos" desc="List all videos">
            <H3>Query params</H3>
            <Code>{`?status=ready     // filter by status: generating | scripted | voiced | assembled | captioned | labeled | ready | posted | failed`}</Code>
            <H3>Response</H3>
            <Code>{`[{ "id": "uuid", "title": "...", "status": "ready", "file_path": "https://...", ... }]`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/videos/{id}" desc="Get single video">
            <Code>{`{ "id": "uuid", "title": "...", "status": "ready", "youtube_id": "...", "labels": [...], ... }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/videos/{id}/logs" desc="Stream pipeline logs">
            <H3>Query params</H3>
            <Code>{`?since=0    // line offset — pass the count of lines already received`}</Code>
            <H3>Response</H3>
            <Code>{`{ "lines": ["[SCRIPT] ...", "[VOICE] ..."], "done": false, "total": 5 }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/videos/{id}/upload" desc="Upload to YouTube">
            <Code>{`{ "title": "...", "description": "...", "tags": ["tag1"], "privacy": "public", "category": "Education" }`}</Code>
          </Endpoint>

          <Endpoint method="DELETE" path="/api/videos/{id}" desc="Delete video record + file">
            <Code>{`{ "message": "deleted" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/videos/{id}/retry" desc="Retry failed pipeline">
            <Code>{`{ "message": "Retry started" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/videos/sync-youtube" desc="Sync views/likes from YouTube">
            <Code>{`{ "synced": 12, "message": "YouTube sync complete" }`}</Code>
          </Endpoint>

          {/* ── API SHORTS ────────────────────────────────────────────────────────── */}
          <H2 id="api-shorts">API Reference — Shorts</H2>

          <Endpoint method="POST" path="/api/shorts/generate" desc="Generate new Short from scratch">
            <Code>{`{
  "prompt":        "string (required if no custom_script)",
  "custom_script": "string (optional — bypasses LLM generation)",
  "ambience":      "rain",
  "music_style":   "Laidback_Fevorite",
  "music_volume":  0.04
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/videos/{id}/create-short" desc="Clip Short from existing video">
            <P>Clips the best 59s from <code>video_id</code>, crops to 9:16. Marks the source with <code>used_for_short</code> label to prevent re-use.</P>
          </Endpoint>

          <Endpoint method="GET" path="/api/shorts" desc="List Shorts">
            <Code>{`?limit=25&offset=0`}</Code>
          </Endpoint>

          {/* ── API PODCAST ───────────────────────────────────────────────────────── */}
          <H2 id="api-podcast">API Reference — Podcast</H2>

          <Endpoint method="POST" path="/api/podcast-episode/generate" desc="Generate episode">
            <Code>{`{
  "topic":        "string (optional — LLM generates essay)",
  "title":        "string (optional)",
  "essay":        "string (optional — use pre-written essay)",
  "music_style":  "Laidback_Fevorite",
  "music_volume": 0.04
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/podcast-episode/settings" desc="Get scheduler settings" />
          <Endpoint method="POST" path="/api/podcast-episode/settings" desc="Save scheduler settings">
            <Code>{`{ "enabled": true, "days": [6], "hour": 9, "topics": [...], "music_style": "..." }`}</Code>
          </Endpoint>
          <Endpoint method="POST" path="/api/podcast-episode/trigger" desc="Manually trigger one episode" />

          {/* ── API AUTOMATION ────────────────────────────────────────────────────── */}
          <H2 id="api-automation">API Reference — Automation</H2>

          <Endpoint method="GET" path="/api/auto-generate/settings" desc="Get auto-video settings" />
          <Endpoint method="POST" path="/api/auto-generate/settings" desc="Save auto-video settings">
            <Code>{`{ "enabled": true, "days": [0,2,4], "hour": 8, "topics": [...], "profile": "educational", "visual_mood": "rain", "music_style": "Laidback_Fevorite", "music_volume": 0.04 }`}</Code>
          </Endpoint>
          <Endpoint method="POST" path="/api/auto-generate/trigger" desc="Manually trigger one auto-video" />

          <Endpoint method="GET" path="/api/auto-short/settings" desc="Get auto-short settings" />
          <Endpoint method="POST" path="/api/auto-short/settings" desc="Save auto-short settings">
            <Code>{`{ "enabled": true, "days": [1,3,5], "hour": 10, "topics": [...], "ambience": "rain", "music_style": "Laidback_Fevorite", "music_volume": 0.04 }`}</Code>
          </Endpoint>
          <Endpoint method="POST" path="/api/auto-short/trigger" desc="Manually trigger one auto-short" />

          {/* ── API STATS ─────────────────────────────────────────────────────────── */}
          <H2 id="api-stats">API Reference — Stats & Quota</H2>

          <Endpoint method="GET" path="/api/stats" desc="Channel stats">
            <Code>{`{
  "total_videos": 42,
  "total_views": 128400,
  "total_likes": 3200,
  "posted_videos": 38,
  "ready_videos": 4
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/quota" desc="YouTube upload quota">
            <Code>{`{ "uploads_remaining": 5, "uploads_used": 1, "resets_at": "2026-03-16T07:00:00Z" }`}</Code>
          </Endpoint>

          {/* ── PLANS ─────────────────────────────────────────────────────────────── */}
          <H2 id="plans">Subscription Plans</H2>
          <P>AutoVid is being productised as a self-serve SaaS. Below is the planned tier structure. Existing accounts will be grandfathered into the tier that matches their current usage.</P>

          <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
            <PlanCard
              name="Starter" price="Free" color={T.accentGreen}
              features={[
                { text: "5 videos per month" },
                { text: "10 Shorts per month" },
                { text: "1 podcast episode/month" },
                { text: "YouTube upload (manual)" },
                { text: "Dashboard access" },
                { text: "No automation / scheduling", no: true },
                { text: "No API access", no: true },
              ]}
              cta="Get Started Free"
            />
            <PlanCard
              name="Pro" price="$29" badge="POPULAR" color={T.accent}
              features={[
                { text: "60 videos per month" },
                { text: "120 Shorts per month" },
                { text: "30 podcast episodes/month" },
                { text: "Full automation & scheduling" },
                { text: "YouTube + TikTok upload" },
                { text: "API access (REST)" },
                { text: "Priority pipeline processing" },
              ]}
              cta="Start Pro Trial"
            />
            <PlanCard
              name="Enterprise" price="Custom" color={T.accentPurple}
              features={[
                { text: "Unlimited generation" },
                { text: "Custom LLM & voice models" },
                { text: "White-label deployment" },
                { text: "Dedicated infrastructure" },
                { text: "SLA + dedicated support" },
                { text: "Custom integrations & webhooks" },
                { text: "Multi-channel / multi-user" },
              ]}
              cta="Contact Sales"
            />
          </div>

          <Note type="info">Limits are soft-enforced at the API level. Overuse results in a 429 response with a <code>Retry-After</code> header. Annual billing offers 20% discount.</Note>

          {/* ── API KEYS ──────────────────────────────────────────────────────────── */}
          <H2 id="api-keys">API Keys & Access</H2>
          <P>In the upcoming API product launch, each user will receive a personal API key from their account settings. API keys follow the format:</P>
          <Code>{`av_live_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   // Production
av_test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   // Sandbox`}</Code>
          <P>Keys are included in requests instead of (or in addition to) the JWT token:</P>
          <Code>{`Authorization: Bearer av_live_sk_xxxx...
// OR
X-AutoVid-Key: av_live_sk_xxxx...`}</Code>

          <H3>Rate Limits</H3>
          <div style={{ overflowX: "auto", margin: "10px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Plan", "Videos/month", "Shorts/month", "API calls/min", "Concurrent jobs"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 14px", color: T.textFaint, fontWeight: 600, letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Starter", "5", "10", "10", "1"],
                  ["Pro",     "60", "120", "60", "3"],
                  ["Enterprise", "Unlimited", "Unlimited", "Custom", "Custom"],
                ].map(row => (
                  <tr key={row[0]} style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.1s" }}>
                    {row.map((cell, i) => (
                      <td key={i} style={{ padding: "10px 14px", color: i === 0 ? T.text : T.textMid, fontWeight: i === 0 ? 600 : 400 }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3>Webhook Events (planned)</H3>
          <P>Pro and Enterprise plans will receive webhook notifications for pipeline events:</P>
          <Code>{`POST https://your-endpoint.com/autovid-webhook

{
  "event":    "video.ready",        // video.ready | video.failed | short.ready | short.failed
  "video_id": "uuid",
  "title":    "Why deep sleep...",
  "url":      "https://storage.supabase.co/...",
  "timestamp": "2026-03-15T09:00:00Z"
}`}</Code>

          {/* ── ROADMAP ───────────────────────────────────────────────────────────── */}
          <H2 id="roadmap">Roadmap</H2>
          <P>Planned features in priority order:</P>
          <div style={{ margin: "12px 0" }}>
            {[
              { status: "done",    label: "Custom script input for Shorts & Script Studio" },
              { status: "done",    label: "Global shorts config persistence across all pipelines" },
              { status: "done",    label: "Browser push notifications for pipeline completion" },
              { status: "done",    label: "Video library search & filter" },
              { status: "done",    label: "Next-run display for all automation schedulers" },
              { status: "active",  label: "Custom footage upload (replace Pexels with user-provided b-roll)" },
              { status: "planned", label: "User registration & multi-tenant accounts" },
              { status: "planned", label: "API key management UI & scoped permissions" },
              { status: "planned", label: "Stripe billing integration + usage metering" },
              { status: "planned", label: "Webhook delivery for pipeline events" },
              { status: "planned", label: "Instagram Reels upload" },
              { status: "planned", label: "LinkedIn video posting" },
              { status: "planned", label: "Multi-language TTS (beyond English)" },
              { status: "planned", label: "Custom voice cloning via ElevenLabs" },
              { status: "planned", label: "AI thumbnail generation (Midjourney / SDXL)" },
              { status: "future",  label: "White-label SaaS deployment" },
              { status: "future",  label: "Team collaboration & workspace sharing" },
            ].map((item, i) => {
              const s = {
                done:    { color: T.accentGreen,  dot: "✓", label: "DONE" },
                active:  { color: T.accent,        dot: "●", label: "IN PROGRESS" },
                planned: { color: T.accentYellow,  dot: "○", label: "PLANNED" },
                future:  { color: T.textFaint,     dot: "◌", label: "FUTURE" },
              }[item.status];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: s.color, width: 16, textAlign: "center" }}>{s.dot}</span>
                  <span style={{ fontSize: 13, color: item.status === "done" ? T.textMid : T.text, flex: 1, textDecoration: item.status === "done" ? "none" : "none" }}>{item.label}</span>
                  <Badge color={s.color}>{s.label}</Badge>
                </div>
              );
            })}
          </div>

          <Note type="success">Custom footage upload is coming soon — the user is recording their own b-roll footage and will provide it for integration. This will replace Pexels stock footage for a fully personalised look.</Note>

          <div style={{ marginTop: 48, padding: "20px 24px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🚀</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>AutoVid is being productised</div>
            <div style={{ fontSize: 13, color: T.textDim, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              The API subscription model, user registration, billing, and multi-tenant support are the next major milestone. This documentation will be updated as each feature ships.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
