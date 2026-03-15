/**
 * Script Studio — v2
 * Write your own script → choose a looping visual + background music → generate a long-form video.
 */
import { useRef, useState } from "react";
import api from "../api/client";

const PROFILES = [
  { id: "educational",   emoji: "🧠", label: "Educational",   desc: "Thoughtful essay-style" },
  { id: "serious",       emoji: "🎯", label: "Serious",        desc: "Documentary & weighty" },
  { id: "inspirational", emoji: "🔥", label: "Inspirational",  desc: "Emotional storytelling" },
  { id: "reflective",    emoji: "🌊", label: "Reflective",     desc: "Philosophical & deep" },
  { id: "funny",         emoji: "😄", label: "Funny",          desc: "Humour with insight" },
];

const MOODS = [
  { id: "stars",  emoji: "⭐", label: "Stars",  desc: "Deep space drift" },
  { id: "aurora", emoji: "🌌", label: "Aurora", desc: "Northern lights" },
  { id: "ocean",  emoji: "🌊", label: "Ocean",  desc: "Underwater rays" },
  { id: "fire",   emoji: "🔥", label: "Fire",   desc: "Floating embers" },
  { id: "rain",   emoji: "🌧", label: "Rain",   desc: "Night city window" },
  { id: "galaxy", emoji: "🌀", label: "Galaxy", desc: "Spiral rotation" },
];

const MUSIC = [
  { id: "Birds_Atmosphere_Piano", emoji: "🌙", label: "Birds & Piano",  desc: "Birds atmosphere + piano" },
  { id: "Birds_Atmosphere_Wing",  emoji: "🍃", label: "Birds & Wing",   desc: "Birds atmosphere + wing pads" },
  { id: "Laidback_Fevorite",      emoji: "🎹", label: "Laidback Fav",   desc: "Smooth laidback favourite" },
  { id: "Pads_EPiano",            emoji: "🎧", label: "Pads & EPiano",  desc: "Deep smooth pads + e-piano" },
  { id: "Pads",                   emoji: "🎵", label: "Pads",           desc: "Chill heavy pads" },
  { id: "none",                   emoji: "🔇", label: "No Music",       desc: "Voice only" },
];

const PIPE_STEPS = ["Script", "Voice", "Visuals", "Music", "Assemble", "Upload"];

const STEP_LABELS = {
  1: "Synthesizing voice narration...",
  2: "Generating looping visual...",
  3: "Mixing background music...",
  4: "Assembling final video...",
  5: "Burning captions...",
  6: "Done! Check your Videos tab.",
};


export default function ScriptStudio({ T, showToast, onVideoReady }) {
  const [title, setTitle]     = useState("");
  const [script, setScript]   = useState("");
  const [profile, setProfile] = useState("educational");
  const [mood, setMood]       = useState("stars");
  const [music, setMusic]         = useState("Birds_Atmosphere_Piano");
  const [musicVolume, setMusicVolume] = useState(0.01);
  const [running, setRunning] = useState(false);
  const [pipeStep, setPipeStep]   = useState(0);
  const [jobId, setJobId]         = useState(null);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);
  const [showLogs, setShowLogs]   = useState(false);
  const [logs, setLogs]           = useState([]);
  const pollRef    = useRef(null);
  const logPollRef = useRef(null);
  const logLineRef = useRef(0);
  const logsEndRef = useRef(null);

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estMins   = Math.round(wordCount / 140);

  // Word-count bar color
  const wcColor =
    wordCount < 50  ? T.accentRed :
    wordCount < 200 ? "#f59e0b" :
    wordCount < 500 ? "#eab308" :
    T.accentGreen;
  const wcPct = Math.min(100, (wordCount / 700) * 100);

  const handleCancel = async () => {
    if (!jobId) return;
    clearInterval(pollRef.current);
    clearInterval(logPollRef.current);
    try { await api.post(`/videos/${jobId}/cancel`); } catch (e) {}
    setRunning(false);
    setError("Cancelled by you");
    showToast("Pipeline cancelled", "error");
  };

  const handleGenerate = async () => {
    if (!title.trim()) { showToast("Please enter a title", "error"); return; }
    if (wordCount < 50) { showToast("Script needs at least 50 words", "error"); return; }

    setRunning(true);
    setError("");
    setDone(false);
    setPipeStep(1);
    setShowLogs(true); // auto-open log panel

    try {
      const { data } = await api.post("/script-studio/generate", {
        title:        title.trim(),
        script:       script.trim(),
        profile,
        visual_mood:  mood,
        music_style:  music,
        music_volume: musicVolume,
      });
      const vid = data.video_id;
      setJobId(vid);
      setLogs([]);
      logLineRef.current = 0;
      showToast("Script pipeline started!");

      // Poll log buffer every 1.5s
      logPollRef.current = setInterval(async () => {
        try {
          const { data: logData } = await api.get(`/videos/${vid}/logs?since=${logLineRef.current}`);
          if (logData.lines && logData.lines.length > 0) {
            logLineRef.current += logData.lines.length;
            setLogs((prev) => [...prev, ...logData.lines].slice(-300));
            setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
          if (logData.done) clearInterval(logPollRef.current);
        } catch (e) { /* ignore */ }
      }, 1500);

      // Poll for progress every 4s
      pollRef.current = setInterval(async () => {
        try {
          const { data: status } = await api.get(`/videos/${data.video_id}`);
          const stepMap = {
            generating: 1, scripted: 2, voiced: 3,
            assembled: 4,  captioned: 5, labeled: 5,
            ready: 6,      posted: 6,
          };
          setPipeStep(stepMap[status.status] || pipeStep);
          if (["ready", "posted", "failed"].includes(status.status)) {
            clearInterval(pollRef.current);
            setRunning(false);
            if (status.status === "failed") {
              setError(status.error_message || "Pipeline failed");
              showToast("Pipeline failed", "error");
            } else {
              setPipeStep(6);
              setDone(true);
              showToast("Video ready! Loading preview...");
              try {
                const { data: finishedVideo } = await api.get(`/videos/${data.video_id}`);
                setTimeout(() => { if (onVideoReady) onVideoReady(finishedVideo); }, 1200);
              } catch (e) { /* preview failed silently */ }
            }
          }
        } catch (e) { /* ignore poll errors */ }
      }, 4000);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to start pipeline");
      setRunning(false);
      setPipeStep(0);
      showToast("Failed to start", "error");
    }
  };

  // ─── sub-components ───────────────────────────────────────────────────────

  const MoodCard = ({ v }) => {
    const isSelected = mood === v.id;
    return (
      <button
        onClick={() => setMood(v.id)}
        disabled={running}
        style={{
          padding: "8px 10px", borderRadius: 8,
          cursor: running ? "not-allowed" : "pointer",
          textAlign: "left",
          border: `2px solid ${isSelected ? T.accent : T.border}`,
          background: isSelected ? `${T.accent}18` : T.inputBg,
          color: T.text, fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700 }}>{v.emoji} {v.label}</div>
        <div style={{ fontSize: 10, color: T.textDim }}>{v.desc}</div>
      </button>
    );
  };

  const MusicCard = ({ m }) => {
    const isSelected = music === m.id;
    return (
      <button
        onClick={() => setMusic(m.id)}
        disabled={running}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 11px",
          borderRadius: 8,
          border: `1px solid ${isSelected ? T.accentGreen + "70" : T.border}`,
          background: isSelected ? T.accentGreen + "0f" : "transparent",
          color: isSelected ? T.accentGreen : T.textMid,
          cursor: running ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          transition: "all 0.15s",
          opacity: running ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{m.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{m.label}</div>
          <div style={{ fontSize: 9, color: T.textFaint, lineHeight: 1.3 }}>{m.desc}</div>
        </div>
        {isSelected && (
          <div style={{
            marginLeft: "auto", flexShrink: 0,
            width: 6, height: 6, borderRadius: "50%",
            background: T.accentGreen,
          }} />
        )}
      </button>
    );
  };

  // ─── render ───────────────────────────────────────────────────────────────
  const currentStepLabel = PIPE_STEPS[pipeStep - 1] || "";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Top header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 16, marginBottom: 20, borderBottom: `1px solid ${T.border}`,
        gap: 12,
      }}>
        {/* Left: title + word count */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22,
            color: T.text, letterSpacing: "-0.02em",
          }}>
            ✍ Script Studio
          </div>
          <div style={{ fontSize: 11, color: T.textMid }}>
            Write &rarr; choose visuals &amp; music &rarr; generate a long-form video
          </div>
        </div>

        {/* Center: pipeline status badge (visible while running) */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {running && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 16px", borderRadius: 100,
              background: T.accent + "14",
              border: `1px solid ${T.accent}40`,
            }}>
              {/* Spinning dot */}
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: T.accent,
                animation: "statusPulse 1.2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: T.accent,
                fontFamily: "'Syne',sans-serif",
              }}>
                {currentStepLabel ? currentStepLabel.toUpperCase() : "PROCESSING"}
              </span>
            </div>
          )}
          {done && !running && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 16px", borderRadius: 100,
              background: T.accentGreen + "14",
              border: `1px solid ${T.accentGreen}40`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.accentGreen, fontFamily: "'Syne',sans-serif", letterSpacing: "0.04em" }}>
                ✓ COMPLETE
              </span>
            </div>
          )}
        </div>

        {/* Right: quick info pills */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            padding: "5px 12px", borderRadius: 8,
            background: T.bgCard, border: `1px solid ${T.border}`,
            fontSize: 10, color: wcColor, fontWeight: 600,
            transition: "color 0.3s",
          }}>
            {wordCount} words
          </div>
          <div style={{
            padding: "5px 12px", borderRadius: 8,
            background: T.bgCard, border: `1px solid ${T.border}`,
            fontSize: 10, color: T.textFaint,
          }}>
            ~{estMins < 1 ? "<1" : estMins} min
          </div>
        </div>
      </div>

      {/* ── Main two-panel layout ────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.65fr) minmax(0,1fr)",
        gap: 20,
        alignItems: "start",
      }}>

        {/* ═══ LEFT PANEL — Script editor ═════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Video title */}
          <div>
            <label style={{
              display: "block", fontSize: 10, color: T.textFaint,
              letterSpacing: "0.1em", marginBottom: 7,
            }}>
              VIDEO TITLE
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Stoic's Guide to Inner Peace"
              maxLength={80}
              disabled={running}
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.inputBg, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "11px 14px",
                color: T.text, fontSize: 13,
                fontFamily: "inherit", outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e)  => (e.target.style.borderColor = T.border)}
            />
          </div>

          {/* Script textarea */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
              <label style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                YOUR SCRIPT
              </label>
              <span style={{ fontSize: 10, color: T.textFaint }}>
                Target: <span style={{ color: wcColor, transition: "color 0.3s" }}>
                  {wordCount}
                </span> / 700 words for 5-min
              </span>
            </div>

            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={"Write your full narration script here.\n\nTip: Write naturally as if speaking. Use line breaks between sections.\nAim for 700+ words for a 5-minute video, 1400+ for 10 minutes.\n\nThe AI will handle timing, captions, and visual sync automatically."}
              rows={19}
              disabled={running}
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.inputBg, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "13px 15px",
                color: T.text, fontSize: 13,
                fontFamily: "inherit", outline: "none",
                resize: "vertical", lineHeight: 1.75,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e)  => (e.target.style.borderColor = T.border)}
            />

            {/* Word-count progress bar */}
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 3, background: T.border, borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${wcPct}%`,
                  background: wcColor, borderRadius: 3,
                  transition: "width 0.4s, background 0.3s",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: 9, color: T.textFaint }}>
                  ~140 words per minute of narration
                </span>
                <span style={{ fontSize: 9, color: T.textFaint }}>
                  700w = 5 min &nbsp;·&nbsp; 1400w = 10 min
                </span>
              </div>
            </div>
          </div>

          {/* Content profile (horizontal row of pills) */}
          <div style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
              CONTENT PROFILE
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PROFILES.map((p) => {
                const active = profile === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id)}
                    disabled={running}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 8,
                      border: `1px solid ${active ? T.accent + "60" : T.border}`,
                      background: active ? T.accent + "12" : "transparent",
                      color: active ? T.accent : T.textMid,
                      cursor: running ? "not-allowed" : "pointer",
                      fontFamily: "inherit", textAlign: "left",
                      transition: "all 0.15s", opacity: running ? 0.6 : 1,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{p.label}</div>
                      <div style={{ fontSize: 9, color: T.textFaint }}>{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pipeline stepper (visible while running or done) */}
          {(running || done) && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: "16px 20px",
            }}>
              <div style={{
                fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 16,
              }}>
                PIPELINE PROGRESS
              </div>

              {/* Steps */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {PIPE_STEPS.map((step, i) => {
                  const stepNum = i + 1;
                  const isDone   = stepNum < pipeStep;
                  const isActive = stepNum === pipeStep;
                  return (
                    <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                        {/* Circle with pulse rings */}
                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isActive && (
                            <>
                              <div style={{
                                position: "absolute", borderRadius: "50%",
                                width: 36, height: 36,
                                border: `2px solid ${T.accent}`,
                                animation: "ringPulse 1.4s ease-out infinite",
                                opacity: 0,
                              }} />
                              <div style={{
                                position: "absolute", borderRadius: "50%",
                                width: 44, height: 44,
                                border: `1.5px solid ${T.accent}`,
                                animation: "ringPulse 1.4s ease-out infinite 0.4s",
                                opacity: 0,
                              }} />
                            </>
                          )}
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700,
                            background: isDone ? T.accentGreen : isActive ? T.accent : T.bgDeep,
                            color: isDone || isActive ? "#fff" : T.textFaint,
                            border: isActive ? `2px solid ${T.accent}` : "none",
                            transition: "all 0.4s",
                            boxShadow: isActive ? `0 0 16px ${T.accent}80` : "none",
                            zIndex: 1,
                          }}>
                            {isDone ? "✓" : stepNum}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 9, letterSpacing: "0.07em", whiteSpace: "nowrap",
                          color: isActive ? T.accent : isDone ? T.accentGreen : T.textFaint,
                        }}>
                          {step.toUpperCase()}
                        </div>
                      </div>

                      {/* Connector line */}
                      {i < PIPE_STEPS.length - 1 && (
                        <div style={{
                          flex: 1, height: 2, margin: "0 4px", marginBottom: 22,
                          background: isDone ? T.accentGreen : T.border,
                          transition: "background 0.4s",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step description */}
              <div style={{
                marginTop: 14, fontSize: 11, color: T.textMid, textAlign: "center",
                minHeight: 18,
              }}>
                {STEP_LABELS[pipeStep] || ""}
              </div>
            </div>
          )}

          {/* Inline log viewer */}
          {(running || (logs.length > 0)) && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 12, overflow: "hidden",
            }}>
              {/* Log header row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", borderBottom: showLogs ? `1px solid ${T.border}` : "none",
                cursor: "pointer",
              }}
                onClick={() => setShowLogs((v) => !v)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: running ? T.accentGreen : T.textFaint,
                    animation: running ? "statusPulse 1.2s ease-in-out infinite" : "none",
                  }} />
                  <span style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                    PIPELINE LOGS
                  </span>
                  <span style={{ fontSize: 9, color: T.textFaint }}>
                    ({logs.length} lines)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {running && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                      style={{
                        padding: "4px 12px", borderRadius: 6,
                        border: `1px solid ${T.accentRed}50`,
                        background: `${T.accentRed}0e`,
                        color: T.accentRed, fontSize: 9,
                        fontFamily: "inherit", letterSpacing: "0.07em",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${T.accentRed}20`;
                        e.currentTarget.style.borderColor = `${T.accentRed}90`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${T.accentRed}0e`;
                        e.currentTarget.style.borderColor = `${T.accentRed}50`;
                      }}
                    >
                      CANCEL &amp; PURGE
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: T.textFaint }}>
                    {showLogs ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Log body */}
              {showLogs && (
                <div style={{
                  height: 200, overflowY: "auto",
                  padding: "10px 16px",
                  background: "#03060f",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10.5, lineHeight: 1.75,
                }}>
                  {logs.length === 0 ? (
                    <div style={{ color: T.textFaint }}>Waiting for pipeline output...</div>
                  ) : (
                    logs.slice(-12).map((line, i) => (
                      <div key={i} style={{
                        color:
                          line.startsWith("[ERROR]") ? "#ff5c6c" :
                          line.startsWith("[DONE]")  ? "#60ff90" :
                          "#7dd3a8",
                        wordBreak: "break-all",
                      }}>
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Success banner */}
          {done && !running && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "14px 18px", borderRadius: 12,
              background: T.accentGreen + "0d",
              border: `1px solid ${T.accentGreen}40`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accentGreen, marginBottom: 3 }}>
                  Video ready
                </div>
                <div style={{ fontSize: 11, color: T.textMid }}>
                  Head to the Videos tab to preview and download your new video.
                </div>
              </div>
              <button
                onClick={() => { if (onVideoReady) onVideoReady(null); }}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: `1px solid ${T.accentGreen}50`,
                  background: T.accentGreen + "14",
                  color: T.accentGreen, fontSize: 11,
                  fontFamily: "inherit", cursor: "pointer",
                  fontWeight: 700, letterSpacing: "0.04em",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.accentGreen + "28";
                  e.currentTarget.style.borderColor = T.accentGreen + "90";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = T.accentGreen + "14";
                  e.currentTarget.style.borderColor = T.accentGreen + "50";
                }}
              >
                Go to Videos &rarr;
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && !running && (
            <div style={{
              padding: "13px 16px", borderRadius: 12,
              background: T.accentRed + "08",
              border: `1px solid ${T.accentRed}35`,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.accentRed, marginBottom: 4 }}>
                    Pipeline error
                  </div>
                  <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>{error}</div>
                </div>
                <button
                  onClick={() => { setError(""); setDone(false); }}
                  style={{
                    padding: "6px 14px", borderRadius: 7,
                    border: `1px solid ${T.accentRed}40`,
                    background: `${T.accentRed}10`,
                    color: T.accentRed, fontSize: 10,
                    fontFamily: "inherit", cursor: "pointer",
                    letterSpacing: "0.06em", flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${T.accentRed}22`;
                    e.currentTarget.style.borderColor = `${T.accentRed}80`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${T.accentRed}10`;
                    e.currentTarget.style.borderColor = `${T.accentRed}40`;
                  }}
                >
                  RETRY
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL — Options ═══════════════════════════════════════════ */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 14,
          overflowY: "auto", maxHeight: "calc(100vh - 160px)",
          paddingRight: 2,
        }}>

          {/* Running status toast at top of right panel */}
          {running && (
            <div style={{
              padding: "9px 14px", borderRadius: 9,
              background: T.accent + "10",
              border: `1px solid ${T.accent}35`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: T.accent, flexShrink: 0,
                animation: "statusPulse 1s ease-in-out infinite",
              }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: "0.05em" }}>
                  {currentStepLabel || "PROCESSING"}
                </div>
                <div style={{ fontSize: 9, color: T.textFaint, marginTop: 1 }}>
                  {STEP_LABELS[pipeStep] || ""}
                </div>
              </div>
            </div>
          )}

          {/* Visual mood */}
          <div style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "14px 14px",
          }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                AMBIENCE
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}>
              {MOODS.map((v) => <MoodCard key={String(v.id)} v={v} />)}
            </div>
          </div>

          {/* Background music */}
          <div style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "14px 14px",
          }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
              BACKGROUND MUSIC
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              {MUSIC.map((m) => <MusicCard key={m.id} m={m} />)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 9, color: T.textFaint, flexShrink: 0, letterSpacing: "0.08em" }}>VOL</div>
              <input type="range" min={0} max={0.5} step={0.01}
                value={musicVolume}
                onChange={e => setMusicVolume(parseFloat(e.target.value))}
                disabled={running}
                style={{ flex: 1, accentColor: T.accentGreen, cursor: "pointer" }}
              />
              <div style={{ fontSize: 9, color: T.textFaint, width: 28, textAlign: "right" }}>{Math.round(musicVolume * 100)}%</div>
            </div>
          </div>

          {/* Generate / Cancel buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={running || wordCount < 50}
              style={{
                width: "100%", padding: "15px",
                borderRadius: 10, border: "none",
                background:
                  running || wordCount < 50
                    ? T.border
                    : `linear-gradient(135deg, ${T.accent} 0%, #a060ff 100%)`,
                color: running || wordCount < 50 ? T.textFaint : "#fff",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700, fontSize: 13,
                letterSpacing: "0.1em",
                cursor: running || wordCount < 50 ? "not-allowed" : "pointer",
                transition: "opacity 0.15s, background 0.3s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
              onMouseEnter={(e) => {
                if (!running && wordCount >= 50) e.currentTarget.style.opacity = "0.88";
              }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {running ? (
                <>
                  <span style={{
                    display: "inline-block",
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    animation: "spin 0.7s linear infinite",
                    flexShrink: 0,
                  }} />
                  GENERATING...
                </>
              ) : (
                <>
                  ▶ GENERATE VIDEO
                </>
              )}
            </button>

            {running && (
              <button
                onClick={handleCancel}
                style={{
                  width: "100%", padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${T.accentRed}45`,
                  background: `${T.accentRed}0a`,
                  color: T.accentRed, fontFamily: "inherit",
                  fontSize: 11, letterSpacing: "0.08em",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${T.accentRed}20`;
                  e.currentTarget.style.borderColor = `${T.accentRed}80`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${T.accentRed}0a`;
                  e.currentTarget.style.borderColor = `${T.accentRed}45`;
                }}
              >
                ✕ CANCEL
              </button>
            )}

            {wordCount < 50 && !running && (
              <div style={{ fontSize: 10, color: T.textFaint, textAlign: "center" }}>
                Add at least {50 - wordCount} more word{50 - wordCount !== 1 ? "s" : ""} to generate
              </div>
            )}
          </div>

          {/* How it works (hidden while running) */}
          {!running && !done && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: "14px 14px",
            }}>
              <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 12 }}>
                HOW IT WORKS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "✍", title: "You write the script", body: "Paste or type your narration. Any length — 1 min or 10 mins." },
                  { icon: "🎨", title: "Looping visual generated", body: "A beautiful animated background loops for the full duration." },
                  { icon: "🎵", title: "Music + voice mixed", body: "Narration plays over the visual with background music under it." },
                ].map((item) => (
                  <div key={item.title} style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: 10, background: T.bgDeep,
                    borderRadius: 9, border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, color: T.text, fontWeight: 600, marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: T.textMid, lineHeight: 1.55 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global keyframe injections */}
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Purple fluid variant */
        .fluid-purple { background: #080012; }
        .fluid-purple .fluid-blob:nth-child(1) {
          background: radial-gradient(circle, #2a0060 0%, transparent 70%);
          top: 7%; left: 19%;
          animation: fluid1 14s ease-in-out infinite;
        }
        .fluid-purple .fluid-blob:nth-child(2) {
          background: radial-gradient(circle, #1a0045 0%, transparent 70%);
          top: 29%; left: 42%;
          animation: fluid2 10s ease-in-out infinite;
        }
        .fluid-purple .fluid-blob:nth-child(3) {
          background: radial-gradient(circle, #0d0025 0%, transparent 70%);
          top: 50%; left: 7%;
          animation: fluid3 8s ease-in-out infinite;
        }
        /* Gold/ember fluid variant */
        .fluid-gold { background: #0a0400; }
        .fluid-gold .fluid-blob:nth-child(1) {
          background: radial-gradient(circle, #4a2000 0%, transparent 70%);
          top: 7%; left: 19%;
          animation: fluid1 13s ease-in-out infinite;
        }
        .fluid-gold .fluid-blob:nth-child(2) {
          background: radial-gradient(circle, #301500 0%, transparent 70%);
          top: 29%; left: 42%;
          animation: fluid2 9s ease-in-out infinite;
        }
        .fluid-gold .fluid-blob:nth-child(3) {
          background: radial-gradient(circle, #1a0b00 0%, transparent 70%);
          top: 50%; left: 7%;
          animation: fluid3 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
