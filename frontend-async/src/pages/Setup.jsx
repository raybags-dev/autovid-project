import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateSubscriberSettings } from "../config/api";

function ChannelField({ icon, label, placeholder, hint, value, onChange, verifyUrl }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#8a9ab8", marginBottom: 8 }}>
        {icon} {label}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, background: "#050a14", border: "1px solid #1a2a3a",
            color: "#e0eaf5", borderRadius: 8, padding: "11px 14px",
            fontSize: 14, outline: "none", fontFamily: "inherit",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
          onBlur={(e) => (e.target.style.borderColor = value ? "#4f46e5" : "#1a2a3a")}
        />
        {verifyUrl && value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#1a2a3a", border: "1px solid #2a3a5a",
              color: "#8a9ab8", padding: "11px 16px", borderRadius: 8,
              fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            Verify ↗
          </a>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export default function Setup() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [youtube, setYoutube] = useState(user?.youtube_channel_url || "");
  const [tiktok,  setTiktok]  = useState(user?.tiktok_profile_url  || "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateSubscriberSettings({
        youtube_channel_url: youtube.trim(),
        tiktok_profile_url:  tiktok.trim(),
      });
      await refreshUser();
      navigate("/dashboard");
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate("/dashboard");

  return (
    <div style={{
      minHeight: "100vh", background: "#08080f",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 16px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e0eaf5", marginBottom: 6 }}>
            async<span style={{ color: "#4f46e5" }}>-mode</span>
          </div>
          <div style={{ fontSize: 13, color: "#4a6a8a" }}>
            Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </div>
        </div>

        <div style={{
          background: "#080e1a", border: "1px solid #0d1b2a",
          borderRadius: 16, padding: "40px 36px",
        }}>
          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>1</div>
            <div style={{ flex: 1, height: 2, background: "#0d1b2a", borderRadius: 1 }} />
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0d1b2a", border: "1px solid #1a2a3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#4a6a8a", flexShrink: 0 }}>2</div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#e0eaf5", margin: "0 0 10px" }}>
            Connect your channels
          </h2>
          <p style={{ fontSize: 13, color: "#6a8ab0", margin: "0 0 32px", lineHeight: 1.7 }}>
            Link your YouTube and TikTok channels so AutoVid knows where to publish your
            generated videos. You can add or update these later in Account settings.
          </p>

          <ChannelField
            icon="▶"
            label="YouTube Channel URL"
            placeholder="https://youtube.com/@yourchannel"
            hint='Find it at youtube.com → Your channel → Copy the URL from the address bar'
            value={youtube}
            onChange={setYoutube}
            verifyUrl
          />

          <ChannelField
            icon="♪"
            label="TikTok Profile URL"
            placeholder="https://tiktok.com/@yourhandle"
            hint="Your TikTok profile link — e.g. tiktok.com/@username"
            value={tiktok}
            onChange={setTiktok}
            verifyUrl
          />

          {/* Publishing note */}
          <div style={{
            background: "#050a14", border: "1px solid #0d1b2a",
            borderRadius: 10, padding: "14px 16px", marginBottom: 28,
          }}>
            <div style={{ fontSize: 12, color: "#4a6a8a", lineHeight: 1.7 }}>
              <strong style={{ color: "#8a9ab8" }}>How publishing works:</strong> Once your video is ready,
              you'll get an email with a download link. You can then upload it to your channels, or
              we'll guide you through auto-publishing in a future update.
            </div>
          </div>

          {error && (
            <div style={{
              background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171",
              padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving || (!youtube.trim() && !tiktok.trim())}
              style={{
                flex: 1, background: saving || (!youtube.trim() && !tiktok.trim()) ? "#1a2a3a" : "#4f46e5",
                color: saving || (!youtube.trim() && !tiktok.trim()) ? "#4a6a8a" : "#fff",
                border: "none", borderRadius: 9, padding: "12px",
                fontWeight: 700, fontSize: 14, cursor: saving || (!youtube.trim() && !tiktok.trim()) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Save & continue →"}
            </button>
            <button
              onClick={handleSkip}
              style={{
                background: "transparent", border: "1px solid #1a2a3a",
                color: "#4a6a8a", borderRadius: 9, padding: "12px 20px",
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Skip
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#4a6a8a" }}>
            You can always update these in Account → Channel Settings
          </div>
        </div>
      </div>
    </div>
  );
}
