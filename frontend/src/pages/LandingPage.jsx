import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import lifeLogoLong from "../assets/logo/life-logo-long.png";
import freedomImg from "../assets/static/freedom.jpg";
import jajja2 from "../assets/static/jajja2.jpg";
import metrixVideo from "../assets/static/metrix.mp4";
import nebularVideo from "../assets/static/nebular.mp4";
import faceImg from "../assets/static/relaxedface.png";
import sea_shower from "../assets/static/sea_shower.mp4";

const SOCIAL = {
  youtube: "https://www.youtube.com/@4life_mystery",
  tiktok: "https://www.tiktok.com/@lifemystery183284",
  spotify: "https://open.spotify.com/show/31b1tuqETLGjz0Oq6oqE8d",
};
const SPOTIFY_SHOW_ID = "31b1tuqETLGjz0Oq6oqE8d";

const SECTIONS = [
  { id: "hero", label: "HOME" },
  { id: "about", label: "ABOUT" },
  { id: "content", label: "CONTENT" },
  { id: "videos", label: "VIDEOS" },
  { id: "podcast", label: "PODCAST" },
  { id: "topics", label: "TOPICS" },
  { id: "community", label: "COMMUNITY" },
];

const CAROUSEL = [
  {
    id: 1,
    platform: "YOUTUBE",
    icon: "▶",
    color: "#ff5533",
    title: "Why Does Life Feel Meaningless?",
    excerpt:
      "An honest exploration of existential emptiness and what it's actually trying to tell you.",
    tag: "Existence",
    link: SOCIAL.youtube,
  },
  {
    id: 2,
    platform: "TIKTOK",
    icon: "♪",
    color: "#00f2ea",
    title: "The 60-Second Truth About Fear",
    excerpt:
      "Fear isn't your enemy. It's a signal. Here's how to read it before it controls you.",
    tag: "Mental Health",
    link: SOCIAL.tiktok,
  },
  {
    id: 3,
    platform: "PODCAST",
    icon: "◎",
    color: "#1db954",
    title: "Connection in a Disconnected World",
    excerpt: "Why modern life made us more reachable but less truly reached.",
    tag: "Relationships",
    link: SOCIAL.spotify,
  },
  {
    id: 4,
    platform: "YOUTUBE",
    icon: "▶",
    color: "#ff5533",
    title: "The Mystery of Consciousness",
    excerpt:
      "What is it that makes you *you*? This question has haunted philosophers for centuries.",
    tag: "Philosophy",
    link: SOCIAL.youtube,
  },
];

const TOPICS = [
  { name: "Identity & Purpose", icon: "◈", count: 24 },
  { name: "Mental Health", icon: "◎", count: 18 },
  { name: "Relationships", icon: "◇", count: 31 },
  { name: "Mortality & Meaning", icon: "◉", count: 15 },
  { name: "Consciousness", icon: "◐", count: 12 },
  { name: "Spirituality", icon: "◑", count: 20 },
  { name: "Philosophy", icon: "◒", count: 27 },
  { name: "Society & Culture", icon: "◓", count: 22 },
];

// ── Theme tokens ──────────────────────────────────────────────────────────────
const DARK = {
  bg: "#03060f",
  bgAlt: "rgba(255,255,255,0.012)",
  text: "#e0eaf5",
  textM: "#8ab0cc",
  textD: "#5a8aaa",
  textD2: "#2e5a7a",
  cardBg: "rgba(255,255,255,0.06)",
  cardBr: "rgba(255,255,255,0.13)",
  cardSh: "none",
  navBg: "rgba(3,6,15,0.82)",
  secBr: "rgba(255,255,255,0.045)",
  footBg: "rgba(0,0,0,0.55)",
  ftLink: "#8ab8d4",
  inputBg: "rgba(255,255,255,0.03)",
  inputBr: "rgba(255,255,255,0.07)",
  socBr: "rgba(255,255,255,0.08)",
  togBg: "rgba(255,255,255,0.06)",
  togBr: "rgba(255,255,255,0.1)",
  togText: "#4a6a8a",
};

function BlogSection({ c, theme }) {
  const FP_KEY = "blog_fp";
  const getOrCreateFP = () => {
    let fp = localStorage.getItem(FP_KEY);
    if (!fp) {
      fp = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem(FP_KEY, fp);
    }
    return fp;
  };

  const [comments, setComments] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", content: "" });
  const [formError, setFormError] = React.useState("");
  const [formSuccess, setFormSuccess] = React.useState("");
  const [likingId, setLikingId] = React.useState(null);
  const [replyForm, setReplyForm] = React.useState(null); // comment id with open reply form
  const [replyData, setReplyData] = React.useState({}); // { [commentId]: { name, content, submitting, error, success } }
  const [openReplies, setOpenReplies] = React.useState(new Set());
  const [pendingComment, setPendingComment] = React.useState(null); // optimistic placeholder

  const fp = getOrCreateFP();

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/comments?page=${p}&limit=20&fp=${fp}`);
      const data = await res.json();
      setComments(data.comments || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load(1);
  }, []); // eslint-disable-line

  const handleSubmit = async () => {
    setFormError("");
    setFormSuccess("");
    if (!form.name.trim() || !form.content.trim()) {
      setFormError("Name and comment are required.");
      return;
    }
    if (form.content.trim().length < 5) {
      setFormError("Comment too short.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fingerprint: fp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.detail || "Submission failed.");
        return;
      }
      setFormSuccess("✓ Submitted! Your comment will appear after review.");
      setPendingComment({
        name: form.name,
        content: form.content,
        _pending: true,
      });
      setForm({ name: "", email: "", content: "" });
    } catch (e) {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId) => {
    if (likingId) return;
    setLikingId(commentId);
    try {
      const res = await fetch(`/api/blog/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId)
              return {
                ...c,
                likes_count: data.likes_count,
                liked_by_me: data.liked,
              };
            if (c.replies?.some((r) => r.id === commentId)) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId
                    ? {
                        ...r,
                        likes_count: data.likes_count,
                        liked_by_me: data.liked,
                      }
                    : r,
                ),
              };
            }
            return c;
          }),
        );
      }
    } catch (e) {
    } finally {
      setLikingId(null);
    }
  };

  const handleReplySubmit = async (commentId) => {
    const rd = replyData[commentId] || {};
    if (!rd.name?.trim() || !rd.content?.trim()) return;
    setReplyData((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], submitting: true, error: "" },
    }));
    try {
      const res = await fetch(`/api/blog/comments/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rd.name,
          content: rd.content,
          fingerprint: fp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReplyData((prev) => ({
          ...prev,
          [commentId]: {
            ...prev[commentId],
            submitting: false,
            error: data.detail || "Submission failed.",
          },
        }));
        return;
      }
      setReplyData((prev) => ({
        ...prev,
        [commentId]: {
          name: "",
          content: "",
          submitting: false,
          error: "",
          success: "✓ Reply submitted for review.",
        },
      }));
      setReplyForm(null);
      // append a pending reply placeholder so it's immediately visible
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                replies: [
                  ...(c.replies || []),
                  {
                    id: `pending-${Date.now()}`,
                    name: rd.name,
                    content: rd.content,
                    created_at: new Date().toISOString(),
                    _pending: true,
                  },
                ],
              }
            : c,
        ),
      );
    } catch (e) {
      setReplyData((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          submitting: false,
          error: "Network error.",
        },
      }));
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isDark = theme === "dark";
  const inputSt = {
    padding: "10px 13px",
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    border: `1px solid ${c.cardBr}`,
    borderRadius: 9,
    color: c.text,
    fontFamily: "inherit",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div style={{ margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 10, color: c.textD, letterSpacing: "0.16em" }}>
          DISCUSSION · {total} COMMENT{total !== 1 ? "S" : ""}
        </span>
      </div>

      {/* Comments list — scrollable */}
      <div style={{ maxHeight: "80vh", overflowY: "auto", paddingRight: 4 }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: c.textD,
              letterSpacing: "0.1em",
              fontSize: 11,
            }}
          >
            LOADING…
          </div>
        ) : comments.length === 0 && !pendingComment ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: c.textD,
              fontSize: 12,
              letterSpacing: "0.1em",
            }}
          >
            BE THE FIRST TO COMMENT
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Pending placeholder */}
            {pendingComment && (
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background: c.cardBg,
                  border: `1px solid ${c.cardBr}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  opacity: 0.75,
                }}
              >
                <div
                  style={{
                    filter: "blur(3px)",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "rgba(255,80,30,0.12)",
                        border: "1px solid rgba(255,80,30,0.2)",
                      }}
                    />
                    <div
                      style={{
                        width: 100,
                        height: 13,
                        background: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.08)",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      height: 12,
                      background: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderRadius: 5,
                      marginBottom: 6,
                      width: "88%",
                    }}
                  />
                  <div
                    style={{
                      height: 12,
                      background: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderRadius: 5,
                      width: "65%",
                    }}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "#ff7755",
                      letterSpacing: "0.12em",
                      fontWeight: 600,
                    }}
                  >
                    PENDING REVIEW
                  </span>
                  <span style={{ fontSize: 10, color: c.textD }}>
                    Your comment will appear once approved.
                  </span>
                </div>
              </div>
            )}

            {comments.map((comment) => (
              <div key={comment.id}>
                {/* Main comment — compact */}
                <div
                  style={{
                    background: c.cardBg,
                    border: `1px solid ${c.cardBr}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    boxShadow: c.cardSh,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `hsl(${(comment.name.charCodeAt(0) * 13) % 360},48%,32%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                        fontFamily: "'Syne',sans-serif",
                      }}
                    >
                      {comment.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 5,
                        }}
                      >
                        <span
                          className="syne"
                          style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color: c.text,
                          }}
                        >
                          {comment.name}
                        </span>
                        <span style={{ fontSize: 10, color: c.textM }}>
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      {/* Body */}
                      <p
                        style={{
                          fontSize: 12,
                          color: c.textM,
                          lineHeight: 1.7,
                          margin: 0,
                          marginBottom: 10,
                        }}
                      >
                        {comment.content}
                      </p>
                      {/* Action row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        <button
                          onClick={() => handleLike(comment.id)}
                          disabled={likingId === comment.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: comment.liked_by_me ? "#ff5533" : c.textM,
                            fontSize: 11,
                            fontFamily: "inherit",
                            padding: 0,
                            transition: "color 0.2s",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>
                            {comment.liked_by_me ? "♥" : "♡"}
                          </span>
                          <span>{comment.likes_count}</span>
                        </button>
                        <button
                          onClick={() => {
                            setReplyForm(
                              replyForm === comment.id ? null : comment.id,
                            );
                            setReplyData((p) => ({
                              ...p,
                              [comment.id]: p[comment.id] || {
                                name: "",
                                content: "",
                              },
                            }));
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color:
                              replyForm === comment.id ? "#ff6644" : c.textM,
                            fontSize: 11,
                            fontFamily: "inherit",
                            padding: 0,
                            transition: "color 0.2s",
                          }}
                        >
                          ↩ {replyForm === comment.id ? "CANCEL" : "REPLY"}
                        </button>
                      </div>
                    </div>
                    {/* Replies toggle badge */}
                    {comment.replies?.length > 0 && (
                      <button
                        onClick={() =>
                          setOpenReplies((prev) => {
                            const s = new Set(prev);
                            s.has(comment.id)
                              ? s.delete(comment.id)
                              : s.add(comment.id);
                            return s;
                          })
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          marginTop: 8,
                          background: "none",
                          border: `1px solid ${c.secBr}`,
                          borderRadius: 20,
                          padding: "3px 10px",
                          cursor: "pointer",
                          color: openReplies.has(comment.id)
                            ? "#ff6633"
                            : c.textM,
                          fontSize: 10,
                          fontFamily: "inherit",
                          transition: "color 0.2s, border-color 0.2s",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <span style={{ fontSize: 11 }}>
                          {openReplies.has(comment.id) ? "▴" : "▾"}
                        </span>
                        {comment.replies.length}{" "}
                        {comment.replies.length === 1 ? "reply" : "replies"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline reply form — indented */}
                {replyForm === comment.id && (
                  <div
                    style={{
                      marginLeft: 42,
                      marginTop: 6,
                      background: c.cardBg,
                      border: `1px solid ${c.cardBr}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        placeholder="Your name *"
                        value={replyData[comment.id]?.name || ""}
                        onChange={(e) =>
                          setReplyData((p) => ({
                            ...p,
                            [comment.id]: {
                              ...p[comment.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        style={{ ...inputSt, fontSize: 11 }}
                      />
                      <input
                        placeholder="Email (optional)"
                        value={replyData[comment.id]?.email || ""}
                        onChange={(e) =>
                          setReplyData((p) => ({
                            ...p,
                            [comment.id]: {
                              ...p[comment.id],
                              email: e.target.value,
                            },
                          }))
                        }
                        style={{ ...inputSt, fontSize: 11 }}
                      />
                    </div>
                    <textarea
                      placeholder="Write a reply…"
                      rows={2}
                      value={replyData[comment.id]?.content || ""}
                      onChange={(e) =>
                        setReplyData((p) => ({
                          ...p,
                          [comment.id]: {
                            ...p[comment.id],
                            content: e.target.value,
                          },
                        }))
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        ...inputSt,
                        fontSize: 11,
                        resize: "vertical",
                        marginBottom: 8,
                      }}
                    />
                    {replyData[comment.id]?.error && (
                      <div
                        style={{
                          color: "#ff6060",
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        ⚠ {replyData[comment.id].error}
                      </div>
                    )}
                    {replyData[comment.id]?.success && (
                      <div
                        style={{
                          color: "#1db954",
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        {replyData[comment.id].success}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={() => setReplyForm(null)}
                        style={{
                          padding: "6px 12px",
                          background: "transparent",
                          border: `1px solid ${c.cardBr}`,
                          borderRadius: 6,
                          color: c.textM,
                          fontSize: 10,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={() => handleReplySubmit(comment.id)}
                        disabled={replyData[comment.id]?.submitting}
                        style={{
                          padding: "6px 14px",
                          background: "linear-gradient(135deg,#cc2200,#ff5533)",
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          opacity: replyData[comment.id]?.submitting ? 0.6 : 1,
                        }}
                      >
                        {replyData[comment.id]?.submitting
                          ? "SENDING…"
                          : "POST REPLY →"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies — visible only when toggled open */}
                {comment.replies?.length > 0 && openReplies.has(comment.id) && (
                  <div
                    style={{
                      marginLeft: 42,
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        style={{
                          display: "flex",
                          borderRadius: "1rem",
                          gap: 9,
                          padding: "10px 14px",
                          borderLeft: `2px solid ${reply.is_admin_reply ? "rgba(255,80,30,0.35)" : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
                          opacity: reply._pending ? 0.65 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              marginBottom: 3,
                            }}
                          >
                            <span
                              className="syne"
                              style={{
                                fontWeight: 700,
                                fontSize: 11,
                                color: reply.is_admin_reply
                                  ? "#ff7755"
                                  : c.text,
                              }}
                            >
                              {reply.name}
                            </span>
                            {reply.is_admin_reply && (
                              <span
                                style={{
                                  fontSize: 8,
                                  background: "rgba(255,80,30,0.15)",
                                  color: "#ff7755",
                                  padding: "1px 5px",
                                  borderRadius: 8,
                                  letterSpacing: "0.08em",
                                }}
                              >
                                CREATOR
                              </span>
                            )}
                            {reply._pending && (
                              <span
                                style={{
                                  fontSize: 8,
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#f59e0b",
                                  padding: "1px 5px",
                                  borderRadius: 8,
                                  letterSpacing: "0.08em",
                                }}
                              >
                                PENDING
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: c.textM }}>
                              {formatDate(reply.created_at)}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 12,
                              color: c.textM,
                              lineHeight: 1.65,
                              margin: 0,
                              marginBottom: reply._pending ? 0 : 6,
                            }}
                          >
                            {reply.content}
                          </p>
                          {!reply._pending && (
                            <button
                              onClick={() => handleLike(reply.id)}
                              disabled={likingId === reply.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: reply.liked_by_me ? "#ff5533" : c.textM,
                                fontSize: 10,
                                fontFamily: "inherit",
                                padding: 0,
                                transition: "color 0.2s",
                              }}
                            >
                              <span style={{ fontSize: 11 }}>
                                {reply.liked_by_me ? "♥" : "♡"}
                              </span>
                              <span>{reply.likes_count || 0}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {total > 20 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 8,
                  paddingBottom: 8,
                }}
              >
                {page > 1 && (
                  <button
                    onClick={() => load(page - 1)}
                    style={{
                      padding: "7px 16px",
                      background: "transparent",
                      border: `1px solid ${c.cardBr}`,
                      borderRadius: 8,
                      color: c.textM,
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    ← PREV
                  </button>
                )}
                {page * 20 < total && (
                  <button
                    onClick={() => load(page + 1)}
                    style={{
                      padding: "7px 16px",
                      background: "transparent",
                      border: `1px solid ${c.cardBr}`,
                      borderRadius: 8,
                      color: c.textM,
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    NEXT →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit form */}
      <div
        style={{
          background: c.cardBg,
          border: `1px solid ${c.cardBr}`,
          borderRadius: 14,
          padding: "22px 22px 18px",
          marginTop: 32,
          boxShadow: c.cardSh,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: c.textM,
            letterSpacing: "0.1em",
            marginBottom: 16,
          }}
        >
          LEAVE A COMMENT
        </div>
        <div className="comment-name-row">
          <input
            placeholder="Your name *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            style={inputSt}
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            style={inputSt}
          />
        </div>
        <textarea
          placeholder="Share your thoughts, questions, or feedback…"
          value={form.content}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            ...inputSt,
            resize: "vertical",
            marginBottom: 10,
          }}
        />
        {formError && (
          <div style={{ color: "#ff6060", fontSize: 11, marginBottom: 8 }}>
            ⚠ {formError}
          </div>
        )}
        {formSuccess && (
          <div style={{ color: "#1db954", fontSize: 11, marginBottom: 8 }}>
            {formSuccess}
          </div>
        )}
        <div className="comment-submit-row">
          <span style={{ fontSize: 10, color: c.textD }}>
            Comments are reviewed before appearing.
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="comment-submit-btn"
            style={{
              padding: "9px 20px",
              background: "linear-gradient(135deg,#cc2200,#ff5533)",
              border: "none",
              borderRadius: 9,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "SENDING…" : "POST COMMENT →"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SPOTIFY_EPISODES = [
  "5DpHjy5bOOd1ZZQALXq4t6",
  "6svduQn5OIwQKcWabqqpqM",
  "0J2o5s1kRuau8Uv0LEyOZx",
  "0utHEhxB5DjNBCCPsLw7jk",
];

function SpotifyCarousel() {
  const total = SPOTIFY_EPISODES.length;
  const [idx, setIdx] = useState(0);
  // Track which slides have had their iframe initialised — once added, never removed (no remount)
  const [loaded, setLoaded] = useState(() => new Set([0, 1, total - 1]));
  const timerRef = useRef(null);

  const _activate = (next) => {
    setLoaded((prev) => {
      const s = new Set(prev);
      s.add(next);
      s.add((next + 1) % total);
      s.add((next - 1 + total) % total);
      return s;
    });
    setIdx(next);
  };

  const goTo = (n) => {
    clearInterval(timerRef.current);
    _activate(((n % total) + total) % total);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % total;
        _activate(next);
        return next;
      });
    }, 12000);
    return () => clearInterval(timerRef.current);
  }, [total]);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .sp-track { display:flex; transition:transform 0.6s cubic-bezier(0.4,0,0.2,1); will-change:transform; }
        .sp-slide  { flex:0 0 100%; min-width:0; }
        .sp-placeholder { height:352px; background:rgba(3,6,15,0.85); }
      `}</style>

      <div style={{ overflow: "hidden", borderRadius: 16 }}>
        <div
          className="sp-track"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {SPOTIFY_EPISODES.map((episodeId, i) => (
            <div key={episodeId} className="sp-slide">
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(29,185,84,0.25)",
                  boxShadow:
                    "0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(29,185,84,0.08)",
                  background: "rgba(3,6,15,0.85)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                {loaded.has(i) ? (
                  <iframe
                    src={`https://open.spotify.com/embed/episode/${episodeId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="352"
                    style={{ border: "none", display: "block" }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    title="4Life Mystery Podcast Episode"
                  />
                ) : (
                  <div className="sp-placeholder" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
        }}
      >
        <button
          onClick={() => goTo(idx - 1)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(29,185,84,0.6)",
            fontSize: 18,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ‹
        </button>
        {SPOTIFY_EPISODES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === idx ? 20 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: i === idx ? "#1db954" : "rgba(255,255,255,0.18)",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.3s, background 0.3s",
            }}
          />
        ))}
        <button
          onClick={() => goTo(idx + 1)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(29,185,84,0.6)",
            fontSize: 18,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

const BUZZSPROUT_PODCAST_ID = "2603264";

function BuzzsproutPlayer({ size = "large" }) {
  const containerId = `buzzsprout-player-${size}-${BUZZSPROUT_PODCAST_ID}`;
  useEffect(() => {
    // Inject Buzzsprout script dynamically (safe re-injection)
    const existing = document.getElementById(containerId);
    if (existing) existing.innerHTML = "";
    const script = document.createElement("script");
    script.src = `https://www.buzzsprout.com/${BUZZSPROUT_PODCAST_ID}.js?container_id=${containerId}&player=${size}`;
    script.async = true;
    script.charset = "utf-8";
    document.getElementById(containerId)?.appendChild(script);
    return () => {
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
    };
  }, [containerId, size]);

  return (
    <div
      id={containerId}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(242,101,34,0.25)",
        boxShadow:
          "0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(242,101,34,0.08)",
        background: "rgba(3,6,15,0.85)",
        minHeight: size === "large" ? 352 : 70,
      }}
    />
  );
}

function LibraryVideoPlayer({ video, onBack }) {
  const vidRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showDesc, setShowDesc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const hideCtrlTimer = useRef(null);
  const [ctrlVisible, setCtrlVisible] = useState(true);

  const getVideoUrl = (fp) => {
    if (!fp) return null;
    if (fp.startsWith("https://") || fp.startsWith("http://")) return fp;
    const fn = fp.split("/").pop();
    if (fn && fn.endsWith(".mp4")) return `/local-videos/${fn}`;
    return null;
  };
  const url = getVideoUrl(video.file_path);
  const isPodcast = !url && video.narration_url;

  const fmtTime = (s) => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
  const pct = duration ? (currentTime / duration) * 100 : 0;

  const showCtrl = () => {
    setCtrlVisible(true);
    clearTimeout(hideCtrlTimer.current);
    hideCtrlTimer.current = setTimeout(() => setCtrlVisible(false), 3000);
  };

  useEffect(() => {
    showCtrl();
    return () => clearTimeout(hideCtrlTimer.current);
  }, []);

  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    const fn = (e) => {
      switch (e.key) {
        case " ": e.preventDefault(); vid.paused ? vid.play() : vid.pause(); break;
        case "ArrowLeft": vid.currentTime = Math.max(0, vid.currentTime - 10); break;
        case "ArrowRight": vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); break;
        case "ArrowUp": e.preventDefault(); vid.volume = Math.min(1, vid.volume + 0.1); break;
        case "ArrowDown": e.preventDefault(); vid.volume = Math.max(0, vid.volume - 0.1); break;
        case "m": case "M": vid.muted = !vid.muted; setMuted(vid.muted); break;
        case "f": case "F": document.fullscreenElement ? document.exitFullscreen() : vid.requestFullscreen?.(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const seek = (e) => {
    const bar = e.currentTarget;
    const ratio = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    if (vidRef.current) vidRef.current.currentTime = ratio * (vidRef.current.duration || 0);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#000" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 14, background: "rgba(4,6,16,0.95)", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 6, color: "#a855f7", fontSize: 11, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>← BACK</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: "#e8f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.title || "Untitled"}</div>
          <div style={{ fontSize: 9, color: "rgba(180,200,230,0.35)", marginTop: 1, letterSpacing: "0.06em" }}>
            {video.duration_seconds ? fmtTime(video.duration_seconds) : ""}
            {video.resolution ? ` · ${video.resolution}` : ""}
            {video.labels?.filter(l => l && l !== "compilation").slice(0, 2).map(l => ` · ${l}`).join("")}
          </div>
        </div>
        {video.description && (
          <button onClick={() => setShowDesc(d => !d)} style={{ background: showDesc ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${showDesc ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, color: showDesc ? "#a855f7" : "rgba(180,200,230,0.4)", fontSize: 10, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {showDesc ? "Hide description" : "See description"}
          </button>
        )}
      </div>

      {/* Description panel */}
      {showDesc && video.description && (
        <div style={{ padding: "14px 28px", background: "rgba(168,85,247,0.04)", borderBottom: "1px solid rgba(168,85,247,0.12)", fontSize: 13, color: "rgba(200,220,245,0.75)", lineHeight: 1.75, maxHeight: 140, overflowY: "auto", flexShrink: 0 }}>
          {video.description}
        </div>
      )}

      {/* Player area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }} onMouseMove={showCtrl} onClick={showCtrl}>
        {url ? (
          <video
            ref={vidRef}
            src={url}
            autoPlay
            playsInline
            style={{ width: "100%", maxHeight: "100%", display: "block", outline: "none" }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={() => { if (vidRef.current) setCurrentTime(vidRef.current.currentTime); }}
            onDurationChange={() => { if (vidRef.current) setDuration(vidRef.current.duration || 0); }}
            onVolumeChange={() => { if (vidRef.current) { setVolume(vidRef.current.volume); setMuted(vidRef.current.muted); } }}
          />
        ) : isPodcast ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: 40 }}>
            <div style={{ fontSize: 64, opacity: 0.4 }}>🎙</div>
            <div style={{ fontSize: 14, color: "rgba(180,200,230,0.5)" }}>{video.title || "Podcast episode"}</div>
            <audio ref={vidRef} src={video.narration_url} autoPlay controls style={{ width: 420, maxWidth: "90%", outline: "none", borderRadius: 8 }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => { if (vidRef.current) setCurrentTime(vidRef.current.currentTime); }} onDurationChange={() => { if (vidRef.current) setDuration(vidRef.current.duration || 0); }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "rgba(180,200,230,0.3)" }}>
            <div style={{ fontSize: 56 }}>🎬</div>
            <div style={{ fontSize: 12 }}>Video file not available</div>
          </div>
        )}

        {/* Custom control bar (video only) */}
        {url && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.88))", padding: "40px 20px 16px", transition: "opacity 0.3s", opacity: ctrlVisible ? 1 : 0, pointerEvents: ctrlVisible ? "auto" : "none" }}>
            {/* Progress bar */}
            <div onClick={seek} style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, marginBottom: 12, cursor: "pointer", position: "relative" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 2, transition: "width 0.1s linear" }} />
              <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 6px rgba(168,85,247,0.8)" }} />
            </div>

            {/* Controls row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Rewind */}
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime -= 10; }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }} title="−10s (←)">⟪ 10</button>
              {/* Play/Pause */}
              <button onClick={() => { const v = vidRef.current; v && (v.paused ? v.play() : v.pause()); }} style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }} title="Play/Pause (Space)">
                {playing ? "⏸" : "▶"}
              </button>
              {/* Forward */}
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime += 10; }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }} title="+10s (→)">10 ⟫</button>

              {/* Time */}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", minWidth: 80 }}>{fmtTime(currentTime)} / {fmtTime(duration)}</span>

              <div style={{ flex: 1 }} />

              {/* Volume */}
              <button onClick={() => { if (vidRef.current) { vidRef.current.muted = !vidRef.current.muted; } }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }} title="Mute (M)">
                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={e => { const v = vidRef.current; if (v) { v.volume = +e.target.value; v.muted = false; } }} style={{ width: 64, accentColor: "#a855f7", cursor: "pointer" }} />

              {/* Speed */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowSettings(s => !s)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "rgba(255,255,255,0.6)", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>{playbackRate}x</button>
                {showSettings && (
                  <div style={{ position: "absolute", bottom: "110%", right: 0, background: "rgba(10,14,28,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 0", zIndex: 10, minWidth: 80 }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                      <div key={r} onClick={() => { const v = vidRef.current; if (v) v.playbackRate = r; setPlaybackRate(r); setShowSettings(false); }} style={{ padding: "5px 14px", fontSize: 11, color: r === playbackRate ? "#a855f7" : "rgba(200,220,245,0.7)", cursor: "pointer", background: r === playbackRate ? "rgba(168,85,247,0.1)" : "none" }}>{r}x</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button onClick={() => { document.fullscreenElement ? document.exitFullscreen() : vidRef.current?.requestFullscreen?.(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }} title="Fullscreen (F)">⛶</button>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div style={{ padding: "6px 24px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 9, color: "rgba(180,200,230,0.2)", letterSpacing: "0.08em", background: "rgba(4,6,16,0.95)", flexShrink: 0 }}>
        SPACE play/pause · ← → seek 10s · ↑ ↓ volume · M mute · F fullscreen · ESC back
      </div>
    </div>
  );
}


function LibraryModal({ subUser, onClose }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | video | audio
  const [playVideo, setPlayVideo] = useState(null);
  const gridRef = useRef(null);
  const LIB_PAGE = 20;

  const getVideoUrl = (fp) => {
    if (!fp) return null;
    if (fp.startsWith("https://") || fp.startsWith("http://")) return fp;
    const fn = fp.split("/").pop();
    if (fn && fn.endsWith(".mp4")) return `/local-videos/${fn}`;
    return null;
  };

  const fmtDur = (s) => { if (!s) return ""; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };

  useEffect(() => {
    const token = localStorage.getItem("sub_token");
    fetch("/api/subscribe/videos", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setVideos(d.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const fn = () => { if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) setPage(p => p + 1); };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => { setPage(1); }, [search, typeFilter]);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape" && !playVideo) onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose, playVideo]);

  const filtered = videos.filter(v => {
    const isPod = !v.file_path || v.labels?.includes("mp3") || v.file_path?.endsWith?.(".mp3") || (!v.file_path?.endsWith?.(".mp4") && !v.file_path?.startsWith?.("http") && v.narration_url);
    if (typeFilter === "video" && isPod) return false;
    if (typeFilter === "audio" && !isPod) return false;
    if (search.trim() && !(v.title || v.prompt || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const visible = filtered.slice(0, page * LIB_PAGE);
  const hasMore = visible.length < filtered.length;

  const onCardHoverEnter = (e, url) => {
    if (!url) return;
    const vid = e.currentTarget.querySelector("video.lib-hover-vid");
    if (vid) { vid.src = url; vid.play().catch(() => {}); }
  };
  const onCardHoverLeave = (e) => {
    const vid = e.currentTarget.querySelector("video.lib-hover-vid");
    if (vid) { vid.pause(); vid.src = ""; }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(2,4,14,0.98)", backdropFilter: "blur(28px)", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
      <style>{`
        .lib-card { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s, border-color 0.15s; }
        .lib-card:hover { transform: translateY(-4px) scale(1.015); box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.3); }
        .lib-card:hover .lib-play-ring { opacity: 0.85 !important; }
        .lib-card:hover .lib-thumb { opacity: 0; }
        .lib-card:hover .lib-hover-vid { opacity: 1 !important; }
        .lib-hover-vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.35s; pointer-events: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, background: "rgba(3,5,16,0.96)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "0.06em", background: "linear-gradient(135deg,#c084fc,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>◈ MEMBER LIBRARY</div>
          <div style={{ fontSize: 10, color: "rgba(160,185,220,0.45)", marginTop: 1 }}>{subUser?.email} · {filtered.length} item{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        {/* Type filters */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["all","ALL"], ["video","▶ VIDEO"], ["audio","🎙 AUDIO"]].map(([val, label]) => (
            <button key={val} onClick={() => setTypeFilter(val)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${typeFilter === val ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.15)"}`, background: typeFilter === val ? "rgba(168,85,247,0.15)" : "transparent", color: typeFilter === val ? "#c084fc" : "rgba(168,85,247,0.4)", fontSize: 10, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.04em", fontWeight: typeFilter === val ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <input type="text" placeholder="Search library..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "8px 14px", borderRadius: 22, border: "1px solid rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.05)", color: "#e8f0ff", fontSize: 12, fontFamily: "inherit", outline: "none", width: 190 }} />
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "rgba(180,200,230,0.5)", fontSize: 17, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
      </div>

      {/* Player */}
      {playVideo && <LibraryVideoPlayer video={playVideo} onBack={() => setPlayVideo(null)} />}

      {/* Grid */}
      {!playVideo && (
        <div ref={gridRef} style={{ flex: 1, overflowY: "auto", padding: "28px 28px 40px" }}>
          {loading && <div style={{ textAlign: "center", color: "rgba(168,85,247,0.4)", padding: 60, fontSize: 13, letterSpacing: "0.1em" }}>LOADING LIBRARY...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>◈</div>
              <div style={{ fontSize: 13, color: "rgba(160,185,220,0.35)", letterSpacing: "0.06em" }}>
                {search || typeFilter !== "all" ? "No videos match your filters" : "No exclusive videos yet — add videos to the library from your dashboard"}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 22 }}>
            {visible.map((v, i) => {
              const thumb = v.thumbnail_url;
              const isPodcast = !v.file_path || v.labels?.includes("mp3") || v.file_path?.endsWith?.(".mp3") || (!v.file_path?.endsWith?.(".mp4") && !v.file_path?.startsWith?.("http") && v.narration_url);
              const fp = v.file_path;
              const vidUrl = fp && (fp.startsWith("http") ? fp : fp.endsWith(".mp4") ? `/local-videos/${fp.split("/").pop()}` : null);
              const canPlay = !!(vidUrl || (isPodcast && v.narration_url));
              const fmtDur = (s) => { if (!s) return ""; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; };

              return (
                <div
                  key={v.id}
                  className="lib-card"
                  onClick={() => canPlay && setPlayVideo(v)}
                  onMouseEnter={e => onCardHoverEnter(e, vidUrl)}
                  onMouseLeave={e => onCardHoverLeave(e)}
                  style={{ background: "linear-gradient(145deg,rgba(20,14,40,0.9),rgba(12,10,26,0.95))", border: "1px solid rgba(168,85,247,0.12)", borderRadius: 16, overflow: "hidden", cursor: canPlay ? "pointer" : "default" }}
                >
                  {/* Media area */}
                  <div style={{ position: "relative", aspectRatio: "16/9", background: "rgba(0,0,0,0.7)", overflow: "hidden" }}>
                    {/* Thumbnail image */}
                    {thumb && !isPodcast && (
                      <img src={thumb} alt="" className="lib-thumb" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.35s" }} onError={e => { e.target.style.display = "none"; }} />
                    )}

                    {/* Hover video */}
                    {vidUrl && <video className="lib-hover-vid" muted loop playsInline />}

                    {/* Podcast / no thumb placeholder */}
                    {(isPodcast || !thumb) && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isPodcast ? "radial-gradient(circle,rgba(29,185,84,0.08) 0%,transparent 70%)" : "radial-gradient(circle,rgba(168,85,247,0.06) 0%,transparent 70%)" }}>
                        <span style={{ fontSize: 44, opacity: 0.25 }}>{isPodcast ? "🎙" : "🎬"}</span>
                      </div>
                    )}

                    {/* Gradient overlay (bottom) */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,4,18,0.85) 0%, transparent 50%)", pointerEvents: "none" }} />

                    {/* Play button — always visible at 28% opacity, brightens on hover */}
                    {canPlay && (
                      <div className="lib-play-ring" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "40%", aspectRatio: "1 / 1", borderRadius: "50%", background: "rgba(168,85,247,0.22)", border: "2px solid rgba(168,85,247,0.55)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.28, transition: "opacity 0.18s", zIndex: 2 }}>
                        <span style={{ fontSize: "clamp(22px,3vw,36px)", color: "#fff", marginLeft: "8%" }}>▶</span>
                      </div>
                    )}

                    {/* Top badges */}
                    <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 9, color: "rgba(168,85,247,0.9)", fontWeight: 700, backdropFilter: "blur(4px)" }}>#{i + 1}</div>
                      {v.is_exclusive && <div style={{ background: "rgba(168,85,247,0.75)", borderRadius: 6, padding: "2px 8px", fontSize: 8, color: "#fff", fontWeight: 700, letterSpacing: "0.06em", backdropFilter: "blur(4px)" }}>🔐 EXCLUSIVE</div>}
                    </div>

                    {/* Duration badge */}
                    {v.duration_seconds > 0 && (
                      <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.65)", borderRadius: 5, padding: "2px 7px", fontSize: 10, color: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)" }}>{fmtDur(v.duration_seconds)}</div>
                    )}
                  </div>

                  {/* Card info */}
                  <div style={{ padding: "14px 16px 16px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "#ddeeff", lineHeight: 1.4, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {v.title || v.prompt || "Untitled"}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(v.labels || []).filter(l => l && l !== "compilation" && l !== "mp3").slice(0, 3).map(l => (
                        <span key={l} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(168,85,247,0.08)", color: "rgba(168,85,247,0.7)", border: "1px solid rgba(168,85,247,0.18)", letterSpacing: "0.04em" }}>{l}</span>
                      ))}
                      {isPodcast && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(29,185,84,0.08)", color: "rgba(29,185,84,0.7)", border: "1px solid rgba(29,185,84,0.18)" }}>podcast</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && <div style={{ textAlign: "center", padding: "24px 0 8px", fontSize: 10, color: "rgba(168,85,247,0.3)", letterSpacing: "0.1em" }}>↓ SCROLL FOR MORE</div>}
        </div>
      )}
    </div>
  );
}


function ExclusiveSection({ c, subUser, onLogin, onLogout }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [mode, setMode] = useState(null); // null | 'signup' | 'login'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/app-settings/exclusive_preview_video_url")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setPreviewUrl(d.value); setVideoLoading(false); })
      .catch(() => setVideoLoading(false));
  }, []);

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
    return null;
  };

  const reset = () => { setEmail(""); setPassword(""); setMsg(null); };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/subscribe/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Request submitted! You'll receive access once approved." });
        reset(); setMode(null);
      } else {
        const detail = data.detail || "";
        setMsg({ type: "error", text:
          detail === "Email already registered" ? "Already registered — try logging in" :
          detail.includes("not yet configured") ? "Subscription system coming soon — check back shortly" :
          detail || "Something went wrong"
        });
      }
    } catch { setMsg({ type: "error", text: "Network error — please try again" }); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/subscribe/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("sub_token", data.token);
        localStorage.setItem("sub_email", data.email);
        reset(); setMode(null);
        onLogin({ email: data.email, status: "approved" });
      } else {
        const detail = data.detail || "";
        setMsg({ type: "error", text:
          detail === "Account pending approval" ? "Your request is pending — we'll notify you when approved" :
          detail === "Account access denied" ? "Your access request was not approved. Contact support." :
          detail === "Invalid credentials" ? "Invalid email or password" :
          detail || "Login failed"
        });
      }
    } catch { setMsg({ type: "error", text: "Network error — please try again" }); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 8,
    border: "1px solid rgba(168,85,247,0.35)", background: "rgba(255,255,255,0.04)",
    color: "#fff", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit",
    outline: "none", marginBottom: 10,
  };

  return (
    <section id="exclusive" style={{ padding: "80px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", background: "linear-gradient(160deg,rgba(3,6,15,0.98) 0%,rgba(8,4,20,0.95) 100%)" }}>
      {/* ambient glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span className="section-tag" style={{ color: "#a855f7" }}>EXCLUSIVE ACCESS</span>
          <h2 className="syne" style={{ fontWeight: 800, fontSize: "clamp(24px,4vw,38px)", color: c.text, marginBottom: 12 }}>
            Subscribe to <span style={{ color: "#a855f7" }}>Exclusive Content</span>
          </h2>
          <p style={{ fontSize: 13, color: c.textM, maxWidth: 500, margin: "0 auto" }}>
            Get access to premium, members-only videos and deep-dives not available anywhere else.
          </p>
        </div>

        <div className="exclusive-grid">
          {/* Video preview */}
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(168,85,247,0.25)", background: "rgba(0,0,0,0.5)", aspectRatio: "16/9", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {videoLoading ? (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Loading preview...</div>
            ) : previewUrl ? (
              getYouTubeEmbedUrl(previewUrl) ? (
                <iframe
                  src={getYouTubeEmbedUrl(previewUrl)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: "none", borderRadius: 18 }}
                />
              ) : (
                <video src={previewUrl} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 18 }} />
              )
            ) : (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
                <div style={{ fontSize: 11, letterSpacing: "0.1em" }}>EXCLUSIVE CONTENT</div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div>
            {subUser ? (
              /* ── Logged-in state ── */
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.25)", marginBottom: 18 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3dd68c", boxShadow: "0 0 6px #3dd68c" }} />
                  <span style={{ fontSize: 11, color: "#3dd68c", fontWeight: 600 }}>MEMBER ACCESS ACTIVE</span>
                </div>
                <h3 className="syne" style={{ fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 10 }}>
                  Welcome back!
                </h3>
                <p style={{ fontSize: 13, color: c.textM, lineHeight: 1.7, marginBottom: 6 }}>
                  Logged in as <span style={{ color: "#a855f7" }}>{subUser.email}</span>
                </p>
                <p style={{ fontSize: 12, color: c.textD, lineHeight: 1.6, marginBottom: 24 }}>
                  Your library is available in the navigation bar above. Click{" "}
                  <span style={{ color: "#a855f7", fontWeight: 600 }}>LIBRARY</span> to browse all exclusive content.
                </p>
                <button
                  onClick={() => { localStorage.removeItem("sub_token"); localStorage.removeItem("sub_email"); onLogout(); }}
                  style={{ padding: "10px 22px", borderRadius: 50, background: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, cursor: "pointer", letterSpacing: "0.05em", fontFamily: "inherit" }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              /* ── Guest state ── */
              <div>
                <h3 className="syne" style={{ fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 12 }}>
                  {mode === "login" ? "Member Login" : "Get exclusive access"}
                </h3>
                <p style={{ fontSize: 13, color: c.textM, lineHeight: 1.7, marginBottom: 20 }}>
                  Members-only videos, early access content, and deep-dives that go beyond what's public.
                  {mode === null && " Submit a request — approved members get instant access."}
                </p>

                {msg && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.type === "success" ? "rgba(61,214,140,0.08)" : "rgba(255,92,108,0.08)", border: `1px solid ${msg.type === "success" ? "rgba(61,214,140,0.3)" : "rgba(255,92,108,0.3)"}`, color: msg.type === "success" ? "#3dd68c" : "#ff5c6c", fontSize: 12, lineHeight: 1.5 }}>
                    {msg.text}
                  </div>
                )}

                {mode === null && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setMode("signup"); setMsg(null); }} style={{ flex: 1, padding: "13px 20px", borderRadius: 50, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}>
                      🔐 SUBSCRIBE NOW
                    </button>
                    <button onClick={() => { setMode("login"); setMsg(null); }} style={{ padding: "13px 20px", borderRadius: 50, background: "rgba(255,255,255,0.05)", color: c.textM, border: "1px solid rgba(255,255,255,0.12)", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>
                      MEMBER LOGIN
                    </button>
                  </div>
                )}

            {mode === "signup" && (
              <form onSubmit={handleSignup}>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                <input type="password" placeholder="Choose a password (min. 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: "12px 20px", borderRadius: 50, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Submitting..." : "SUBMIT REQUEST"}
                  </button>
                  <button type="button" onClick={() => { setMode(null); reset(); }} style={{ padding: "12px 16px", borderRadius: 50, background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    CANCEL
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: c.textD, textAlign: "center" }}>
                  Already a member?{" "}
                  <button type="button" onClick={() => { setMode("login"); setMsg(null); }} style={{ background: "none", border: "none", color: "#a855f7", cursor: "pointer", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>
                    Log in
                  </button>
                </div>
              </form>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin}>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                <input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: "12px 20px", borderRadius: 50, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "Logging in..." : "LOGIN"}
                  </button>
                  <button type="button" onClick={() => { setMode(null); reset(); }} style={{ padding: "12px 16px", borderRadius: 50, background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    CANCEL
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: c.textD, textAlign: "center" }}>
                  Not a member?{" "}
                  <button type="button" onClick={() => { setMode("signup"); setMsg(null); }} style={{ background: "none", border: "none", color: "#a855f7", cursor: "pointer", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>
                    Request access
                  </button>
                </div>
              </form>
            )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


export default function LandingPage() {
  const theme = "dark";
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [menuOpen, setMenuOpen] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [slideDir, setSlideDir] = useState("right");
  const [ytVideos, setYtVideos] = useState([]);
  const [ytLoading, setYtLoading] = useState(true);
  const [ytIdx, setYtIdx] = useState(0);
  const [modalVideo, setModalVideo] = useState(null); // { id, title, url }
  const [podcastTab, setPodcastTab] = useState("spotify"); // "spotify" | "buzzsprout" | "podbean"
  const [showBackTop, setShowBackTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroStats, setHeroStats] = useState(null);
  const [counterVals, setCounterVals] = useState({
    followers: 0,
    episodes: 0,
    comments: 0,
    views: 0,
  });
  const [cookieConsent, setCookieConsent] = useState(null); // null=unknown, 'accepted', 'declined'
  const [cookieManage, setCookieManage] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [subStatus, setSubStatus] = useState(""); // '' | 'loading' | 'success' | 'error'
  const [subUser, setSubUser] = useState(null); // { email, status } if token valid
  const [showLibrary, setShowLibrary] = useState(false);
  const [bmcUrl, setBmcUrl] = useState("");
  const [bmcMsg, setBmcMsg] = useState(false);
  const wrapperRef = useRef(null);
  const autoRef = useRef(null);
  const heroVidRef = useRef(null);
  const topicsBgRef = useRef(null);
  const communityBgRef = useRef(null);
  const contentBgRef = useRef(null);
  const videoBgRef = useRef(null);
  const ytAutoRef = useRef(null);

  const c = DARK;

  // Verify subscriber token on mount
  useEffect(() => {
    const token = localStorage.getItem("sub_token");
    if (!token) return;
    fetch("/api/subscribe/verify", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.email) setSubUser({ email: d.email, status: d.status });
        else { localStorage.removeItem("sub_token"); localStorage.removeItem("sub_email"); }
      })
      .catch(() => {});
  }, []);

  // Scroll detection on the wrapper (not window)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = () => {
      setScrolled(el.scrollTop > 60);
      if (el.scrollTop > 100 && menuOpen) setMenuOpen(false);
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [menuOpen]);

  // Section tracking with wrapper as root
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const observers = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) setActiveSection(id);
        },
        { root: wrapper, rootMargin: "-35% 0px -35% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Fetch public YouTube videos
  useEffect(() => {
    fetch("/api/public/channel-videos")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setYtVideos(d.videos || []))
      .catch(() => setYtVideos([]))
      .finally(() => setYtLoading(false));
  }, []);

  // Back-to-top visibility + scroll progress (uses wrapper scroll)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = () => {
      setShowBackTop(el.scrollTop > 600);
      const maxScroll = el.scrollHeight - el.clientHeight;
      setScrollProgress(
        maxScroll > 0 ? Math.min(1, el.scrollTop / maxScroll) : 0,
      );
      // Parallax backgrounds — direct DOM, no re-render
      if (topicsBgRef.current) {
        const rect = document.getElementById("topics")?.getBoundingClientRect();
        if (rect)
          topicsBgRef.current.style.transform = `translateY(${-rect.top * 0.28}px) scale(1.35)`;
      }
      if (communityBgRef.current) {
        const rect = document
          .getElementById("community")
          ?.getBoundingClientRect();
        if (rect)
          communityBgRef.current.style.transform = `translateY(${-rect.top * 0.28}px) scale(1.35)`;
      }
      if (contentBgRef.current) {
        const rect = document
          .getElementById("content")
          ?.getBoundingClientRect();
        if (rect)
          contentBgRef.current.style.transform = `translateY(${-rect.top * 0.22}px) scale(1.3)`;
      }
      if (videoBgRef.current) {
        const rect = document.getElementById("videos")?.getBoundingClientRect();
        if (rect)
          videoBgRef.current.style.transform = `translateY(${-rect.top * 0.25}px) scale(1.35)`;
      }
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, []);

  // YouTube hero auto-advance (3 videos max, loop)
  useEffect(() => {
    const total = Math.min(ytVideos.length, 3);
    if (total > 1) {
      ytAutoRef.current = setInterval(() => {
        setYtIdx((i) => (i + 1) % total);
      }, 5500);
    }
    return () => clearInterval(ytAutoRef.current);
  }, [ytVideos]);

  // Close modal on Escape
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") setModalVideo(null);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // Scroll-reveal — runs once per element when it enters viewport
  useEffect(() => {
    const els = document.querySelectorAll(".scroll-reveal");
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("sr-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Slow down hero video
  useEffect(() => {
    if (heroVidRef.current) heroVidRef.current.playbackRate = 0.55;
  }, []);

  // Cookie consent — read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cookie_consent");
    if (saved === "accepted" || saved === "declined") {
      setCookieConsent(saved);
    }
  }, []);

  // Fetch aggregated hero stats
  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHeroStats(d))
      .catch(() => {});
  }, []);

  // Fetch BMC support link (public setting)
  useEffect(() => {
    fetch("/api/app-settings/bmc_url")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setBmcUrl(d.value); })
      .catch(() => {});
  }, []);

  // Counter animation — runs when heroStats arrives
  useEffect(() => {
    if (!heroStats) return;
    const targets = {
      followers:
        typeof heroStats.followers === "number" ? heroStats.followers : 10000,
      episodes:
        typeof heroStats.episodes === "number" ? heroStats.episodes : 50,
      comments: typeof heroStats.comments === "number" ? heroStats.comments : 0,
      views: typeof heroStats.total_views === "number" ? heroStats.total_views : 0,
    };
    const duration = 2000; // ms
    const startTime = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic: slows down as it approaches target
      const ease = 1 - Math.pow(1 - t, 3);
      setCounterVals({
        followers: Math.round(targets.followers * ease),
        episodes: Math.round(targets.episodes * ease),
        comments: Math.round(targets.comments * ease),
        views: Math.round(targets.views * ease),
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [heroStats]);

  // Carousel auto-advance
  useEffect(() => {
    autoRef.current = setInterval(
      () => setCarouselIdx((i) => (i + 1) % CAROUSEL.length),
      5500,
    );
    return () => clearInterval(autoRef.current);
  }, []);

  const goPrev = () => {
    clearInterval(autoRef.current);
    setSlideDir("left");
    setCarouselIdx((i) => (i - 1 + CAROUSEL.length) % CAROUSEL.length);
  };
  const goNext = () => {
    clearInterval(autoRef.current);
    setSlideDir("right");
    setCarouselIdx((i) => (i + 1) % CAROUSEL.length);
  };
  const goTo = (i) => {
    clearInterval(autoRef.current);
    setSlideDir(i > carouselIdx ? "right" : "left");
    setCarouselIdx(i);
  };
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };
  const ytPause = () => clearInterval(ytAutoRef.current);
  const ytResume = () => {
    const total = Math.min(ytVideos.length, 3);
    if (total > 1) {
      ytAutoRef.current = setInterval(
        () => setYtIdx((i) => (i + 1) % total),
        5500,
      );
    }
  };
  const ytPrev = () => {
    ytPause();
    const t = Math.min(ytVideos.length, 3);
    setYtIdx((i) => (i - 1 + t) % t);
  };
  const ytNext = () => {
    ytPause();
    const t = Math.min(ytVideos.length, 3);
    setYtIdx((i) => (i + 1) % t);
  };

  const item = CAROUSEL[carouselIdx];

  return (
    <div
      ref={wrapperRef}
      data-theme={theme}
      style={{
        maxHeight: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        background: c.bg,
        color: c.text,
        fontFamily: "'DM Mono','Fira Code',monospace",
        scrollBehavior: "smooth",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 17px; }

        /* ── DISABLE COPY ─────────────────────────────── */
        [data-theme] { -webkit-user-select:none; -moz-user-select:none; user-select:none; }
        img { -webkit-user-drag:none; pointer-events:none; }
        a, button, iframe, input, textarea { pointer-events:auto; }

        /* ── NAV ──────────────────────────────────────── */
        .lp-nav {
          position: sticky; top: 0; left: 0; right: 0; z-index: 300;
          transition: background 0.35s, border-color 0.35s, backdrop-filter 0.35s;
          border-bottom: 1px solid transparent;
          /* always float transparent over hero video */
          background: transparent;
        }
        .lp-nav.scrolled {
          background: var(--nav-bg);
          backdrop-filter: blur(28px) saturate(180%) brightness(0.95);
          -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(0.95);
          border-bottom-color: rgba(255,80,30,0.12);
          box-shadow: 0 2px 32px rgba(0,0,0,0.18);
        }
        /* Force nav text white on hero video */
        .lp-nav:not(.scrolled) .lp-navlink { color: rgba(255,255,255,0.65)!important; }
        .lp-nav:not(.scrolled) .lp-navlink:hover,
        .lp-nav:not(.scrolled) .lp-navlink.active { color: #ff8866!important; }
        .lp-nav:not(.scrolled) .soc-icon { color: rgba(255,255,255,0.6)!important; border-color: rgba(255,255,255,0.18)!important; }
        .lp-nav:not(.scrolled) .theme-toggle { color: rgba(255,255,255,0.55)!important; border-color: rgba(255,255,255,0.2)!important; background: rgba(255,255,255,0.06)!important; }
        .lp-navlink {
          color: var(--text-m);
          text-decoration: none;
          font-size: 10px;
          letter-spacing: 0.14em;
          transition: color 0.2s;
          padding-bottom: 4px;
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .lp-navlink::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 0; height: 1px;
          background: linear-gradient(90deg,#ff5533,#ff8844);
          transition: width 0.3s ease;
        }
        .lp-navlink:hover { color: #ff6633; }
        .lp-navlink:hover::after { width: 100%; }
        .lp-navlink.active { color: #ff6633; }
        .lp-navlink.active::after { width: 100%; }

        /* ── BUTTONS ──────────────────────────────────── */
        .lp-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 15px 28px; border-radius: 12px;
          font-family: 'DM Mono', monospace; font-size: 12px;
          font-weight: 500; letter-spacing: 0.12em;
          cursor: pointer; transition: all 0.22s;
          text-decoration: none; border: none;
          white-space: nowrap; position: relative; overflow: hidden;
        }
        .lp-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
          transform: translateX(-110%);
          transition: transform 0.55s ease;
          pointer-events: none;
        }
        .lp-btn:hover::after { transform: translateX(110%); }
        .lp-btn-fire { background: linear-gradient(135deg,#cc2200,#ff5533,#ff8844); color:#fff; box-shadow: 0 4px 20px rgba(255,80,30,0.25); }
        .lp-btn-fire:hover { opacity:0.92; transform:translateY(-3px) scale(1.03); box-shadow:0 12px 36px rgba(255,80,30,0.5); }
        .lp-btn-ghost { background:transparent; color: var(--text-light,#c0d4e8); border:1px solid rgba(255,255,255,0.18); }
        .lp-btn-ghost:hover { border-color:rgba(255,80,30,0.5); color:#ff6633; background:rgba(255,80,30,0.07); transform:translateY(-2px); }
        .lp-btn-green { background:linear-gradient(135deg,#1db954,#1ed760); color:#fff; box-shadow: 0 4px 20px rgba(29,185,84,0.25); }
        .lp-btn-green:hover { opacity:0.92; transform:translateY(-3px) scale(1.03); box-shadow:0 12px 36px rgba(29,185,84,0.45); }

        /* ── CARDS ────────────────────────────────────── */
        .lp-card {
          background: var(--card-bg);
          border: 1px solid var(--card-br);
          box-shadow: var(--card-sh,none);
          border-radius: 16px;
          transition: border-color 0.28s, transform 0.28s, box-shadow 0.28s;
          position: relative; overflow: hidden;
        }
        .lp-card::before {
          content: '';
          position: absolute;
          top: -60%; left: -60%;
          width: 220%; height: 220%;
          background: radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.07) 0%, transparent 60%);
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.45s, transform 0.45s;
          pointer-events: none;
        }
        .lp-card:hover { border-color:rgba(255,80,30,0.28); transform:translateY(-4px); box-shadow:0 12px 40px rgba(255,80,30,0.12); }
        .lp-card:hover::before { opacity:1; transform:scale(1); }

        /* ── COMMENT CARD ─────────────────────────────── */
        .comment-card {
          background: var(--card-bg);
          border: 1px solid var(--card-br);
          box-shadow: var(--card-sh,none);
          border-radius: 14px; padding: 20px;
          transition: transform 0.25s, box-shadow 0.25s;
          position: relative; overflow: hidden;
        }
        .comment-card::before {
          content: '';
          position: absolute; top:0; left:0; right:0; height:2px;
          background: linear-gradient(90deg,transparent,rgba(255,80,30,0.4),transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .comment-card:hover { transform:translateY(-3px); box-shadow:0 8px 32px rgba(255,80,30,0.1); }
        .comment-card:hover::before { opacity:1; }

        /* ── HELPERS ──────────────────────────────────── */
        .syne { font-family:'Syne',sans-serif; }
        .grad-fire { background:linear-gradient(135deg,#ff8844,#ff3300,#0088ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .section-tag { font-size:10px; letter-spacing:0.22em; color:#ff6633; margin-bottom:14px; display:block; }
        .grid-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(255,60,20,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,100,255,0.018) 1px,transparent 1px); background-size:64px 64px; pointer-events:none; }

        /* ── SIDE NAV ─────────────────────────────────── */
        .side-nav { position:sticky; top:50vh; float:left; margin-left:18px; margin-top:-40px; display:flex; flex-direction:column; gap:10px; z-index:200; transform:translateY(-50%); }
        .side-dot { display:flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; padding:2px 0; }
        .side-bar { height:7px; border-radius:4px; transition:all 0.32s; }
        .side-label { font-size:8px; letter-spacing:0.14em; color:#ff6633; opacity:0; transition:opacity 0.2s; white-space:nowrap; pointer-events:none; }
        .side-dot:hover .side-label { opacity:1; }

        /* ── ANIMATIONS ───────────────────────────────── */
        @keyframes fadeUp     { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow       { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes scrollPulse{ 0%,100%{opacity:0.25;transform:translateY(0)} 50%{opacity:0.9;transform:translateY(6px)} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(48px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-48px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInUp    { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .anim-1 { animation:fadeUp 0.7s ease both; }
        .anim-2 { animation:fadeUp 0.7s 0.12s ease both; }
        .anim-3 { animation:fadeUp 0.7s 0.24s ease both; }
        .anim-4 { animation:fadeUp 0.7s 0.36s ease both; }
        @keyframes scrollRise { from { opacity:0; transform:translateY(36px); } to { opacity:1; transform:translateY(0); } }
        .scroll-reveal { opacity:0; transform:translateY(36px); }
        .scroll-reveal.sr-visible { animation: scrollRise 0.65s cubic-bezier(0.22,1,0.36,1) forwards; }
        .scroll-reveal.sr-d1 { animation-delay:0.07s; }
        .scroll-reveal.sr-d2 { animation-delay:0.15s; }
        .scroll-reveal.sr-d3 { animation-delay:0.23s; }
        .carousel-slide { animation:slideInRight 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .carousel-slide-icon { animation:slideInLeft 0.42s 0.06s cubic-bezier(0.22,1,0.36,1) both; }

        /* ── SOCIAL ICONS ─────────────────────────────── */
        .soc-icon {
          display:flex; align-items:center; justify-content:center;
          width:38px; height:38px; border-radius:10px;
          border:1px solid var(--soc-br,rgba(255,255,255,0.08));
          color:var(--text-m); text-decoration:none; font-size:16px;
          transition:all 0.25s; position:relative; overflow:hidden;
        }
        .soc-icon::before {
          content:'';
          position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,80,30,0.15),transparent);
          opacity:0; transition:opacity 0.3s;
        }
        .soc-icon:hover { border-color:rgba(255,80,30,0.5); color:#ff6633; transform:translateY(-3px) scale(1.08); box-shadow:0 6px 20px rgba(255,80,30,0.2); }
        .soc-icon:hover::before { opacity:1; }

        /* ── FOOTER LINKS ─────────────────────────────── */
        .ft-link { display:block; font-size:13.5px; text-decoration:none; margin-bottom:11px; transition:color 0.2s, padding-left 0.2s; letter-spacing:0.03em; }
        @media (min-width: 1280px) { .ft-link { font-size:15.5px; margin-bottom:13px; } }
        .ft-link:hover { color:#ff6633 !important; padding-left:4px; }
        button.ft-link { background:none; border:none; cursor:pointer; font-family:inherit; text-align:left; padding:0; padding-bottom:10px; }
        button.ft-link:hover { color:#ff6633 !important; padding-left:4px; }

        /* ── TOPIC PILLS ──────────────────────────────── */
        .topic-pill {
          display:inline-flex; align-items:center; gap:8px;
          padding:10px 18px; border-radius:100px;
          cursor:pointer; transition:all 0.25s;
          text-decoration:none; font-size:11px; letter-spacing:0.04em;
          position:relative; overflow:hidden;
        }
        .topic-pill::before {
          content:'';
          position:absolute; inset:0; border-radius:100px;
          background:radial-gradient(circle at center,rgba(255,80,30,0.15),transparent 70%);
          opacity:0; transition:opacity 0.35s;
        }
        .topic-pill:hover { border-color:rgba(255,80,30,0.5)!important; color:#ff6633!important; transform:translateY(-3px) scale(1.04); box-shadow:0 4px 16px rgba(255,80,30,0.15); }
        .topic-pill:hover::before { opacity:1; }

        /* ── CAROUSEL DOT ─────────────────────────────── */
        .c-dot { height:7px; border-radius:4px; border:none; cursor:pointer; transition:all 0.32s; padding:0; }

        /* ── MOBILE MENU ──────────────────────────────── */
        .mob-menu { position:fixed; inset:0; z-index:9900; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; backdrop-filter:blur(28px) saturate(160%); -webkit-backdrop-filter:blur(28px) saturate(160%); background:rgba(3,6,15,0.97)!important; }
        .mob-navlink { font-size:20px; letter-spacing:0.16em; background:none; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-weight:700; transition:color 0.2s, transform 0.2s; padding:8px 0; }
        .mob-navlink:hover { transform:translateX(6px); }
        .mob-close { position:absolute; top:20px; right:24px; background:none; border:none; font-size:28px; cursor:pointer; transition:all 0.2s; }
        .mob-close:hover { color:#ff6633!important; transform:rotate(90deg); }

        /* ── COMMENT FORM ─────────────────────────────── */
        .comment-input { width:100%; padding:12px 16px; border-radius:10px; font-family:inherit; font-size:13px; outline:none; resize:vertical; min-height:90px; }
        .coming-soon-overlay { position:absolute; inset:0; backdrop-filter:blur(6px) saturate(140%); -webkit-backdrop-filter:blur(6px) saturate(140%); border-radius:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; z-index:10; }
        .comment-name-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px; }
        .comment-name-row input { flex:1 1 180px; min-width:0; }
        .comment-submit-row { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
        @media (max-width:540px) {
          .comment-name-row input { flex:1 1 100%; }
          .comment-submit-row { flex-direction:column; align-items:stretch; }
          .comment-submit-row span { order:2; text-align:center; }
          .comment-submit-btn { width:100%!important; justify-content:center; order:1; }
        }

        /* ── HAMBURGER ────────────────────────────────── */
        .hamburger { display:none; background:none; border-radius:8px; width:38px; height:38px; cursor:pointer; font-size:18px; align-items:center; justify-content:center; transition:all 0.2s; }
        .hamburger:hover { color:#ff6633!important; }

        /* ── THEME TOGGLE ─────────────────────────────── */
        .theme-toggle {
          display:flex; align-items:center; gap:7px;
          padding:6px 12px; border-radius:20px;
          cursor:pointer; font-family:inherit; font-size:10px;
          letter-spacing:0.08em; transition:all 0.25s;
          border:1px solid;
        }
        .theme-toggle:hover { transform:scale(1.06); }

        /* ── HERO VIDEO OVERLAP — nav overlays video ── */
        #hero { margin-top: -62px; }

        /* ── FACE FEATURE IMAGE ───────────────────────── */
        .face-feature { pointer-events: auto; overflow: hidden; }
        .face-sway { animation: none; }
        .face-feature img { pointer-events: none; }
        .face-wind-overlay { display: none; }
        @media (max-width:900px) { .face-feature { min-height: 360px!important; } }

        /* ── YT CAROUSEL ─────────────────────────────── */
        .yt-stage-wrap { padding:0 78px; }
        @media (max-width:900px) { .yt-stage-wrap { padding:0 60px; } }
        @media (max-width:600px) { .yt-stage-wrap { padding:0 50px; } }
        .yt-stage { position:relative; }
        /* overflow-x:clip allows overflow-y:visible for hover card lift */
        .yt-carousel-win { overflow-x:clip; overflow-y:visible; border-radius:20px; padding-top:16px; margin-top:-16px; }
        .yt-carousel-track { display:flex; gap:22px; transition:transform 0.55s cubic-bezier(0.4,0,0.2,1); }
        .yt-card { flex-shrink:0; border-radius:18px; overflow:hidden; cursor:pointer;
          background:rgba(8,8,18,0.9); border:1px solid rgba(255,255,255,0.1);
          box-shadow:0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5);
          transition:transform 0.35s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.35s, border-color 0.3s; }
        .yt-card:hover { transform:translateY(-12px) scale(1.015); border-color:rgba(220,50,40,0.6);
          box-shadow:0 36px 90px rgba(0,0,0,0.8), 0 8px 28px rgba(200,40,30,0.4); }
        .yt-thumb { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; background:#050510; }
        .yt-thumb img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.55s; display:block; }
        .yt-card:hover .yt-thumb img { transform:scale(1.08); }
        .yt-thumb-grad { position:absolute; inset:0; background:linear-gradient(to top,rgba(4,4,16,0.75) 0%,rgba(4,4,16,0.1) 42%,transparent 68%); pointer-events:none; }
        .yt-thumb-title { position:absolute; bottom:0; left:0; right:0; padding:16px 18px 14px; }
        .yt-thumb-title .ttl { font-family:'Syne',sans-serif; font-weight:800; font-size:15px; line-height:1.38; color:#fff;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          text-shadow:0 2px 12px rgba(0,0,0,0.9); }
        .yt-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          opacity:0; transition:opacity 0.3s; pointer-events:none; }
        .yt-card:hover .yt-play { opacity:1; }
        .yt-play-btn { width:clamp(52px,18%,72px); aspect-ratio:1/1; border-radius:50%;
          background:rgba(195,38,38,0.9); border:2.5px solid rgba(255,100,70,0.7);
          backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 6px 32px rgba(180,20,20,0.65);
          transform:scale(0.85); transition:transform 0.25s, background 0.25s; }
        .yt-card:hover .yt-play-btn { transform:scale(1.08); background:rgba(220,38,38,0.95); }
        .yt-play-btn svg { width:60%; height:60%; fill:#fff; margin-left:8%; filter:drop-shadow(0 1px 6px rgba(0,0,0,0.6)); }
        .yt-play-btn.disabled { opacity:0.18; border-color:rgba(150,150,150,0.25); background:rgba(50,50,50,0.2); box-shadow:none; }
        .yt-badge-yt { position:absolute; top:12px; left:12px; background:rgba(195,28,28,0.92); color:#fff;
          font-size:9px; font-weight:700; letter-spacing:0.12em; padding:4px 9px; border-radius:5px; backdrop-filter:blur(4px); }
        .yt-badge-dur { position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.85); color:#fff;
          font-size:10px; padding:3px 9px; border-radius:5px; letter-spacing:0.04em; backdrop-filter:blur(4px); }
        .yt-meta-row { display:flex; gap:16px; align-items:center; padding:14px 18px 16px; font-size:11px; letter-spacing:0.06em; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.06); }
        .yt-skeleton { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%);
          background-size:200% 100%; animation:shimmer 1.4s ease-in-out infinite; border-radius:10px; }
        /* Arrows — full height, transparent, outside track */
        .yt-arr { position:absolute; top:0; height:100%; width:54px;
          border-radius:0; border:none; background:transparent;
          color:rgba(255,255,255,0.45); font-size:4rem; line-height:1;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; z-index:10; transition:color 0.2s; padding:0; }
        .yt-arr:hover:not(:disabled) { color:rgba(255,255,255,0.95); }
        .yt-arr:disabled { opacity:0.15; cursor:default; }
        .yt-arr.prev { right:calc(100% + 16px); }
        .yt-arr.next { left:calc(100% + 16px); }
        .yt-dots { display:flex; gap:8px; justify-content:center; margin-top:28px; align-items:center; }
        .yt-dot { width:7px; height:7px; border-radius:50%; border:none; cursor:pointer; transition:all 0.32s; padding:0; }
        @media (max-width:900px) { .yt-arr { width:42px; font-size:3rem; } }
        @media (max-width:600px) { .yt-arr { width:34px; font-size:2.4rem; } }
        /* ── VIDEO MODAL ─────────────────────────────── */
        .yt-modal-backdrop { position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center;
          background:rgba(0,0,0,0.72); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
          animation:fadeIn 0.22s ease; padding:20px; }
        .yt-modal-box { width:min(82vw,1100px); display:flex; flex-direction:column; gap:0;
          border-radius:18px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.6);
          border:1px solid rgba(200,40,40,0.25); animation:modalIn 0.28s cubic-bezier(0.34,1.3,0.64,1); }
        .yt-modal-frame { width:100%; aspect-ratio:16/9; background:#000; }
        .yt-modal-frame iframe { width:100%; height:100%; border:none; display:block; }
        .yt-modal-bar { display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:14px 18px; background:#0d0d12; border-top:1px solid rgba(255,255,255,0.06); }
        .yt-modal-title { font-size:13px; font-weight:600; color:#e8f4ff; flex:1; min-width:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:sans-serif; }
        .yt-modal-actions { display:flex; gap:10px; flex-shrink:0; }
        .yt-modal-btn { padding:7px 16px; border-radius:8px; border:none; cursor:pointer; font-size:11px;
          font-weight:700; letter-spacing:0.06em; font-family:sans-serif; transition:opacity 0.2s; }
        .yt-modal-btn:hover { opacity:0.8; }
        .yt-modal-btn.yt { background:rgba(195,40,40,0.9); color:#fff; }
        .yt-modal-btn.close { background:rgba(255,255,255,0.1); color:#cdd8e8; }
        @keyframes modalIn { from { opacity:0; transform:scale(0.92) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        /* ── BACKDROP FILTER ON INTERACTIVE / VISIBLE ELEMENTS ── */
        .lp-card { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .lp-btn  { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .topic-pill { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .soc-icon   { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
        .yt-card    { backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }

        /* ── NETFLIX HERO ─────────────────────────────── */
        .yt-hero { position:relative; width:100%; height:clamp(280px,42vw,560px); overflow:hidden; border-radius:20px; cursor:pointer; }
        .yt-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; transition:transform 0.8s ease; }
        .yt-hero:hover .yt-hero-bg { transform:scale(1.04); }
        .yt-hero-overlay { position:absolute; inset:0; background:linear-gradient(to right, rgba(3,6,15,0.92) 0%, rgba(3,6,15,0.6) 55%, rgba(3,6,15,0.1) 85%, transparent 100%); pointer-events:none; }
        .yt-hero-content { position:absolute; inset:0; display:flex; align-items:flex-end; padding:clamp(22px,4vw,52px); pointer-events:none; }
        .yt-hero-text { max-width:min(520px,70%); transition:transform 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.42s ease; pointer-events:auto; }
        .yt-hero:hover .yt-hero-text { transform:translateX(-36px); opacity:0; pointer-events:none; }
        .yt-hero-badge { display:inline-block; padding:5px 12px; border-radius:6px; background:rgba(195,28,28,0.9); color:#fff; font-size:9px; font-weight:700; letter-spacing:0.14em; margin-bottom:14px; }
        .yt-hero-title { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(16px,2.8vw,34px); color:#fff; line-height:1.25; margin-bottom:12px; text-shadow:0 2px 20px rgba(0,0,0,0.8); }
        .yt-hero-meta { display:flex; gap:14px; font-size:11px; color:rgba(255,255,255,0.55); margin-bottom:20px; letter-spacing:0.04em; flex-wrap:wrap; }
        .yt-hero-cta { display:inline-flex; align-items:center; gap:8px; padding:11px 22px; border-radius:10px; background:rgba(195,38,38,0.9); color:#fff; border:none; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:0.1em; font-family:inherit; transition:background 0.2s, transform 0.2s; }
        .yt-hero-cta:hover { background:rgba(220,38,38,1); transform:scale(1.04); }
        .yt-hero-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.42s; pointer-events:none; }
        .yt-hero:hover .yt-hero-play { opacity:1; pointer-events:auto; }
        .yt-hero-play-btn { width:74px; height:74px; border-radius:50%; background:rgba(195,38,38,0.9); border:3px solid rgba(255,100,70,0.7); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); box-shadow:0 8px 40px rgba(180,20,20,0.7); transition:transform 0.25s, background 0.2s; cursor:pointer; }
        .yt-hero-play-btn:hover { transform:scale(1.12); background:rgba(220,38,38,1); }
        .yt-hero-play-btn svg { width:36px; height:36px; fill:#fff; margin-left:5px; }
        .yt-hero-side-arr { position:absolute; top:50%; transform:translateY(-50%); z-index:10; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.15); border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(255,255,255,0.7); font-size:1.6rem; line-height:1; transition:all 0.2s; backdrop-filter:blur(6px); }
        .yt-hero-side-arr:hover { background:rgba(195,38,38,0.8); color:#fff; border-color:rgba(200,40,40,0.5); }
        .yt-hero-side-arr.left { left:16px; }
        .yt-hero-side-arr.right { right:16px; }
        .yt-hero-dots { display:flex; gap:8px; justify-content:center; margin-top:18px; align-items:center; }
        .yt-hero-dot { border:none; cursor:pointer; padding:0; transition:all 0.32s; height:7px; border-radius:4px; }
        @media (max-width:600px) { .yt-hero { height:clamp(220px,56vw,360px); } .yt-hero-side-arr { width:36px; height:36px; font-size:1.3rem; } }

        /* ── FEATURED CONTENT BUTTON — full width on mobile ── */
        @media (max-width:640px) { .feat-cta-btn { align-self:stretch!important; justify-content:center!important; width:100%!important; } }

        /* ── EXCLUSIVE SECTION — stack on small screens ── */
        .exclusive-grid { display:grid; grid-template-columns:1fr 1fr; gap:32px; align-items:center; }
        @media (max-width:700px) { .exclusive-grid { grid-template-columns:1fr; gap:24px; } }

        /* ── FOOTER MOBILE ────────────────────────────── */
        @media (max-width:540px) {
          .footer-grid > div { text-align:center; display:flex; flex-direction:column; align-items:center; }
          .footer-grid .soc-icon-row { justify-content:center; }
          .ft-link { text-align:center; padding-left:0!important; }
          button.ft-link:hover { padding-left:0!important; }
          .footer-bottom-bar { flex-direction:column!important; align-items:center!important; gap:14px!important; text-align:center; width:100%; }
        }


        /* ── SCROLLBAR — always dark so it doesn't clash with hero ── */
        [data-theme] { scrollbar-width: thin; scrollbar-color: rgba(255,80,30,0.35) rgba(3,6,15,0.4); }
        [data-theme]::-webkit-scrollbar { width: 6px; }
        [data-theme]::-webkit-scrollbar-track { background: rgba(3,6,15,0.4); }
        [data-theme]::-webkit-scrollbar-thumb { background: rgba(255,80,30,0.35); border-radius: 3px; }
        [data-theme]::-webkit-scrollbar-thumb:hover { background: rgba(255,80,30,0.6); }

        /* ── BACK TO TOP ─────────────────────────────── */
        .back-to-top { position:fixed; bottom:28px; right:28px; z-index:800;
          width:46px; height:46px; border-radius:50%; border:none;
          background:transparent;
          display:flex; align-items:center; justify-content:center; cursor:pointer;
          transition:opacity 0.3s, transform 0.3s, background 0.25s;
          color:rgba(255,255,255,0.5); font-size:18px; }
        .back-to-top:hover { background:rgba(195,38,38,0.28); color:#fff; transform:translateY(-3px) scale(1.07); }
        .back-to-top.hidden { opacity:0; pointer-events:none; transform:translateY(12px); }
        @media (max-width:900px) { .yt-modal-box { width:95vw; } .back-to-top { bottom:80px; right:18px; } }
        @media (max-width:540px) { .yt-dot { display:none; } .yt-dot:nth-child(-n+5) { display:block; } }

        /* ── BUTTON GROUPS ────────────────────────────── */
        .btn-group { display:flex; gap:12px; flex-wrap:wrap; }

        /* ── TOPIC PILLS ──────────────────────────────── */
        .topics-grid { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }

        /* ── RESPONSIVE ───────────────────────────────── */
        @media (max-width:900px) {
          .side-nav { display:none!important; }
          .hide-mobile { display:none!important; }
          .hamburger { display:flex!important; }
          .hero-grid { grid-template-columns:1fr!important; }
          .hero-logo-col { order:-1; }
          .about-grid { grid-template-columns:1fr!important; }
          .podcast-grid { grid-template-columns:1fr!important; }
          .carousel-main { grid-template-columns:1fr!important; }
          .footer-grid { grid-template-columns:1fr 1fr!important; }
          .mini-grid { grid-template-columns:1fr 1fr!important; }
          .comments-grid { grid-template-columns:1fr!important; }
        }
        @media (max-width:640px) {
          /* Buttons: equal width, full container, stacked */
          .btn-group { flex-direction:column; width:100%; align-items:stretch; }
          .btn-group .lp-btn { width:100%; justify-content:center; text-align:center; }
          /* Topics: full width, left-justified icon + label + count */
          .topics-grid { flex-direction:column; }
          .topic-pill { width:100%!important; justify-content:space-between!important; border-radius:12px!important; }
          /* Podcast buttons */
          .podcast-btns { flex-direction:column!important; width:100%!important; align-items:stretch!important; }
          .podcast-btns .lp-btn { width:100%!important; justify-content:center!important; }
          /* Hero: reduce padding so content fits */
          #hero { height:100svh!important; min-height:560px!important; }
          .hero-content-pad { padding-top:70px!important; padding-bottom:16px!important; }
          .hero-stats { gap:20px!important; }
          .hero-bottom-bar { flex-direction:column!important; align-items:center!important; gap:8px!important; }
          /* Single buttons span full width */
          .tiktok-btn { width:100%!important; justify-content:center!important; }
        }
        @media (max-width:540px) {
          .footer-grid { grid-template-columns:1fr!important; }
          .about-pillars { grid-template-columns:1fr!important; }
          .mini-grid { grid-template-columns:1fr!important; }
        }
      `}</style>

      {/* ══ SIDE SECTION INDICATOR ════════════════════════════════════════════ */}
      <div
        className="side-nav"
        style={{
          position: "fixed",
          left: 18,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className="side-dot"
            onClick={() => scrollTo(s.id)}
            title={s.label}
          >
            <div
              className="side-bar"
              style={{
                width: activeSection === s.id ? 22 : 7,
                background:
                  activeSection === s.id
                    ? "linear-gradient(90deg,#ff5533,#ff8844)"
                    : `rgba(255,255,255,0.15)`,
              }}
            />
            <span className="side-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ══ MOBILE FULLSCREEN MENU ════════════════════════════════════════════ */}
      {menuOpen && (
        <div
          className="mob-menu"
          style={{
            background: "rgba(3,6,15,0.97)",
          }}
        >
          <button
            className="mob-close"
            onClick={() => setMenuOpen(false)}
            style={{ color: c.textM }}
          >
            ✕
          </button>
          <img
            src={lifeLogoLong}
            alt="4Life Mystery"
            style={{
              height: 44,
              width: "auto",
              objectFit: "contain",
              marginBottom: 12,
            }}
          />
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              className={`mob-navlink${activeSection === id ? " active" : ""}`}
              onClick={() => scrollTo(id)}
              style={{ color: activeSection === id ? "#ff6633" : c.textM }}
            >
              {label}
            </button>
          ))}
          <Link
            to="/blog"
            className="mob-navlink"
            style={{ color: c.textM, textDecoration: "none" }}
            onClick={() => setMenuOpen(false)}
          >
            BLOG
          </Link>
          <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
            <a
              href={SOCIAL.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon"
            >
              ▶
            </a>
            <a
              href={SOCIAL.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon"
            >
              ♪
            </a>
            <a
              href={SOCIAL.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon"
            >
              ◎
            </a>
          </div>
        </div>
      )}

      {/* ══ NAV ═══════════════════════════════════════════════════════════════ */}
      <nav
        className={`lp-nav${scrolled ? " scrolled" : ""}`}
        style={{ "--nav-bg": c.navBg }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            borderRadius: "50%",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("hero");
            }}
            style={{
              textDecoration: "none",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(13px,1.4vw,16px)",
                letterSpacing: "0.18em",
                background: "linear-gradient(135deg,#ff8844,#ff3300,#0088ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              4LIFE MYSTERY
            </span>
          </a>

          <div
            className="hide-mobile"
            style={{ display: "flex", gap: 24, alignItems: "center" }}
          >
            {SECTIONS.filter((s) => s.id !== "hero").map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`lp-navlink${activeSection === id ? " active" : ""}`}
                style={{ "--text-m": c.textM }}
              >
                {label}
              </button>
            ))}
            <Link
              to="/blog"
              className="lp-navlink"
              style={{ "--text-m": c.textM, textDecoration: "none" }}
            >
              BLOG
            </Link>
            {subUser ? (
              <button
                onClick={() => setShowLibrary(true)}
                style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(168,85,247,0.15))", border: "1px solid rgba(168,85,247,0.45)", borderRadius: 20, padding: "5px 16px", color: "#a855f7", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.07em", fontFamily: "inherit", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(124,58,237,0.35),rgba(168,85,247,0.3))"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(168,85,247,0.15))"; }}
              >
                <span style={{ fontSize: 9 }}>●</span> LIBRARY
              </button>
            ) : (
              <button
                onClick={() => scrollTo("exclusive")}
                title="Exclusive Content"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 20, padding: "5px 14px", color: "#a855f7", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.22)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.55)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.12)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.3)"; }}
              >
                🔐 MEMBERS
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <a
              href={SOCIAL.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon hide-mobile"
              title="YouTube"
              style={{ "--text-m": c.textM, "--soc-br": c.socBr }}
            >
              ▶
            </a>
            <a
              href={SOCIAL.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon hide-mobile"
              title="TikTok"
              style={{ "--text-m": c.textM, "--soc-br": c.socBr }}
            >
              ♪
            </a>
            <a
              href={SOCIAL.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="soc-icon hide-mobile"
              title="Spotify"
              style={{ "--text-m": c.textM, "--soc-br": c.socBr }}
            >
              ◎
            </a>

            <button
              className="hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              style={{ border: `1px solid ${c.togBr}`, color: c.text }}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* ══ HERO — full-screen nebula video banner ════════════════════════════ */}
      <section
        id="hero"
        style={{
          position: "relative",
          height: "100vh",
          minHeight: 560,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#03060f", // always dark — video loads above this
        }}
      >
        {/* Video background */}
        <video
          ref={heroVidRef}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => {
            if (heroVidRef.current) heroVidRef.current.playbackRate = 0.55;
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src={nebularVideo} type="video/mp4" />
        </video>

        {/* Gradient overlay — dark vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background:
              "linear-gradient(to bottom, rgba(3,6,15,0.38) 0%, rgba(3,6,15,0.55) 50%, rgba(3,6,15,0.92) 100%)",
          }}
        />

        {/* Main content — centred over video */}
        <div
          className="hero-content-pad"
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "90px 24px 24px",
            gap: 0,
          }}
        >
          {/* Headline */}
          <h1
            className="syne anim-1"
            style={{
              fontWeight: 800,
              fontSize: "clamp(24px,4vw,50px)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 18,
              color: "#fff",
              textShadow: "0 2px 40px rgba(0,0,0,0.6)",
              maxWidth: 820,
            }}
          >
            The questions <span className="grad-fire">worth asking</span> live
            here.
          </h1>

          {/* Description */}
          <p
            className="anim-2"
            style={{
              fontSize: "clamp(12px,1.4vw,14px)",
              color: "rgba(220,230,245,0.75)",
              lineHeight: 1.85,
              maxWidth: 560,
              marginBottom: 24,
              textShadow: "0 1px 12px rgba(0,0,0,0.5)",
            }}
          >
            4Life Mystery is a space for real conversations about life — its
            meaning, its mysteries, and everything between. No algorithm. No
            noise. Just honest human thought.
          </p>

          {/* Stats */}
          <div
            className="hero-stats anim-3"
            style={{
              display: "flex",
              gap: 32,
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            {[
              [
                heroStats
                  ? counterVals.followers >= 1000000
                    ? (counterVals.followers / 1000000).toFixed(1) + "M"
                    : counterVals.followers >= 1000
                      ? Math.round(counterVals.followers / 1000) + "K"
                      : counterVals.followers
                  : "10K+",
                "FOLLOWERS",
              ],
              [heroStats ? counterVals.episodes || "50+" : "50+", "EPISODES"],
              [
                heroStats
                  ? counterVals.views >= 1000000
                    ? (counterVals.views / 1000000).toFixed(1) + "M"
                    : counterVals.views >= 1000
                      ? Math.round(counterVals.views / 1000) + "K"
                      : counterVals.views || "0"
                  : "4K+",
                "VIEWS",
              ],
              [
                heroStats
                  ? counterVals.comments >= 1000
                    ? Math.round(counterVals.comments / 1000) + "K+"
                    : counterVals.comments || "0"
                  : "∞",
                "COMMENTS",
              ],
            ].map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div
                  className="syne grad-fire"
                  style={{
                    fontWeight: 800,
                    fontSize: "clamp(20px,3vw,30px)",
                    filter: heroStats ? "none" : "blur(6px)",
                    transition: "filter 0.5s",
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: "0.2em",
                    marginTop: 4,
                  }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div
            className="anim-4 btn-group"
            style={{
              justifyContent: "center",
              width: "100%",
              maxWidth: 500,
              marginBottom: 8,
            }}
          >
            <button
              onClick={() => scrollTo("content")}
              className="lp-btn lp-btn-fire"
              style={{ flex: 1, display: "flex", justifyContent: "center" }}
            >
              EXPLORE CONTENT
            </button>
            <a
              href={SOCIAL.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn lp-btn-ghost"
              style={{
                flex: 1,
                color: "#fff",
                borderColor: "rgba(255,255,255,0.22)",
                justifyContent: "center",
              }}
            >
              ▶ WATCH ON YOUTUBE
            </a>
          </div>
        </div>

        {/* Bottom bar — privacy links + scroll nudge */}
        <div
          className="hero-bottom-bar"
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 28px 20px",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.22)",
                letterSpacing: "0.1em",
              }}
            >
              4LIFEMYSTERY.COM
            </span>
            <Link
              to="/privacy-policy"
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.42)",
                textDecoration: "none",
                letterSpacing: "0.08em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ff7755")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.42)")
              }
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-service"
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.42)",
                textDecoration: "none",
                letterSpacing: "0.08em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ff7755")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.42)")
              }
            >
              Terms of Service
            </Link>
          </div>
          <button
            onClick={() => scrollTo("about")}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.28)",
                letterSpacing: "0.2em",
              }}
            >
              SCROLL
            </span>
            <div
              style={{
                width: 24,
                height: 38,
                border: "1px solid rgba(255,80,30,0.4)",
                borderRadius: 12,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 5,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#ff5533",
                  animation: "scrollPulse 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </button>
        </div>
      </section>

      {/* ══ ABOUT ═════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        style={{
          padding: "100px 20px",
          background: c.bgAlt,
          borderTop: `1px solid ${c.secBr}`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div
            className="about-grid scroll-reveal"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "stretch",
            }}
          >
            {/* Face image — default; click to play video */}
            <div
              style={{
                position: "relative",
                borderRadius: 24,
                overflow: "hidden",
                minHeight: 520,
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,80,30,0.15)",
                height: "100%",
                cursor: "pointer",
              }}
              className="face-feature"
            >
              {/* Video autoplays; poster image shows as fallback if video can't load */}
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={faceImg}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  zIndex: 1,
                }}
              >
                <source src={sea_shower} type="video/mp4" />
              </video>
              {/* Gradient overlay with name badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background:
                    "linear-gradient(to top, rgba(3,6,15,0.92) 0%, transparent 55%)",
                  padding: "32px 24px 24px",
                }}
              >
                <div
                  className="syne"
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#fff",
                    marginBottom: 4,
                  }}
                >
                  4Life Mystery
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,160,100,0.8)",
                    letterSpacing: "0.14em",
                  }}
                >
                  CREATOR · THINKER · STORYTELLER
                </div>
              </div>
              {/* Fire glow corners */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  boxShadow: "inset 0 0 60px rgba(255,60,20,0.08)",
                  pointerEvents: "none",
                }}
              />
            </div>

            <div>
              <h2
                className="syne"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(28px,4vw,44px)",
                  lineHeight: 1.18,
                  marginBottom: 20,
                  color: c.text,
                }}
              >
                A community built on{" "}
                <span className="grad-fire">radical honesty.</span>
              </h2>
              <p
                style={{
                  color: c.textM,
                  lineHeight: 1.92,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                We live in a world that moves fast and talks loud, but rarely
                stops to ask the questions that actually matter. 4Life Mystery
                is the pause — the space where you sit with the uncomfortable,
                the unexplained, and the deeply human.
              </p>
              <p
                style={{
                  color: c.textM,
                  lineHeight: 1.92,
                  fontSize: 13,
                  marginBottom: 32,
                }}
              >
                Whether you're questioning your purpose, processing grief,
                navigating relationships, or just curious about what it means to
                be alive — you belong here.
              </p>

              <div
                className="about-pillars"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginBottom: 32,
                }}
              >
                {[
                  {
                    icon: "◈",
                    title: "Depth",
                    desc: "No surface-level takes. Every piece goes deep.",
                  },
                  {
                    icon: "◇",
                    title: "Honesty",
                    desc: "Real experiences, real feelings — no performance.",
                  },
                  {
                    icon: "◉",
                    title: "Community",
                    desc: "A growing space of thinkers and honest questioners.",
                  },
                  {
                    icon: "◐",
                    title: "Mystery",
                    desc: "Questions without easy answers — that's the point.",
                  },
                ].map((p) => (
                  <div
                    key={p.title}
                    className="lp-card"
                    style={{
                      padding: 18,
                      "--card-bg": c.cardBg,
                      "--card-br": c.cardBr,
                      "--card-sh": c.cardSh,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        color: "#ff5533",
                        marginBottom: 10,
                      }}
                    >
                      {p.icon}
                    </div>
                    <div
                      className="syne"
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 7,
                        color: c.text,
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{ fontSize: 11, color: c.textM, lineHeight: 1.7 }}
                    >
                      {p.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className="btn-group">
                <a
                  href={SOCIAL.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn lp-btn-fire"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  JOIN THE CONVERSATION
                </a>
                <button
                  onClick={() => scrollTo("community")}
                  className="lp-btn lp-btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  COMMUNITY →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CAROUSEL ══════════════════════════════════════════════════════════ */}
      <section
        id="content"
        style={{
          padding: "100px 20px",
          borderTop: `1px solid ${c.secBr}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Parallax photo background — face */}
        <div
          ref={contentBgRef}
          style={{
            position: "absolute",
            inset: "-30% 0",
            backgroundImage: `url(${faceImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
            opacity: 0.1,
            willChange: "transform",
            transform: "scale(1.3)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(160deg,rgba(3,6,15,0.94) 0%,rgba(5,2,10,0.88) 50%,rgba(3,6,15,0.94) 100%)",
          }}
        />
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 40,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <span className="section-tag">FEATURED CONTENT</span>
              <h2
                className="syne"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(26px,4vw,38px)",
                  color: c.text,
                }}
              >
                Latest from <span className="grad-fire">4Life Mystery</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                ["←", goPrev],
                ["→", goNext],
              ].map(([lbl, fn]) => (
                <button
                  key={lbl}
                  onClick={fn}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    border: `1px solid ${c.cardBr}`,
                    background: c.cardBg,
                    color: c.textM,
                    cursor: "pointer",
                    fontSize: 18,
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: c.cardSh,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,80,30,0.45)";
                    e.currentTarget.style.color = "#ff6633";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = c.cardBr;
                    e.currentTarget.style.color = c.textM;
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div
            className="carousel-main"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 20,
              minHeight: "40vh",
              marginBottom: 24,
              alignItems: "stretch",
            }}
          >
            <div
              key={`slide-${carouselIdx}`}
              className={
                slideDir === "right" ? "carousel-slide" : "carousel-slide-icon"
              }
              style={{
                background: c.cardBg,
                border: `1px solid ${item.color}28`,
                borderRadius: 18,
                padding: "30px 28px",
                display: "flex",
                flexDirection: "column",
                boxShadow: c.cardSh,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    padding: "5px 12px",
                    borderRadius: 100,
                    background: `${item.color}14`,
                    color: item.color,
                    border: `1px solid ${item.color}28`,
                    letterSpacing: "0.12em",
                  }}
                >
                  {item.platform}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: c.textD,
                    letterSpacing: "0.1em",
                  }}
                >
                  {item.tag}
                </span>
              </div>
              <h3
                className="syne"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(20px,2.5vw,27px)",
                  lineHeight: 1.28,
                  marginBottom: 16,
                  color: c.text,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  color: c.textM,
                  lineHeight: 1.84,
                  fontSize: 13,
                  flex: 1,
                  marginBottom: 28,
                }}
              >
                {item.excerpt}
              </p>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn lp-btn-fire feat-cta-btn"
                style={{ alignSelf: "flex-start" }}
              >
                {item.icon} WATCH / LISTEN NOW
              </a>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 7,
              marginBottom: 24,
            }}
          >
            {CAROUSEL.map((_, i) => (
              <button
                key={i}
                className="c-dot"
                onClick={() => goTo(i)}
                style={{
                  width: i === carouselIdx ? 26 : 8,
                  background: i === carouselIdx ? "#ff5533" : c.cardBr,
                }}
              />
            ))}
          </div>

        </div>
      </section>

      {/* ══ TIKTOK STRIP ══════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "56px 20px",
          background: "rgba(0,242,234,0.013)",
          borderTop: "1px solid rgba(0,242,234,0.06)",
          borderBottom: "1px solid rgba(0,242,234,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(0,242,234,0.08)",
                border: "1px solid rgba(0,242,234,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                color: "#00f2ea",
                flexShrink: 0,
                transition: "transform 0.3s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.1) rotate(5deg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1) rotate(0deg)")
              }
            >
              ♪
            </div>
            <div>
              <div
                className="syne"
                style={{
                  fontWeight: 700,
                  fontSize: "clamp(15px,2.5vw,18px)",
                  marginBottom: 4,
                  color: c.text,
                }}
              >
                @lifemystery183284 on TikTok
              </div>
              <div style={{ fontSize: 12, color: c.textM }}>
                60-second truths. Bite-sized thoughts that hit hard.
              </div>
            </div>
          </div>
          <a
            href={SOCIAL.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn lp-btn-ghost tiktok-btn"
            style={{ borderColor: "rgba(0,242,234,0.3)", color: "#00f2ea" }}
          >
            ♪ FOLLOW ON TIKTOK
          </a>
        </div>
      </section>

      {/* ══ YOUTUBE VIDEOS ════════════════════════════════════════════════════ */}
      <section
        id="videos"
        style={{
          padding: "50px 20px 110px",
          borderTop: `1px solid ${c.secBr}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Parallax background — freedom.jpg */}
        <div
          ref={videoBgRef}
          style={{
            position: "absolute",
            inset: "-35% 0",
            backgroundImage: `url(${freedomImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center 45%",
            opacity: 0.42,
            willChange: "transform",
            transform: "scale(1.35)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(160deg,rgba(3,6,15,0.55) 0%,rgba(3,6,15,0.25) 50%,rgba(3,6,15,0.55) 100%)",
          }}
        />

        <div
          className="scroll-reveal"
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Header — centered */}
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span className="section-tag" style={{ color: "#ff0000" }}>
              YOUTUBE
            </span>
            <h2
              className="syne"
              style={{
                fontWeight: 800,
                fontSize: "clamp(26px,4vw,42px)",
                color: c.text,
                marginBottom: 10,
              }}
            >
              Latest <span className="grad-fire">videos</span>
            </h2>
            <p
              style={{
                fontSize: 13,
                color: c.textM,
                letterSpacing: "0.04em",
                marginBottom: 22,
              }}
            >
              Watch on YouTube · New content weekly
            </p>
            <a
              href={SOCIAL.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn lp-btn-ghost"
              style={{
                fontSize: 11,
                borderColor: "rgba(200,30,30,0.35)",
                color: "#ff5533",
                display: "inline-flex",
              }}
            >
              ▶ VIEW CHANNEL →
            </a>
          </div>

          {/* Netflix Hero */}
          {ytLoading ? (
            <div
              className="yt-skeleton"
              style={{
                width: "100%",
                height: "clamp(280px,42vw,560px)",
                borderRadius: 20,
              }}
            />
          ) : (
            (() => {
              const heroVideos = ytVideos.slice(0, 3);
              if (heroVideos.length === 0)
                return (
                  <div
                    style={{
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#0a0a14",
                      border: "1px solid rgba(255,85,51,0.2)",
                      boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                      padding: "48px 52px",
                      minHeight: 280,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 24,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(ellipse at 70% 50%, rgba(255,85,51,0.08) 0%, rgba(0,0,0,0) 70%)",
                        pointerEvents: "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        color: "#ff5533",
                        background: "rgba(255,85,51,0.12)",
                        border: "1px solid rgba(255,85,51,0.25)",
                        padding: "4px 12px",
                        borderRadius: 20,
                        alignSelf: "flex-start",
                      }}
                    >
                      ▶ YOUTUBE
                    </span>
                    <h3
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 800,
                        fontSize: "clamp(20px,3vw,32px)",
                        color: "#fff",
                        lineHeight: 1.2,
                        marginBottom: 8,
                      }}
                    >
                      4Life Mystery — Uncover the Unknown
                    </h3>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.45)",
                        fontSize: 13,
                        lineHeight: 1.7,
                        maxWidth: 460,
                      }}
                    >
                      Deep dives into existence, consciousness, and the
                      questions mainstream media won't touch. New videos weekly.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        marginTop: 8,
                      }}
                    >
                      <a
                        href={SOCIAL.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 28px",
                          borderRadius: 50,
                          background: "#ff0000",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textDecoration: "none",
                          boxShadow: "0 8px 32px rgba(255,0,0,0.4)",
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="white"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        WATCH ON YOUTUBE
                      </a>
                    </div>
                  </div>
                );
              const v = heroVideos[ytIdx % heroVideos.length];
              const total = heroVideos.length;
              return (
                <div onMouseEnter={ytPause} onMouseLeave={ytResume}>
                  <div
                    style={{
                      position: "relative",
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#0a0a14",
                      border: "1px solid rgba(255,85,51,0.2)",
                      boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                    }}
                  >
                    {/* Static branded background */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(ellipse at 70% 50%, rgba(255,85,51,0.08) 0%, rgba(0,0,0,0) 70%), linear-gradient(135deg, rgba(255,85,51,0.04) 0%, rgba(0,0,0,0) 100%)",
                        pointerEvents: "none",
                      }}
                    />

                    <div
                      key={v.id}
                      style={{
                        padding: "48px 52px",
                        minHeight: 340,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {/* Top badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 24,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.18em",
                            color: "#ff5533",
                            background: "rgba(255,85,51,0.12)",
                            border: "1px solid rgba(255,85,51,0.25)",
                            padding: "4px 12px",
                            borderRadius: 20,
                          }}
                        >
                          ▶ YOUTUBE
                        </span>
                        {v.duration && (
                          <span
                            style={{
                              fontSize: 10,
                              color: "rgba(255,255,255,0.35)",
                              letterSpacing: "0.1em",
                            }}
                          >
                            ⏱ {v.duration}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            fontFamily: "'Syne',sans-serif",
                            fontWeight: 800,
                            fontSize: "clamp(20px,3vw,32px)",
                            color: "#fff",
                            lineHeight: 1.2,
                            marginBottom: 16,
                            maxWidth: 480,
                          }}
                        >
                          {v.title}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            gap: 18,
                            color: "rgba(255,255,255,0.45)",
                            fontSize: 12,
                          }}
                        >
                          <span>
                            ▶ {Number(v.views || 0).toLocaleString()} views
                          </span>
                          <span>♥ {Number(v.likes || 0).toLocaleString()}</span>
                          {v.duration && <span>⏱ {v.duration}</span>}
                        </div>
                      </div>

                      {/* Big play button */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          marginTop: 32,
                        }}
                      >
                        <a
                          href={`https://www.youtube.com/watch?v=${v.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "14px 28px",
                            borderRadius: 50,
                            background: "#ff0000",
                            border: "none",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textDecoration: "none",
                            cursor: "pointer",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            boxShadow: "0 8px 32px rgba(255,0,0,0.4)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.05)";
                            e.currentTarget.style.boxShadow =
                              "0 12px 40px rgba(255,0,0,0.6)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow =
                              "0 8px 32px rgba(255,0,0,0.4)";
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="white"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          WATCH ON YOUTUBE
                        </a>
                        <a
                          href={SOCIAL.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.45)",
                            textDecoration: "none",
                            letterSpacing: "0.08em",
                          }}
                        >
                          View all videos →
                        </a>
                      </div>
                    </div>

                    {/* Side arrows */}
                    {total > 1 && (
                      <>
                        <button
                          className="yt-hero-side-arr left"
                          onClick={(e) => {
                            e.stopPropagation();
                            ytPrev();
                          }}
                        >
                          ‹
                        </button>
                        <button
                          className="yt-hero-side-arr right"
                          onClick={(e) => {
                            e.stopPropagation();
                            ytNext();
                          }}
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>

                  {/* Dots */}
                  {total > 1 && (
                    <div className="yt-hero-dots">
                      {heroVideos.map((_, i) => (
                        <button
                          key={i}
                          className="yt-hero-dot"
                          onClick={() => {
                            ytPause();
                            setYtIdx(i);
                          }}
                          style={{
                            background:
                              i === ytIdx ? "#ff5533" : "rgba(255,255,255,0.2)",
                            width: i === ytIdx ? 24 : 8,
                            borderRadius: i === ytIdx ? 4 : "50%",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* Video modal */}
          {modalVideo && (
            <div
              className="yt-modal-backdrop"
              onClick={(e) => {
                if (e.target === e.currentTarget) setModalVideo(null);
              }}
            >
              <div className="yt-modal-box">
                <div className="yt-modal-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${modalVideo.id}?autoplay=1&rel=0&modestbranding=1`}
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                    title={modalVideo.title}
                  />
                </div>
                <div className="yt-modal-bar">
                  <div className="yt-modal-title">{modalVideo.title}</div>
                  <div className="yt-modal-actions">
                    <a
                      href={`https://www.youtube.com/watch?v=${modalVideo.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="yt-modal-btn yt"
                      style={{ textDecoration: "none" }}
                    >
                      ↗ YouTube
                    </a>
                    <button
                      className="yt-modal-btn close"
                      onClick={() => setModalVideo(null)}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══ PODCAST ═══════════════════════════════════════════════════════════ */}
      <section
        id="podcast"
        style={{ padding: "100px 20px", borderTop: `1px solid ${c.secBr}` }}
      >
        <div
          className="scroll-reveal"
          style={{ maxWidth: 1180, margin: "0 auto" }}
        >
          <span className="section-tag" style={{ color: "#1db954" }}>
            PODCAST
          </span>
          <div
            className="podcast-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "start",
            }}
          >
            <div>
              <h2
                className="syne"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(28px,4vw,44px)",
                  lineHeight: 1.18,
                  marginBottom: 20,
                  color: c.text,
                }}
              >
                Listen on{" "}
                <span
                  style={{
                    color: podcastTab === "spotify" ? "#1db954" : "#f26522",
                  }}
                >
                  {podcastTab === "spotify"
                    ? "Spotify."
                    : podcastTab === "buzzsprout"
                      ? "Buzzsprout."
                      : "Podbean."}
                </span>
              </h2>
              <p
                style={{
                  color: c.textM,
                  lineHeight: 1.92,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                The 4Life Mystery podcast goes even deeper. Long-form
                conversations — no time limits, no edits, no filter.
              </p>
              <p
                style={{
                  color: c.textM,
                  lineHeight: 1.92,
                  fontSize: 13,
                  marginBottom: 28,
                }}
              >
                From the mystery of consciousness to navigating grief, love, and
                the strangeness of being human. New episodes every week.
              </p>

              {/* Platform tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <button
                  onClick={() => setPodcastTab("spotify")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 20,
                    border: `1px solid ${podcastTab === "spotify" ? "#1db954" : "rgba(255,255,255,0.12)"}`,
                    background:
                      podcastTab === "spotify"
                        ? "rgba(29,185,84,0.15)"
                        : "transparent",
                    color: podcastTab === "spotify" ? "#1db954" : c.textM,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.07em",
                    transition: "all 0.2s",
                  }}
                >
                  ◎ SPOTIFY
                </button>
                <button
                  onClick={() => setPodcastTab("buzzsprout")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 20,
                    border: `1px solid ${podcastTab === "buzzsprout" ? "#f26522" : "rgba(255,255,255,0.12)"}`,
                    background:
                      podcastTab === "buzzsprout"
                        ? "rgba(242,101,34,0.15)"
                        : "transparent",
                    color: podcastTab === "buzzsprout" ? "#f26522" : c.textM,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.07em",
                    transition: "all 0.2s",
                  }}
                >
                  🎙 BUZZSPROUT
                </button>
                <button
                  onClick={() => setPodcastTab("podbean")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 20,
                    border: `1px solid ${podcastTab === "podbean" ? "#f26522" : "rgba(255,255,255,0.12)"}`,
                    background:
                      podcastTab === "podbean"
                        ? "rgba(242,101,34,0.15)"
                        : "transparent",
                    color: podcastTab === "podbean" ? "#f26522" : c.textM,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.07em",
                    transition: "all 0.2s",
                  }}
                >
                  🎙 PODBEAN
                </button>
              </div>

              <div className="btn-group podcast-btns">
                <a
                  href={
                    podcastTab === "spotify"
                      ? SOCIAL.spotify
                      : podcastTab === "buzzsprout"
                        ? `https://www.buzzsprout.com/${BUZZSPROUT_PODCAST_ID}`
                        : "https://www.podbean.com/site/podcatcher/index/blog/UrMKq7tJWM6P"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background:
                      podcastTab === "spotify"
                        ? "rgba(29,185,84,0.12)"
                        : "rgba(242,101,34,0.12)",
                    border: `1px solid ${podcastTab === "spotify" ? "rgba(29,185,84,0.35)" : "rgba(242,101,34,0.35)"}`,
                    color: podcastTab === "spotify" ? "#1db954" : "#f26522",
                  }}
                >
                  ◎ LISTEN NOW
                </a>
                <a
                  href={
                    podcastTab === "spotify"
                      ? SOCIAL.spotify
                      : podcastTab === "buzzsprout"
                        ? `https://www.buzzsprout.com/${BUZZSPROUT_PODCAST_ID}`
                        : "https://www.podbean.com/site/podcatcher/index/blog/UrMKq7tJWM6P"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn lp-btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  ALL EPISODES →
                </a>
              </div>
            </div>

            {/* Player — switches between Spotify carousel and Buzzsprout embed */}
            <div>
              {podcastTab === "spotify" ? (
                <SpotifyCarousel />
              ) : podcastTab === "buzzsprout" ? (
                <BuzzsproutPlayer size="large" />
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(242,101,34,0.25)",
                    boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
                    background: "rgba(3,6,15,0.85)",
                    minHeight: 150,
                  }}
                >
                  <iframe
                    title="4Life Mystery Podcast on Podbean"
                    allowTransparency="true"
                    height="150"
                    width="100%"
                    style={{
                      border: "none",
                      minWidth: "min(100%, 430px)",
                      height: "150px",
                      display: "block",
                    }}
                    scrolling="no"
                    data-name="pb-iframe-player"
                    src="https://www.podbean.com/player-v2/?i=8qrdu-1a6efa9-pb&from=pb6admin&share=1&download=1&rtl=0&fonts=Arial&skin=1&font-color=auto&logo_link=episode_page&btn-skin=7"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TOPICS ════════════════════════════════════════════════════════════ */}
      <section
        id="topics"
        style={{
          padding: "100px 20px",
          position: "relative",
          overflow: "hidden",
          borderTop: `1px solid ${c.secBr}`,
          borderBottom: `1px solid ${c.secBr}`,
        }}
      >
        {/* Parallax photo background — jajja2 */}
        <div
          ref={topicsBgRef}
          style={{
            position: "absolute",
            inset: "-35% 0",
            backgroundImage: `url(${jajja2})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 1,
            willChange: "transform",
            transform: "scale(1.35)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(160deg,rgba(3,6,15,0.94) 0%,rgba(3,6,15,0.78) 50%,rgba(3,6,15,0.94) 100%)",
          }}
        />
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span className="section-tag">EXPLORE TOPICS</span>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <h2
              className="syne"
              style={{
                fontWeight: 800,
                fontSize: "clamp(26px,4vw,38px)",
                color: c.text,
              }}
            >
              What moves <span className="grad-fire">you?</span>
            </h2>
            <p
              style={{
                color: c.textM,
                fontSize: 12,
                lineHeight: 1.7,
                maxWidth: 340,
              }}
            >
              Every topic is a doorway. Pick one that resonates.
            </p>
          </div>
          <div className="topics-grid">
            {TOPICS.map((t2) => (
              <a
                key={t2.name}
                href={SOCIAL.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="topic-pill"
                style={{
                  background: c.cardBg,
                  border: `1px solid ${c.cardBr}`,
                  color: c.textM,
                  boxShadow: c.cardSh,
                }}
              >
                <span style={{ color: "#ff5533" }}>{t2.icon}</span>
                <span style={{ flex: 1 }}>{t2.name}</span>
                <span style={{ fontSize: 9, color: c.textD, flexShrink: 0 }}>
                  {t2.count}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MATRIX VIDEO BREAK ════════════════════════════════════════════════ */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "min(420px,55vw)",
          overflow: "hidden",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        >
          <source src={metrixVideo} type="video/mp4" />
        </video>
        {/* vignette + tinted overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(3,6,15,0.65) 0%, rgba(3,6,15,0.35) 50%, rgba(3,6,15,0.72) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          <div
            className="syne"
            style={{
              fontWeight: 800,
              fontSize: "clamp(20px,4vw,42px)",
              color: "#fff",
              letterSpacing: "-0.02em",
              textShadow: "0 2px 30px rgba(0,0,0,0.7)",
            }}
          >
            The answers are <span className="grad-fire">out there.</span>
          </div>
          <p
            style={{
              fontSize: "clamp(12px,1.4vw,15px)",
              color: "rgba(200,215,235,0.7)",
              maxWidth: 560,
              lineHeight: 1.75,
            }}
          >
            Every mystery starts with a question. Join the community.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => scrollTo("community")}
              className="lp-btn lp-btn-fire"
            >
              JOIN THE COMMUNITY
            </button>
            <button
              onClick={() => setBmcMsg(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "11px 20px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(230,220,200,0.9)",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                letterSpacing: "0.06em",
                backdropFilter: "blur(6px)",
                cursor: "pointer",
                opacity: 0.85,
                transition: "background 0.2s, border-color 0.2s",
              }}
              title="Support coming soon!"
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,180,60,0.12)"; e.currentTarget.style.borderColor = "rgba(255,180,60,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
            >
              ☕ BUY ME A COFFEE
            </button>
            {bmcMsg && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 14px", borderRadius: 8,
                background: "rgba(255,180,60,0.1)", border: "1px solid rgba(255,180,60,0.3)",
                color: "rgba(255,210,120,0.95)", fontSize: 12, fontFamily: "inherit",
                animation: "fadeIn 0.2s",
              }}>
                💛 Thank you so much! Support functionality is coming very soon — stay tuned!
                <button onClick={() => setBmcMsg(false)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 14, opacity: 0.7 }}>✕</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ MANIFESTO ════════════════════════════════════════════════════════ */}
      <section style={{ padding: "0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", background: "linear-gradient(160deg,rgba(2,4,12,0.98) 0%,rgba(6,2,18,0.96) 50%,rgba(2,6,14,0.98) 100%)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "100px 20px" }}>
          {/* ambient orb */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 900, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(255,60,20,0.04) 0%,rgba(20,40,200,0.04) 50%,transparent 75%)", pointerEvents: "none" }} />
          <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "rgba(255,85,51,0.7)", fontWeight: 700, marginBottom: 28, textTransform: "uppercase" }}>Our Manifesto</div>
            <blockquote style={{ margin: 0, padding: 0 }}>
              <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(26px,4.5vw,52px)", lineHeight: 1.18, color: "#e8f0f8", marginBottom: 20, letterSpacing: "-0.01em" }}>
                "We exist in the space{" "}
                <span style={{ background: "linear-gradient(135deg,#ff6633,#ff3300)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>between</span>
                {" "}question and answer."
              </p>
            </blockquote>
            <div style={{ width: 60, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)", margin: "28px auto" }} />
            <p style={{ fontSize: "clamp(13px,1.6vw,16px)", color: "rgba(180,210,235,0.7)", lineHeight: 1.85, maxWidth: 600, margin: "0 auto 32px", fontWeight: 400 }}>
              4Life Mystery is not a channel. It is a conversation — one that has been happening for centuries
              in whispered rooms and sleepless nights, but was never given a stage.{" "}
              <span style={{ color: "rgba(200,225,245,0.9)" }}>Until now.</span>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "Mortality & Meaning", color: "rgba(255,85,51,0.6)" },
                { label: "Consciousness", color: "rgba(100,100,255,0.6)" },
                { label: "The Self", color: "rgba(168,85,247,0.6)" },
                { label: "Why We're Here", color: "rgba(29,185,84,0.5)" },
              ].map(t => (
                <span key={t.label} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${t.color}`, color: t.color, fontSize: 10, letterSpacing: "0.1em", fontWeight: 600 }}>{t.label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMMUNITY ═════════════════════════════════════════════════════════ */}
      <section
        id="community"
        style={{
          padding: "100px 20px 120px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Parallax photo background — jajja2 */}
        <div
          ref={communityBgRef}
          style={{
            position: "absolute",
            inset: "-35% 0",
            backgroundImage: `url(${jajja2})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            opacity: 1,
            willChange: "transform",
            transform: "scale(1.35)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(160deg,rgba(3,6,15,0.92) 0%,rgba(5,2,10,0.80) 50%,rgba(3,6,15,0.92) 100%)",
          }}
        />

        <div
          className="scroll-reveal"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span className="section-tag">COMMUNITY</span>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 40,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h2
                className="syne"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(26px,4vw,42px)",
                  lineHeight: 1.15,
                  color: c.text,
                }}
              >
                The conversation is just{" "}
                <span className="grad-fire">getting started.</span>
              </h2>
              <p
                style={{
                  color: c.textM,
                  fontSize: 13,
                  lineHeight: 1.84,
                  maxWidth: 560,
                  marginTop: 14,
                }}
              >
                Share your thoughts, ask questions, or tell us what you want
                explored next.
              </p>
            </div>
            <div className="btn-group" style={{ marginTop: 4 }}>
              <a
                href={SOCIAL.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn lp-btn-fire"
                style={{ flex: 1, justifyContent: "center" }}
              >
                ▶ YOUTUBE
              </a>
              <a
                href={SOCIAL.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn lp-btn-ghost"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  borderColor: "rgba(0,242,234,0.3)",
                  color: "#00f2ea",
                }}
              >
                ♪ TIKTOK
              </a>
              <a
                href={SOCIAL.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn lp-btn-ghost"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  borderColor: "rgba(29,185,84,0.3)",
                  color: "#1db954",
                }}
              >
                ◎ SPOTIFY
              </a>
            </div>
          </div>
          <BlogSection c={c} theme={theme} />
        </div>
      </section>

      {/* ══ EXCLUSIVE CONTENT SUBSCRIPTION ════════════════════════════════════ */}
      <ExclusiveSection
        c={c}
        subUser={subUser}
        onLogin={(u) => { setSubUser(u); setShowLibrary(true); }}
        onLogout={() => setSubUser(null)}
      />

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(3,6,15,0.98) 40%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle top glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "60%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,85,51,0.4), rgba(29,185,84,0.3), transparent)",
          }}
        />

        {/* Top CTA band */}
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: "40px 20px",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(18px,2.5vw,26px)",
                  color: "#e8f4ff",
                  marginBottom: 4,
                }}
              >
                New episodes, every week.
              </div>
              <div style={{ fontSize: 13, color: "#8ab8d4" }}>
                Subscribe and never miss a deep dive.
              </div>
            </div>
            <a
              href={SOCIAL.youtube}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 50, background: "rgba(255,85,51,0.12)", border: "1px solid rgba(255,85,51,0.3)", color: "#ff5533", fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,85,51,0.22)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,85,51,0.12)")}
            >
              ▶ YOUTUBE
            </a>
          </div>
        </div>

        {/* Main grid */}
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "56px 20px 40px",
          }}
        >
          <div
            className="footer-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 1fr 1.2fr 1fr",
              gap: 40,
              marginBottom: 52,
            }}
          >
            {/* Brand column */}
            <div>
              <img
                src={lifeLogoLong}
                alt="4Life Mystery"
                style={{
                  height: 36,
                  width: "auto",
                  objectFit: "contain",
                  marginBottom: 14,
                }}
              />
              <p
                style={{
                  fontSize: 13,
                  color: "#8ab8d4",
                  lineHeight: 1.88,
                  maxWidth: 260,
                  marginBottom: 22,
                }}
              >
                Real conversations about life — its meaning, its mysteries, and
                everything in between. No filter. No algorithm. Just truth.
              </p>
              {/* Social pills */}
              <div
                className="soc-icon-row"
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
              >
                {[
                  {
                    href: SOCIAL.youtube,
                    icon: "▶",
                    label: "YouTube",
                    color: "#ff5533",
                    bg: "rgba(255,85,51,0.12)",
                  },
                  {
                    href: SOCIAL.spotify,
                    icon: "◎",
                    label: "Spotify",
                    color: "#1db954",
                    bg: "rgba(29,185,84,0.10)",
                  },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 14px",
                      borderRadius: 50,
                      background: s.bg,
                      border: `1px solid ${s.color}22`,
                      color: s.color,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textDecoration: "none",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = s.color + "28";
                      e.currentTarget.style.borderColor = s.color + "55";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = s.bg;
                      e.currentTarget.style.borderColor = s.color + "22";
                    }}
                  >
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Navigate */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "#5a8aaa",
                  marginBottom: 20,
                  fontWeight: 700,
                }}
              >
                EXPLORE
              </div>
              {SECTIONS.filter((s) => s.id !== "hero").map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="ft-link"
                  style={{
                    display: "block",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "5px 0",
                    fontSize: 13,
                    color: "#8ab8d4",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#e8f4ff")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                >
                  {label.charAt(0) + label.slice(1).toLowerCase()}
                </button>
              ))}
              <button
                onClick={() => scrollTo("hero")}
                className="ft-link"
                style={{
                  display: "block",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px 0",
                  fontSize: 13,
                  color: "#8ab8d4",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e8f4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8ab8d4")}
              >
                Home
              </button>
            </div>

            {/* Platforms */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "#5a8aaa",
                  marginBottom: 20,
                  fontWeight: 700,
                }}
              >
                LISTEN & WATCH
              </div>
              {[
                {
                  href: SOCIAL.youtube,
                  icon: "▶",
                  label: "YouTube",
                  color: "#ff5533",
                },
                {
                  href: SOCIAL.spotify,
                  icon: "◎",
                  label: "Spotify Podcast",
                  color: "#1db954",
                },
              ].map((p) => (
                <a
                  key={p.label}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 0",
                    fontSize: 13,
                    color: "#8ab8d4",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = p.color)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                >
                  <span style={{ fontSize: 11 }}>{p.icon}</span>
                  {p.label}
                </a>
              ))}
            </div>

            {/* Legal + Contact */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "#5a8aaa",
                  marginBottom: 20,
                  fontWeight: 700,
                }}
              >
                LEGAL
              </div>
              <Link
                to="/privacy-policy"
                style={{
                  display: "block",
                  padding: "5px 0",
                  fontSize: 13,
                  color: "#8ab8d4",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e8f4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8ab8d4")}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms-of-service"
                style={{
                  display: "block",
                  padding: "5px 0",
                  fontSize: 13,
                  color: "#8ab8d4",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e8f4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8ab8d4")}
              >
                Terms of Service
              </Link>
              <Link
                to="/cookie-policy"
                style={{
                  display: "block",
                  padding: "5px 0",
                  fontSize: 13,
                  color: "#8ab8d4",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e8f4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8ab8d4")}
              >
                Cookie Policy
              </Link>
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "#5a8aaa",
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  CONTACT
                </div>
                <a
                  href="mailto:contact@4lifemystery.com"
                  style={{
                    display: "block",
                    padding: "4px 0",
                    fontSize: 12,
                    color: "#8ab8d4",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#e8f4ff")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                >
                  General: contact@4lifemystery.com
                </a>
                <a
                  href="mailto:support@4lifemystery.com"
                  style={{
                    display: "block",
                    padding: "4px 0",
                    fontSize: 12,
                    color: "#8ab8d4",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#e8f4ff")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                >
                  Support: support@4lifemystery.com
                </a>
                <Link
                  to="/login"
                  style={{
                    display: "inline-block",
                    marginTop: 14,
                    padding: "6px 16px",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 10,
                    color: "#5a8aaa",
                    textDecoration: "none",
                    letterSpacing: "0.1em",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#5a8aaa")
                  }
                >
                  STUDIO →
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="footer-bottom-bar"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#5a8aaa" }}>
              © 2026 4Life Mystery · All rights reserved.
            </div>
            <div style={{ fontSize: 12, color: "#3d6882" }}>
              Made with ♥ · 4lifemystery.com
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                ["Blog", "/blog"],
                ["Privacy", "/privacy-policy"],
                ["Terms", "/terms-of-service"],
                ["Cookies", "/cookie-policy"],
              ].map(([label, to]) => (
                <Link
                  key={label}
                  to={to}
                  style={{
                    fontSize: 11,
                    color: "#5a8aaa",
                    textDecoration: "none",
                    letterSpacing: "0.06em",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#8ab8d4")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#5a8aaa")
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Member Library Modal ─────────────────────────────────────────── */}
      {showLibrary && subUser && (
        <LibraryModal subUser={subUser} onClose={() => setShowLibrary(false)} />
      )}

      {/* Back to top */}
      <button
        className={`back-to-top${showBackTop ? "" : " hidden"}`}
        onClick={() =>
          wrapperRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        title="Back to top"
        aria-label="Back to top"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
          <path d="M12 4l-8 8h5v8h6v-8h5z" />
        </svg>
      </button>

      {/* ── Cookie Consent Banner ───────────────────────────────────────── */}
      {cookieConsent === null && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9000,
            transform: "translateY(0)",
            animation: "slideUpBanner 0.45s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <style>{`
            @keyframes slideUpBanner {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
            .cookie-banner-inner {
              background: linear-gradient(135deg, rgba(8,14,28,0.98) 0%, rgba(15,22,42,0.98) 100%);
              border-top: 1px solid rgba(255,255,255,0.09);
              backdrop-filter: blur(20px);
              padding: 22px 28px 20px;
              display: flex;
              align-items: flex-start;
              gap: 24px;
              flex-wrap: wrap;
            }
            .cookie-icon-wrap {
              width: 40px; height: 40px; flex-shrink: 0;
              background: rgba(255,80,30,0.12);
              border: 1px solid rgba(255,80,30,0.22);
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 18px; margin-top: 2px;
            }
            .cookie-text-block { flex: 1; min-width: 200px; }
            .cookie-text-block h4 {
              margin: 0 0 4px;
              font-family: 'Syne', sans-serif;
              font-size: 13px; font-weight: 700;
              color: #e0eaf5; letter-spacing: 0.05em;
            }
            .cookie-text-block p {
              margin: 0; font-size: 11px; line-height: 1.7;
              color: rgba(160,180,210,0.75);
            }
            .cookie-text-block a {
              color: rgba(255,130,80,0.85); text-decoration: underline; cursor: pointer;
            }
            .cookie-actions {
              display: flex; flex-direction: row; gap: 8px; align-items: center;
              padding-top: 4px; flex-shrink: 0;
            }
            @media (max-width: 600px) {
              .cookie-actions { flex-direction: column; align-items: stretch; width: 100%; }
              .cookie-btn { width: 100% !important; }
            }
            .cookie-btn {
              padding: 10px 18px; border-radius: 9px; font-size: 11px;
              font-family: 'DM Mono', monospace; letter-spacing: 0.09em; text-align: center;
              cursor: pointer; border: none; outline: none; transition: all 0.2s; white-space: nowrap;
            }
            .cookie-btn-accept {
              background: linear-gradient(135deg, #ff5533, #ff8040);
              color: #fff; font-weight: 600;
            }
            .cookie-btn-accept:hover { opacity: 0.88; transform: translateY(-1px); }
            .cookie-btn-decline {
              background: rgba(255,255,255,0.06);
              border: 1px solid rgba(255,255,255,0.1);
              color: rgba(160,180,210,0.8);
            }
            .cookie-btn-decline:hover { background: rgba(255,255,255,0.1); }
            .cookie-btn-manage {
              background: transparent; border: 1px solid rgba(255,130,80,0.2);
              color: rgba(255,130,80,0.8); font-size: 10px;
              padding: 8px 18px; cursor: pointer;
              font-family: 'DM Mono', monospace; letter-spacing: 0.08em;
              border-radius: 9px; width: 100%;
            }
            .cookie-btn-manage:hover { background: rgba(255,130,80,0.07); }

            /* ── Cookie Manage Modal ── */
            .cookie-modal-overlay {
              position: fixed; inset: 0; z-index: 9100;
              background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
              display: flex; align-items: flex-end; justify-content: center;
            }
            .cookie-modal {
              background: linear-gradient(160deg, rgba(8,14,28,0.99) 0%, rgba(12,20,40,0.99) 100%);
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 20px 20px 0 0;
              padding: 32px 28px 28px;
              width: 100%; max-width: 560px;
              animation: slideUpBanner 0.35s cubic-bezier(0.22,1,0.36,1) both;
            }
            .cookie-modal h3 {
              font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
              color: #e0eaf5; margin: 0 0 6px; letter-spacing: 0.05em;
            }
            .cookie-modal p { font-size: 11px; color: rgba(160,180,210,0.7); line-height: 1.75; margin: 0 0 20px; }
            .cookie-type-row {
              display: flex; align-items: flex-start; gap: 14px;
              padding: 14px 0; border-top: 1px solid rgba(255,255,255,0.06);
            }
            .cookie-type-row:last-of-type { border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
            .cookie-type-info h5 {
              font-size: 12px; font-weight: 600; color: #e0eaf5;
              margin: 0 0 3px; font-family: 'Syne', sans-serif;
            }
            .cookie-type-info p { font-size: 10px; color: rgba(160,180,210,0.6); margin: 0; line-height: 1.6; }
            .cookie-toggle {
              flex-shrink: 0; margin-top: 2px;
              width: 36px; height: 20px; border-radius: 10px;
              background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.14); position: relative;
              cursor: default;
            }
            .cookie-toggle.on { background: rgba(255,85,51,0.55); border-color: rgba(255,85,51,0.4); }
            .cookie-toggle::after {
              content: ''; position: absolute; top: 2px; left: 2px;
              width: 14px; height: 14px; border-radius: 50%;
              background: rgba(255,255,255,0.4); transition: left 0.2s;
            }
            .cookie-toggle.on::after { left: 18px; background: #fff; }
          `}</style>

          {/* Manage modal */}
          {cookieManage && (
            <div
              className="cookie-modal-overlay"
              onClick={() => setCookieManage(false)}
            >
              <div
                className="cookie-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <h3>Cookie Preferences</h3>
                <p>
                  We use cookies to enhance your experience. Below you can
                  review what each category does. Strictly necessary cookies
                  cannot be disabled.
                </p>
                <div className="cookie-type-row">
                  <div className="cookie-toggle on" title="Always active" />
                  <div className="cookie-type-info">
                    <h5>Strictly Necessary</h5>
                    <p>
                      Essential for the site to function — session handling,
                      security, and core navigation. Cannot be disabled.
                    </p>
                  </div>
                </div>
                <div className="cookie-type-row">
                  <div className="cookie-toggle on" />
                  <div className="cookie-type-info">
                    <h5>Analytics & Performance</h5>
                    <p>
                      Help us understand how visitors interact with the site so
                      we can improve content and experience. No personal data is
                      sold.
                    </p>
                  </div>
                </div>
                <div className="cookie-type-row">
                  <div className="cookie-toggle on" />
                  <div className="cookie-type-info">
                    <h5>Preferences & Personalisation</h5>
                    <p>
                      Remember your settings (e.g., theme, playback preferences)
                      across visits.
                    </p>
                  </div>
                </div>
                <div className="cookie-actions">
                  <button
                    className="cookie-btn cookie-btn-accept"
                    onClick={() => {
                      localStorage.setItem("cookie_consent", "accepted");
                      setCookieConsent("accepted");
                      setCookieManage(false);
                      setTimeout(() => setShowWelcome(true), 400);
                    }}
                  >
                    ACCEPT ALL
                  </button>
                  <button
                    className="cookie-btn cookie-btn-decline"
                    onClick={() => {
                      localStorage.setItem("cookie_consent", "declined");
                      setCookieConsent("declined");
                      setCookieManage(false);
                    }}
                  >
                    DECLINE
                  </button>
                  <button
                    className="cookie-btn cookie-btn-manage"
                    onClick={() => setCookieManage(false)}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="cookie-banner-inner">
            <div className="cookie-icon-wrap">🍪</div>
            <div className="cookie-text-block">
              <h4>We use cookies</h4>
              <p>
                4Life Mystery uses cookies to improve your experience,
                understand site traffic, and remember your preferences. By
                clicking <strong style={{ color: "#e0eaf5" }}>Accept</strong>{" "}
                you agree to our{" "}
                <a onClick={() => setCookieManage(true)} role="button">
                  Cookie Policy
                </a>
                . You can also{" "}
                <a onClick={() => setCookieManage(true)} role="button">
                  manage your preferences
                </a>
                .
              </p>
            </div>
            <div className="cookie-actions">
              <button
                className="cookie-btn cookie-btn-accept"
                onClick={() => {
                  localStorage.setItem("cookie_consent", "accepted");
                  setCookieConsent("accepted");
                  setTimeout(() => setShowWelcome(true), 500);
                }}
              >
                ACCEPT ALL
              </button>
              <button
                className="cookie-btn cookie-btn-decline"
                onClick={() => {
                  localStorage.setItem("cookie_consent", "declined");
                  setCookieConsent("declined");
                }}
              >
                DECLINE
              </button>
              <button
                className="cookie-btn cookie-btn-manage"
                onClick={() => setCookieManage(true)}
              >
                MANAGE COOKIES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Welcome Popup ───────────────────────────────────────────────── */}
      {showWelcome && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            padding: 20,
          }}
          onClick={() => setShowWelcome(false)}
        >
          <style>{`
            @keyframes welcomeIn {
              from { opacity: 0; transform: scale(0.92) translateY(16px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            .welcome-modal {
              animation: welcomeIn 0.4s cubic-bezier(0.22,1,0.36,1) both;
            }
            .sub-input-row { display: flex; gap: 8px; width: 100%; }
            .sub-input {
              flex: 1; padding: 10px 14px;
              background: rgba(255,255,255,0.06);
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 9px; color: #e0eaf5;
              font-family: 'DM Mono', monospace; font-size: 12px; outline: none;
            }
            .sub-input::placeholder { color: rgba(160,180,210,0.4); }
            .sub-submit-btn {
              padding: 10px 18px; border-radius: 9px;
              background: linear-gradient(135deg, #ff5533, #ff8040);
              border: none; color: #fff; font-size: 11px;
              font-family: 'DM Mono', monospace; letter-spacing: 0.08em;
              font-weight: 600; cursor: pointer; white-space: nowrap; transition: opacity 0.2s;
            }
            .sub-submit-btn:hover { opacity: 0.85; }
            .sub-submit-btn:disabled { opacity: 0.4; cursor: default; }
          `}</style>
          <div
            className="welcome-modal"
            style={{
              maxWidth: 500,
              width: "100%",
              background:
                "linear-gradient(145deg, rgba(8,14,28,0.98) 0%, rgba(14,22,44,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "36px 32px 30px",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowWelcome(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                background: "none",
                border: "none",
                color: "rgba(160,180,210,0.5)",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>

            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,80,30,0.12)",
                border: "1px solid rgba(255,80,30,0.2)",
                borderRadius: 20,
                padding: "4px 12px",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,130,80,0.9)",
                  letterSpacing: "0.14em",
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                ◈ WELCOME
              </span>
            </div>

            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(18px,4vw,22px)",
                color: "#e0eaf5",
                margin: "0 0 14px",
                lineHeight: 1.3,
              }}
            >
              Glad you're here.
            </h2>

            <p
              style={{
                fontSize: 13,
                lineHeight: 1.8,
                color: "rgba(180,200,230,0.75)",
                margin: "0 0 10px",
              }}
            >
              <strong style={{ color: "#e0eaf5" }}>4Life Mystery</strong> is a
              new content media entity — here to explore the different
              dimensions of life: its mysteries, its meaning, and the things we
              rarely say out loud. Every episode, video, and conversation is
              made with intention.
            </p>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.8,
                color: "rgba(180,200,230,0.75)",
                margin: "0 0 22px",
              }}
            >
              We genuinely appreciate you being here. Feel free to subscribe to
              our{" "}
              <a
                href={SOCIAL.youtube}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "rgba(255,130,80,0.85)",
                  textDecoration: "underline",
                }}
              >
                YouTube
              </a>{" "}
              and{" "}
              <a
                href={SOCIAL.spotify}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "rgba(255,130,80,0.85)",
                  textDecoration: "underline",
                }}
              >
                Podcast
              </a>{" "}
              channels — more is on the way.
            </p>

            {/* Subscribe form */}
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "rgba(160,180,210,0.5)",
                margin: "0 0 10px",
                fontFamily: "'DM Mono',monospace",
              }}
            >
              GET NOTIFIED WHEN NEW CONTENT DROPS
            </p>
            {subStatus === "success" ? (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(30,180,90,0.1)",
                  border: "1px solid rgba(30,180,90,0.2)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "rgba(80,220,130,0.9)",
                  textAlign: "center",
                }}
              >
                ✓ You're subscribed! We'll let you know when new content drops.
              </div>
            ) : (
              <div className="sub-input-row">
                <input
                  className="sub-input"
                  type="email"
                  placeholder="your@email.com"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      document.getElementById("welcome-sub-btn")?.click();
                  }}
                />
                <button
                  id="welcome-sub-btn"
                  className="sub-submit-btn"
                  disabled={subStatus === "loading"}
                  onClick={async () => {
                    const em = subEmail.trim();
                    if (!em || !em.includes("@")) return;
                    setSubStatus("loading");
                    try {
                      const res = await fetch("/api/public/subscribe", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: em }),
                      });
                      if (res.ok) {
                        setSubStatus("success");
                        localStorage.setItem("subscribed", "1");
                      } else {
                        const d = await res.json().catch(() => ({}));
                        setSubStatus(
                          d.detail === "already_subscribed"
                            ? "success"
                            : "error",
                        );
                      }
                    } catch {
                      setSubStatus("error");
                    }
                  }}
                >
                  {subStatus === "loading" ? "…" : "SUBSCRIBE"}
                </button>
              </div>
            )}
            {subStatus === "error" && (
              <p
                style={{
                  fontSize: 10,
                  color: "rgba(255,100,80,0.8)",
                  margin: "8px 0 0",
                }}
              >
                Something went wrong — please try again.
              </p>
            )}

            <button
              onClick={() => setShowWelcome(false)}
              style={{
                marginTop: 20,
                display: "block",
                width: "100%",
                padding: "9px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 9,
                color: "rgba(160,180,210,0.5)",
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              MAYBE LATER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
