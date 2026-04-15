import React, { useState, useEffect, useRef } from "react";
import { dangerVerify, dangerClearVideos, dangerClearStorage, dangerClearPodcasts, dangerClearStickfigures, dangerClearBlogs } from "../api/client";

function DangerBtn({ icon, label, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(180,0,20,0.07)",
        border: "1px solid rgba(200,0,30,0.22)",
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(200,0,30,0.16)";
        e.currentTarget.style.borderColor = "rgba(200,0,30,0.5)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(180,0,20,0.07)";
        e.currentTarget.style.borderColor = "rgba(200,0,30,0.22)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 12,
          color: "#ff3030",
          letterSpacing: "0.1em",
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 10,
        color: "rgba(255,120,120,0.55)",
        lineHeight: 1.6,
        paddingLeft: 26,
        letterSpacing: "0.02em",
      }}>{desc}</div>
    </button>
  );
}

export default function DangerZone({ onClose }) {
  const [countdown, setCountdown] = useState(10);
  const [interacted, setInteracted] = useState(false);
  const [phase, setPhase] = useState("auth"); // auth | ready | confirm | done
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dangerToken, setDangerToken] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // "wipe-videos" | "clear-storage" | "wipe-all"
  const [confirmInput, setConfirmInput] = useState("");
  const [actionRunning, setActionRunning] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // Auto-close countdown — pauses once user interacts
  useEffect(() => {
    if (interacted || phase !== "auth") return;
    if (countdown <= 0) { onClose(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, interacted, phase, onClose]);

  const markInteracted = () => { if (!interacted) setInteracted(true); };

  const handleAuth = async () => {
    if (!keyInput.trim() || authLoading) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await dangerVerify(keyInput.trim());
      setDangerToken(res.danger_token);
      setPhase("ready");
    } catch (e) {
      setAuthError(e?.response?.data?.detail || "Authentication failed — invalid key");
    } finally {
      setAuthLoading(false);
    }
  };

  const triggerConfirm = (action) => {
    setConfirmAction(action);
    setConfirmInput("");
    setPhase("confirm");
  };

  const ACTION_LABELS = {
    "wipe-videos":      "WIPE ALL VIDEOS",
    "clear-storage":    "CLEAR STORAGE",
    "wipe-all":         "WIPE EVERYTHING",
    "wipe-podcasts":    "WIPE ALL PODCASTS",
    "wipe-stickfigures":"WIPE ALL STICK FIGURES",
    "wipe-blogs":       "WIPE ALL BLOG POSTS",
  };
  const ACTION_WARNINGS = {
    "wipe-videos":       "This will permanently delete every video record from the database. Storage files remain.",
    "clear-storage":     "This will permanently delete all files from the Supabase storage buckets (videos + narrations).",
    "wipe-all":          "This will permanently delete ALL database records AND ALL storage files. There is absolutely no recovery.",
    "wipe-podcasts":     "This will permanently delete all podcast DB records and their MP3 narration files from Supabase storage. Cannot be undone.",
    "wipe-stickfigures": "This will permanently delete all stick figure clip records from the database. The files in the stickfigures bucket are not removed.",
    "wipe-blogs":        "This will permanently delete every blog post from the database. Comments and slugs will also be lost. Cannot be undone.",
  };

  const executeAction = async () => {
    if (confirmInput !== "CONFIRM" || actionRunning) return;
    setActionRunning(true);
    try {
      let message;
      if (confirmAction === "wipe-videos") {
        const r = await dangerClearVideos(dangerToken);
        message = r.message;
      } else if (confirmAction === "clear-storage") {
        const r = await dangerClearStorage(dangerToken);
        message = r.message;
      } else if (confirmAction === "wipe-all") {
        const [r1, r2] = await Promise.all([
          dangerClearVideos(dangerToken),
          dangerClearStorage(dangerToken),
        ]);
        message = `${r1.message}. ${r2.message}.`;
      } else if (confirmAction === "wipe-podcasts") {
        const r = await dangerClearPodcasts(dangerToken);
        message = r.message;
      } else if (confirmAction === "wipe-stickfigures") {
        const r = await dangerClearStickfigures(dangerToken);
        message = r.message;
      } else if (confirmAction === "wipe-blogs") {
        const r = await dangerClearBlogs(dangerToken);
        message = r.message;
      }
      setActionResult({ success: true, message });
      setPhase("done");
    } catch (e) {
      setActionResult({ success: false, message: e?.response?.data?.detail || "Operation failed" });
      setPhase("done");
    } finally {
      setActionRunning(false);
    }
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(180,0,20,0.07)",
    border: "1px solid rgba(200,0,30,0.3)",
    borderRadius: 8,
    padding: "11px 14px",
    color: "#ff8080",
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
    letterSpacing: "0.05em",
  };

  const btnBase = {
    padding: "11px 0",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 11,
    cursor: "pointer",
    letterSpacing: "0.1em",
    fontWeight: 600,
    border: "1px solid",
    transition: "all 0.15s",
  };

  return (
    <div
      onClick={markInteracted}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.93)",
        backdropFilter: "blur(18px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`
        @keyframes dangerPulse { 0%,100%{box-shadow:0 0 40px rgba(200,0,30,0.12),inset 0 1px 0 rgba(200,0,30,0.1)} 50%{box-shadow:0 0 70px rgba(200,0,30,0.22),inset 0 1px 0 rgba(200,0,30,0.18)} }
        @keyframes skullBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>

      <div style={{
        background: "linear-gradient(180deg, #090006 0%, #0e0008 60%, #090006 100%)",
        border: "1px solid rgba(200,0,30,0.45)",
        borderRadius: 18,
        padding: "36px 32px",
        maxWidth: 500,
        width: "100%",
        position: "relative",
        animation: "dangerPulse 3s ease-in-out infinite",
      }}>
        {/* Top glow */}
        <div style={{
          position: "absolute",
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 240,
          height: 100,
          background: "radial-gradient(ellipse, rgba(200,0,30,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 52, animation: "skullBob 2.5s ease-in-out infinite", marginBottom: 10 }}>☠</div>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 900,
            fontSize: 22,
            color: "#ff1a1a",
            letterSpacing: "0.16em",
            textShadow: "0 0 24px rgba(255,20,20,0.55)",
          }}>DANGER ZONE</div>
          <div style={{
            fontSize: 9,
            color: "rgba(255,60,60,0.5)",
            letterSpacing: "0.18em",
            marginTop: 5,
          }}>RESTRICTED · DESTRUCTIVE OPERATIONS · NO UNDO</div>
        </div>

        {/* ── AUTH PHASE ── */}
        {phase === "auth" && (
          <>
            {!interacted && (
              <div style={{
                textAlign: "center",
                marginBottom: 16,
                fontSize: 10,
                color: "rgba(255,60,60,0.4)",
                letterSpacing: "0.12em",
              }}>
                AUTO-CLOSING IN {countdown}s — INTERACT TO STAY
              </div>
            )}

            <div style={{
              background: "rgba(180,0,20,0.07)",
              border: "1px solid rgba(200,0,30,0.18)",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 22,
              fontSize: 11,
              color: "rgba(255,130,130,0.8)",
              lineHeight: 1.75,
            }}>
              ⚠ This panel can <strong style={{ color: "#ff4040" }}>permanently erase all database records and storage files</strong>.
              There is <strong style={{ color: "#ff4040" }}>no recovery</strong> after execution.
              If you are unsure why you are here, close this immediately.
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, color: "rgba(255,80,80,0.55)", letterSpacing: "0.14em", marginBottom: 7 }}>
                ENTER DANGER ZONE KEY
              </div>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAuth()}
                placeholder="Danger zone key..."
                autoFocus
                style={inputStyle}
              />
              {authError && (
                <div style={{ fontSize: 11, color: "#ff4040", marginTop: 8, letterSpacing: "0.04em" }}>
                  ✕ {authError}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ ...btnBase, flex: 1, background: "transparent", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
              >
                EXIT SAFELY
              </button>
              <button
                onClick={handleAuth}
                disabled={!keyInput.trim() || authLoading}
                style={{
                  ...btnBase,
                  flex: 2,
                  background: "rgba(180,0,20,0.15)",
                  borderColor: "rgba(200,0,30,0.4)",
                  color: "#ff4040",
                  opacity: (!keyInput.trim() || authLoading) ? 0.4 : 1,
                  cursor: (!keyInput.trim() || authLoading) ? "not-allowed" : "pointer",
                }}
              >
                {authLoading ? "⟳ VERIFYING..." : "AUTHENTICATE"}
              </button>
            </div>
          </>
        )}

        {/* ── READY PHASE ── */}
        {phase === "ready" && (
          <>
            <div style={{
              fontSize: 10,
              color: "rgba(255,80,80,0.5)",
              textAlign: "center",
              marginBottom: 22,
              letterSpacing: "0.12em",
            }}>
              ☢ AUTHENTICATED — SELECT OPERATION
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <DangerBtn
                icon="🎙"
                label="WIPE ALL PODCASTS"
                desc="Deletes all podcast DB records and their MP3 narration files from Supabase storage."
                onClick={() => triggerConfirm("wipe-podcasts")}
              />
              <DangerBtn
                icon="🕹"
                label="WIPE ALL STICK FIGURES"
                desc="Deletes all stick figure clip records from the database."
                onClick={() => triggerConfirm("wipe-stickfigures")}
              />
              <DangerBtn
                icon="✏"
                label="WIPE ALL BLOG POSTS"
                desc="Permanently deletes every blog post from the database. Comments and slugs are also removed."
                onClick={() => triggerConfirm("wipe-blogs")}
              />
              <DangerBtn
                icon="☢"
                label="WIPE ALL VIDEOS"
                desc="Deletes every video record from the database. Storage files remain until cleared separately."
                onClick={() => triggerConfirm("wipe-videos")}
              />
              <DangerBtn
                icon="🗑"
                label="CLEAR STORAGE"
                desc="Deletes all files from the Supabase storage buckets (videos + narrations). DB records remain."
                onClick={() => triggerConfirm("clear-storage")}
              />
              <DangerBtn
                icon="💀"
                label="WIPE EVERYTHING"
                desc="Clears both database records AND all storage files simultaneously. Complete system reset."
                onClick={() => triggerConfirm("wipe-all")}
              />
            </div>
            <button
              onClick={onClose}
              style={{ ...btnBase, width: "100%", background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}
            >
              EXIT SAFELY
            </button>
          </>
        )}

        {/* ── CONFIRM PHASE ── */}
        {phase === "confirm" && confirmAction && (
          <>
            <div style={{
              background: "rgba(180,0,20,0.09)",
              border: "1px solid rgba(200,0,30,0.22)",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 20,
              fontSize: 11,
              color: "rgba(255,140,140,0.9)",
              lineHeight: 1.7,
            }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13, color: "#ff2828", marginBottom: 7, letterSpacing: "0.08em" }}>
                ☢ {ACTION_LABELS[confirmAction]}
              </div>
              {ACTION_WARNINGS[confirmAction]}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: "rgba(255,80,80,0.55)", letterSpacing: "0.14em", marginBottom: 7 }}>
                TYPE "CONFIRM" TO PROCEED — THIS CANNOT BE UNDONE
              </div>
              <input
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && executeAction()}
                placeholder='Type CONFIRM'
                autoFocus
                style={{
                  ...inputStyle,
                  border: `1px solid ${confirmInput === "CONFIRM" ? "rgba(200,0,30,0.7)" : "rgba(200,0,30,0.25)"}`,
                  color: confirmInput === "CONFIRM" ? "#ff3030" : "#ff8080",
                  letterSpacing: "0.18em",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setPhase("ready"); setConfirmInput(""); }}
                style={{ ...btnBase, flex: 1, background: "transparent", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
              >
                GO BACK
              </button>
              <button
                onClick={executeAction}
                disabled={confirmInput !== "CONFIRM" || actionRunning}
                style={{
                  ...btnBase,
                  flex: 2,
                  background: confirmInput === "CONFIRM" ? "rgba(200,0,30,0.25)" : "rgba(180,0,20,0.07)",
                  borderColor: "rgba(200,0,30,0.45)",
                  color: "#ff2828",
                  fontWeight: 900,
                  opacity: (confirmInput !== "CONFIRM" || actionRunning) ? 0.45 : 1,
                  cursor: (confirmInput !== "CONFIRM" || actionRunning) ? "not-allowed" : "pointer",
                }}
              >
                {actionRunning ? "⟳ EXECUTING..." : `EXECUTE ${ACTION_LABELS[confirmAction]}`}
              </button>
            </div>
          </>
        )}

        {/* ── DONE PHASE ── */}
        {phase === "done" && actionResult && (
          <>
            <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>
                {actionResult.success ? "✓" : "✕"}
              </div>
              <div style={{
                fontSize: 12,
                color: actionResult.success ? "rgba(255,100,100,0.85)" : "#ff4040",
                lineHeight: 1.8,
                letterSpacing: "0.03em",
              }}>
                {actionResult.message}
              </div>
            </div>
            <button
              onClick={actionResult.success ? onClose : () => { setPhase("ready"); setActionResult(null); }}
              style={{
                ...btnBase,
                width: "100%",
                background: "rgba(180,0,20,0.15)",
                borderColor: "rgba(200,0,30,0.35)",
                color: "#ff3030",
              }}
            >
              {actionResult.success ? "CLOSE" : "TRY AGAIN"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
