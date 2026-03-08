/**
 * Script Studio
 * A separate pipeline where you write the script yourself.
 * Generates: looping visual + background music + your narration → final video.
 */
import { useRef, useState } from "react";
import api from "../api/client";

const PROFILES = [
  { id: "funny", emoji: "😄", label: "Funny", desc: "Comedy & viral" },
  { id: "serious", emoji: "🎯", label: "Serious", desc: "Documentary style" },
  {
    id: "educational",
    emoji: "🧠",
    label: "Educational",
    desc: "Explainer & facts",
  },
  {
    id: "inspirational",
    emoji: "🔥",
    label: "Inspirational",
    desc: "Motivational",
  },
];

const MOODS = [
  {
    id: null,
    emoji: "🎯",
    label: "Auto",
    desc: "Matches your topic",
    aurora: null,
  },
  {
    id: "ocean",
    emoji: "🌊",
    label: "Ocean & Water",
    desc: "Waves, sea, calm water",
    aurora: null,
  },
  {
    id: "candle",
    emoji: "🕯️",
    label: "Candle & Firelight",
    desc: "Warm flame, dark backdrop",
    aurora: null,
  },
  {
    id: "forest",
    emoji: "🌲",
    label: "Forest & Nature",
    desc: "Light rays, misty trees",
    aurora: null,
  },
  {
    id: "stars",
    emoji: "🌌",
    label: "Night Sky & Stars",
    desc: "Milky way, starfield",
    aurora: "dark",
  },
  {
    id: "hands",
    emoji: "🤝",
    label: "Hands & People",
    desc: "Human connection, warmth",
    aurora: null,
  },
  {
    id: "mountains",
    emoji: "⛰️",
    label: "Mountains & Fog",
    desc: "Dramatic peaks, mist",
    aurora: null,
  },
  {
    id: "aurora_blue",
    emoji: "🌌",
    label: "Aurora Blue",
    desc: "Glowing blue light waves",
    aurora: "blue",
  },
  {
    id: "aurora_dark",
    emoji: "🖤",
    label: "Aurora Dark",
    desc: "Deep obsidian black waves",
    aurora: "dark",
  },
];

const MUSIC = [
  { id: "none", emoji: "🔇", label: "No Music", desc: "Voice only" },
  { id: "ambient", emoji: "🌙", label: "Ambient", desc: "Calm & atmospheric" },
  { id: "piano", emoji: "🎹", label: "Solo Piano", desc: "Gentle & intimate" },
  { id: "violin", emoji: "🎻", label: "Solo Violin", desc: "Warm & emotional" },
  { id: "cinematic", emoji: "🎬", label: "Cinematic", desc: "Epic & dramatic" },
  { id: "lofi", emoji: "🎵", label: "Lo-Fi Beats", desc: "Chill background" },
  { id: "upbeat", emoji: "🥁", label: "Upbeat", desc: "Energetic & punchy" },
];

const PIPE_STEPS = [
  "Script",
  "Voice",
  "Visuals",
  "Music",
  "Assemble",
  "Upload",
];

export default function ScriptStudio({ T, showToast }) {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [profile, setProfile] = useState("educational");
  const [mood, setMood] = useState(null); // null = auto-detect from topic
  const [music, setMusic] = useState("ambient");
  const [running, setRunning] = useState(false);
  const [pipeStep, setPipeStep] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estMins = Math.round(wordCount / 140); // ~140 wpm narration

  const handleGenerate = async () => {
    if (!title.trim()) {
      showToast("Please enter a title", "error");
      return;
    }
    if (wordCount < 50) {
      showToast("Script needs at least 50 words", "error");
      return;
    }

    setRunning(true);
    setError("");
    setPipeStep(1);

    try {
      const { data } = await api.post("/script-studio/generate", {
        title: title.trim(),
        script: script.trim(),
        profile,
        visual_mood: mood,
        music_style: music,
      });
      setJobId(data.video_id);
      showToast("Script pipeline started!");

      // Poll for progress
      pollRef.current = setInterval(async () => {
        try {
          const { data: status } = await api.get(`/videos/${data.video_id}`);
          const stepMap = {
            generating: 1,
            scripted: 2,
            voiced: 3,
            assembled: 4,
            captioned: 5,
            labeled: 5,
            ready: 6,
            posted: 6,
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
              showToast("Script video ready! Check Videos tab.");
            }
          }
        } catch (e) {
          /* ignore poll errors */
        }
      }, 4000);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to start pipeline");
      setRunning(false);
      setPipeStep(0);
      showToast("Failed to start", "error");
    }
  };

  const handleStop = () => {
    clearInterval(pollRef.current);
    setRunning(false);
    setPipeStep(0);
    setJobId(null);
    showToast("Cancelled");
  };

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16 }}>
        <div
          style={{
            fontFamily: "'Syne',sans-serif",
            fontWeight: 800,
            fontSize: 22,
            color: T.text,
            letterSpacing: "-0.01em",
          }}
        >
          ✍ Script Studio
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.textMid,
            marginTop: 4,
            lineHeight: 1.6,
          }}
        >
          Write your own script → choose a looping visual + background music →
          generate a long-form video. No AI script generation — your words, your
          story.
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* LEFT — Script editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label
              style={{
                fontSize: 10,
                color: T.textFaint,
                letterSpacing: "0.1em",
                display: "block",
                marginBottom: 6,
              }}
            >
              VIDEO TITLE
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Stoic's Guide to Inner Peace"
              maxLength={80}
              disabled={running}
              style={{
                width: "100%",
                background: T.inputBg,
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                padding: "10px 14px",
                color: T.text,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />
          </div>

          {/* Script textarea */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <label
                style={{
                  fontSize: 10,
                  color: T.textFaint,
                  letterSpacing: "0.1em",
                }}
              >
                YOUR SCRIPT
              </label>
              <span
                style={{
                  fontSize: 10,
                  color: wordCount >= 50 ? T.accentGreen : T.textFaint,
                }}
              >
                {wordCount} words · ~{estMins < 1 ? "<1" : estMins} min
              </span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={
                "Write your full narration script here.\n\nTip: Write naturally as if speaking. Use line breaks between sections.\nAim for 700+ words for a 5-minute video, 1400+ for 10 minutes.\n\nThe AI will handle timing, captions, and visual sync automatically."
              }
              rows={18}
              disabled={running}
              style={{
                width: "100%",
                background: T.inputBg,
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                padding: "12px 14px",
                color: T.text,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.7,
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 5 }}>
              ~140 words = 1 minute · 700 words = 5 min · 1400 words = 10 min
            </div>
          </div>
        </div>

        {/* RIGHT — Options panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Content profile */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: T.textFaint,
                letterSpacing: "0.1em",
                marginBottom: 10,
              }}
            >
              CONTENT PROFILE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  disabled={running}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${profile === p.id ? T.accent + "60" : T.border}`,
                    background:
                      profile === p.id ? T.accent + "12" : "transparent",
                    color: profile === p.id ? T.accent : T.textMid,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 9, color: T.textFaint }}>
                      {p.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visual mood */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: T.textFaint,
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              VISUAL MOOD
            </div>
            <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 10 }}>
              Real stock footage matched to your topic
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {MOODS.map((v) => (
                <button
                  key={String(v.id)}
                  onClick={() => setMood(v.id)}
                  disabled={running}
                  style={{
                    position: "relative",
                    padding: "8px 10px",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${mood === v.id ? "#a060ff60" : T.border}`,
                    background:
                      v.aurora === "dark"
                        ? "#080810"
                        : mood === v.id
                          ? "#a060ff12"
                          : "transparent",
                    color:
                      mood === v.id ? "#a060ff" : v.aurora ? "#fff" : T.textMid,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Aurora background if applicable */}
                  {v.aurora && (
                    <div
                      className={`aurora-wrap aurora-${v.aurora}`}
                      style={{ opacity: mood === v.id ? 1 : 0.6 }}
                    >
                      <div className="aurora-band" />
                      <div className="aurora-band" />
                      <div className="aurora-band" />
                    </div>
                  )}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>
                      {v.emoji}
                    </div>
                    <div
                      style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}
                    >
                      {v.label}
                    </div>
                    <div style={{ fontSize: 9, opacity: 0.7 }}>{v.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Background music */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: T.textFaint,
                letterSpacing: "0.1em",
                marginBottom: 10,
              }}
            >
              BACKGROUND MUSIC
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {MUSIC.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMusic(m.id)}
                  disabled={running}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 7,
                    border: `1px solid ${music === m.id ? T.accentGreen + "60" : T.border}`,
                    background:
                      music === m.id ? T.accentGreen + "10" : "transparent",
                    color: music === m.id ? T.accentGreen : T.textMid,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{m.emoji}</span>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      {m.label}
                    </span>
                    <span
                      style={{ fontSize: 9, color: T.textFaint, marginLeft: 6 }}
                    >
                      {m.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {!running ? (
            <button
              onClick={handleGenerate}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                background: `linear-gradient(135deg, ${T.accent}, #a060ff)`,
                color: "white",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              ▶ GENERATE VIDEO
            </button>
          ) : (
            <button
              onClick={handleStop}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: `1px solid ${T.accentRed}40`,
                background: `${T.accentRed}0d`,
                color: T.accentRed,
                fontFamily: "inherit",
                fontSize: 12,
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              ✕ CANCEL
            </button>
          )}
        </div>
      </div>

      {/* Pipeline progress */}
      {running && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.textFaint,
              letterSpacing: "0.1em",
              marginBottom: 14,
            }}
          >
            PIPELINE PROGRESS
          </div>
          <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
            {PIPE_STEPS.map((step, i) => {
              const done = i + 1 < pipeStep;
              const active = i + 1 === pipeStep;
              return (
                <div
                  key={step}
                  style={{ display: "flex", alignItems: "center", flex: 1 }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        background: done
                          ? T.accentGreen
                          : active
                            ? T.accent
                            : T.bgDeep,
                        color: done || active ? "white" : T.textFaint,
                        border: active ? `2px solid ${T.accent}` : "none",
                        transition: "all 0.4s",
                        boxShadow: active ? `0 0 12px ${T.accent}60` : "none",
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: active
                          ? T.accent
                          : done
                            ? T.accentGreen
                            : T.textFaint,
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.toUpperCase()}
                    </div>
                  </div>
                  {i < PIPE_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        background: done ? T.accentGreen : T.border,
                        margin: "0 4px",
                        marginBottom: 22,
                        transition: "background 0.4s",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: T.textMid,
              textAlign: "center",
            }}
          >
            {pipeStep === 1 && "🎙 Synthesizing voice narration..."}
            {pipeStep === 2 && "🎨 Generating looping visual..."}
            {pipeStep === 3 && "🎵 Mixing background music..."}
            {pipeStep === 4 && "🎬 Assembling final video..."}
            {pipeStep === 5 && "📝 Burning captions..."}
            {pipeStep === 6 && "✅ Done! Check your Videos tab."}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: `${T.accentRed}08`,
            border: `1px solid ${T.accentRed}30`,
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 12,
            color: T.accentRed,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* How it works */}
      {!running && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.textFaint,
              letterSpacing: "0.1em",
              marginBottom: 12,
            }}
          >
            HOW IT WORKS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                step: "1",
                icon: "✍",
                title: "You write the script",
                body: "Paste or type your narration. Any length — 1 min or 10 mins.",
              },
              {
                step: "2",
                icon: "🎨",
                title: "Looping visual generated",
                body: "A calm, beautiful animation loops for the full duration. No stock footage.",
              },
              {
                step: "3",
                icon: "🎵",
                title: "Music + voice mixed",
                body: "Your narration plays over the visual with background music under it.",
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  padding: 12,
                  background: T.bgDeep,
                  borderRadius: 9,
                  border: `1px solid ${T.border}`,
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.text,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}
                >
                  {item.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
