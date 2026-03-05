import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#03060f",
          color: "#0a2a4a",
          fontFamily: "monospace",
          letterSpacing: "0.2em",
          fontSize: 12,
        }}
      >
        INITIALIZING SYSTEM...
      </div>
    );
  return user ? children : <Navigate to="/" replace />;
}
