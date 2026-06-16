import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getVideos } from "../config/api";

function VideoCard({ video }) {
  const thumb = video.thumbnail_url;
  const dur = video.duration_seconds
    ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}`
    : null;

  return (
    <div style={{
      background: "#080e1a", border: "1px solid #0d1b2a",
      borderRadius: 10, overflow: "hidden",
      transition: "border-color 0.2s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a2a4a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#0d1b2a")}
    >
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#050a14" }}>
        {thumb ? (
          <img
            src={thumb}
            alt={video.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 28, color: "#1a2a3a",
          }}>
            🎬
          </div>
        )}
        {dur && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            background: "rgba(0,0,0,0.8)", color: "#fff",
            fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
          }}>
            {dur}
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "#e0eaf5",
          marginBottom: 6, lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {video.title || "Untitled"}
        </div>
        {video.created_at && (
          <div style={{ fontSize: 12, color: "#4a6a8a" }}>
            {new Date(video.created_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getVideos()
      .then(setVideos)
      .catch(() => setError("Failed to load videos."));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#08080f", color: "#e0eaf5",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #0d1b2a", padding: "0 28px",
        display: "flex", alignItems: "center", height: 56,
        background: "#050a14",
      }}>
        <span style={{ fontWeight: 800, fontSize: 16, flex: 1, color: "#e0eaf5" }}>
          async<span style={{ color: "#4f46e5" }}>-mode</span>
          <span style={{ color: "#4a6a8a", fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
            AutoVid
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#4a6a8a" }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent", border: "1px solid #1a2a3a",
              color: "#8a9ab8", padding: "5px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 13,
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e0eaf5", marginBottom: 4 }}>
            Your workspace
          </h1>
          <p style={{ fontSize: 14, color: "#4a6a8a" }}>
            Exclusive content and your AutoVid library.
          </p>
        </div>

        {error && (
          <div style={{
            background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171",
            padding: "12px 16px", borderRadius: 8, marginBottom: 24, fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Videos */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#8a9ab8", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Exclusive Videos
          </h2>

          {videos === null ? (
            <p style={{ color: "#4a6a8a", fontSize: 14 }}>Loading…</p>
          ) : videos.length === 0 ? (
            <div style={{
              background: "#080e1a", border: "1px dashed #0d1b2a",
              borderRadius: 10, padding: "48px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
              <p style={{ color: "#4a6a8a", fontSize: 14 }}>No exclusive videos yet — check back soon.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 20,
            }}>
              {videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
        </div>

        {/* Account info */}
        <div style={{
          marginTop: 48, background: "#080e1a", border: "1px solid #0d1b2a",
          borderRadius: 10, padding: "24px",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#4a6a8a", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Account
          </h2>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</div>
              <div style={{ fontSize: 14, color: "#c8d8e8" }}>{user?.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
              <div style={{ fontSize: 14, color: "#4fc3f7" }}>Active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
