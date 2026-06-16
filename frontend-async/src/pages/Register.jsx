import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../config/api";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      setDone(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === "Email already registered") setError("That email is already registered.");
      else if (detail === "invalid_email") setError("Please enter a valid email address.");
      else setError(detail || "Registration failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Wrapper>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#e0eaf5" }}>
            Request received
          </h2>
          <p style={{ color: "#8a9ab8", lineHeight: 1.7, marginBottom: 24 }}>
            We've sent a confirmation email to <strong style={{ color: "#e0eaf5" }}>{email}</strong>.
            Your account will be reviewed within 24 hours.
          </p>
          <Link to="/" style={{ color: "#4f46e5", fontSize: 14 }}>← Back to home</Link>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: "#e0eaf5", textAlign: "center" }}>
        Request access
      </h2>
      <p style={{ color: "#8a9ab8", fontSize: 14, textAlign: "center", marginBottom: 28 }}>
        Accounts are approved manually. You'll be notified by email.
      </p>

      {error && (
        <div style={{
          background: "#2a0f0f", border: "1px solid #4a1f1f", color: "#f87171",
          padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="min 6 characters" required />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="repeat password" required />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 8, padding: "12px",
            fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, marginTop: 8,
          }}
        >
          {loading ? "Submitting…" : "Request access"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#4a6a8a" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#4f46e5" }}>Log in</Link>
      </p>
    </Wrapper>
  );
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, color: "#8a9ab8", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: "100%", background: "#080e1a", border: "1px solid #1a2a3a",
          color: "#e0eaf5", borderRadius: 7, padding: "10px 12px",
          fontSize: 14, outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
        onBlur={(e) => (e.target.style.borderColor = "#1a2a3a")}
      />
    </div>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#08080f",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: 20, color: "#e0eaf5" }}>
            async<span style={{ color: "#4f46e5" }}>-mode</span>
          </Link>
        </div>
        <div style={{
          background: "#080e1a", border: "1px solid #0d1b2a",
          borderRadius: 14, padding: "36px 32px",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
