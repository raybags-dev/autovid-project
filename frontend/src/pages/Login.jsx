import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Both fields required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Login failed. Check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#03060f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Mono', 'Fira Code', monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #03060f; }
        .login-input { display:block; width:100%; padding:13px 16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; color:#e0eaf5; font-family:inherit; font-size:13px; outline:none; transition:border-color 0.2s; }
        .login-input:focus { border-color:rgba(0,200,255,0.4); }
        .login-input::placeholder { color:#1a3a5a; }
        .login-btn { width:100%; padding:14px; background:linear-gradient(135deg,#0070cc,#00b4ff); border:none; border-radius:10px; color:white; font-family:inherit; font-size:12px; font-weight:500; letter-spacing:0.12em; cursor:pointer; transition:all 0.2s; margin-top:6px; }
        .login-btn:hover:not(:disabled) { opacity:0.85; transform:translateY(-1px); }
        .login-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
        .grid-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(0,150,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,150,255,0.03) 1px,transparent 1px); background-size:50px 50px; pointer-events:none; }
        .glow { position:absolute; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle,rgba(0,100,255,0.06) 0%,transparent 70%); top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none; }
        .card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:20px; padding:36px; width:380px; position:relative; opacity:0; transform:translateY(20px); transition:opacity 0.5s ease, transform 0.5s ease; }
        .card.mounted { opacity:1; transform:translateY(0); }
      `}</style>

      <div className="grid-bg" />
      <div className="glow" />

      <div className={`card ${mounted ? "mounted" : ""}`}>
        {/* Back to home */}
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "#1a3a5a", textDecoration: "none", letterSpacing: "0.08em", marginBottom: 20, transition: "color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#00b4ff"}
          onMouseLeave={e => e.currentTarget.style.color = "#1a3a5a"}
        >← BACK TO HOME</a>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "-0.03em",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                background: "linear-gradient(135deg,#00b4ff,#00ff88)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AUTO
            </span>
            <span style={{ color: "#e0eaf5" }}>VID</span>
          </div>
          <div
            style={{ fontSize: 10, color: "#1a3a5a", letterSpacing: "0.2em" }}
          >
            AI VIDEO AUTOMATION ENGINE
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            padding: "8px 12px",
            background: "rgba(255,50,80,0.06)",
            border: "1px solid rgba(255,50,80,0.12)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ff3250",
              flexShrink: 0,
            }}
          />
          <span
            style={{ fontSize: 10, color: "#ff3250", letterSpacing: "0.1em" }}
          >
            UNAUTHORIZED
          </span>
        </div>

        {/* Email */}
        <label
          style={{
            display: "block",
            fontSize: 10,
            color: "#2a5070",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          EMAIL ADDRESS
        </label>
        <input
          className="login-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="admin@autovid.ai"
          style={{ marginBottom: 16 }}
        />

        {/* Password */}
        <label
          style={{
            display: "block",
            fontSize: 10,
            color: "#2a5070",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          PASSWORD
        </label>
        <input
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="••••••••••"
          style={{ marginBottom: error ? 14 : 20 }}
        />

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(255,50,80,0.07)",
              border: "1px solid rgba(255,50,80,0.2)",
              borderRadius: 8,
              fontSize: 12,
              color: "#ff6080",
              marginBottom: 16,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "AUTHENTICATING..." : "AUTHENTICATE →"}
        </button>

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 10,
            color: "#0a2030",
            letterSpacing: "0.06em",
          }}
        >
          AUTOVID v1.0 · INTERNAL DASHBOARD
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#1a3a5a" }}>
          <a href="/privacy-policy" style={{ color: "#1a5070", textDecoration: "none", letterSpacing: "0.06em" }}
            onMouseEnter={e => e.target.style.color = "#00b4ff"}
            onMouseLeave={e => e.target.style.color = "#1a5070"}
          >Privacy Policy</a>
          <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
          <a href="/terms-of-service" style={{ color: "#1a5070", textDecoration: "none", letterSpacing: "0.06em" }}
            onMouseEnter={e => e.target.style.color = "#00b4ff"}
            onMouseLeave={e => e.target.style.color = "#1a5070"}
          >Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
