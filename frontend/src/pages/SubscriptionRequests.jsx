import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

const STATUS_COLORS = {
  pending:  { bg: "#1a2a10", text: "#7fba5f" },
  approved: { bg: "#0a1f2e", text: "#4fc3f7" },
  rejected: { bg: "#2a1010", text: "#f87171" },
};

function Badge({ status }) {
  const c = STATUS_COLORS[status] || { bg: "#1a1a2e", text: "#aaa" };
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {status}
    </span>
  );
}

function UserRow({ user, onApprove, onReject, onDelete }) {
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <tr style={{ borderBottom: "1px solid #0d1b2a" }}>
      <td style={{ padding: "12px 16px", color: "#c8d8e8", fontSize: 14 }}>{user.email}</td>
      <td style={{ padding: "12px 16px" }}><Badge status={user.status} /></td>
      <td style={{ padding: "12px 16px", color: "#556", fontSize: 12 }}>
        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
      </td>
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {user.status !== "approved" && (
            <button
              disabled={busy}
              onClick={() => act(onApprove)}
              style={{
                background: "#16422e", color: "#4caf74", border: "1px solid #1d6040",
                borderRadius: 5, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              Approve
            </button>
          )}
          {user.status !== "rejected" && (
            <button
              disabled={busy}
              onClick={() => act(onReject)}
              style={{
                background: "#2a1010", color: "#f87171", border: "1px solid #4a1f1f",
                borderRadius: 5, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              Reject
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => act(onDelete)}
            style={{
              background: "transparent", color: "#556", border: "1px solid #1a2a3a",
              borderRadius: 5, padding: "4px 12px", fontSize: 12, cursor: "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function SubscriptionRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data: d } = await api.get("/admin/subscription-requests");
      setData(d);
    } catch {
      setError("Failed to load subscription requests.");
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    await api.post(`/admin/subscription-requests/${id}/approve`);
    load();
  };
  const reject = async (id) => {
    await api.post(`/admin/subscription-requests/${id}/reject`);
    load();
  };
  const del = async (id) => {
    if (!window.confirm("Delete this subscriber permanently?")) return;
    await api.delete(`/admin/subscription-requests/${id}`);
    load();
  };

  const allUsers = data
    ? [
        ...(data.pending || []).map((u) => ({ ...u, status: "pending" })),
        ...(data.approved || []).map((u) => ({ ...u, status: "approved" })),
        ...(data.rejected || []).map((u) => ({ ...u, status: "rejected" })),
      ]
    : [];

  const shown = filter === "all" ? allUsers : allUsers.filter((u) => u.status === filter);

  const counts = {
    pending:  (data?.pending || []).length,
    approved: (data?.approved || []).length,
    rejected: (data?.rejected || []).length,
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#03060f", color: "#c8d8e8",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #0d1b2a", padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "transparent", border: "1px solid #1a2a3a",
              color: "#4a8fb8", padding: "6px 14px", borderRadius: 6,
              cursor: "pointer", fontSize: 13,
            }}
          >
            ← Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: 18, color: "#e0eaf5" }}>
            Subscription Requests
          </h1>
        </div>
        <span style={{ fontSize: 12, color: "#4a6a8a" }}>
          Logged in as {user?.email}
        </span>
      </div>

      <div style={{ padding: "32px" }}>
        {error && (
          <div style={{
            background: "#2a0f0f", border: "1px solid #4a1f1f",
            color: "#f87171", padding: "12px 16px", borderRadius: 8, marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {["pending", "approved", "rejected"].map((s) => (
            <div key={s} style={{
              background: "#080e1a", border: `1px solid ${filter === s ? "#2a5080" : "#0d1b2a"}`,
              borderRadius: 10, padding: "16px 24px", cursor: "pointer", minWidth: 100,
              transition: "border-color 0.2s",
            }}
              onClick={() => setFilter(filter === s ? "all" : s)}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS[s]?.text }}>
                {counts[s]}
              </div>
              <div style={{ fontSize: 12, color: "#4a6a8a", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>
                {s}
              </div>
            </div>
          ))}
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              style={{
                background: "transparent", border: "1px solid #1a2a3a",
                color: "#4a8fb8", padding: "8px 16px", borderRadius: 8,
                cursor: "pointer", fontSize: 12, alignSelf: "center",
              }}
            >
              Show all
            </button>
          )}
        </div>

        {/* Table */}
        {data === null ? (
          <p style={{ color: "#4a6a8a" }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p style={{ color: "#4a6a8a" }}>No {filter !== "all" ? filter : ""} requests.</p>
        ) : (
          <div style={{ background: "#080e1a", border: "1px solid #0d1b2a", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #0d1b2a", background: "#050a14" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#4a6a8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#4a6a8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#4a6a8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Registered</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#4a6a8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onApprove={() => approve(u.id)}
                    onReject={() => reject(u.id)}
                    onDelete={() => del(u.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
