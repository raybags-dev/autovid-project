import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createVideo,
  getCreateYourWebsite,
  getMyVideos,
  getSampleVideos,
  getVideoStreamUrl,
} from "../config/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(s) {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function fmtCountdown(seconds) {
  if (!seconds || seconds <= 0) return "Expired";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

const STATUS_COLOR = {
  generating: "#f59e0b",
  scripted:   "#f59e0b",
  voiced:     "#f59e0b",
  assembled:  "#f59e0b",
  captioned:  "#f59e0b",
  labeled:    "#f59e0b",
  ready:      "#22c55e",
  posted:     "#22c55e",
  failed:     "#f87171",
  queued:     "#4a6a8a",
};

const STATUS_LABEL = {
  generating: "Generating…",
  scripted:   "Writing script…",
  voiced:     "Recording voice…",
  assembled:  "Assembling…",
  captioned:  "Adding captions…",
  labeled:    "Labeling…",
  ready:      "Ready",
  posted:     "Done",
  failed:     "Failed",
  queued:     "Queued",
};

const STYLES = [
  { value: "educational",   label: "Educational",   desc: "Clear, curious, Kurzgesagt-style" },
  { value: "inspirational", label: "Inspirational",  desc: "Motivational, warm, heart-driven" },
  { value: "serious",       label: "Documentary",    desc: "Measured, authoritative tone" },
  { value: "funny",         label: "Entertaining",   desc: "Witty, sharp, comedy-first" },
  { value: "reflective",    label: "Reflective",     desc: "Philosophical, slow, contemplative" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TrialBanner({ user, onExpired }) {
  const [remaining, setRemaining] = useState(user.trial_remaining_seconds ?? null);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); onExpired?.(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (user.plan !== "trial") return null;

  const pct = remaining && user.trial_remaining_seconds
    ? Math.max(0, (remaining / (24 * 3600)) * 100)
    : 0;

  const urgent = remaining !== null && remaining < 3600;
  const expired = remaining !== null && remaining <= 0;

  return (
    <div style={{
      background: expired ? "#2a0f0f" : urgent ? "#2a1800" : "#0d1b2a",
      border: `1px solid ${expired ? "#4a1f1f" : urgent ? "#78350f" : "#1a2a4a"}`,
      borderRadius: 10, padding: "16px 20px", marginBottom: 28,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: expired ? "#f87171" : urgent ? "#fbbf24" : "#60a5fa",
            marginBottom: 3,
          }}>
            {expired ? "Trial Expired" : "Free Trial Active"}
          </div>
          <div style={{ fontSize: 12, color: "#6a8ab0" }}>
            {expired
              ? "Your 24-hour trial has ended. Reply to your welcome email to discuss upgrade options."
              : `${fmtCountdown(remaining)} · ${user.videos_created ?? 0}/${user.video_limit ?? 2} videos used`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!expired && (
            <div style={{ width: 100, height: 4, background: "#0a1520", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: urgent ? "#f59e0b" : "#4f46e5",
                transition: "width 1s linear", borderRadius: 2,
              }} />
            </div>
          )}
          <a
            href="mailto:help@async-mode.com?subject=Upgrade%20Request"
            style={{
              background: "transparent", border: "1px solid #4f46e5",
              color: "#818cf8", padding: "5px 14px", borderRadius: 6,
              fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            Upgrade →
          </a>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, isOwned }) {
  const thumb = video.thumbnail_url;
  const dur   = fmtDuration(video.duration_seconds);
  const status = video.status;
  const isPending = status && !["ready", "posted", "failed"].includes(status);
  const isDone    = ["ready", "posted"].includes(status);
  const isFailed  = status === "failed";

  return (
    <div style={{
      background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10,
      overflow: "hidden", transition: "border-color 0.2s, transform 0.15s",
      cursor: isDone ? "pointer" : "default",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1a2a4a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#0d1b2a"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#050a14" }}>
        {thumb ? (
          <img src={thumb} alt={video.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isPending ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>⚙️</div>
                <div style={{ fontSize: 11, color: "#4a6a8a" }}>Processing…</div>
              </div>
            ) : (
              <div style={{ fontSize: 28, color: "#1a2a3a" }}>🎬</div>
            )}
          </div>
        )}
        {dur && <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>{dur}</div>}
        {isOwned && status && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(0,0,0,0.85)", borderRadius: 4,
            padding: "2px 8px", fontSize: 10, fontWeight: 700,
            color: STATUS_COLOR[status] || "#4a6a8a",
          }}>
            {STATUS_LABEL[status] || status}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e0eaf5", marginBottom: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {video.title || video.prompt?.replace(" [Keep this concise", "") || "Untitled"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {video.created_at && <div style={{ fontSize: 11, color: "#4a6a8a" }}>{fmtRelative(video.created_at)}</div>}
          {isOwned && isDone && video.id && (
            <a
              href={getVideoStreamUrl(video.id)}
              target="_blank" rel="noopener noreferrer"
              style={{
                background: "#4f46e5", color: "#fff", padding: "4px 12px",
                borderRadius: 5, fontSize: 11, fontWeight: 600, textDecoration: "none",
                whiteSpace: "nowrap",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          )}
          {isOwned && isFailed && (
            <span style={{ fontSize: 11, color: "#f87171" }}>Generation failed</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateVideoPanel({ user, onCreated }) {
  const [topic, setTopic]   = useState("");
  const [style, setStyle]   = useState("educational");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const atLimit = (user.videos_created ?? 0) >= (user.video_limit ?? 2);
  const trialExpired = user.trial_remaining_seconds === 0 || user.status === "expired";

  const submit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) { setError("Enter a topic first."); return; }
    setLoading(true);
    setError("");
    try {
      await createVideo(topic.trim(), style);
      setSuccess(true);
      setTopic("");
      onCreated?.();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to queue video.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (trialExpired || atLimit) {
    return (
      <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>{atLimit ? "✓" : "⏱"}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e0eaf5", marginBottom: 8 }}>
          {atLimit ? "Video limit reached" : "Trial expired"}
        </div>
        <div style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 20, lineHeight: 1.6 }}>
          {atLimit
            ? `You've used all ${user.video_limit ?? 2} videos in your trial.`
            : "Your 24-hour trial has ended."}
          {" "}Upgrade to full access to create unlimited videos.
        </div>
        <a
          href="mailto:help@async-mode.com?subject=Upgrade%20Request"
          style={{
            display: "inline-block", background: "#4f46e5", color: "#fff",
            padding: "10px 24px", borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}
        >
          Request full access →
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ background: "#080e1a", border: "1px solid #0d3a1a", borderRadius: 10, padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🎬</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>Video queued!</div>
        <div style={{ fontSize: 13, color: "#4a6a8a", lineHeight: 1.6, marginBottom: 20 }}>
          Generation takes 5–20 minutes. You'll get an email when it's ready.<br />
          The video will appear in "My Videos" below.
        </div>
        <button
          onClick={() => setSuccess(false)}
          style={{ background: "transparent", border: "1px solid #1a2a4a", color: "#8a9ab8", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "24px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#4a6a8a", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Create a Video · {(user.video_limit ?? 2) - (user.videos_created ?? 0)} credit{((user.video_limit ?? 2) - (user.videos_created ?? 0)) !== 1 ? "s" : ""} remaining
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#6a8ab0", marginBottom: 6 }}>Topic or idea</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Why humans procrastinate — the psychology behind delay"
            rows={3}
            style={{
              width: "100%", background: "#050a14", border: "1px solid #1a2a3a",
              borderRadius: 7, padding: "10px 12px", color: "#e0eaf5",
              fontSize: 14, resize: "vertical", outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
            onBlur={(e)  => (e.target.style.borderColor = "#1a2a3a")}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, color: "#6a8ab0", marginBottom: 8 }}>Video style</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStyle(s.value)}
                title={s.desc}
                style={{
                  background: style === s.value ? "#4f46e5" : "#050a14",
                  border: `1px solid ${style === s.value ? "#4f46e5" : "#1a2a3a"}`,
                  color: style === s.value ? "#fff" : "#8a9ab8",
                  padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 8 }}>
            {STYLES.find((s) => s.value === style)?.desc}
          </div>
        </div>
        {error && (
          <div style={{ background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171", padding: "10px 14px", borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          style={{
            background: loading || !topic.trim() ? "#1a2a3a" : "#4f46e5",
            color: loading || !topic.trim() ? "#4a6a8a" : "#fff",
            border: "none", padding: "11px 28px", borderRadius: 7,
            cursor: loading || !topic.trim() ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 700,
          }}
        >
          {loading ? "Queuing…" : "Generate video →"}
        </button>
      </form>
    </div>
  );
}

function CreateYourWebsitePanel() {
  const [data, setData]     = useState(null);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (data) { setOpen((v) => !v); return; }
    setLoading(true);
    try {
      const d = await getCreateYourWebsite();
      setData(d);
      setOpen(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={load}
        style={{
          width: "100%", background: "transparent", border: "none", padding: "20px 24px",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          color: "#e0eaf5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 24 }}>🌐</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Create Your Own Website</div>
            <div style={{ fontSize: 12, color: "#4a6a8a" }}>Deploy a full AutoVid-powered platform on your own domain</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: "#4a6a8a", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          {loading ? "…" : "⌄"}
        </div>
      </button>
      {open && data && (
        <div style={{ padding: "0 24px 24px", borderTop: "1px solid #0d1b2a" }}>
          <p style={{ fontSize: 13, color: "#6a8ab0", marginTop: 16, lineHeight: 1.7 }}>
            {data.tagline}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
            <div style={{ background: "#050a14", border: "1px solid #0d1b2a", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 8, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>What you get</div>
              {(data.what_you_get || []).map((item, i) => (
                <div key={i} style={{ fontSize: 12, color: "#c8d8e8", marginBottom: 5, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "#4f46e5" }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ background: "#050a14", border: "1px solid #0d1b2a", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 8, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Requirements</div>
              {(data.requirements || []).map((item, i) => (
                <div key={i} style={{ fontSize: 12, color: "#c8d8e8", marginBottom: 5, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "#6a8ab0" }}>·</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Getting started</div>
            {(data.steps || []).map((s) => (
              <div key={s.step} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, background: "#4f46e5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 1 }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0eaf5", marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#6a8ab0", lineHeight: 1.5 }}>{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <a
            href={`mailto:${data.contact}?subject=Platform%20License%20Request`}
            style={{
              display: "inline-block", background: "#4f46e5", color: "#fff",
              padding: "10px 24px", borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}
          >
            Get the platform →
          </a>
          <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 10 }}>{data.pricing}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [myVideos,     setMyVideos]     = useState(null);
  const [sampleVideos, setSampleVideos] = useState(null);
  const [activeTab,    setActiveTab]    = useState("create");
  const [trialExpired, setTrialExpired] = useState(false);

  const pollRef = useRef(null);

  const loadMyVideos = async () => {
    try {
      const vids = await getMyVideos();
      setMyVideos(vids);
      return vids;
    } catch {
      setMyVideos([]);
      return [];
    }
  };

  const loadSamples = async () => {
    try {
      const vids = await getSampleVideos();
      setSampleVideos(vids);
    } catch {
      setSampleVideos([]);
    }
  };

  useEffect(() => {
    loadMyVideos();
    loadSamples();
  }, []);

  // Poll every 15s while any video is still processing
  useEffect(() => {
    const hasPending = (myVideos || []).some(
      (v) => !["ready", "posted", "failed"].includes(v.status)
    );
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadMyVideos();
        refreshUser?.();
      }, 15000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [myVideos]);

  const handleLogout = () => { logout(); navigate("/login"); };

  const handleVideoCreated = () => {
    setActiveTab("my-videos");
    loadMyVideos();
    refreshUser?.();
  };

  const handleTrialExpired = () => {
    setTrialExpired(true);
    refreshUser?.();
  };

  const pendingCount = (myVideos || []).filter(
    (v) => !["ready", "posted", "failed"].includes(v.status)
  ).length;

  return (
    <div style={{
      minHeight: "100vh", background: "#08080f", color: "#e0eaf5",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #0d1b2a", padding: "0 28px",
        display: "flex", alignItems: "center", height: 56, background: "#050a14",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontWeight: 800, fontSize: 16, flex: 1, color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
          <span style={{ color: "#4a6a8a", fontSize: 11, fontWeight: 400, marginLeft: 10 }}>workspace</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#4a6a8a" }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent", border: "1px solid #1a2a3a",
              color: "#6a8ab0", padding: "5px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 12,
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Trial banner */}
        {user?.plan === "trial" && (
          <TrialBanner user={user} onExpired={handleTrialExpired} />
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid #0d1b2a", paddingBottom: 0 }}>
          {[
            { id: "create",     label: "Create" },
            { id: "my-videos",  label: `My Videos${pendingCount ? ` (${pendingCount} processing)` : ""}` },
            { id: "samples",    label: "Sample Library" },
            { id: "website",    label: "Create Your Website" },
            { id: "account",    label: "Account" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
                color: activeTab === tab.id ? "#e0eaf5" : "#4a6a8a",
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 400,
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Create tab */}
        {activeTab === "create" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>
                Generate a video
              </h2>
              <p style={{ fontSize: 13, color: "#4a6a8a", margin: 0 }}>
                Give a topic and style — AutoVid writes the script, records the voice, and assembles the full video.
                Trial videos are up to 5 minutes long.
              </p>
            </div>
            <CreateVideoPanel user={user || {}} onCreated={handleVideoCreated} />
          </div>
        )}

        {/* My Videos tab */}
        {activeTab === "my-videos" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>My Videos</h2>
              <p style={{ fontSize: 13, color: "#4a6a8a", margin: 0 }}>
                Videos you've generated. Ready videos can be downloaded.
                {pendingCount > 0 && <span style={{ color: "#f59e0b" }}> · {pendingCount} still processing…</span>}
              </p>
            </div>

            {myVideos === null ? (
              <p style={{ color: "#4a6a8a", fontSize: 14 }}>Loading…</p>
            ) : myVideos.length === 0 ? (
              <div style={{
                background: "#080e1a", border: "1px dashed #0d1b2a",
                borderRadius: 10, padding: 48, textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
                <p style={{ color: "#4a6a8a", fontSize: 14, marginBottom: 16 }}>No videos yet.</p>
                <button
                  onClick={() => setActiveTab("create")}
                  style={{
                    background: "#4f46e5", color: "#fff", border: "none",
                    padding: "9px 22px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  }}
                >
                  Create your first video →
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                {myVideos.map((v) => <VideoCard key={v.id} video={v} isOwned />)}
              </div>
            )}
          </div>
        )}

        {/* Sample Library tab */}
        {activeTab === "samples" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>Sample Library</h2>
              <p style={{ fontSize: 13, color: "#4a6a8a", margin: 0 }}>
                Example videos produced by AutoVid — showing what you can create.
              </p>
            </div>
            {sampleVideos === null ? (
              <p style={{ color: "#4a6a8a", fontSize: 14 }}>Loading…</p>
            ) : sampleVideos.length === 0 ? (
              <div style={{
                background: "#080e1a", border: "1px dashed #0d1b2a",
                borderRadius: 10, padding: 48, textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                <p style={{ color: "#4a6a8a", fontSize: 14 }}>No sample videos available yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                {sampleVideos.map((v) => <VideoCard key={v.id} video={v} isOwned={false} />)}
              </div>
            )}
          </div>
        )}

        {/* Create Your Website tab */}
        {activeTab === "website" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>Create Your Own Website</h2>
              <p style={{ fontSize: 13, color: "#4a6a8a", margin: 0 }}>
                Deploy a full AutoVid platform on your own domain — same tech stack, your brand.
              </p>
            </div>
            <CreateYourWebsitePanel />
          </div>
        )}

        {/* Account tab */}
        {activeTab === "account" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>Account</h2>
            </div>
            <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 24 }}>
                {[
                  { label: "Email",         value: user?.email },
                  { label: "Plan",          value: user?.plan === "trial" ? "Free Trial" : "Full Access" },
                  { label: "Status",        value: user?.status?.charAt(0).toUpperCase() + user?.status?.slice(1) },
                  { label: "Videos used",   value: `${user?.videos_created ?? 0} / ${user?.video_limit ?? 2}` },
                  { label: "Trial expires", value: user?.trial_remaining_seconds != null ? fmtCountdown(user.trial_remaining_seconds) : "—" },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: "#c8d8e8" }}>{row.value || "—"}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #0d1b2a" }}>
                <div style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 12 }}>
                  Want to keep access or upgrade to full? Email us:
                </div>
                <a
                  href="mailto:help@async-mode.com?subject=Upgrade%20Request"
                  style={{ color: "#818cf8", fontSize: 13, fontWeight: 600 }}
                >
                  help@async-mode.com
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
