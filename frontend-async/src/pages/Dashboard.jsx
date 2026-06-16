import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  cancelAccountDeletion,
  createVideo,
  getCreateYourWebsite,
  getMyVideos,
  getSampleVideos,
  getVideoStatus,
  getVideoStreamUrl,
  requestAccountDeletion,
  retryVideo,
  updateSubscriberSettings,
} from "../config/api";

/* ─── Toast / Notification system ───────────────────────────────────────────── */

function useNotifications() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, addToast: add, dismiss };
}

function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  const colors = { info: "#4f46e5", success: "#22c55e", error: "#f87171", warning: "#f59e0b" };
  return (
    <div style={{ position: "fixed", top: 68, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 340 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: "#0d1b2a", border: `1px solid ${colors[t.type] || colors.info}33`,
          borderLeft: `3px solid ${colors[t.type] || colors.info}`,
          borderRadius: 8, padding: "12px 14px",
          display: "flex", gap: 12, alignItems: "flex-start",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          animation: "slideIn 0.2s ease",
        }}>
          <span style={{ fontSize: 12, color: "#c8d8e8", flex: 1, lineHeight: 1.5 }}>{t.msg}</span>
          <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", color: "#4a6a8a", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}

/* ─── Video progress panel ───────────────────────────────────────────────────── */

const PIPELINE_STEPS = [
  { key: "generating",  label: "Writing script",     desc: "AI is crafting your script" },
  { key: "scripted",    label: "Generating voice",    desc: "Converting text to speech" },
  { key: "voiced",      label: "Building video",      desc: "Combining audio with visuals" },
  { key: "assembled",   label: "Adding captions",     desc: "Burning in subtitles" },
  { key: "captioned",   label: "Finishing up",        desc: "Final processing" },
  { key: "labeled",     label: "Uploading to YouTube", desc: "Uploading as private draft" },
  { key: "ready",       label: "Ready!",              desc: "Your video is complete" },
  { key: "posted",      label: "Published",           desc: "Uploaded to YouTube" },
];

function VideoProgressPanel({ videoId, onComplete }) {
  const [status, setStatus] = useState("generating");
  const [title, setTitle]   = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;
    const poll = async () => {
      try {
        const data = await getVideoStatus(videoId);
        setStatus(data.status);
        if (data.title) setTitle(data.title);
        if (["ready", "posted", "failed"].includes(data.status)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          onComplete?.();
        }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [videoId]);

  const stepIndex  = PIPELINE_STEPS.findIndex((s) => s.key === status);
  const isFailed   = status === "failed";
  const isDone     = status === "ready" || status === "posted";
  const pct        = isDone ? 100 : Math.round(((stepIndex < 0 ? 0 : stepIndex) / (PIPELINE_STEPS.length - 3)) * 100);

  return (
    <div style={{
      background: "#050e1a", border: "1px solid #1a3a6a", borderRadius: 12,
      padding: "20px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isFailed ? "#f87171" : isDone ? "#22c55e" : "#4f46e5",
          animation: (!isFailed && !isDone) ? "pulse 1.5s ease-in-out infinite" : "none",
        }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e0eaf5" }}>
          {isFailed ? "Pipeline failed" : isDone ? "Video ready!" : "Generating your video…"}
        </div>
        {title && <div style={{ fontSize: 11, color: "#4a6a8a", marginLeft: "auto", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
      </div>

      {/* Progress bar */}
      {!isFailed && (
        <div style={{ background: "#0d1b2a", borderRadius: 4, height: 4, marginBottom: 16, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: isDone ? "#22c55e" : "linear-gradient(90deg,#4f46e5,#818cf8)",
            borderRadius: 4,
            transition: "width 1s ease",
          }} />
        </div>
      )}

      {/* Steps */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PIPELINE_STEPS.filter((s) => !["posted"].includes(s.key)).map((s, i) => {
          const done    = stepIndex > i || isDone;
          const current = stepIndex === i && !isDone;
          return (
            <div key={s.key} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              background: done ? "#0d2a1a" : current ? "#0d1b3a" : "#0a0f1a",
              border: `1px solid ${done ? "#22c55e33" : current ? "#4f46e5" : "#0d1b2a"}`,
              fontSize: 11,
              color: done ? "#22c55e" : current ? "#e0eaf5" : "#4a6a8a",
              fontWeight: current ? 700 : 400,
            }}>
              {done ? "✓" : current ? "…" : String(i + 1)}
              {" "}{s.label}
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#f87171" }}>
          Pipeline failed — go to My Videos and click Retry.
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

/* ─── Capabilities panel ─────────────────────────────────────────────────────── */

function CapabilitiesPanel({ user }) {
  const isTrialActive = user.plan === "trial" && (user.trial_remaining_seconds ?? 0) > 0 && user.status !== "expired";
  const isExpired = user.status === "expired" || (user.plan === "trial" && (user.trial_remaining_seconds ?? 0) <= 0);
  const isFull = user.plan === "subscriber" || user.plan === "full";
  const videosLeft = Math.max(0, (user.video_limit ?? 2) - (user.videos_created ?? 0));

  const caps = [
    { label: "Create videos", ok: !isExpired, note: isExpired ? "Upgrade required" : isFull ? "Unlimited" : `${videosLeft} credit${videosLeft !== 1 ? "s" : ""} left` },
    { label: "Download videos", ok: true, note: "Always available" },
    { label: "YouTube (private draft)", ok: !isExpired, note: isExpired ? "Upgrade required" : "Auto-uploaded as private" },
    { label: "Retry failed videos", ok: true, note: "No credits deducted" },
    { label: "All voice profiles", ok: isFull, note: isFull ? "15+ profiles" : "5 profiles on trial" },
    { label: "Priority queue", ok: isFull, note: isFull ? "Enabled" : "Standard queue" },
    { label: "Shorts automation", ok: isFull, note: isFull ? "Enabled" : "Creator plan" },
    { label: "Podcast pipeline", ok: isFull, note: isFull ? "Enabled" : "Creator plan" },
  ];

  return (
    <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: "#4a6a8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
        What you can do
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {caps.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <span style={{ fontSize: 12, flexShrink: 0, color: c.ok ? "#22c55e" : "#4a6a8a" }}>{c.ok ? "✓" : "○"}</span>
            <div>
              <div style={{ fontSize: 12, color: c.ok ? "#c8d8e8" : "#4a6a8a", fontWeight: c.ok ? 600 : 400 }}>{c.label}</div>
              <div style={{ fontSize: 10, color: "#4a6a8a" }}>{c.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Upgrade modal ──────────────────────────────────────────────────────────── */

function UpgradeModal({ onClose }) {
  const plans = [
    { name: "Starter", price: "$29/mo", features: ["10 videos/month", "YouTube (private upload)", "5 voice profiles", "Auto-captions", "Email support"] },
    { name: "Creator", price: "$79/mo", features: ["Unlimited videos", "Shorts automation", "Podcast pipeline", "All 15+ voices", "Priority queue"], highlight: true },
    { name: "Studio", price: "Custom", features: ["Everything in Creator", "Dedicated worker", "White-label output", "API access", "SLA support"] },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#080e1a", border: "1px solid #1a2a4a", borderRadius: 16,
        padding: "32px 28px", maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e0eaf5", margin: "0 0 6px" }}>Upgrade your plan</h2>
            <p style={{ fontSize: 13, color: "#4a6a8a", margin: 0 }}>Choose the plan that fits your content goals.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a6a8a", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#090c1e" : "#050a14",
              border: `1px solid ${plan.highlight ? "#4f46e5" : "#0d1b2a"}`,
              borderRadius: 12, padding: "20px",
              position: "relative",
            }}>
              {plan.highlight && (
                <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#4f46e5", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6a8a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{plan.name}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#e0eaf5", marginBottom: 16 }}>{plan.price}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 12, color: "#8a9ab8", padding: "4px 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ color: "#4f46e5", fontWeight: 800 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ background: "#050a14", border: "1px solid #1a2a4a", borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#6a8ab0", margin: "0 0 12px", lineHeight: 1.7 }}>
            To upgrade, email us with your preferred plan. We'll confirm payment details and activate your account — usually within 24 hours.
          </p>
          <a
            href="mailto:help@async-mode.com?subject=Upgrade%20Request&body=Hi%2C%20I'd%20like%20to%20upgrade%20my%20async-mode.com%20account.%20My%20preferred%20plan%20is%3A%20"
            style={{
              display: "inline-block", background: "#4f46e5", color: "#fff",
              padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}
          >
            Email to upgrade →
          </a>
          <span style={{ fontSize: 12, color: "#4a6a8a", marginLeft: 12 }}>help@async-mode.com</span>
        </div>

        <p style={{ fontSize: 12, color: "#4a6a8a", margin: 0, textAlign: "center" }}>
          All plans include a 7-day money-back guarantee. Cancel anytime. See our{" "}
          <Link to="/refund" onClick={onClose} style={{ color: "#818cf8" }}>Refund Policy</Link>.
        </p>
      </div>
    </div>
  );
}

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
          <button
            onClick={() => setShowUpgrade(true)}
            style={{
              background: "transparent", border: "1px solid #4f46e5",
              color: "#818cf8", padding: "5px 14px", borderRadius: 6,
              fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Upgrade →
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, isOwned, onRetry }) {
  const thumb = video.thumbnail_url;
  const dur   = fmtDuration(video.duration_seconds);
  const status = video.status;
  const isPending = status && !["ready", "posted", "failed"].includes(status);
  const isDone    = ["ready", "posted"].includes(status);
  const isFailed  = status === "failed";
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (e) => {
    e.stopPropagation();
    setRetrying(true);
    try {
      await retryVideo(video.id);
      onRetry?.();
    } catch {
      // silent — status will update on next poll
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div style={{
      background: "#080e1a", border: `1px solid ${isFailed ? "#2a1010" : "#0d1b2a"}`, borderRadius: 10,
      overflow: "hidden", transition: "border-color 0.2s, transform 0.15s",
      cursor: isDone ? "pointer" : "default",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = isFailed ? "#3a1515" : "#1a2a4a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isFailed ? "#2a1010" : "#0d1b2a"; e.currentTarget.style.transform = "none"; }}
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
            ) : isFailed ? (
              <div style={{ fontSize: 28, color: "#3a1515" }}>✕</div>
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
        {isFailed && video.error_message && (
          <div style={{ fontSize: 10, color: "#6a3a3a", marginBottom: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {video.error_message}
          </div>
        )}
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
            <button
              onClick={handleRetry}
              disabled={retrying}
              style={{
                background: "transparent", border: "1px solid #3a2020",
                color: "#f87171", padding: "4px 10px", borderRadius: 5,
                fontSize: 11, fontWeight: 600, cursor: retrying ? "not-allowed" : "pointer",
                opacity: retrying ? 0.6 : 1,
              }}
            >
              {retrying ? "Retrying…" : "↺ Retry"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateVideoPanel({ user, onCreated, onUpgrade }) {
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
      const result = await createVideo(topic.trim(), style);
      setSuccess(true);
      setTopic("");
      onCreated?.(result?.video_id);
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
        <button
          onClick={() => onUpgrade?.()}
          style={{
            display: "inline-block", background: "#4f46e5", color: "#fff",
            padding: "10px 24px", borderRadius: 7, fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer",
          }}
        >
          Upgrade to full access →
        </button>
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

// ── Account Tab ───────────────────────────────────────────────────────────────

function AccountTab({ user, onSaved, navigate, onUpgrade }) {
  const [youtube,  setYoutube]  = useState(user?.youtube_channel_url || "");
  const [tiktok,   setTiktok]   = useState(user?.tiktok_profile_url  || "");
  const [voiceId,  setVoiceId]  = useState(user?.tts_voice_id || "");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const [delPending, setDelPending]   = useState(user?.deletion_status === "pending_deletion");
  const [delLoading, setDelLoading]   = useState(false);
  const [delConfirm, setDelConfirm]   = useState(false);
  const [delError,   setDelError]     = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateSubscriberSettings({
        youtube_channel_url: youtube.trim(),
        tiktok_profile_url:  tiktok.trim(),
        tts_voice_id:        voiceId.trim() || null,
      });
      await onSaved?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDeletion = async () => {
    setDelLoading(true);
    setDelError("");
    try {
      await requestAccountDeletion();
      setDelPending(true);
      setDelConfirm(false);
    } catch (err) {
      setDelError(err.response?.data?.detail || "Failed to queue deletion. Contact help@async-mode.com.");
    } finally {
      setDelLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setDelLoading(true);
    setDelError("");
    try {
      await cancelAccountDeletion();
      setDelPending(false);
    } catch (err) {
      setDelError(err.response?.data?.detail || "Failed to cancel. Contact help@async-mode.com.");
    } finally {
      setDelLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>Account</h2>
      </div>

      {/* Plan info */}
      <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "24px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Plan & Usage</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
          {[
            { label: "Email",         value: user?.email },
            { label: "Plan",          value: user?.plan === "trial" ? "Free Trial" : "Full Access" },
            { label: "Status",        value: user?.status?.charAt(0).toUpperCase() + user?.status?.slice(1) },
            { label: "Videos used",   value: `${user?.videos_created ?? 0} / ${user?.video_limit ?? 2}` },
            { label: "Trial expires", value: user?.trial_remaining_seconds != null ? fmtCountdown(user.trial_remaining_seconds) : "—" },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ fontSize: 10, color: "#4a6a8a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</div>
              <div style={{ fontSize: 13, color: "#c8d8e8" }}>{row.value || "—"}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #0d1b2a", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => onUpgrade?.()} style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Upgrade plan →
          </button>
          <Link to="/docs" style={{ color: "#6a8ab0", fontSize: 13 }}>View documentation</Link>
        </div>
      </div>

      {/* Channel settings */}
      <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, padding: "24px" }}>
        <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Publishing Channels</div>
        <p style={{ fontSize: 13, color: "#6a8ab0", margin: "0 0 20px", lineHeight: 1.6 }}>
          Your videos are downloaded and can be published to these channels. Enter your channel URLs
          so AutoVid knows where to route your content.
        </p>
        <form onSubmit={handleSave}>
          {[
            { label: "▶ YouTube Channel", key: "youtube", val: youtube, set: setYoutube, ph: "https://youtube.com/@yourchannel" },
            { label: "♪ TikTok Profile",  key: "tiktok",  val: tiktok,  set: setTiktok,  ph: "https://tiktok.com/@yourhandle" },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "#6a8ab0", marginBottom: 6 }}>{f.label}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  style={{
                    flex: 1, background: "#050a14", border: "1px solid #1a2a3a",
                    color: "#e0eaf5", borderRadius: 7, padding: "9px 12px",
                    fontSize: 13, outline: "none", fontFamily: "inherit",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                  onBlur={(e) => (e.target.style.borderColor = "#1a2a3a")}
                />
                {f.val && (
                  <a href={f.val} target="_blank" rel="noopener noreferrer"
                    style={{
                      background: "#050a14", border: "1px solid #1a2a3a", color: "#6a8ab0",
                      padding: "9px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                      textDecoration: "none", whiteSpace: "nowrap",
                    }}>
                    Verify ↗
                  </a>
                )}
              </div>
            </div>
          ))}
          {/* TTS voice */}
          <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid #0d1b2a" }}>
            <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>TTS Voice</div>
            <p style={{ fontSize: 12, color: "#4a6a8a", margin: "0 0 10px", lineHeight: 1.6 }}>
              Custom ElevenLabs voice ID for your videos. Leave blank to use the platform default.
            </p>
            <input
              type="text"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="ElevenLabs voice ID (e.g. 21m00Tcm4TlvDq8ikWAM)"
              style={{
                width: "100%", background: "#050a14", border: "1px solid #1a2a3a",
                color: "#e0eaf5", borderRadius: 7, padding: "9px 12px",
                fontSize: 13, outline: "none", fontFamily: "monospace", boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
              onBlur={(e)  => (e.target.style.borderColor = "#1a2a3a")}
            />
            <div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 5 }}>
              Find your voice ID in the ElevenLabs dashboard → Voices
            </div>
          </div>

          {error && (
            <div style={{ background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171", padding: "9px 12px", borderRadius: 7, fontSize: 12, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? "#1a2a3a" : "#4f46e5", color: saving ? "#4a6a8a" : "#fff",
                border: "none", borderRadius: 7, padding: "9px 22px",
                fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
            {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ Saved</span>}
            <button
              type="button"
              onClick={() => navigate("/setup")}
              style={{
                background: "transparent", border: "1px solid #1a2a3a", color: "#4a6a8a",
                borderRadius: 7, padding: "9px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Setup guide
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone — account deletion */}
      <div style={{ background: "#0c0608", border: "1px solid #2a1018", borderRadius: 10, padding: "24px", marginTop: 20 }}>
        <div style={{ fontSize: 12, color: "#6a2a3a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
          Danger Zone
        </div>
        {delPending ? (
          <div>
            <p style={{ fontSize: 13, color: "#c8a0a8", lineHeight: 1.6, margin: "0 0 16px" }}>
              Your account is queued for permanent deletion in 24 hours. This includes all generated videos and account data.
            </p>
            {delError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{delError}</div>}
            <button
              onClick={handleCancelDeletion}
              disabled={delLoading}
              style={{
                background: "#4f46e5", color: "#fff", border: "none",
                padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                cursor: delLoading ? "not-allowed" : "pointer",
              }}
            >
              {delLoading ? "Cancelling…" : "Cancel deletion — keep my account"}
            </button>
          </div>
        ) : delConfirm ? (
          <div>
            <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6, margin: "0 0 16px" }}>
              Are you sure? This will permanently delete your account and ALL generated videos after 24 hours. This cannot be undone.
            </p>
            {delError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{delError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRequestDeletion}
                disabled={delLoading}
                style={{
                  background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b",
                  padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                  cursor: delLoading ? "not-allowed" : "pointer",
                }}
              >
                {delLoading ? "Processing…" : "Yes, delete my account"}
              </button>
              <button
                onClick={() => setDelConfirm(false)}
                style={{
                  background: "transparent", border: "1px solid #2a1a1a", color: "#6a5a5a",
                  padding: "8px 16px", borderRadius: 7, fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#6a5a5a", lineHeight: 1.6, margin: "0 0 16px" }}>
              Permanently delete your account and all generated videos. After requesting, you have 24 hours to cancel.
              You'll receive an email confirmation.
            </p>
            <button
              onClick={() => setDelConfirm(true)}
              style={{
                background: "transparent", border: "1px solid #3a1a1a", color: "#b06060",
                padding: "8px 20px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Request account deletion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [myVideos,       setMyVideos]       = useState(null);
  const [sampleVideos,   setSampleVideos]   = useState(null);
  const [activeTab,      setActiveTab]      = useState("create");
  const [trialExpired,   setTrialExpired]   = useState(false);
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [trackingVideoId, setTrackingVideoId] = useState(null);

  const { toasts, addToast, dismiss } = useNotifications();

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

  const handleVideoCreated = (videoId) => {
    setActiveTab("my-videos");
    if (videoId) setTrackingVideoId(videoId);
    loadMyVideos();
    refreshUser?.();
    addToast("Video queued! Tracking progress below. Ready in 8–15 minutes.", "success");
  };

  const handleTrialExpired = () => {
    setTrialExpired(true);
    refreshUser?.();
    addToast("Your trial has expired. Upgrade to continue creating videos.", "warning");
  };

  const pendingCount = (myVideos || []).filter(
    (v) => !["ready", "posted", "failed"].includes(v.status)
  ).length;

  return (
    <div style={{
      minHeight: "100vh", background: "#08080f", color: "#e0eaf5",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #0d1b2a", padding: "0 28px",
        display: "flex", alignItems: "center", height: 56, background: "#050a14",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span
          onClick={() => navigate("/")}
          style={{ fontWeight: 800, fontSize: 16, flex: 1, color: "#e0eaf5", cursor: "pointer" }}
        >
          async<span style={{ color: "#4f46e5" }}>-mode</span>
          <span style={{ color: "#4a6a8a", fontSize: 11, fontWeight: 400, marginLeft: 10 }}>workspace</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/docs" style={{ fontSize: 12, color: "#4a6a8a", padding: "5px 10px" }}>Docs</Link>
          <span style={{ fontSize: 12, color: "#4a6a8a" }}>{user?.email}</span>
          <button
            onClick={() => setShowUpgrade(true)}
            style={{
              background: "#4f46e5", border: "none",
              color: "#fff", padding: "5px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}
          >
            Upgrade
          </button>
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
        {(() => {
          const isTrial = user?.plan === "trial";
          const TABS = [
            { id: "create",    label: "Create",              locked: false },
            { id: "my-videos", label: `My Videos${pendingCount ? ` (${pendingCount})` : ""}`, locked: false },
            { id: "samples",   label: "Sample Library",      locked: false },
            { id: "website",   label: "Create Your Website", locked: isTrial },
            { id: "account",   label: "Account",             locked: isTrial },
          ];
          return (
            <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid #0d1b2a", paddingBottom: 0, flexWrap: "wrap" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.locked) { setShowUpgrade(true); addToast("Upgrade to access this feature.", "warning"); return; }
                    setActiveTab(t.id);
                  }}
                  title={t.locked ? "Upgrade to unlock" : undefined}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === t.id ? "2px solid #4f46e5" : "2px solid transparent",
                    color: t.locked ? "#2a3a4a" : activeTab === t.id ? "#e0eaf5" : "#4a6a8a",
                    padding: "10px 16px",
                    cursor: t.locked ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: activeTab === t.id ? 700 : 400,
                    marginBottom: -1,
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  {t.locked && <span style={{ marginRight: 4, fontSize: 10, opacity: 0.5 }}>🔒</span>}
                  {t.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Create tab */}
        {activeTab === "create" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e0eaf5", margin: "0 0 6px" }}>
                Generate a video
              </h2>
              <p style={{ fontSize: 13, color: "#4a6a8a", margin: "0 0 12px" }}>
                Give a topic and style — AutoVid writes the script, records the voice, and assembles the full video.
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0d1a2a", border: "1px solid #1a3a5a", borderRadius: 6, padding: "5px 12px", fontSize: 11, color: "#6a8ab0" }}>
                🔒 Videos are uploaded to YouTube as <strong style={{ color: "#818cf8" }}>private drafts</strong> — only you can see them until you publish
              </div>
            </div>
            <CapabilitiesPanel user={user || {}} />
            <CreateVideoPanel user={user || {}} onCreated={handleVideoCreated} onUpgrade={() => setShowUpgrade(true)} />
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

            {trackingVideoId && (
              <VideoProgressPanel
                videoId={trackingVideoId}
                onComplete={() => {
                  loadMyVideos();
                  refreshUser?.();
                  setTrackingVideoId(null);
                }}
              />
            )}

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
                {myVideos.map((v) => <VideoCard key={v.id} video={v} isOwned onRetry={handleVideoCreated} />)}
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
                {user?.plan === "trial" && <span style={{ color: "#4f46e5", marginLeft: 8 }}>Trial: 5 previews shown</span>}
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
            ) : (() => {
              const isTrial = user?.plan === "trial";
              const displayed = isTrial ? sampleVideos.slice(0, 5) : sampleVideos;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                  {displayed.map((v) => (
                    <div key={v.id} style={{ position: "relative" }}>
                      <div style={{ pointerEvents: isTrial ? "none" : undefined, opacity: isTrial ? 0.45 : 1, filter: isTrial ? "grayscale(0.5)" : "none" }}>
                        <VideoCard video={v} isOwned={false} />
                      </div>
                      {isTrial && (
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: 10,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 6, cursor: "pointer",
                        }} onClick={() => setShowUpgrade(true)}>
                          <div style={{ fontSize: 18, opacity: 0.6 }}>🔒</div>
                          <div style={{ fontSize: 10, color: "#4a6a8a", fontWeight: 600, letterSpacing: "0.05em" }}>UPGRADE TO WATCH</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isTrial && sampleVideos.length > 5 && (
                    <div
                      onClick={() => setShowUpgrade(true)}
                      style={{
                        background: "#080e1a", border: "1px dashed #1a2a3a",
                        borderRadius: 10, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        padding: 32, cursor: "pointer", gap: 8, minHeight: 160,
                      }}
                    >
                      <div style={{ fontSize: 22, opacity: 0.4 }}>+{sampleVideos.length - 5}</div>
                      <div style={{ fontSize: 11, color: "#4a6a8a", fontWeight: 600 }}>Upgrade to see all</div>
                    </div>
                  )}
                </div>
              );
            })()}
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
          <AccountTab user={user} onSaved={refreshUser} navigate={navigate} onUpgrade={() => setShowUpgrade(true)} />
        )}
      </div>
    </div>
  );
}
