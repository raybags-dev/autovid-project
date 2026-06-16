import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === "Account pending approval")
        setError("Your account is still pending approval. Check your email for updates.");
      else if (detail === "Account access denied")
        setError("Your access request was not approved. Contact support if you think this is a mistake.");
      else if (err.response?.status === 401)
        setError("Invalid email or password.");
      else
        setError(detail || "Login failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#08080f",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: 20, color: "#e0eaf5" }}>
            async<span style={{ color: "#4f46e5" }}>-mode</span>
          </Link>
        </div>

        <div style={{
          background: "#080e1a", border: "1px solid #0d1b2a",
          borderRadius: 14, padding: "36px 32px",
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, color: "#e0eaf5", textAlign: "center" }}>
            Log in
          </h2>

          {error && (
            <div style={{
              background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171",
              padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 14, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#8a9ab8", marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: "100%", background: "#080e1a", border: "1px solid #1a2a3a",
                  color: "#e0eaf5", borderRadius: 7, padding: "10px 12px",
                  fontSize: 14, outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                onBlur={(e) => (e.target.style.borderColor = "#1a2a3a")}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, color: "#8a9ab8", marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", background: "#080e1a", border: "1px solid #1a2a3a",
                  color: "#e0eaf5", borderRadius: 7, padding: "10px 12px",
                  fontSize: 14, outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                onBlur={(e) => (e.target.style.borderColor = "#1a2a3a")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", background: "#4f46e5", color: "#fff",
                border: "none", borderRadius: 8, padding: "12px",
                fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#4a6a8a" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#4f46e5" }}>Request access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
