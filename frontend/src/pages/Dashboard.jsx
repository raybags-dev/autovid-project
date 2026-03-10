import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  clearCache,
  createShortFromVideo,
  deleteComment,
  deleteFromYoutube,
  deleteVideo,
  generateShortFromScratch,
  generateVideo,
  getAutoShortSettings,
  getComments,
  getQuota,
  getStats,
  getYouTubeDetails,
  listShorts,
  listVideos,
  moderateComment,
  postComment,
  replyComment,
  retryVideo,
  saveAutoShortSettings,
  syncYoutube,
  triggerAutoComment,
  triggerAutoShort,
  uploadVideo,
} from "../api/client";
import CompilationStudio from "../components/CompilationStudio";
import ScriptStudio from "../components/ScriptStudio";
import {
  ShortsModal,
  UploadModal,
  YouTubeSettingsModal,
} from "../components/YouTubeModals";
import { useAuth } from "../context/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const MOODS_CSS = [
  { id: "aurora_blue",      emoji: "🌌", label: "Aurora Blue",   aurora: "blue",   bg: "#05081a" },
  { id: "aurora_dark",      emoji: "🖤", label: "Aurora Dark",   aurora: "dark",   bg: "#080810" },
  { id: "fluid_red",        emoji: "🔴", label: "Liquid Red",    fluid: "red",     bg: "#08000a" },
  { id: "fluid_blue",       emoji: "🔵", label: "Liquid Blue",   fluid: "blue",    bg: "#00030e" },
  { id: "fluid_black",      emoji: "⚫", label: "Liquid Black",  fluid: "black",   bg: "#020202" },
  { id: "neon_purple",      emoji: "💜", label: "Neon Purple",   fluid: "purple",  bg: "#08010e" },
  { id: "gradient_wave",    emoji: "🌈", label: "Gradient Wave", bg: "#080a14" },
  { id: "starfield",        emoji: "✨", label: "Starfield",     bg: "#020408" },
  { id: "geometric_pulse",  emoji: "◆",  label: "Geometric",     bg: "#0a0a12" },
  { id: "cosmic_dust",      emoji: "🌌", label: "Cosmic Dust",   bg: "#020408" },
  { id: "ember_glow",       emoji: "🔥", label: "Ember Glow",    bg: "#080200" },
];
const MOODS_STOCK = [
  { id: "inspirational", emoji: "🔥", label: "Inspirational", bg: null },
  { id: "educational",   emoji: "🧠", label: "Educational",   bg: null },
  { id: "dramatic",      emoji: "⚡", label: "Dramatic",      bg: null },
  { id: "reflective",    emoji: "🌊", label: "Reflective",    bg: null },
];
const MOODS_GRID = [...MOODS_CSS, ...MOODS_STOCK];
const STEPS = [
  "Script",
  "Voice",
  "Clips",
  "Assembly",
  "Captions",
  "Labels",
  "Upload",
];
const STATUS = {
  posted: {
    label: "LIVE",
    color: "#00c070",
    bg: "rgba(0,192,112,0.08)",
    pulse: "#00c070",
  },
  ready: {
    label: "READY",
    color: "#e09000",
    bg: "rgba(224,144,0,0.08)",
    pulse: "#e09000",
  },
  failed: {
    label: "FAILED",
    color: "#e03050",
    bg: "rgba(224,48,80,0.08)",
    pulse: "#e03050",
  },
  generating: {
    label: "GENERATING",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  scripted: {
    label: "SCRIPTED",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  voiced: {
    label: "VOICED",
    color: "#0090d0",
    bg: "rgba(0,144,208,0.08)",
    pulse: "#0090d0",
  },
  assembled: {
    label: "ASSEMBLING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  captioned: {
    label: "CAPTIONING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  labeled: {
    label: "LABELING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
  uploading: {
    label: "UPLOADING",
    color: "#9060e0",
    bg: "rgba(144,96,224,0.08)",
    pulse: "#9060e0",
  },
};
const IN_PROGRESS = [
  "generating",
  "scripted",
  "voiced",
  "assembled",
  "captioned",
  "labeled",
  "uploading",
];
const STEP_MAP = {
  generating: 1,
  scripted: 2,
  voiced: 3,
  assembled: 4,
  captioned: 5,
  labeled: 6,
  uploading: 7,
};
const fmtNum = (n) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1000
      ? (n / 1000).toFixed(1) + "K"
      : String(n || 0);
const timeAgo = (d) => {
  if (!d) return "—";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
const fmtDur = (s) =>
  s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—";

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#111318", // dark charcoal — not pure black
    bgSub: "#1a1d24",
    bgDeep: "#0c0e13",
    bgCard: "#1e2128", // card slightly lighter than bg
    bgCardHover: "#252830",
    border: "#2e3340", // clearly visible border
    borderHover: "#4a9eff",
    text: "#f0f2f5", // near-white, crisp
    textMid: "#c8cdd8", // clearly readable secondary
    textDim: "#8892a4", // visible tertiary
    textFaint: "#5a6478", // visible metadata
    inputBg: "#13151a",
    topBar: "#13151a",
    accent: "#4a9eff", // vivid blue
    accentGreen: "#3dd68c", // vivid green
    accentRed: "#ff5c6c", // vivid red
    accentYellow: "#ffb020", // vivid amber
    scrollThumb: "#2e3340",
  },
  light: {
    bg: "#f0f2f5", // neutral cool grey
    bgSub: "#e4e7ed",
    bgDeep: "#d8dce5",
    bgCard: "#ffffff",
    bgCardHover: "#f5f7fa",
    border: "#d0d5de", // clearly visible border
    borderHover: "#2563eb",
    text: "#111827", // near-black, maximum contrast
    textMid: "#374151", // dark readable secondary
    textDim: "#4b5563", // readable tertiary
    textFaint: "#6b7280", // readable metadata — NOT faint
    inputBg: "#ffffff",
    topBar: "#ffffff",
    accent: "#2563eb", // vivid blue
    accentGreen: "#059669", // vivid green
    accentRed: "#dc2626", // vivid red
    accentYellow: "#d97706", // vivid amber
    scrollThumb: "#c1c9d6",
  },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pageReady, setPageReady] = useState(false); // true after first data load
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({});
  const [quota, setQuota] = useState({});
  const [filter, setFilter] = useState("all");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [profile, setProfile] = useState("educational");
  const [visualMood, setVisualMood] = useState("inspirational");
  const [musicStyle, setMusicStyle] = useState("ambient");
  const [pipeStep, setPipeStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null); // video being previewed
  const [tab, setTab] = useState("videos");
  const [tabLoading, setTabLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {id, hasYoutube, youtubeId}
  const [syncing, setSyncing] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(null); // string message or null
  const [ytModal, setYtModal] = useState(null); // video being managed on YT
  const [ytDetails, setYtDetails] = useState(null); // full YT details
  const [ytComments, setYtComments] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [deleteYtConfirm, setDeleteYtConfirm] = useState(null);
  // Inline comments panel per video card
  const [openComments, setOpenComments] = useState(null); // video_id with panel open
  const [cardComments, setCardComments] = useState({}); // { video_id: [...comments] }
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // thread_id being replied to
  const [replyText, setReplyText] = useState("");
  const [cardCommentText, setCardCommentText] = useState("");
  const [postingCardComment, setPostingCardComment] = useState(false);
  const [billing, setBilling] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [channelVisible, setChannelVisible] = useState(24); // how many to render
  const channelBottomRef = useRef(null);
  const [channelDeleteConfirm, setChannelDeleteConfirm] = useState(null); // {id, title}
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("autovid_theme") !== "light",
  );
  const pollRef = useRef();
  const videoRef = useRef();
  const logPollRef = useRef(null);
  const logLineRef = useRef(0);
  const [genJobId, setGenJobId] = useState(null);
  const [genLogs, setGenLogs] = useState([]);
  const [showGenLogs, setShowGenLogs] = useState(false);
  const genLogsEndRef = useRef(null);
  const [shortPrompt, setShortPrompt] = useState("");
  const [shortAmbience, setShortAmbience] = useState("stars");
  const [shortGenerating, setShortGenerating] = useState(false);
  const [shortGenError, setShortGenError] = useState("");
  const [shortClipVideoId, setShortClipVideoId] = useState("");
  const [shortClipping, setShortClipping] = useState(false);
  const [shortClipError, setShortClipError] = useState("");
  const [shortClipSuccess, setShortClipSuccess] = useState("");
  const [shortsList, setShortsList] = useState([]);
  const [shortsLoading, setShortsLoading] = useState(false);
  const [shortsHasMore, setShortsHasMore] = useState(true);
  const shortsOffsetRef = useRef(0);
  const shortsListRef = useRef(null);
  const T = isDark ? THEMES.dark : THEMES.light;

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("autovid_theme", next ? "dark" : "light");
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchBilling = useCallback(async () => {
    try {
      const res = await api.get("/billing");
      setBilling(res.data);
    } catch (e) {
      console.error("Billing fetch error:", e);
    }
  }, []);

  const isFirstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [v, s, q] = await Promise.all([
        listVideos(),
        getStats(),
        getQuota(),
      ]);
      setVideos(v);
      setStats(s);
      setQuota(q);
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        // Small delay so final render paints before we remove loader
        setTimeout(() => setPageReady(true), 150);
      }
    } catch (e) {
      console.error("Refresh error:", e);
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setPageReady(true); // show page even on error
      }
    }
  }, []);

  // Smart polling: fast when generating, slow when idle, paused when tab hidden
  useEffect(() => {
    refresh(); // initial load

    const getInterval = () => {
      const hasActive = videos.some((v) => IN_PROGRESS.includes(v.status));
      return hasActive ? 6000 : 60000; // 6s while generating, 60s when idle
    };

    const schedule = () => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "hidden") return; // don't poll hidden tab
        refresh().then(() => {
          // Reschedule with correct interval after each refresh
          schedule();
        });
      }, getInterval());
    };

    schedule();
    return () => clearInterval(pollRef.current);
  }, [refresh, videos.length]); // re-evaluate when video count changes

  // Track whether THIS SESSION started a generation (not stale DB status)
  const fetchChannel = useCallback(async (forceRefresh = false) => {
    setChannelLoading(true);
    setChannelError("");
    try {
      const url = forceRefresh
        ? "/channel/videos?refresh=true"
        : "/channel/videos";
      const res = await api.get(url);
      setChannelVideos(res.data.videos || []);
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || "";
      if (status === 429 || detail.toLowerCase().includes("quota")) {
        setChannelError(
          "⏳ YouTube API quota exceeded — resets at midnight Pacific Time. Cached data shown if available.",
        );
      } else {
        setChannelError("Failed to load channel videos. Check YouTube OAuth.");
      }
    } finally {
      setChannelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "billing") fetchBilling();
    if (tab === "channel") fetchChannel(false); // use cache, don't burn quota
    if (tab === "shorts") loadShorts(true);
  }, [tab, fetchBilling, fetchChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionGenerating = useRef(false);

  useEffect(() => {
    // Only update pipe step progress if WE started this generation
    if (!sessionGenerating.current) return;
    const active = videos.find((v) => IN_PROGRESS.includes(v.status));
    if (active) {
      setPipeStep(STEP_MAP[active.status] || 1);
    } else {
      // Pipeline finished
      sessionGenerating.current = false;
      setGenerating(false);
      setPipeStep(0);
      showToast("Video pipeline complete!");
    }
  }, [videos]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenError("");
    setGenerating(true);
    setPipeStep(1);
    setGlobalLoading("Starting pipeline...");
    setGenLogs([]);
    logLineRef.current = 0;
    sessionGenerating.current = true;
    try {
      const data = await generateVideo(
        prompt.trim(),
        false,
        profile,
        visualMood,
        musicStyle,
      );
      const vid = data.video_id;
      setGenJobId(vid);
      setPrompt("");
      setGlobalLoading(null);

      // Start log polling
      logPollRef.current = setInterval(async () => {
        try {
          const { data: logData } = await api.get(
            `/videos/${vid}/logs?since=${logLineRef.current}`,
          );
          if (logData.lines?.length > 0) {
            logLineRef.current += logData.lines.length;
            setGenLogs((prev) => [...prev, ...logData.lines].slice(-300));
            setTimeout(
              () =>
                genLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }),
              50,
            );
          }
          if (logData.done) clearInterval(logPollRef.current);
        } catch (e) {
          /* ignore */
        }
      }, 1500);

      setTimeout(refresh, 1000);
    } catch (e) {
      setGlobalLoading(null);
      setGenError(
        e.response?.data?.detail ||
          "Pipeline failed. Is the backend running on port 8000?",
      );
      setGenerating(false);
      setPipeStep(0);
    }
  };

  const handleGenCancel = async () => {
    if (!genJobId) return;
    clearInterval(logPollRef.current);
    try {
      await api.post(`/videos/${genJobId}/cancel`);
    } catch (e) {}
    setGenerating(false);
    setPipeStep(0);
    setGenError("Cancelled by you");
    showToast("Pipeline cancelled", "error");
  };

  const handleGenerateShort = async () => {
    if (!shortPrompt.trim() || shortGenerating) return;
    setShortGenError("");
    setShortGenerating(true);
    try {
      await generateShortFromScratch(shortPrompt.trim(), shortAmbience);
      setShortPrompt("");
      showToast("Short generation started — check back in a few minutes.");
    } catch (e) {
      setShortGenError(e?.response?.data?.detail || "Failed to start short generation.");
    } finally {
      setShortGenerating(false);
    }
  };

  const handleClipShort = async () => {
    if (!shortClipVideoId || shortClipping) return;
    setShortClipError("");
    setShortClipSuccess("");
    setShortClipping(true);
    try {
      await createShortFromVideo(shortClipVideoId);
      setShortClipSuccess("Short is being created and will upload to YouTube.");
      setShortClipVideoId("");
    } catch (e) {
      setShortClipError(e?.response?.data?.detail || "Failed to clip short.");
    } finally {
      setShortClipping(false);
    }
  };

  const loadShorts = async (reset = false) => {
    if (shortsLoading) return;
    if (!reset && !shortsHasMore) return;
    setShortsLoading(true);
    const offset = reset ? 0 : shortsOffsetRef.current;
    try {
      const data = await listShorts(25, offset);
      const items = Array.isArray(data) ? data : [];
      if (reset) {
        setShortsList(items);
      } else {
        setShortsList(prev => [...prev, ...items]);
      }
      shortsOffsetRef.current = offset + items.length;
      setShortsHasMore(items.length === 25);
    } catch (e) {
      console.error("Shorts load error:", e);
    } finally {
      setShortsLoading(false);
    }
  };

  const handleShortsScroll = () => {
    const el = shortsListRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom && !shortsLoading && shortsHasMore) {
      loadShorts(false);
    }
  };

  // Reset channel scroll when switching to channel tab
  useEffect(() => {
    if (tab === "channel") setChannelVisible(24);
  }, [tab]);

  // Settings tab — load auto-reply + auto-generate + auto-short
  useEffect(() => {
    if (tab !== "settings") return;
    api
      .get("/auto-reply/status")
      .then((r) => {
        setAutoReplyEnabled(r.data.enabled);
        setAutoReplyStatus(r.data);
      })
      .catch(() => {});
    api
      .get("/auto-generate/settings")
      .then((r) => {
        setAutoGenSettings(r.data);
      })
      .catch(() => {});
    api.get("/auto-short/settings").then(r => setAutoShortSettings(r.data)).catch(() => {});
  }, [tab]);

  // Infinite scroll — load more channel videos when bottom sentinel is visible
  useEffect(() => {
    if (!channelBottomRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setChannelVisible((v) => Math.min(v + 24, channelVideos.length));
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(channelBottomRef.current);
    return () => obs.disconnect();
  }, [channelVideos.length, tab]);

  const handleAutoReplyToggle = async (val) => {
    setAutoReplyEnabled(val);
    try {
      await api.post("/auto-reply/toggle", { enabled: val });
      showToast(val ? "💬 Auto-reply enabled" : "🔇 Auto-reply disabled");
    } catch (e) {
      showToast("Toggle failed", "error");
    }
  };

  const handleRetry = async (id, e) => {
    e.stopPropagation();
    try {
      await retryVideo(id);
      refresh();
      showToast("Retry started");
    } catch (e) {
      showToast("Retry failed", "error");
    }
  };
  // YouTube modal state
  const [uploadModal, setUploadModal] = useState(null); // video object
  const [ytSettingsModal, setYtSettingsModal] = useState(null); // video object
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplyStatus, setAutoReplyStatus] = useState(null);
  const [autoGenSettings, setAutoGenSettings] = useState(null);
  const [autoGenSaving, setAutoGenSaving] = useState(false);
  const [autoGenJobId, setAutoGenJobId] = useState(null);
  const [autoGenRunning, setAutoGenRunning] = useState(false);
  const [autoGenStep, setAutoGenStep] = useState(0);
  const [autoGenLogs, setAutoGenLogs] = useState([]);
  const [showAutoGenLogs, setShowAutoGenLogs] = useState(false);
  const [autoGenPrompt, setAutoGenPrompt] = useState("");
  const autoGenLogLineRef = useRef(0);
  const autoGenLogPollRef = useRef(null);
  const autoGenLogsEndRef = useRef(null);
  const [shortsModal, setShortsModal] = useState(null); // video object | "new"
  const [autoShortSettings, setAutoShortSettings] = useState(null);
  const [autoShortSaving, setAutoShortSaving] = useState(false);
  const [autoShortRunning, setAutoShortRunning] = useState(false);
  const [autoShortJobId, setAutoShortJobId] = useState(null);
  const [autoShortPrompt, setAutoShortPrompt] = useState("");
  const [autoShortStep, setAutoShortStep] = useState(0);
  const [autoShortLogs, setAutoShortLogs] = useState([]);
  const [showAutoShortLogs, setShowAutoShortLogs] = useState(false);
  const autoShortLogsEndRef = useRef(null);
  const autoShortLogPollRef = useRef(null);
  const autoShortLogLineRef = useRef(0);
  const tabTimerRef = useRef(null);

  const switchTab = (id) => {
    if (id === tab) return;
    if (tabTimerRef.current) clearTimeout(tabTimerRef.current);
    setTab(id);
    setTabLoading(true);
    tabTimerRef.current = setTimeout(() => setTabLoading(false), 800);
  };

  const handleUpload = async (id, e) => {
    e.stopPropagation();
    setGlobalLoading("Starting YouTube upload...");
    try {
      await uploadVideo(id);
      refresh();
      showToast("YouTube upload started!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Upload failed", "error");
    } finally {
      setGlobalLoading(null);
    }
  };
  const handleDelete = async (id, alsoDeleteFromYt = false) => {
    setGlobalLoading("Deleting...");
    try {
      if (alsoDeleteFromYt && deleteConfirm?.youtubeId) {
        try {
          await deleteFromYoutube(id);
        } catch (e) {
          console.warn("YT delete failed:", e);
        }
      }
      await deleteVideo(id);
      setDeleteConfirm(null);
      setSelected(null);
      refresh();
      showToast("Video deleted");
    } catch (e) {
      showToast("Delete failed", "error");
    } finally {
      setGlobalLoading(null);
    }
  };
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSync = async () => {
    setSyncing(true);
    setGlobalLoading("Syncing YouTube stats...");
    try {
      const res = await syncYoutube();
      showToast(res.message || `Synced ${res.synced} videos`);
      refresh();
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Sync failed — check YouTube token",
        "error",
      );
    } finally {
      setSyncing(false);
      setGlobalLoading(null);
    }
  };

  // Build video URL from file_path stored in DB
  // Backend serves files from /output/videos/ via FastAPI static files
  const openYtModal = async (video) => {
    setYtModal(video);
    setYtDetails(null);
    setYtComments([]);
    setYtLoading(true);
    setGlobalLoading("Loading YouTube data...");
    try {
      const [details, commentsData] = await Promise.all([
        getYouTubeDetails(video.id),
        getComments(video.id),
      ]);
      setYtDetails(details);
      setYtComments(commentsData.comments || []);
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Failed to load YouTube data",
        "error",
      );
    } finally {
      setYtLoading(false);
      setGlobalLoading(null);
    }
  };

  const handleDeleteFromYt = async (videoId) => {
    setGlobalLoading("Deleting from YouTube...");
    try {
      await deleteFromYoutube(videoId);
      setDeleteYtConfirm(null);
      setYtModal(null);
      refresh();
      showToast("Deleted from YouTube — video is now ready to re-upload");
    } catch (e) {
      showToast(
        e.response?.data?.detail || "Delete from YouTube failed",
        "error",
      );
    } finally {
      setGlobalLoading(null);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !ytModal) return;
    setPostingComment(true);
    try {
      await postComment(ytModal.id, newComment.trim());
      setNewComment("");
      // Refresh comments
      const data = await getComments(ytModal.id);
      setYtComments(data.comments || []);
      showToast("Comment posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed to post comment", "error");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(ytModal.id, commentId);
      setYtComments((prev) => prev.filter((c) => c.id !== commentId));
      showToast("Comment deleted");
    } catch (e) {
      showToast("Failed to delete comment", "error");
    }
  };

  const handleTriggerAutoComment = async () => {
    try {
      await triggerAutoComment();
      showToast("Auto-comment cycle triggered!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed", "error");
    }
  };

  const toggleComments = async (videoId) => {
    if (openComments === videoId) {
      setOpenComments(null);
      return;
    }
    setOpenComments(videoId);
    if (cardComments[videoId]) return; // already loaded
    setCommentsLoading(true);
    try {
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
    } catch (e) {
      showToast("Failed to load comments", "error");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCardPostComment = async (videoId) => {
    if (!cardCommentText.trim()) return;
    setPostingCardComment(true);
    try {
      await postComment(videoId, cardCommentText.trim());
      setCardCommentText("");
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast("Comment posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Failed to post", "error");
    } finally {
      setPostingCardComment(false);
    }
  };

  const handleReply = async (videoId, threadId) => {
    if (!replyText.trim()) return;
    try {
      await replyComment(videoId, threadId, replyText.trim());
      setReplyText("");
      setReplyingTo(null);
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast("Reply posted!");
    } catch (e) {
      showToast(e.response?.data?.detail || "Reply failed", "error");
    }
  };

  const handleDeleteCardComment = async (videoId, commentId) => {
    try {
      await deleteComment(videoId, commentId);
      setCardComments((prev) => ({
        ...prev,
        [videoId]: prev[videoId].filter((c) => c.id !== commentId),
      }));
      showToast("Comment deleted");
    } catch (e) {
      showToast("Failed to delete", "error");
    }
  };

  const handleModerate = async (videoId, commentId, status) => {
    try {
      await moderateComment(videoId, commentId, status);
      const data = await getComments(videoId);
      setCardComments((prev) => ({ ...prev, [videoId]: data.comments || [] }));
      showToast(
        `Comment ${status === "rejected" ? "rejected" : status === "published" ? "approved" : "held"}`,
      );
    } catch (e) {
      showToast("Moderation failed", "error");
    }
  };

  // Default avatar SVG for comments with no profile image
  const getAvatarSvg = (gender = "neutral") => {
    const female = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23374151'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%236b7280'/%3E%3Cellipse cx='20' cy='34' rx='10' ry='8' fill='%236b7280'/%3E%3Ccircle cx='17' cy='22' r='1.5' fill='%239ca3af'/%3E%3Ccircle cx='23' cy='22' r='1.5' fill='%239ca3af'/%3E%3C/svg%3E`;
    const male = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%231e3a5f'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%232563eb'/%3E%3Crect x='10' y='26' width='20' height='12' rx='4' fill='%232563eb'/%3E%3C/svg%3E`;
    const neutral = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23312e81'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%236366f1'/%3E%3Cellipse cx='20' cy='33' rx='10' ry='7' fill='%236366f1'/%3E%3C/svg%3E`;
    if (gender === "female") return female;
    if (gender === "male") return male;
    return neutral;
  };

  // Pick a consistent gender per author name so same person always gets same avatar
  const getCommentAvatar = (authorImg, authorName = "") => {
    if (authorImg) return authorImg;
    const hash = authorName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const genders = ["male", "female", "neutral", "male", "female"];
    return getAvatarSvg(genders[hash % genders.length]);
  };

  const getVideoUrl = (filePath) => {
    if (!filePath) return null;
    // Full Supabase/remote URL → play directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://"))
      return filePath;
    // Local path → serve via backend static mount
    const filename = filePath.split("/").pop();
    if (filename && filename.endsWith(".mp4"))
      return `http://localhost:8000/local-videos/${filename}`;
    return null;
  };

  const filtered = videos.filter(
    (v) => filter === "all" || v.status === filter,
  );
  const sc = (s) => STATUS[s] || STATUS.failed;

  return (
    <>
      {!pageReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.bg,
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          {/* Animated logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: "-0.02em",
              }}
            >
              <span style={{ color: T.accent }}>VID</span>
              <span
                style={{
                  color: T.accentGreen,
                  fontSize: 14,
                  verticalAlign: "super",
                  marginLeft: 2,
                }}
              >
                AI
              </span>
            </div>
          </div>
          {/* Spinner */}
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `3px solid ${T.border}`,
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `3px solid transparent`,
                borderTopColor: T.accent,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
          <div
            style={{
              color: T.textFaint,
              fontSize: 11,
              letterSpacing: "0.18em",
            }}
          >
            LOADING DASHBOARD
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          height: "100vh",
          background: T.bg,
          color: T.text,
          fontFamily: "'DM Mono','Fira Code',monospace",
          overflow: "hidden",
          opacity: pageReady ? 1 : 0,
          transition: "opacity 0.3s ease, background 0.3s, color 0.3s",
        }}
      >
        {/* ── Global Loading Overlay ──────────────────────────────────────────── */}
        {globalLoading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              zIndex: 200,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${T.border}`,
                borderTop: `3px solid ${T.accent}`,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                color: T.text,
                fontSize: 13,
                letterSpacing: "0.1em",
                fontFamily: "'Syne',sans-serif",
              }}
            >
              {globalLoading}
            </div>
          </div>
        )}
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px;}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12px;letter-spacing:0.05em;color:${T.textDim};transition:all 0.15s;}
        .nav-item:hover{background:rgba(0,160,220,0.07);color:${T.textMid};}
        .nav-item.active{background:rgba(0,160,220,0.1);color:${T.accent};}
        .stat-card{background:${T.bgCard};border:1px solid ${T.border};border-radius:14px;padding:20px;transition:border-color 0.2s,box-shadow 0.2s;}
        .stat-card:hover{border-color:${T.borderHover};box-shadow:0 4px 20px rgba(0,120,200,0.08);}
        .video-row{background:${T.bgCard};border:1px solid ${T.border};border-radius:12px;padding:16px 20px;cursor:pointer;transition:all 0.15s;margin-bottom:8px;}
        .video-row:hover{background:${T.bgCardHover};border-color:${T.borderHover};transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,100,180,0.08);}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:10px;letter-spacing:0.06em;font-weight:500;white-space:nowrap;}
        .tag{display:inline-block;padding:2px 8px;border-radius:100px;font-size:9px;background:${T.inputBg};color:${T.textDim};border:1px solid ${T.border};margin:1px;letter-spacing:0.04em;}
        .btn-primary{background:linear-gradient(135deg,#0060bb,#00a8f0);border:none;color:white;padding:11px 22px;border-radius:9px;font-family:inherit;font-size:11px;letter-spacing:0.1em;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
        .btn-primary:hover:not(:disabled){opacity:0.85;transform:translateY(-1px);}
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Fluid liquid animations ── */
        /* ── Red fluid — dark crimson, subtle & pleasant ── */
        /* ── Blue fluid — deep navy, subtle & pleasant ── */
        /* ── Black fluid — near-black charcoal morphs ── */
        /* ── Aurora wave animations ── */
        /* Blue aurora */
        /* Dark/obsidian aurora */
        .btn-primary:disabled{opacity:0.35;cursor:not-allowed;transform:none;}
        .btn-sm{padding:5px 12px;border-radius:6px;font-family:inherit;font-size:10px;letter-spacing:0.06em;cursor:pointer;border:1px solid;transition:all 0.15s;}
        .filter-btn{padding:5px 14px;border-radius:6px;font-family:inherit;font-size:10px;letter-spacing:0.06em;border:1px solid ${T.border};background:transparent;color:${T.textDim};cursor:pointer;transition:all 0.15s;}
        .filter-btn.active{background:rgba(0,160,220,0.1);border-color:rgba(0,160,220,0.35);color:${T.accent};}
        .filter-btn:hover:not(.active){color:${T.textMid};border-color:${T.borderHover};}
        .prog-bar{height:2px;background:${T.border};border-radius:2px;overflow:hidden;}
        .prog-fill{height:100%;background:linear-gradient(90deg,#0070cc,#00e080);border-radius:2px;transition:width 0.6s ease;}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.65)}}
        .dot{width:6px;height:6px;border-radius:50%;animation:pulse 2s infinite;flex-shrink:0;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(12px);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;}
        .modal{background:${isDark ? "#060d18" : "#ffffff"};border:1px solid ${T.border};border-radius:18px;padding:28px;max-width:580px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.4);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .modal{animation:fadeUp 0.2s ease;}
        .textarea{width:100%;padding:12px 14px;background:${T.inputBg};border:1px solid ${T.border};border-radius:8px;color:${T.text};font-family:inherit;font-size:13px;resize:none;outline:none;transition:border-color 0.2s;line-height:1.6;}
        .textarea:focus{border-color:rgba(0,160,220,0.4);}
        .textarea::placeholder{color:${T.textFaint};}
        @keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:10px;font-size:12px;letter-spacing:0.06em;z-index:100;animation:toastIn 0.2s ease;}
        .pipe-step{padding:5px 12px;border-radius:6px;font-size:10px;letter-spacing:0.05em;transition:all 0.3s;border:1px solid;display:flex;align-items:center;gap:5px;}
        .detail-row{display:flex;justify-content:space-between;padding:10px 14px;background:${T.inputBg};border-radius:8px;font-size:12px;margin-bottom:6px;border:1px solid ${T.border};}
        .theme-toggle{width:40px;height:22px;border-radius:11px;border:1px solid ${T.border};background:${T.bgCard};cursor:pointer;position:relative;transition:all 0.3s;flex-shrink:0;}
        .theme-knob{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:${T.accent};transition:all 0.3s;left:${isDark ? "2px" : "20px"};}
        .play-btn{width:48px;height:48px;border-radius:50%;background:rgba(0,180,255,0.15);border:2px solid rgba(0,180,255,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;flex-shrink:0;font-size:16px;}
        .play-btn:hover{background:rgba(0,180,255,0.25);transform:scale(1.05);}
        video{border-radius:10px;width:100%;background:#000;outline:none;}
        .video-preview-modal{background:#000;border:1px solid ${T.border};border-radius:18px;padding:0;overflow:hidden;max-width:760px;width:100%;box-shadow:0 32px 100px rgba(0,0,0,0.8);}
        .video-preview-modal .modal-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;background:${isDark ? "rgba(0,0,0,0.8)" : "rgba(10,10,20,0.9)"};}
      `}</style>

        {/* ── Toast ──────────────────────────────────────────────────────────────── */}
        {toast && (
          <div
            className="toast"
            style={{
              background:
                toast.type === "error"
                  ? "rgba(200,40,60,0.12)"
                  : "rgba(0,192,112,0.1)",
              border: `1px solid ${toast.type === "error" ? "rgba(200,40,60,0.3)" : "rgba(0,192,112,0.25)"}`,
              color: toast.type === "error" ? "#e05070" : "#00c070",
            }}
          >
            {toast.type === "error" ? "⚠ " : "✓ "}
            {toast.msg}
          </div>
        )}

        {/* ── Sidebar ────────────────────────────────────────────────────────────── */}
        <div
          style={{
            width: 220,
            background: T.bgSub,
            borderRight: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "20px 10px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "4px 10px 20px",
              borderBottom: `1px solid ${T.border}`,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "-0.02em",
              }}
            >
              <span
                style={{
                  background: "linear-gradient(135deg,#00b4ff,#00e080)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AUTO
              </span>
              <span style={{ color: T.text }}>VID</span>
            </div>
            <div
              style={{
                fontSize: 9,
                color: T.textFaint,
                letterSpacing: "0.18em",
                marginTop: 2,
              }}
            >
              AI VIDEO ENGINE
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {[
              {
                id: "videos",
                icon: "▣",
                label: "Videos",
                count: videos.length,
              },
              { id: "script", icon: "✍", label: "Script Studio" },
              { id: "shorts", icon: "⚡", label: "Shorts" },
              { id: "channel", icon: "▶", label: "My Channel" },
              { id: "billing", icon: "◑", label: "Billing" },
              { id: "analytics", icon: "◈", label: "Analytics" },
              { id: "compilations", icon: "🎬", label: "Compilations" },
              { id: "settings", icon: "◎", label: "Settings" },
            ].map((n) => (
              <div
                key={n.id}
                className={`nav-item ${tab === n.id ? "active" : ""}`}
                onClick={() => switchTab(n.id)}
              >
                <span style={{ fontSize: 13 }}>{n.icon}</span>
                <span>{n.label}</span>
                {n.count !== undefined && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "rgba(0,160,220,0.12)",
                      color: T.accent,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 10,
                    }}
                  >
                    {n.count}
                  </span>
                )}
              </div>
            ))}
          </nav>

          {quota.uploads_remaining !== undefined && (
            <div
              style={{
                padding: "10px 8px",
                borderTop: `1px solid ${T.border}`,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: T.textFaint,
                  letterSpacing: "0.1em",
                  marginBottom: 5,
                }}
              >
                YOUTUBE QUOTA
              </div>
              <div
                style={{
                  fontSize: 12,
                  color:
                    quota.uploads_remaining > 1 ? T.accentGreen : T.accentRed,
                  marginBottom: 4,
                }}
              >
                {quota.uploads_remaining} uploads left
              </div>
              <div className="prog-bar">
                <div
                  className="prog-fill"
                  style={{
                    width: `${((6 - quota.uploads_remaining) / 6) * 100}%`,
                    background:
                      quota.uploads_remaining > 2
                        ? "linear-gradient(90deg,#0070cc,#00e080)"
                        : T.accentRed,
                  }}
                />
              </div>
            </div>
          )}

          <div
            style={{ padding: "12px 8px", borderTop: `1px solid ${T.border}` }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg,#0060bb,#00a8f0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {user?.email?.[0]?.toUpperCase() || "S"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMid,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.email}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: T.textFaint,
                    letterSpacing: "0.1em",
                  }}
                >
                  SUPERUSER
                </div>
              </div>
            </div>
            <div
              onClick={handleLogout}
              style={{
                fontSize: 10,
                color: T.accentRed,
                cursor: "pointer",
                letterSpacing: "0.08em",
                padding: "7px 12px",
                borderRadius: 7,
                transition: "all 0.15s",
                border: `1px solid ${T.accentRed}30`,
                background: `${T.accentRed}08`,
                textAlign: "center",
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${T.accentRed}18`;
                e.currentTarget.style.borderColor = `${T.accentRed}60`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${T.accentRed}08`;
                e.currentTarget.style.borderColor = `${T.accentRed}30`;
              }}
            >
              ← LOGOUT
            </div>
          </div>
        </div>

        {/* ── Main ───────────────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              padding: "12px 24px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              background: T.topBar,
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: T.textMid,
              }}
            >
              {tab === "videos"
                ? "Video Library"
                : tab === "script"
                ? "Script Studio"
                : tab === "shorts"
                ? "YouTube Shorts"
                : tab === "channel"
                ? "My Channel"
                : tab === "billing"
                ? "Billing & Quotas"
                : tab === "compilations"
                ? "Compilations"
                : tab === "analytics"
                ? "Analytics"
                : "Settings"}
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div className="dot" style={{ background: T.accentGreen }} />
              <span
                style={{
                  fontSize: 10,
                  color: T.textFaint,
                  letterSpacing: "0.1em",
                }}
              >
                ONLINE
              </span>

              {/* Theme toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 10, color: T.textFaint }}>☀</span>
                <div className="theme-toggle" onClick={toggleTheme}>
                  <div className="theme-knob" />
                </div>
                <span style={{ fontSize: 10, color: T.textFaint }}>☾</span>
              </div>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textDim,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↺
              </button>
              <button
                onClick={async () => {
                  try {
                    await clearCache();
                    window.location.reload();
                  } catch (e) {
                    window.location.reload();
                  }
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textDim,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.06em",
                }}
              >
                ⊗ CLEAR
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${T.accentGreen}40`,
                  background: `${T.accentGreen}0a`,
                  color: T.accentGreen,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.06em",
                  opacity: syncing ? 0.5 : 1,
                }}
              >
                {syncing ? "⟳ SYNCING..." : "⟳ SYNC YT"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 24, position: "relative" }}>
            {/* Tab loading overlay */}
            {tabLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(8,8,16,0.72)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 12,
                  pointerEvents: "all",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "4px solid rgba(255,255,255,0.08)",
                    borderTopColor: "#00a0dc",
                    animation: "tabSpinner 0.7s linear infinite",
                  }}
                />
              </div>
            )}
            {/* ── VIDEOS TAB ──────────────────────────────────────────────────────── */}
            {tab === "videos" && (
              <>
                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {!pageReady ? (
                    [0,1,2,3].map(i => (
                      <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", height: 80 }}>
                        <div className="skeleton-loader" style={{ width: "40%", height: 10, borderRadius: 4, marginBottom: 10 }} />
                        <div className="skeleton-loader" style={{ width: "60%", height: 22, borderRadius: 4 }} />
                      </div>
                    ))
                  ) : (
                    [
                      {
                        label: "TOTAL VIDEOS",
                        value: videos.length,
                        color: T.accent,
                        icon: "▣",
                      },
                      {
                        label: "LIVE ON YT",
                        value: videos.filter((v) => v.status === "posted").length,
                        color: T.accentGreen,
                        icon: "▶",
                      },
                      {
                        label: "TOTAL VIEWS",
                        value: fmtNum(
                          videos.reduce((s, v) => s + (v.views_count || 0), 0),
                        ),
                        color: T.accentYellow,
                        icon: "◉",
                      },
                      {
                        label: "TOTAL LIKES",
                        value: fmtNum(
                          videos.reduce((s, v) => s + (v.likes_count || 0), 0),
                        ),
                        color: "#e060a0",
                        icon: "♥",
                      },
                    ].map((s) => (
                      <div key={s.label} className="stat-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.12em",
                            }}
                          >
                            {s.label}
                          </div>
                          <span style={{ color: s.color, fontSize: 14 }}>
                            {s.icon}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "'Syne',sans-serif",
                            fontSize: 30,
                            fontWeight: 800,
                            color: s.color,
                          }}
                        >
                          {s.value}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Generate box */}
                <div
                  style={{
                    background: isDark
                      ? "rgba(0,80,160,0.05)"
                      : "rgba(0,100,200,0.04)",
                    border: `1px solid ${isDark ? "rgba(0,140,220,0.14)" : "rgba(0,100,200,0.15)"}`,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: T.accent,
                      letterSpacing: "0.1em",
                      fontWeight: 500,
                      marginBottom: 12,
                    }}
                  >
                    ⚡ GENERATE NEW VIDEO
                  </div>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
                  >
                    <textarea
                      className="textarea"
                      rows={2}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          handleGenerate();
                      }}
                      placeholder="Describe your video idea... e.g. 'A cat explains quantum physics but keeps getting distracted'"
                      disabled={generating}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleGenerate}
                      disabled={generating || !prompt.trim()}
                    >
                      {generating ? "⚙ RUNNING..." : "▶ GENERATE"}
                    </button>
                  </div>
                  {/* Profile selector */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        id: "educational",
                        label: "🧠 Educational",
                        desc: "Essay-style explainer",
                      },
                      {
                        id: "serious",
                        label: "🎯 Serious",
                        desc: "Documentary / weighty",
                      },
                      {
                        id: "inspirational",
                        label: "🔥 Inspirational",
                        desc: "Emotional storytelling",
                      },
                      {
                        id: "reflective",
                        label: "🌊 Reflective",
                        desc: "Philosophical / deep",
                      },
                      {
                        id: "funny",
                        label: "😄 Funny",
                        desc: "Humour with insight",
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProfile(p.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 7,
                          border: `1px solid ${profile === p.id ? T.accent + "80" : T.border}`,
                          background:
                            profile === p.id ? `${T.accent}15` : "transparent",
                          color: profile === p.id ? T.accent : T.textMid,
                          fontSize: 10,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.06em",
                          transition: "all 0.15s",
                        }}
                        title={p.desc}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Visual mood grid */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 7 }}>
                      VISUAL MOOD
                    </div>
                    <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 4 }}>CSS BACKGROUNDS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginBottom: 8 }}>
                      {MOODS_CSS.map((v) => (
                        <button key={v.id} onClick={() => setVisualMood(v.id)} disabled={generating}
                          style={{
                            position: "relative", padding: "7px 8px", borderRadius: 8, overflow: "hidden",
                            border: `1px solid ${visualMood === v.id ? "#a060ff60" : T.border}`,
                            background: v.bg || (visualMood === v.id ? "#a060ff12" : "transparent"),
                            color: visualMood === v.id ? "#a060ff" : T.textMid,
                            cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                          }}
                        >
                          {v.aurora && (
                            <div className={`aurora-wrap aurora-${v.aurora}`} style={{ opacity: visualMood === v.id ? 1 : 0.55 }}>
                              <div className="aurora-band" /><div className="aurora-band" /><div className="aurora-band" />
                            </div>
                          )}
                          {v.fluid && (
                            <div className={`fluid-wrap fluid-${v.fluid}`} style={{ opacity: visualMood === v.id ? 1 : 0.65 }}>
                              <div className="fluid-blob" /><div className="fluid-blob" /><div className="fluid-blob" />
                            </div>
                          )}
                          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 12 }}>{v.emoji}</span>
                            <span style={{ fontSize: 9, fontWeight: 600 }}>{v.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 4 }}>STOCK FOOTAGE</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
                      {MOODS_STOCK.map((v) => (
                        <button key={v.id} onClick={() => setVisualMood(v.id)} disabled={generating}
                          style={{
                            position: "relative", padding: "7px 8px", borderRadius: 8, overflow: "hidden",
                            border: `1px solid ${visualMood === v.id ? "#a060ff60" : T.border}`,
                            background: visualMood === v.id ? "#a060ff12" : "transparent",
                            color: visualMood === v.id ? "#a060ff" : T.textMid,
                            cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 12 }}>{v.emoji}</span>
                            <span style={{ fontSize: 9, fontWeight: 600 }}>{v.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Music style */}
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                        marginBottom: 7,
                      }}
                    >
                      BACKGROUND MUSIC
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {[
                        {
                          id: "ambient",
                          label: "🌫 Ambient",
                          desc: "Calm & atmospheric",
                        },
                        {
                          id: "cinematic",
                          label: "🎬 Cinematic",
                          desc: "Epic & dramatic",
                        },
                        {
                          id: "lo-fi",
                          label: "☕ Lo-Fi",
                          desc: "Relaxed & warm",
                        },
                        {
                          id: "meditation",
                          label: "🧘 Meditation",
                          desc: "Peaceful & mindful",
                        },
                        {
                          id: "jazz",
                          label: "🎷 Jazz",
                          desc: "Smooth & soulful",
                        },
                        {
                          id: "epic_trailer",
                          label: "🎯 Epic Trailer",
                          desc: "Intense & powerful",
                        },
                        {
                          id: "chill_electronic",
                          label: "🎧 Chill Electronic",
                          desc: "Smooth beats",
                        },
                        { id: "none", label: "🔇 None", desc: "No music" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMusicStyle(m.id)}
                          disabled={generating}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: `1px solid ${musicStyle === m.id ? T.accentGreen + "80" : T.border}`,
                            background:
                              musicStyle === m.id
                                ? `${T.accentGreen}10`
                                : "transparent",
                            color:
                              musicStyle === m.id ? T.accentGreen : T.textFaint,
                            fontSize: 9,
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                          title={m.desc}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{ fontSize: 10, color: T.textFaint, marginTop: 8 }}
                  >
                    Ctrl+Enter to generate · ~3 min pipeline · Auto-saves to
                    Supabase
                  </div>

                  {genError && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "rgba(200,40,60,0.06)",
                        border: `1px solid rgba(200,40,60,0.18)`,
                        borderRadius: 7,
                        fontSize: 11,
                        color: T.accentRed,
                      }}
                    >
                      ⚠ {genError}
                    </div>
                  )}

                  {generating && (
                    <div
                      style={{
                        marginTop: 14,
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
                      <div
                        style={{
                          display: "flex",
                          gap: 0,
                          alignItems: "center",
                        }}
                      >
                        {STEPS.map((s, i) => {
                          const done = i < pipeStep - 1,
                            active = i === pipeStep - 1;
                          return (
                            <div
                              key={s}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                flex: 1,
                              }}
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
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {active && (
                                    <>
                                      <div
                                        style={{
                                          position: "absolute",
                                          borderRadius: "50%",
                                          width: 36,
                                          height: 36,
                                          border: `2px solid ${T.accent}`,
                                          animation:
                                            "ringPulse 1.4s ease-out infinite",
                                          opacity: 0,
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          borderRadius: "50%",
                                          width: 44,
                                          height: 44,
                                          border: `1.5px solid ${T.accent}`,
                                          animation:
                                            "ringPulse 1.4s ease-out infinite 0.4s",
                                          opacity: 0,
                                        }}
                                      />
                                    </>
                                  )}
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
                                      color:
                                        done || active ? "white" : T.textFaint,
                                      border: active
                                        ? `2px solid ${T.accent}`
                                        : "none",
                                      transition: "all 0.4s",
                                      boxShadow: active
                                        ? `0 0 16px ${T.accent}80`
                                        : "none",
                                      zIndex: 1,
                                    }}
                                  >
                                    {done ? "✓" : i + 1}
                                  </div>
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
                                  {s.toUpperCase()}
                                </div>
                              </div>
                              {i < STEPS.length - 1 && (
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
                        {pipeStep === 1 &&
                          "📝 Generating script from prompt..."}
                        {pipeStep === 2 && "🎙 Synthesizing voice narration..."}
                        {pipeStep === 3 && "📐 Aligning segments..."}
                        {pipeStep === 4 && "🎬 Fetching stock footage..."}
                        {pipeStep === 5 && "⚙ Assembling video..."}
                        {pipeStep === 6 && "🎵 Burning captions..."}
                        {pipeStep === 7 && "✅ Done! Loading preview..."}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 16,
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => setShowGenLogs(p => !p)}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 7,
                            border: `1px solid ${T.border}`,
                            background: "transparent",
                            color: T.textMid,
                            fontSize: 10,
                            fontFamily: "inherit",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                          }}
                        >
                          {showGenLogs ? "▲ HIDE LOGS" : "📋 VIEW LOGS"}
                        </button>
                        <button
                          onClick={handleGenCancel}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 7,
                            border: `1px solid ${T.accentRed}50`,
                            background: `${T.accentRed}10`,
                            color: T.accentRed,
                            fontSize: 10,
                            fontFamily: "inherit",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                          }}
                        >
                          🛑 CANCEL
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline pipeline logs */}
                  {(showGenLogs || generating) && genLogs.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      background: isDark ? "#08090e" : "#f0f2f5",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}>
                      <div
                        onClick={() => setShowGenLogs(p => !p)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 14px",
                          cursor: "pointer",
                          borderBottom: showGenLogs ? `1px solid ${T.border}` : "none",
                        }}
                      >
                        <span style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>
                          📋 PIPELINE LOGS ({genLogs.length} lines)
                        </span>
                        <span style={{ fontSize: 11, color: T.textFaint }}>{showGenLogs ? "▲" : "▼"}</span>
                      </div>
                      {showGenLogs && (
                        <div style={{
                          maxHeight: 200,
                          overflowY: "auto",
                          padding: "10px 14px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          lineHeight: 1.7,
                        }}>
                          {genLogs.slice(-50).map((line, i) => (
                            <div key={i} style={{
                              color: line.startsWith("[ERROR]") ? "#ff6060"
                                : line.startsWith("[DONE]") ? "#60ff60"
                                : isDark ? "#a0d0a0" : "#2d5a2d",
                            }}>
                              {line}
                            </div>
                          ))}
                          <div ref={genLogsEndRef} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.12em",
                      marginRight: 4,
                    }}
                  >
                    FILTER
                  </span>
                  {["all", "posted", "ready", "generating", "failed"].map(
                    (f) => (
                      <button
                        key={f}
                        className={`filter-btn ${filter === f ? "active" : ""}`}
                        onClick={() => setFilter(f)}
                      >
                        {f.toUpperCase()}
                        {f !== "all" && (
                          <span style={{ marginLeft: 5, opacity: 0.5 }}>
                            {videos.filter((v) => v.status === f).length}
                          </span>
                        )}
                      </button>
                    ),
                  )}
                </div>

                {/* Video list */}
                {!pageReady && videos.length === 0 ? (
                  [0,1,2,3].map(i => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", marginBottom: 8, background: T.bgCard, borderRadius: 10, border: `1px solid ${T.border}` }}>
                      <div className="skeleton-loader" style={{ width: 96, height: 54, borderRadius: 8, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton-loader" style={{ width: "55%", height: 13, borderRadius: 4, marginBottom: 8 }} />
                        <div className="skeleton-loader" style={{ width: "30%", height: 10, borderRadius: 4 }} />
                      </div>
                      <div className="skeleton-loader" style={{ width: 60, height: 22, borderRadius: 20 }} />
                    </div>
                  ))
                ) : filtered.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 60,
                      color: T.textFaint,
                      fontSize: 12,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {filter === "all"
                      ? "NO VIDEOS YET — GENERATE YOUR FIRST VIDEO ABOVE"
                      : `NO ${filter.toUpperCase()} VIDEOS`}
                  </div>
                ) : (
                  filtered.map((v) => {
                    const s = sc(v.status);
                    const vUrl = getVideoUrl(v.file_path);
                    return (
                      <div
                        key={v.id}
                        className="video-row"
                        onClick={() => setSelected(v)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          {/* Thumbnail / play button */}
                          <div
                            style={{
                              width: 96,
                              height: 54,
                              borderRadius: 8,
                              background: `linear-gradient(135deg,${s.color}18,rgba(0,0,0,0.15))`,
                              border: `1px solid ${s.color}28`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {vUrl ? (
                              // Supabase URL — fully playable
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreview(v);
                                }}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(0,0,0,0.3)",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  transition: "background 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(0,0,0,0.55)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    "rgba(0,0,0,0.3)")
                                }
                              >
                                <span
                                  style={{
                                    fontSize: 22,
                                    color: "white",
                                    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                                  }}
                                >
                                  ▶
                                </span>
                              </div>
                            ) : IN_PROGRESS.includes(v.status) ? (
                              <span style={{ fontSize: 18, opacity: 0.45 }}>
                                ⚙
                              </span>
                            ) : v.status === "failed" ? (
                              <span style={{ fontSize: 18, opacity: 0.45 }}>
                                ✕
                              </span>
                            ) : (
                              // ready/posted but no storage URL — greyed play, non-clickable
                              <span
                                style={{ fontSize: 22, opacity: 0.2 }}
                                title="No preview — this video was generated before storage was set up. New videos will have preview."
                              >
                                ▶
                              </span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "'Syne',sans-serif",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: T.text,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {v.title || "Processing..."}
                              </div>
                              <div
                                className="pill"
                                style={{
                                  background: s.bg,
                                  color: s.color,
                                  flexShrink: 0,
                                }}
                              >
                                <div
                                  className="dot"
                                  style={{
                                    background: s.pulse,
                                    width: 5,
                                    height: 5,
                                  }}
                                />
                                {s.label}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textDim,
                                marginBottom: 5,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {v.prompt}
                            </div>
                            <div>
                              {(v.labels || []).map((l) => (
                                <span key={l} className="tag">
                                  {l}
                                </span>
                              ))}
                              {v.category && (
                                <span
                                  className="tag"
                                  style={{
                                    color: T.accent,
                                    borderColor: `${T.accent}30`,
                                  }}
                                >
                                  #{v.category}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right stats */}
                          <div
                            style={{
                              display: "flex",
                              gap: 16,
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            {v.status === "posted" && (
                              <>
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontFamily: "'Syne',sans-serif",
                                      fontWeight: 700,
                                      color: T.accentYellow,
                                      fontSize: 14,
                                    }}
                                  >
                                    {fmtNum(v.views_count)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textFaint,
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    VIEWS
                                  </div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontFamily: "'Syne',sans-serif",
                                      fontWeight: 700,
                                      color: "#e060a0",
                                      fontSize: 14,
                                    }}
                                  >
                                    {fmtNum(v.likes_count)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textFaint,
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    LIKES
                                  </div>
                                </div>
                              </>
                            )}
                            {v.duration_seconds && (
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontWeight: 600,
                                    color: T.textMid,
                                    fontSize: 13,
                                  }}
                                >
                                  {fmtDur(v.duration_seconds)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: T.textFaint,
                                    letterSpacing: "0.08em",
                                  }}
                                >
                                  LENGTH
                                </div>
                              </div>
                            )}
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: T.textDim }}>
                                {timeAgo(v.created_at)}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textFaint,
                                  letterSpacing: "0.08em",
                                }}
                              >
                                CREATED
                              </div>
                            </div>
                          </div>
                        </div>

                        {v.status === "failed" && v.error_message && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "8px 12px",
                              background: "rgba(200,40,60,0.05)",
                              border: "1px solid rgba(200,40,60,0.14)",
                              borderRadius: 7,
                              fontSize: 10,
                              color: T.accentRed,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ⚠ {v.error_message.split("\n")[0]}
                            </span>
                            <button
                              className="btn-sm"
                              onClick={(e) => handleRetry(v.id, e)}
                              style={{
                                color: T.accentRed,
                                borderColor: "rgba(200,40,60,0.25)",
                                background: "rgba(200,40,60,0.07)",
                                flexShrink: 0,
                              }}
                            >
                              RETRY
                            </button>
                          </div>
                        )}

                        {/* ── Inline Comments Panel ─────────────────────────────── */}
                        {openComments === v.id && v.status === "posted" && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginTop: 12,
                              borderTop: `1px solid ${T.border}`,
                              paddingTop: 14,
                            }}
                          >
                            {/* Post new comment */}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginBottom: 14,
                              }}
                            >
                              <input
                                value={cardCommentText}
                                onChange={(e) =>
                                  setCardCommentText(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  !e.shiftKey &&
                                  handleCardPostComment(v.id)
                                }
                                placeholder="Add a comment..."
                                maxLength={500}
                                style={{
                                  flex: 1,
                                  background: T.bgDeep,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  color: T.text,
                                  fontSize: 11,
                                  fontFamily: "inherit",
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => handleCardPostComment(v.id)}
                                disabled={
                                  postingCardComment || !cardCommentText.trim()
                                }
                                style={{
                                  padding: "8px 14px",
                                  background: postingCardComment
                                    ? "transparent"
                                    : T.accent,
                                  border: `1px solid ${T.accent}40`,
                                  borderRadius: 8,
                                  color: postingCardComment
                                    ? T.textFaint
                                    : "white",
                                  fontSize: 10,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  letterSpacing: "0.08em",
                                  flexShrink: 0,
                                }}
                              >
                                {postingCardComment ? "⟳" : "↑ POST"}
                              </button>
                            </div>

                            {/* Comments list */}
                            {commentsLoading && !cardComments[v.id] ? (
                              <div
                                style={{
                                  textAlign: "center",
                                  color: T.textFaint,
                                  fontSize: 11,
                                  padding: 16,
                                }}
                              >
                                ⟳ Loading comments...
                              </div>
                            ) : (cardComments[v.id] || []).length === 0 ? (
                              <div
                                style={{
                                  textAlign: "center",
                                  color: T.textFaint,
                                  fontSize: 11,
                                  padding: 16,
                                }}
                              >
                                No comments yet
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 10,
                                  maxHeight: 400,
                                  overflowY: "auto",
                                }}
                              >
                                {(cardComments[v.id] || []).map((c) => (
                                  <div
                                    key={c.id}
                                    style={{
                                      background: T.bgDeep,
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                      border: `1px solid ${T.border}`,
                                    }}
                                  >
                                    {/* Comment header */}
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 6,
                                      }}
                                    >
                                      <img
                                        src={getCommentAvatar(
                                          c.author_image,
                                          c.author,
                                        )}
                                        style={{
                                          width: 26,
                                          height: 26,
                                          borderRadius: "50%",
                                          flexShrink: 0,
                                          objectFit: "cover",
                                        }}
                                        alt=""
                                      />
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: T.accent,
                                          fontWeight: 600,
                                          flex: 1,
                                        }}
                                      >
                                        {c.author}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: T.textFaint,
                                        }}
                                      >
                                        {timeAgo(c.published_at)}
                                      </span>
                                      {c.likes > 0 && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: "#e060a0",
                                          }}
                                        >
                                          ♥ {c.likes}
                                        </span>
                                      )}
                                      {c.reply_count > 0 && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: T.textFaint,
                                          }}
                                        >
                                          💬 {c.reply_count}
                                        </span>
                                      )}
                                    </div>

                                    {/* Comment text */}
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: T.textMid,
                                        lineHeight: 1.6,
                                        marginBottom: 8,
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: c.text,
                                      }}
                                    />

                                    {/* Actions */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <button
                                        onClick={() => {
                                          setReplyingTo(
                                            replyingTo === c.id ? null : c.id,
                                          );
                                          setReplyText("");
                                        }}
                                        style={{
                                          fontSize: 10,
                                          color:
                                            replyingTo === c.id
                                              ? T.accent
                                              : T.textFaint,
                                          background: "transparent",
                                          border: `1px solid ${replyingTo === c.id ? T.accent + "40" : T.border}`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ↩ Reply
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(
                                            v.id,
                                            c.id,
                                            "published",
                                          )
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentGreen,
                                          background: "transparent",
                                          border: `1px solid ${T.accentGreen}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(
                                            v.id,
                                            c.id,
                                            "heldForReview",
                                          )
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentYellow,
                                          background: "transparent",
                                          border: `1px solid ${T.accentYellow}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ⏸ Hold
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleModerate(v.id, c.id, "rejected")
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: "#e0a020",
                                          background: "transparent",
                                          border: "1px solid #e0a02030",
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                        }}
                                      >
                                        ✕ Reject
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteCardComment(v.id, c.id)
                                        }
                                        style={{
                                          fontSize: 10,
                                          color: T.accentRed,
                                          background: "transparent",
                                          border: `1px solid ${T.accentRed}30`,
                                          borderRadius: 5,
                                          padding: "3px 8px",
                                          cursor: "pointer",
                                          fontFamily: "inherit",
                                          marginLeft: "auto",
                                        }}
                                      >
                                        🗑 Delete
                                      </button>
                                    </div>

                                    {/* Reply box */}
                                    {replyingTo === c.id && (
                                      <div
                                        style={{
                                          marginTop: 10,
                                          display: "flex",
                                          gap: 8,
                                        }}
                                      >
                                        <input
                                          value={replyText}
                                          onChange={(e) =>
                                            setReplyText(e.target.value)
                                          }
                                          onKeyDown={(e) =>
                                            e.key === "Enter" &&
                                            !e.shiftKey &&
                                            handleReply(v.id, c.id)
                                          }
                                          placeholder={`Reply to ${c.author}...`}
                                          maxLength={500}
                                          autoFocus
                                          style={{
                                            flex: 1,
                                            background: T.bg,
                                            border: `1px solid ${T.accent}40`,
                                            borderRadius: 7,
                                            padding: "7px 10px",
                                            color: T.text,
                                            fontSize: 11,
                                            fontFamily: "inherit",
                                            outline: "none",
                                          }}
                                        />
                                        <button
                                          onClick={() =>
                                            handleReply(v.id, c.id)
                                          }
                                          disabled={!replyText.trim()}
                                          style={{
                                            padding: "7px 12px",
                                            background: T.accent,
                                            border: "none",
                                            borderRadius: 7,
                                            color: "white",
                                            fontSize: 10,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                          }}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          onClick={() => {
                                            setReplyingTo(null);
                                            setReplyText("");
                                          }}
                                          style={{
                                            padding: "7px 10px",
                                            background: "transparent",
                                            border: `1px solid ${T.border}`,
                                            borderRadius: 7,
                                            color: T.textFaint,
                                            fontSize: 10,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                          }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Preview button — show for ready videos always, posted if has URL */}
                          {vUrl ? (
                            <button
                              className="btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreview(v);
                              }}
                              style={{
                                color: T.accent,
                                borderColor: `${T.accent}40`,
                                background: `${T.accent}10`,
                              }}
                            >
                              ▶ PREVIEW
                            </button>
                          ) : null}
                          {vUrl ? (
                            <a
                              href={vUrl}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="btn-sm"
                              style={{
                                color: T.textMid,
                                borderColor: T.border,
                                background: "transparent",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ↓ DOWNLOAD
                            </a>
                          ) : null}
                          {!vUrl && v.status === "ready" ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: T.textFaint,
                                padding: "4px 10px",
                                border: `1px solid ${T.border}`,
                                borderRadius: 5,
                                cursor: "default",
                              }}
                              title="Video file not in storage yet — regenerate to get preview"
                            >
                              🎬 No Preview
                            </span>
                          ) : null}
                          {(v.status === "ready" ||
                            v.status === "uploading") && (
                            <button
                              className="btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (v.status === "ready") setUploadModal(v);
                              }}
                              disabled={v.status === "uploading"}
                              style={{
                                color:
                                  v.status === "uploading"
                                    ? T.textFaint
                                    : T.accentYellow,
                                borderColor:
                                  v.status === "uploading"
                                    ? T.border
                                    : `${T.accentYellow}40`,
                                background:
                                  v.status === "uploading"
                                    ? "transparent"
                                    : `${T.accentYellow}0d`,
                                opacity: v.status === "uploading" ? 0.6 : 1,
                                cursor:
                                  v.status === "uploading"
                                    ? "default"
                                    : "pointer",
                              }}
                            >
                              {v.status === "uploading"
                                ? "⟳ Uploading..."
                                : "🚀 UPLOAD TO YOUTUBE"}
                            </button>
                          )}
                          {v.status === "posted" && (
                            <>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: T.accentGreen,
                                  padding: "4px 10px",
                                  background: `${T.accentGreen}0d`,
                                  borderRadius: 5,
                                  border: `1px solid ${T.accentGreen}30`,
                                }}
                              >
                                ● LIVE
                              </span>
                              <button
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openYtModal(v);
                                }}
                                style={{
                                  color: "#a060ff",
                                  borderColor: "#a060ff40",
                                  background: "#a060ff0d",
                                }}
                              >
                                ⚙ MANAGE
                              </button>
                              <button
                                className="btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(v.id);
                                }}
                                style={{
                                  color:
                                    openComments === v.id
                                      ? T.accentGreen
                                      : T.textMid,
                                  borderColor:
                                    openComments === v.id
                                      ? `${T.accentGreen}50`
                                      : T.border,
                                  background:
                                    openComments === v.id
                                      ? `${T.accentGreen}0d`
                                      : "transparent",
                                }}
                              >
                                💬{" "}
                                {openComments === v.id
                                  ? "HIDE"
                                  : `COMMENTS${v.youtube_id ? "" : ""}`}
                              </button>
                              {v.youtube_url && (
                                <a
                                  href={v.youtube_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: 10,
                                    color: T.accent,
                                    textDecoration: "none",
                                    padding: "4px 10px",
                                    background: `${T.accent}0d`,
                                    borderRadius: 5,
                                    border: `1px solid ${T.accent}30`,
                                  }}
                                >
                                  ▶ YouTube
                                </a>
                              )}
                              {v.narration_url && (
                                <a
                                  href={v.narration_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  download
                                  title="Download narration MP3"
                                  style={{
                                    fontSize: 10,
                                    color: "#a0d090",
                                    textDecoration: "none",
                                    padding: "4px 10px",
                                    background: "#a0d09010",
                                    borderRadius: 5,
                                    border: "1px solid #a0d09030",
                                  }}
                                >
                                  🎙 MP3
                                </a>
                              )}
                              <span
                                style={{ fontSize: 10, color: T.textFaint }}
                              >
                                👁 {fmtNum(v.views_count)} · ♥{" "}
                                {fmtNum(v.likes_count)} · {timeAgo(v.posted_at)}
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 6,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setYtSettingsModal(v);
                                    }}
                                    style={{
                                      fontSize: 11,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${T.border}`,
                                      background: "transparent",
                                      color: T.textFaint,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ⚙ Settings
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShortsModal(v);
                                    }}
                                    style={{
                                      fontSize: 11,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${T.border}`,
                                      background: "transparent",
                                      color: T.textFaint,
                                      cursor: "pointer",
                                    }}
                                  >
                                    📱 Make Short
                                  </button>
                                </div>
                              </span>
                            </>
                          )}
                          {v.status === "uploading" && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#9060e0",
                                letterSpacing: "0.08em",
                              }}
                            >
                              ⟳ Uploading to YouTube...
                            </span>
                          )}
                          <button
                            className="btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                id: v.id,
                                hasYoutube:
                                  v.status === "posted" && !!v.youtube_id,
                                youtubeId: v.youtube_id,
                              });
                            }}
                            style={{
                              marginLeft: "auto",
                              color: T.textFaint,
                              borderColor: T.border,
                              background: "transparent",
                            }}
                          >
                            ✕ DELETE
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* ── SCRIPT STUDIO TAB ─────────────────────────────────────────────── */}
            {tab === "script" && (
              <ScriptStudio
                T={T}
                showToast={showToast}
                onVideoReady={(video) => {
                  setTab("videos");
                  setTimeout(() => setPreview(video), 400);
                }}
              />
            )}

            {/* ── SHORTS TAB ─────────────────────────────────────────────────────── */}
            {tab === "shorts" && (
  <div style={{ display: "flex", gap: 20, height: "100%", minHeight: 0 }}>

    {/* LEFT — Existing Shorts */}
    <div style={{
      width: 320,
      flexShrink: 0,
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.08em" }}>
          ⚡ YOUR SHORTS
        </div>
        <button
          onClick={() => { setShortsList([]); shortsOffsetRef.current = 0; loadShorts(true); }}
          style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 13 }}
        >↺</button>
      </div>

      <div
        ref={shortsListRef}
        onScroll={handleShortsScroll}
        style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
      >
        {shortsLoading && shortsList.length === 0 ? (
          [0,1,2].map(i => (
            <div key={i} style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <div className="skeleton-loader" style={{ width: 64, height: 36, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-loader" style={{ width: "70%", height: 11, borderRadius: 3, marginBottom: 6 }} />
                <div className="skeleton-loader" style={{ width: "40%", height: 9, borderRadius: 3 }} />
              </div>
            </div>
          ))
        ) : shortsList.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: T.textFaint, fontSize: 11 }}>
            No shorts yet — generate your first one →
          </div>
        ) : (
          shortsList.map(s => (
            <div
              key={s.id}
              style={{
                padding: "10px 14px",
                display: "flex",
                gap: 10,
                alignItems: "center",
                cursor: "pointer",
                borderBottom: `1px solid ${T.border}20`,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgCardHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Thumbnail */}
              <div style={{
                width: 64, height: 36, borderRadius: 6,
                background: `linear-gradient(135deg,#4a9eff18,#00000020)`,
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 14, opacity: 0.7,
              }}>
                {s.file_path ? "▶" : "⚙"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: T.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  marginBottom: 3,
                }}>
                  {s.title || s.prompt?.slice(0, 40) || "Untitled Short"}
                </div>
                <div style={{ fontSize: 10, color: T.textFaint }}>
                  {s.status === "ready" ? "✅ Ready" : s.status === "failed" ? "❌ Failed" : "⚙ " + s.status}
                  {s.duration_seconds ? ` · ${s.duration_seconds}s` : ""}
                </div>
              </div>
            </div>
          ))
        )}
        {shortsLoading && shortsList.length > 0 && (
          <div style={{ textAlign: "center", padding: 12, color: T.textFaint, fontSize: 11 }}>Loading more...</div>
        )}
        {shortsHasMore === false && shortsList.length > 0 && (
          <div style={{ textAlign: "center", padding: 10, color: T.textFaint, fontSize: 10 }}>All shorts loaded</div>
        )}
      </div>
    </div>

    {/* RIGHT — Generate forms */}
    <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: T.text, marginBottom: 6 }}>
          ⚡ YouTube Shorts Studio
        </div>
        <div style={{ fontSize: 12, color: T.textDim }}>
          Generate portrait 9:16 videos or clip your best existing content into Shorts.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Mode A: Generate from scratch */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>
            ✨ Generate New Short
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16 }}>
            AI writes + narrates + renders a brand-new 9:16 Short from your prompt.
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>TOPIC / PROMPT</div>
            <textarea
              value={shortPrompt}
              onChange={e => setShortPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. 'The quiet grief nobody talks about'"
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 8 }}>AMBIENCE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { v: "stars", emoji: "⭐", label: "Stars", desc: "Deep space drift" },
                { v: "aurora", emoji: "🌌", label: "Aurora", desc: "Northern lights" },
                { v: "ocean", emoji: "🌊", label: "Ocean", desc: "Underwater rays" },
                { v: "fire", emoji: "🔥", label: "Fire", desc: "Floating embers" },
                { v: "rain", emoji: "🌧", label: "Rain", desc: "Night city window" },
                { v: "galaxy", emoji: "🌀", label: "Galaxy", desc: "Spiral rotation" },
              ].map(a => (
                <button key={a.v} onClick={() => setShortAmbience(a.v)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: `2px solid ${shortAmbience === a.v ? T.accent : T.border}`, background: shortAmbience === a.v ? `${T.accent}18` : T.inputBg, color: T.text, fontFamily: "inherit" }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{a.emoji} {a.label}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {shortGenError && <div style={{ fontSize: 11, color: T.accentRed, marginBottom: 10 }}>{shortGenError}</div>}
          <button onClick={handleGenerateShort} disabled={shortGenerating || !shortPrompt.trim()} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: shortGenerating || !shortPrompt.trim() ? T.border : T.accent, color: shortGenerating || !shortPrompt.trim() ? T.textFaint : "#fff", fontSize: 12, fontWeight: 700, cursor: shortGenerating || !shortPrompt.trim() ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}>
            {shortGenerating ? "⚡ GENERATING..." : "⚡ GENERATE SHORT"}
          </button>
        </div>

        {/* Mode B: Clip from existing video */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>
            ✂️ Clip Existing Video
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16 }}>
            Auto-clips the best 59s from a video in your library, crops to 9:16 portrait.
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>SELECT VIDEO</div>
            <select
              value={shortClipVideoId}
              onChange={e => setShortClipVideoId(e.target.value)}
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
            >
              <option value="">— Pick a video —</option>
              {videos.filter(v => (v.status === "posted" || v.status === "ready") && v.file_path).map(v => (
                <option key={v.id} value={v.id}>{v.title || v.id.slice(0,16)}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, padding: "10px 12px", background: T.bgSub, borderRadius: 8, lineHeight: 1.6 }}>
            ℹ️ First ~25% skipped (intro), next 59s center-cropped to portrait and saved as a Short.
          </div>
          {shortClipError && <div style={{ fontSize: 11, color: T.accentRed, marginBottom: 10 }}>{shortClipError}</div>}
          {shortClipSuccess && <div style={{ fontSize: 11, color: T.accentGreen, marginBottom: 10 }}>{shortClipSuccess}</div>}
          <button onClick={handleClipShort} disabled={shortClipping || !shortClipVideoId} style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: shortClipping || !shortClipVideoId ? T.border : T.accentGreen, color: shortClipping || !shortClipVideoId ? T.textFaint : "#fff", fontSize: 12, fontWeight: 700, cursor: shortClipping || !shortClipVideoId ? "not-allowed" : "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}>
            {shortClipping ? "✂️ PROCESSING..." : "✂️ CREATE SHORT"}
          </button>
        </div>
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>SHORTS TIPS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { icon: "⏱", title: "Max 59 Seconds", desc: "YouTube Shorts must be under 60s to qualify for the Shorts feed." },
            { icon: "📱", title: "9:16 Portrait", desc: "All Shorts are rendered at 1080×1920 — vertical mobile-first format." },
            { icon: "👁", title: "Review Before Upload", desc: "Shorts are saved as Ready — you upload to YouTube when satisfied." },
          ].map(tip => (
            <div key={tip.icon} style={{ background: T.bgSub, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{tip.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>{tip.title}</div>
              <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
            )}

            {/* ── Billing & Quotas Tab ──────────────────────────────────────────── */}
            {/* ── MY CHANNEL TAB ─────────────────────────────────────────────── */}
            {tab === "channel" && (
              <div style={{ padding: "0 2px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 18,
                  }}
                >
                  <div style={{ fontSize: 11, color: T.textMid }}>
                    {channelVideos.length > 0
                      ? `${channelVideos.length} videos on your channel`
                      : ""}
                  </div>
                  <button
                    onClick={() => fetchChannel(true)}
                    disabled={channelLoading}
                    style={{
                      padding: "7px 16px",
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      color: T.textMid,
                      fontSize: 10,
                      fontFamily: "inherit",
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                    }}
                  >
                    {channelLoading ? "..." : "↺ REFRESH"}
                  </button>
                </div>
                {channelError && (
                  <div
                    style={{
                      padding: 16,
                      background: "rgba(255,80,80,0.07)",
                      border: "1px solid rgba(255,80,80,0.2)",
                      borderRadius: 10,
                      color: "#ff5c6c",
                      fontSize: 12,
                      marginBottom: 16,
                    }}
                  >
                    {channelError}
                  </div>
                )}
                {channelLoading && !channelVideos.length ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 60,
                      color: T.textMid,
                      fontSize: 12,
                    }}
                  >
                    Loading channel videos...
                  </div>
                ) : channelVideos.length === 0 && !channelLoading ? (
                  // Quota hit & no cache — fall back to DB posted videos
                  <div>
                    {channelError && (
                      <div
                        style={{
                          padding: "14px 18px",
                          background: "rgba(255,170,0,0.07)",
                          border: "1px solid rgba(255,170,0,0.25)",
                          borderRadius: 10,
                          marginBottom: 18,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#ffaa00",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          📦 Showing cached library data
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: T.textMid,
                            lineHeight: 1.6,
                          }}
                        >
                          YouTube API quota is exhausted — live channel stats
                          unavailable until midnight Pacific Time. Showing your
                          posted videos from the local database instead. Upload
                          counts, views and likes may be outdated.
                        </div>
                      </div>
                    )}
                    {videos.filter((v) => v.status === "posted" || v.youtube_id)
                      .length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 60,
                          color: T.textMid,
                          fontSize: 12,
                        }}
                      >
                        No posted videos found in library.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill,minmax(300px,1fr))",
                          gap: 16,
                        }}
                      >
                        {videos
                          .filter((v) => v.status === "posted" || v.youtube_id)
                          .map((v) => (
                            <div
                              key={v.id}
                              style={{
                                background: T.bgCard,
                                border: `1px solid ${T.border}`,
                                borderRadius: 14,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  position: "relative",
                                  paddingBottom: "56.25%",
                                  background: T.bgBase,
                                }}
                              >
                                <img
                                  src={v.thumbnail_url}
                                  alt={v.title}
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: v.thumbnail_url ? "block" : "none",
                                  }}
                                  onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                                />
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: v.thumbnail_url ? "none" : "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: T.textFaint,
                                    fontSize: 28,
                                  }}
                                >
                                  ▶
                                </div>
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    fontSize: 9,
                                    padding: "3px 7px",
                                    borderRadius: 5,
                                    letterSpacing: "0.08em",
                                    background: "rgba(0,192,112,0.85)",
                                    color: "#fff",
                                  }}
                                >
                                  POSTED
                                </div>
                              </div>
                              <div style={{ padding: "12px 14px" }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: T.text,
                                    marginBottom: 6,
                                    lineHeight: 1.4,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                >
                                  {v.title || v.prompt}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 12,
                                    fontSize: 10,
                                    color: T.textMid,
                                  }}
                                >
                                  {v.youtube_url && (
                                    <a
                                      href={v.youtube_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: T.accent,
                                        textDecoration: "none",
                                      }}
                                    >
                                      ▶ WATCH ON YOUTUBE
                                    </a>
                                  )}
                                  {v.narration_url && (
                                    <a
                                      href={v.narration_url}
                                      download
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: "#a0d090",
                                        textDecoration: "none",
                                      }}
                                    >
                                      🎙 NARRATION MP3
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {channelVideos.length > channelVisible && (
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          textAlign: "right",
                          marginBottom: 10,
                        }}
                      >
                        Showing {channelVisible} of {channelVideos.length}{" "}
                        videos — scroll down for more
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill,minmax(300px,1fr))",
                        gap: 16,
                      }}
                    >
                      {channelVideos.slice(0, channelVisible).map((v) => (
                        <div
                          key={v.id}
                          style={{
                            background: T.bgCard,
                            border: `1px solid ${T.border}`,
                            borderRadius: 14,
                            overflow: "hidden",
                          }}
                        >
                          {/* Thumbnail */}
                          <div
                            style={{
                              position: "relative",
                              paddingBottom: "56.25%",
                              background: T.bgBase,
                            }}
                          >
                            {v.thumbnail ? (
                              <img
                                src={v.thumbnail}
                                alt={v.title}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: T.textFaint,
                                  fontSize: 28,
                                }}
                              >
                                ▶
                              </div>
                            )}
                            {/* Privacy badge */}
                            <div
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                fontSize: 9,
                                padding: "3px 7px",
                                borderRadius: 5,
                                letterSpacing: "0.08em",
                                background:
                                  v.privacy === "public"
                                    ? "rgba(0,192,112,0.85)"
                                    : v.privacy === "private"
                                      ? "rgba(30,30,40,0.9)"
                                      : "rgba(255,160,0,0.85)",
                                color: "#fff",
                              }}
                            >
                              {v.privacy?.toUpperCase() || "—"}
                            </div>
                            {/* Duration */}
                            {v.duration && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 8,
                                  right: 8,
                                  fontSize: 9,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "rgba(0,0,0,0.75)",
                                  color: "#fff",
                                }}
                              >
                                {v.duration}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ padding: "12px 14px" }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.text,
                                marginBottom: 6,
                                lineHeight: 1.4,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {v.title}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                fontSize: 10,
                                color: T.textMid,
                                marginBottom: 12,
                              }}
                            >
                              <span>👁 {fmtNum(v.views || 0)}</span>
                              <span>👍 {fmtNum(v.likes || 0)}</span>
                              <span>💬 {fmtNum(v.comments || 0)}</span>
                              <span style={{ marginLeft: "auto" }}>
                                {timeAgo(v.published_at)}
                              </span>
                            </div>
                            {/* Actions */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 6,
                              }}
                            >
                              <a
                                href={`https://youtube.com/watch?v=${v.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  padding: "7px 0",
                                  background: T.bgBase,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 7,
                                  color: T.textMid,
                                  fontSize: 10,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                ▶ WATCH
                              </a>
                              <a
                                href={`https://studio.youtube.com/video/${v.id}/edit`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  padding: "7px 0",
                                  background: T.bgBase,
                                  border: `1px solid ${T.border}`,
                                  borderRadius: 7,
                                  color: T.textMid,
                                  fontSize: 10,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                ✏ EDIT
                              </a>
                              {v.privacy !== "private" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "private" },
                                      );
                                      showToast("Video set to private");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast(
                                        "Failed to set private",
                                        "error",
                                      );
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🔒 MAKE PRIVATE
                                </button>
                              )}
                              {v.privacy !== "public" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "public" },
                                      );
                                      showToast("Video set to public");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast(
                                        "Failed to set public",
                                        "error",
                                      );
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🌍 MAKE PUBLIC
                                </button>
                              )}
                              {v.privacy !== "unlisted" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/channel/videos/${v.id}/privacy`,
                                        { privacy: "unlisted" },
                                      );
                                      showToast("Video set to unlisted");
                                      fetchChannel();
                                    } catch (e) {
                                      showToast("Failed", "error");
                                    }
                                  }}
                                  style={{
                                    padding: "7px 0",
                                    background: T.bgBase,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 7,
                                    color: T.textMid,
                                    fontSize: 10,
                                    fontFamily: "inherit",
                                    letterSpacing: "0.06em",
                                    cursor: "pointer",
                                  }}
                                >
                                  🔗 UNLISTED
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setChannelDeleteConfirm({
                                    id: v.id,
                                    title: v.title,
                                  })
                                }
                                style={{
                                  padding: "7px 0",
                                  background: `rgba(220,38,38,0.07)`,
                                  border: `1px solid rgba(220,38,38,0.25)`,
                                  borderRadius: 7,
                                  color: T.accentRed,
                                  fontSize: 10,
                                  fontFamily: "inherit",
                                  letterSpacing: "0.06em",
                                  cursor: "pointer",
                                }}
                              >
                                🗑 DELETE
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Infinite scroll sentinel */}
                    {channelVideos.length > channelVisible && (
                      <div
                        ref={channelBottomRef}
                        style={{
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            letterSpacing: "0.08em",
                          }}
                        >
                          ↓ loading more...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "billing" && (
              <div style={{ padding: "0 2px" }}>
                {!billing ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 60,
                      color: T.textMid,
                      fontSize: 12,
                    }}
                  >
                    Loading billing data...
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(320px,1fr))",
                      gap: 16,
                    }}
                  >
                    {/* ElevenLabs */}
                    {billing.elevenlabs && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🎙</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              ElevenLabs
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Text-to-Speech
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background:
                                billing.elevenlabs.status === "ok"
                                  ? "#00ff9020"
                                  : "#ff505020",
                              color:
                                billing.elevenlabs.status === "ok"
                                  ? "#00ff90"
                                  : "#ff5050",
                              border: `1px solid ${billing.elevenlabs.status === "ok" ? "#00ff9040" : "#ff505040"}`,
                            }}
                          >
                            {billing.elevenlabs.status === "ok"
                              ? "● LIVE"
                              : "● ERROR"}
                          </div>
                        </div>
                        {billing.elevenlabs.status === "ok" ? (
                          <>
                            <div style={{ marginBottom: 10 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 11,
                                  marginBottom: 5,
                                }}
                              >
                                <span style={{ color: T.textMid }}>
                                  Characters used
                                </span>
                                <span
                                  style={{ color: T.text, fontWeight: 600 }}
                                >
                                  {(
                                    billing.elevenlabs.chars_used || 0
                                  ).toLocaleString()}{" "}
                                  /{" "}
                                  {(
                                    billing.elevenlabs.chars_limit || 0
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 6,
                                  background: `${T.border}`,
                                  borderRadius: 99,
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    borderRadius: 99,
                                    width: `${Math.min(billing.elevenlabs.percent_used || 0, 100)}%`,
                                    background:
                                      (billing.elevenlabs.percent_used || 0) >
                                      80
                                        ? "#ff5050"
                                        : (billing.elevenlabs.percent_used ||
                                              0) > 50
                                          ? "#ffaa00"
                                          : "#00d4ff",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: T.textMid,
                                  marginTop: 4,
                                }}
                              >
                                {billing.elevenlabs.percent_used || 0}% used
                              </div>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                              }}
                            >
                              {[
                                [
                                  "Remaining",
                                  `${((billing.elevenlabs.chars_remaining || 0) / 1000).toFixed(0)}K chars`,
                                ],
                                ["Tier", billing.elevenlabs.tier || "—"],
                                [
                                  "Resets On",
                                  billing.elevenlabs.reset_date || "—",
                                ],
                                [
                                  "Voice ID",
                                  billing.elevenlabs.voice_id || "—",
                                ],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    background: T.bgBase,
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textMid,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 2,
                                    }}
                                  >
                                    {k}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: T.text,
                                    }}
                                  >
                                    {v}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <a
                              href="https://elevenlabs.io/subscription"
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "block",
                                marginTop: 12,
                                textAlign: "center",
                                fontSize: 10,
                                color: T.accent,
                                textDecoration: "none",
                                letterSpacing: "0.06em",
                              }}
                            >
                              MANAGE SUBSCRIPTION →
                            </a>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, color: "#ff5050" }}>
                            {billing.elevenlabs.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* YouTube */}
                    {billing.youtube && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>▶</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              YouTube API
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Data API v3
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● LIVE
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ color: T.textMid }}>
                              Units used today
                            </span>
                            <span style={{ color: T.text, fontWeight: 600 }}>
                              {(
                                billing.youtube.units_used_today || 0
                              ).toLocaleString()}{" "}
                              / 10,000
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: `${T.border}`,
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                width: `${Math.min((billing.youtube.units_used_today || 0) / 100, 100)}%`,
                                background:
                                  (billing.youtube.units_used_today || 0) > 8000
                                    ? "#ff5050"
                                    : (billing.youtube.units_used_today || 0) >
                                        5000
                                      ? "#ffaa00"
                                      : "#00d4ff",
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            [
                              "Uploads Today",
                              billing.youtube.uploads_today || 0,
                            ],
                            [
                              "Uploads Left",
                              billing.youtube.uploads_remaining_today || 0,
                            ],
                            [
                              "Units Remaining",
                              (
                                billing.youtube.units_remaining || 0
                              ).toLocaleString(),
                            ],
                            [
                              "Upload Units",
                              (
                                billing.youtube.upload_units_used || 0
                              ).toLocaleString(),
                            ],
                            [
                              "Read Units",
                              (
                                billing.youtube.read_units_used || 0
                              ).toLocaleString(),
                            ],
                            ["Cost/Upload", "1,600 units"],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textMid,
                            lineHeight: 1.6,
                            marginBottom: 8,
                          }}
                        >
                          Quota resets midnight Pacific Time. Apply for a free
                          increase at Google Cloud Console if needed.
                        </div>
                        <a
                          href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          VIEW QUOTA DASHBOARD →
                        </a>
                      </div>
                    )}

                    {/* Supabase */}
                    {billing.supabase && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🗄</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Supabase
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Database & Storage
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background:
                                billing.supabase.status === "ok"
                                  ? "#00ff9020"
                                  : "#ff505020",
                              color:
                                billing.supabase.status === "ok"
                                  ? "#00ff90"
                                  : "#ff5050",
                              border: `1px solid ${billing.supabase.status === "ok" ? "#00ff9040" : "#ff505040"}`,
                            }}
                          >
                            {billing.supabase.status === "ok"
                              ? "● LIVE"
                              : "● ERROR"}
                          </div>
                        </div>
                        {/* Storage progress bar */}
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ color: T.textMid }}>
                              Storage used
                            </span>
                            <span style={{ color: T.text, fontWeight: 600 }}>
                              {billing.supabase.storage_used_gb >= 1
                                ? `${billing.supabase.storage_used_gb.toFixed(2)} GB`
                                : `${billing.supabase.storage_used_mb || 0} MB`}{" "}
                              / {billing.supabase.storage_limit_gb || 100} GB
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: T.border,
                              borderRadius: 99,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                width: `${Math.min(billing.supabase.storage_percent || 0, 100)}%`,
                                background:
                                  (billing.supabase.storage_percent || 0) > 80
                                    ? "#ff5050"
                                    : (billing.supabase.storage_percent || 0) > 50
                                      ? "#ffaa00"
                                      : "#00d4ff",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: T.textMid,
                              marginTop: 4,
                            }}
                          >
                            {billing.supabase.storage_percent || 0}% of{" "}
                            {billing.supabase.storage_limit_gb || 100} GB used
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            ["Tier", billing.supabase.tier || "Pro"],
                            ["Videos in DB", billing.supabase.videos_in_db || 0],
                            [
                              "Video Files",
                              `${billing.supabase.videos_file_count || 0} files (${billing.supabase.videos_bucket_mb || 0} MB)`,
                            ],
                            [
                              "Narrations",
                              `${billing.supabase.narrations_file_count || 0} files (${billing.supabase.narrations_bucket_mb || 0} MB)`,
                            ],
                            [
                              "Storage Limit",
                              `${billing.supabase.storage_limit_gb || 100} GB`,
                            ],
                            [
                              "Max File Size",
                              `${billing.supabase.file_size_limit_gb || 5} GB`,
                            ],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://supabase.com/dashboard"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          OPEN SUPABASE DASHBOARD →
                        </a>
                      </div>
                    )}

                    {/* Groq */}
                    {billing.groq && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>⚡</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Groq
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Script Generation LLM
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● FREE
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            [
                              "Model",
                              billing.groq.model
                                ?.split("-")
                                .slice(0, 3)
                                .join("-") || "—",
                            ],
                            ["Pricing", billing.groq.pricing || "Free"],
                            [
                              "Context",
                              `${billing.groq.context_k || 128}K tokens`,
                            ],
                            [
                              "Tok/Min",
                              (billing.groq.tok_per_min || 6000).toLocaleString(),
                            ],
                            [
                              "Req/Min",
                              billing.groq.req_per_min || 30,
                            ],
                            [
                              "Daily Limit",
                              `${((billing.groq.tok_per_day || 500000) / 1000).toFixed(0)}K tokens`,
                            ],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://console.groq.com"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          OPEN GROQ CONSOLE →
                        </a>
                      </div>
                    )}

                    {/* Pexels */}
                    {billing.pexels && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🎬</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Pexels
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Stock Video & Images
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#00ff9020",
                              color: "#00ff90",
                              border: "1px solid #00ff9040",
                            }}
                          >
                            ● FREE
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          {[
                            ["Pricing", "Free"],
                            [
                              "Rate Limit",
                              `${billing.pexels.rate_limit_hour || 200} req/hr`,
                            ],
                            [
                              "Monthly",
                              `${((billing.pexels.monthly_limit || 20000) / 1000).toFixed(0)}K requests`,
                            ],
                            [
                              "Content",
                              billing.pexels.content_types || "Videos, Photos",
                            ],
                            [
                              "Pixabay Fallback",
                              billing.pexels.pixabay_fallback ? "✓ Configured" : "✗ Not set",
                            ],
                            ["Attribution", "Required"],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: T.bgBase,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  color: T.textMid,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 2,
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: T.text,
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://www.pexels.com/api/"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "block",
                            textAlign: "center",
                            fontSize: 10,
                            color: T.accent,
                            textDecoration: "none",
                            letterSpacing: "0.06em",
                          }}
                        >
                          PEXELS API DOCS →
                        </a>
                      </div>
                    )}

                    {/* ── Hetzner VPS ── */}
                    {billing.hetzner && (
                      <div
                        style={{
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: 20,
                          gridColumn: "1/-1",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontSize: 22 }}>🖥️</div>
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Hetzner VPS
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: T.textMid,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              {billing.hetzner.server_name || "Server"} ·{" "}
                              {billing.hetzner.location || "—"}
                            </div>
                          </div>
                          {billing.hetzner.status === "ok" ? (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background:
                                  billing.hetzner.server_status === "running"
                                    ? "#00ff9020"
                                    : "#ff505020",
                                color:
                                  billing.hetzner.server_status === "running"
                                    ? "#00ff90"
                                    : "#ff5050",
                                border: `1px solid ${billing.hetzner.server_status === "running" ? "#00ff9040" : "#ff505040"}`,
                              }}
                            >
                              ●{" "}
                              {(
                                billing.hetzner.server_status || "unknown"
                              ).toUpperCase()}
                            </div>
                          ) : billing.hetzner.status === "no_token" ? (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background: "#ffaa0015",
                                color: "#ffaa00",
                                border: "1px solid #ffaa0040",
                              }}
                            >
                              ⚠ ADD TOKEN
                            </div>
                          ) : (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                padding: "3px 10px",
                                borderRadius: 6,
                                background: "#ff505020",
                                color: "#ff5050",
                                border: "1px solid #ff505040",
                              }}
                            >
                              ● ERROR
                            </div>
                          )}
                        </div>

                        {billing.hetzner.status === "ok" ? (
                          <>
                            {/* Specs + Cost grid */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4,1fr)",
                                gap: 8,
                                marginBottom: 14,
                              }}
                            >
                              {[
                                ["Type", billing.hetzner.server_type],
                                ["CPU", `${billing.hetzner.cpu_cores} vCPU`],
                                ["RAM", `${billing.hetzner.ram_gb} GB`],
                                [
                                  "Disk",
                                  `${billing.hetzner.disk_gb} GB ${billing.hetzner.disk_type || ""}`,
                                ],
                                [
                                  "Monthly",
                                  billing.hetzner.monthly_cost || "—",
                                ],
                                ["Since", billing.hetzner.created || "—"],
                                [
                                  "Traffic In",
                                  `${billing.hetzner.ingoing_traffic_gb || 0} GB`,
                                ],
                                [
                                  "Traffic Out",
                                  `${billing.hetzner.outgoing_traffic_gb || 0} GB`,
                                ],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    background: T.bgBase,
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: T.textMid,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 2,
                                    }}
                                  >
                                    {k}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: T.text,
                                    }}
                                  >
                                    {v || "—"}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Traffic bar */}
                            {billing.hetzner.included_traffic_tb &&
                              billing.hetzner.included_traffic_tb !== "—" && (
                                <div style={{ marginBottom: 14 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: 10,
                                      color: T.textMid,
                                      marginBottom: 5,
                                    }}
                                  >
                                    <span>Outbound traffic this month</span>
                                    <span>
                                      {billing.hetzner.outgoing_traffic_gb} GB /{" "}
                                      {billing.hetzner.included_traffic_tb *
                                        1000}{" "}
                                      GB included
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      height: 5,
                                      background: T.border,
                                      borderRadius: 99,
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        borderRadius: 99,
                                        background: "#00d4ff",
                                        width: `${Math.min((billing.hetzner.outgoing_traffic_gb / (billing.hetzner.included_traffic_tb * 1000)) * 100, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                            {/* IPv4 + console link */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: T.textFaint,
                                  fontFamily: "monospace",
                                }}
                              >
                                {billing.hetzner.ipv4}
                              </div>
                              <a
                                href="https://console.hetzner.cloud"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: 10,
                                  color: T.accent,
                                  textDecoration: "none",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                OPEN HETZNER CONSOLE →
                              </a>
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                billing.hetzner.status === "no_token"
                                  ? "#ffaa00"
                                  : "#ff5050",
                              lineHeight: 1.6,
                            }}
                          >
                            {billing.hetzner.status === "no_token"
                              ? "Add HETZNER_API_TOKEN to your server .env file to see live server stats. Create a Read-only token at console.hetzner.cloud → Security → API Tokens."
                              : billing.hetzner.error}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Refresh button */}
                    <div
                      style={{
                        gridColumn: "1/-1",
                        textAlign: "center",
                        paddingTop: 4,
                      }}
                    >
                      <button
                        onClick={fetchBilling}
                        style={{
                          padding: "9px 24px",
                          background: "transparent",
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          color: T.textMid,
                          fontSize: 10,
                          fontFamily: "inherit",
                          letterSpacing: "0.1em",
                          cursor: "pointer",
                        }}
                      >
                        ↺ REFRESH
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS TAB ───────────────────────────────────────────────────── */}
            {tab === "compilations" && (
              <CompilationStudio T={T} showToast={showToast} videos={videos} />
            )}

            {tab === "analytics" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: "SUCCESS RATE",
                      value: stats.total
                        ? `${Math.round(((stats.total - (stats.failed || 0)) / stats.total) * 100)}%`
                        : "—",
                      color: T.accentGreen,
                    },
                    {
                      label: "AVG DURATION",
                      value: (() => {
                        const p = videos.filter((v) => v.duration_seconds);
                        return p.length
                          ? fmtDur(
                              Math.round(
                                p.reduce((s, v) => s + v.duration_seconds, 0) /
                                  p.length,
                              ),
                            )
                          : "—";
                      })(),
                      color: T.accent,
                    },
                    {
                      label: "THIS WEEK",
                      value: videos.filter(
                        (v) =>
                          new Date(v.created_at) >
                          new Date(Date.now() - 7 * 86400000),
                      ).length,
                      color: T.accentYellow,
                    },
                  ].map((s) => (
                    <div key={s.label} className="stat-card">
                      <div
                        style={{
                          fontSize: 9,
                          color: T.textFaint,
                          letterSpacing: "0.12em",
                          marginBottom: 10,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontSize: 28,
                          fontWeight: 800,
                          color: s.color,
                        }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textFaint,
                      letterSpacing: "0.12em",
                      marginBottom: 16,
                    }}
                  >
                    STATUS BREAKDOWN
                  </div>
                  {Object.entries(STATUS).map(([key, s]) => {
                    const count = videos.filter((v) => v.status === key).length;
                    if (!count) return null;
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            fontSize: 10,
                            color: s.color,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: T.border,
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${(count / videos.length) * 100}%`,
                              height: "100%",
                              background: s.color,
                              borderRadius: 3,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMid,
                            width: 20,
                            textAlign: "right",
                          }}
                        >
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {quota.chars_remaining !== undefined && (
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.12em",
                        marginBottom: 16,
                      }}
                    >
                      ELEVENLABS QUOTA
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {[
                        {
                          label: "USED",
                          value: quota.chars_used?.toLocaleString(),
                          color: T.accentRed,
                        },
                        {
                          label: "REMAINING",
                          value: quota.chars_remaining?.toLocaleString(),
                          color: T.accentGreen,
                        },
                        {
                          label: "LIMIT",
                          value: quota.chars_limit?.toLocaleString(),
                          color: T.textMid,
                        },
                        {
                          label: "TIER",
                          value: quota.tier?.toUpperCase() || "—",
                          color: T.accent,
                        },
                      ].map((q) => (
                        <div key={q.label}>
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.1em",
                              marginBottom: 4,
                            }}
                          >
                            {q.label}
                          </div>
                          <div
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                              fontSize: 16,
                              color: q.color,
                            }}
                          >
                            {q.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="prog-bar"
                      style={{ marginTop: 14, height: 4 }}
                    >
                      <div
                        className="prog-fill"
                        style={{
                          width: `${quota.percent_used || 0}%`,
                          background:
                            quota.percent_used > 80
                              ? T.accentRed
                              : "linear-gradient(90deg,#0070cc,#00e080)",
                        }}
                      />
                    </div>
                    <div
                      style={{ fontSize: 10, color: T.textFaint, marginTop: 6 }}
                    >
                      {quota.percent_used}% used this month
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── SETTINGS TAB ────────────────────────────────────────────────────── */}
            {tab === "settings" && (
              <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

                {/* ── LEFT COLUMN: Automation ── */}
                <div style={{ flex: 1, minWidth: 0, maxWidth: 540 }}>
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 700,
                    fontSize: 20,
                    color: T.text,
                    marginBottom: 20,
                  }}
                >
                  Automation
                </div>

                {/* ── Automation toggles ── */}
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 10,
                    }}
                  >
                    AUTOMATION
                  </div>
                  <div
                    style={{
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: T.text }}
                      >
                        💬 Auto-Reply to Comments
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textFaint,
                          marginTop: 2,
                        }}
                      >
                        Runs every 2h · replies to real viewer comments with AI
                        {autoReplyStatus?.quota_backed_off && (
                          <span
                            style={{ color: T.accentYellow, marginLeft: 6 }}
                          >
                            ⏸ Quota hit — resumes in ~
                            {autoReplyStatus.resume_in_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <div
                      onClick={() => handleAutoReplyToggle(!autoReplyEnabled)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: autoReplyEnabled ? T.accentGreen : T.border,
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: autoReplyEnabled ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* ── Auto-Generate Settings ── */}
                {autoGenSettings && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                        marginBottom: 10,
                      }}
                    >
                      AUTO-GENERATE
                    </div>
                    <div
                      style={{
                        background: T.bgCard,
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        padding: "16px",
                      }}
                    >
                      {/* Enable toggle */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: T.text,
                            }}
                          >
                            🤖 Auto-Generate Videos
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: T.textFaint,
                              marginTop: 2,
                            }}
                          >
                            Automatically generates ready-to-review videos on a
                            schedule
                          </div>
                        </div>
                        <div
                          onClick={() =>
                            setAutoGenSettings((s) => ({
                              ...s,
                              enabled: !s.enabled,
                            }))
                          }
                          style={{
                            width: 44,
                            height: 24,
                            borderRadius: 12,
                            background: autoGenSettings.enabled
                              ? T.accentGreen
                              : T.border,
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 0.2s",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 3,
                              left: autoGenSettings.enabled ? 23 : 3,
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "#fff",
                              transition: "left 0.2s",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Days of week */}
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginBottom: 6,
                            letterSpacing: "0.08em",
                          }}
                        >
                          RUN ON DAYS
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                          ].map((d, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                const days = autoGenSettings.days.includes(i)
                                  ? autoGenSettings.days.filter((x) => x !== i)
                                  : [...autoGenSettings.days, i].sort();
                                setAutoGenSettings((s) => ({ ...s, days }));
                              }}
                              style={{
                                flex: 1,
                                padding: "5px 0",
                                borderRadius: 6,
                                border: `1px solid ${autoGenSettings.days.includes(i) ? T.accent + "80" : T.border}`,
                                background: autoGenSettings.days.includes(i)
                                  ? `${T.accent}15`
                                  : "transparent",
                                color: autoGenSettings.days.includes(i)
                                  ? T.accent
                                  : T.textFaint,
                                fontSize: 9,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginTop: 5,
                          }}
                        >
                          {autoGenSettings.days.length} days/week selected ·
                          runs at {autoGenSettings.hour}:00 UTC (={" "}
                          {autoGenSettings.hour + 1}:00 Amsterdam)
                        </div>
                      </div>

                      {/* Profile */}
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textFaint,
                            marginBottom: 6,
                            letterSpacing: "0.08em",
                          }}
                        >
                          CONTENT PROFILE
                        </div>
                        <div
                          style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
                        >
                          {[
                            "educational",
                            "serious",
                            "inspirational",
                            "reflective",
                          ].map((p) => (
                            <button
                              key={p}
                              onClick={() =>
                                setAutoGenSettings((s) => ({
                                  ...s,
                                  profile: p,
                                }))
                              }
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: `1px solid ${autoGenSettings.profile === p ? T.accent + "80" : T.border}`,
                                background:
                                  autoGenSettings.profile === p
                                    ? `${T.accent}15`
                                    : "transparent",
                                color:
                                  autoGenSettings.profile === p
                                    ? T.accent
                                    : T.textFaint,
                                fontSize: 10,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                textTransform: "capitalize",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save + Trigger */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={async () => {
                            setAutoGenSaving(true);
                            try {
                              await api.post(
                                "/auto-generate/settings",
                                autoGenSettings,
                              );
                              showToast("Auto-generate settings saved");
                            } catch (e) {
                              showToast("Failed to save", "error");
                            } finally {
                              setAutoGenSaving(false);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 7,
                            border: `1px solid ${T.accent}50`,
                            background: `${T.accent}10`,
                            color: T.accent,
                            fontSize: 11,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {autoGenSaving ? "Saving..." : "💾 Save Settings"}
                        </button>
                        <button
                          disabled={autoGenRunning}
                          onClick={async () => {
                            try {
                              const res = await api.post(
                                "/auto-generate/trigger",
                              );
                              const vid = res.data?.video_id;
                              if (!vid) {
                                showToast(
                                  "Server did not return a video ID",
                                  "error",
                                );
                                return;
                              }

                              setAutoGenJobId(vid);
                              setAutoGenPrompt(res.data.prompt || "");
                              setAutoGenRunning(true);
                              setAutoGenStep(1);
                              setAutoGenLogs([]);
                              autoGenLogLineRef.current = 0;
                              showToast("🤖 Auto-generate started!");

                              // Poll for step progress — use functional updater to avoid stale closure
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
                              const stepPoll = setInterval(async () => {
                                try {
                                  const { data: st } = await api.get(
                                    `/videos/${vid}`,
                                  );
                                  if (st?.status)
                                    setAutoGenStep(stepMap[st.status] ?? 1);
                                  if (
                                    ["ready", "posted", "failed"].includes(
                                      st?.status,
                                    )
                                  ) {
                                    clearInterval(stepPoll);
                                    clearInterval(autoGenLogPollRef.current);
                                    setAutoGenRunning(false);
                                    if (st.status === "failed")
                                      showToast(
                                        "Auto-generate failed",
                                        "error",
                                      );
                                    else {
                                      showToast(
                                        "✅ Auto-generated video ready!",
                                      );
                                      refresh();
                                    }
                                  }
                                } catch (e) {}
                              }, 4000);

                              // Poll logs
                              autoGenLogPollRef.current = setInterval(
                                async () => {
                                  try {
                                    const { data: ld } = await api.get(
                                      `/videos/${vid}/logs?since=${autoGenLogLineRef.current}`,
                                    );
                                    if (ld?.lines?.length > 0) {
                                      autoGenLogLineRef.current +=
                                        ld.lines.length;
                                      setAutoGenLogs((prev) =>
                                        [...prev, ...ld.lines].slice(-300),
                                      );
                                      setTimeout(
                                        () =>
                                          autoGenLogsEndRef.current?.scrollIntoView(
                                            { behavior: "smooth" },
                                          ),
                                        50,
                                      );
                                    }
                                    if (ld?.done)
                                      clearInterval(autoGenLogPollRef.current);
                                  } catch (e) {}
                                },
                                1500,
                              );
                            } catch (e) {
                              showToast(
                                e.response?.data?.detail || "Failed to trigger",
                                "error",
                              );
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 7,
                            border: `1px solid ${autoGenRunning ? T.border : T.accentGreen + "60"}`,
                            background: autoGenRunning
                              ? "transparent"
                              : `${T.accentGreen}10`,
                            color: autoGenRunning ? T.textFaint : T.accentGreen,
                            fontSize: 11,
                            fontFamily: "inherit",
                            cursor: autoGenRunning ? "not-allowed" : "pointer",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {autoGenRunning ? "⚙ Running..." : "▶ Run Now"}
                        </button>
                      </div>

                      {/* Progress panel — appears when auto-generate is running */}
                      {autoGenRunning && (
                        <div
                          style={{
                            marginTop: 16,
                            borderTop: `1px solid ${T.border}`,
                            paddingTop: 16,
                          }}
                        >
                          {autoGenPrompt && (
                            <div
                              style={{
                                fontSize: 11,
                                color: T.textMid,
                                marginBottom: 12,
                                fontStyle: "italic",
                              }}
                            >
                              "{autoGenPrompt}"
                            </div>
                          )}
                          {/* Step circles */}
                          <div
                            style={{
                              display: "flex",
                              gap: 0,
                              alignItems: "center",
                              marginBottom: 14,
                            }}
                          >
                            {STEPS.map((s, i) => {
                              const done = i < autoGenStep - 1,
                                active = i === autoGenStep - 1;
                              return (
                                <div
                                  key={s}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flex: 1,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "relative",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {active && (
                                        <>
                                          <div
                                            style={{
                                              position: "absolute",
                                              borderRadius: "50%",
                                              width: 32,
                                              height: 32,
                                              border: `2px solid ${T.accent}`,
                                              animation:
                                                "ringPulse 1.4s ease-out infinite",
                                              opacity: 0,
                                            }}
                                          />
                                          <div
                                            style={{
                                              position: "absolute",
                                              borderRadius: "50%",
                                              width: 40,
                                              height: 40,
                                              border: `1.5px solid ${T.accent}`,
                                              animation:
                                                "ringPulse 1.4s ease-out infinite 0.4s",
                                              opacity: 0,
                                            }}
                                          />
                                        </>
                                      )}
                                      <div
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: "50%",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 10,
                                          fontWeight: 700,
                                          background: done
                                            ? T.accentGreen
                                            : active
                                              ? T.accent
                                              : T.bgDeep,
                                          color:
                                            done || active
                                              ? "white"
                                              : T.textFaint,
                                          transition: "all 0.4s",
                                          boxShadow: active
                                            ? `0 0 14px ${T.accent}80`
                                            : "none",
                                          zIndex: 1,
                                        }}
                                      >
                                        {done ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 8,
                                        color: active
                                          ? T.accent
                                          : done
                                            ? T.accentGreen
                                            : T.textFaint,
                                        letterSpacing: "0.06em",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {s.toUpperCase()}
                                    </div>
                                  </div>
                                  {i < STEPS.length - 1 && (
                                    <div
                                      style={{
                                        flex: 1,
                                        height: 2,
                                        background: done
                                          ? T.accentGreen
                                          : T.border,
                                        margin: "0 3px",
                                        marginBottom: 18,
                                        transition: "background 0.4s",
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* View Logs + Cancel */}
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setShowAutoGenLogs(true)}
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: "transparent",
                                color: T.textMid,
                                fontSize: 10,
                                fontFamily: "inherit",
                                letterSpacing: "0.07em",
                                cursor: "pointer",
                              }}
                            >
                              📋 VIEW LOGS
                            </button>
                            <button
                              onClick={async () => {
                                clearInterval(autoGenLogPollRef.current);
                                if (autoGenJobId) {
                                  try {
                                    await api.post(
                                      `/videos/${autoGenJobId}/cancel`,
                                    );
                                  } catch (e) {}
                                }
                                setAutoGenRunning(false);
                                setAutoGenStep(0);
                                showToast("Cancelled", "error");
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: `1px solid ${T.accentRed}40`,
                                background: `${T.accentRed}08`,
                                color: T.accentRed,
                                fontSize: 10,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                letterSpacing: "0.07em",
                              }}
                            >
                              🛑 CANCEL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-gen log modal */}
                {showAutoGenLogs && (
                  <div
                    onClick={() => setShowAutoGenLogs(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      background: "rgba(0,0,0,0.75)",
                      zIndex: 200,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 20,
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        maxWidth: 700,
                        maxHeight: "70vh",
                        background: "#0a0a0f",
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 18px",
                          borderBottom: `1px solid ${T.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.text,
                            letterSpacing: "0.1em",
                          }}
                        >
                          AUTO-GENERATE LOGS
                        </div>
                        <button
                          onClick={() => setShowAutoGenLogs(false)}
                          style={{
                            background: "none",
                            border: "none",
                            color: T.textFaint,
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: "12px 18px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          lineHeight: 1.7,
                        }}
                      >
                        {autoGenLogs.length === 0 ? (
                          <div style={{ color: T.textFaint }}>
                            Waiting for pipeline output...
                          </div>
                        ) : (
                          autoGenLogs.map((line, i) => (
                            <div
                              key={i}
                              style={{
                                color: line.startsWith("[ERROR]")
                                  ? "#ff6060"
                                  : line.startsWith("[DONE]")
                                    ? "#60ff60"
                                    : "#a0d0a0",
                              }}
                            >
                              {line}
                            </div>
                          ))
                        )}
                        <div ref={autoGenLogsEndRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Auto-Short Settings ── */}
                {autoShortSettings && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.1em", marginBottom: 10 }}>
                      AUTO-SHORT
                    </div>
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px" }}>
                      {/* Enable toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>📱 Auto-Generate Shorts</div>
                          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                            Automatically generates portrait 9:16 Shorts on a schedule
                          </div>
                        </div>
                        <div
                          onClick={() => setAutoShortSettings(s => ({ ...s, enabled: !s.enabled }))}
                          style={{
                            width: 44, height: 24, borderRadius: 12,
                            background: autoShortSettings.enabled ? T.accentGreen : T.border,
                            cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 3,
                            left: autoShortSettings.enabled ? 23 : 3,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          }} />
                        </div>
                      </div>

                      {/* Days of week */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>RUN ON DAYS</div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                            <button key={i}
                              onClick={() => {
                                const days = autoShortSettings.days.includes(i)
                                  ? autoShortSettings.days.filter(x => x !== i)
                                  : [...autoShortSettings.days, i].sort();
                                setAutoShortSettings(s => ({ ...s, days }));
                              }}
                              style={{
                                flex: 1, padding: "5px 0", borderRadius: 6,
                                border: `1px solid ${autoShortSettings.days.includes(i) ? T.accent + "80" : T.border}`,
                                background: autoShortSettings.days.includes(i) ? `${T.accent}15` : "transparent",
                                color: autoShortSettings.days.includes(i) ? T.accent : T.textFaint,
                                fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em",
                              }}
                            >{d}</button>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 5 }}>
                          {autoShortSettings.days.length} days/week · runs at {autoShortSettings.hour}:00 UTC
                        </div>
                      </div>

                      {/* Hour input */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>RUN HOUR (UTC)</div>
                        <input
                          type="number" min={0} max={23}
                          value={autoShortSettings.hour}
                          onChange={e => setAutoShortSettings(s => ({ ...s, hour: parseInt(e.target.value) || 0 }))}
                          style={{
                            width: 80, padding: "5px 8px", borderRadius: 6,
                            border: `1px solid ${T.border}`, background: T.inputBg,
                            color: T.text, fontSize: 12, fontFamily: "inherit",
                          }}
                        />
                      </div>

                      {/* Ambience selector */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, letterSpacing: "0.08em" }}>AMBIENCE</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {["stars","aurora","ocean","fire","rain","galaxy"].map(a => (
                            <button key={a}
                              onClick={() => setAutoShortSettings(s => ({ ...s, ambience: a }))}
                              style={{
                                padding: "5px 10px", borderRadius: 6,
                                border: `1px solid ${autoShortSettings.ambience === a ? T.accent + "80" : T.border}`,
                                background: autoShortSettings.ambience === a ? `${T.accent}15` : "transparent",
                                color: autoShortSettings.ambience === a ? T.accent : T.textFaint,
                                fontSize: 10, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize",
                              }}
                            >{a}</button>
                          ))}
                        </div>
                      </div>

                      {/* Save + Run Now */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={async () => {
                            setAutoShortSaving(true);
                            try {
                              await saveAutoShortSettings(autoShortSettings);
                              showToast("Auto-short settings saved");
                            } catch (e) {
                              showToast("Failed to save", "error");
                            } finally {
                              setAutoShortSaving(false);
                            }
                          }}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 7,
                            border: `1px solid ${T.accent}50`, background: `${T.accent}10`,
                            color: T.accent, fontSize: 11, fontFamily: "inherit",
                            cursor: "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {autoShortSaving ? "Saving..." : "💾 Save Settings"}
                        </button>
                        <button
                          disabled={autoShortRunning}
                          onClick={async () => {
                            try {
                              const res = await triggerAutoShort();
                              const vid = res?.video_id;
                              if (!vid) { showToast("Server did not return a video ID", "error"); return; }
                              setAutoShortJobId(vid);
                              setAutoShortPrompt(res.topic || "");
                              setAutoShortRunning(true);
                              setAutoShortStep(1);
                              setAutoShortLogs([]);
                              autoShortLogLineRef.current = 0;
                              showToast("📱 Auto-short started!");

                              const stepMap = { generating:1, scripted:2, voiced:3, assembled:4, captioned:5, labeled:5, ready:6, posted:6 };
                              const stepPoll = setInterval(async () => {
                                try {
                                  const { data: st } = await api.get(`/videos/${vid}`);
                                  if (st?.status) setAutoShortStep(stepMap[st.status] ?? 1);
                                  if (["ready","posted","failed"].includes(st?.status)) {
                                    clearInterval(stepPoll);
                                    clearInterval(autoShortLogPollRef.current);
                                    setAutoShortRunning(false);
                                    if (st.status === "failed") showToast("Auto-short failed", "error");
                                    else { showToast("✅ Auto-short ready!"); refresh(); }
                                  }
                                } catch (e) {}
                              }, 4000);

                              autoShortLogPollRef.current = setInterval(async () => {
                                try {
                                  const { data: ld } = await api.get(`/videos/${vid}/logs?since=${autoShortLogLineRef.current}`);
                                  if (ld?.lines?.length > 0) {
                                    autoShortLogLineRef.current += ld.lines.length;
                                    setAutoShortLogs(prev => [...prev, ...ld.lines].slice(-300));
                                    setTimeout(() => autoShortLogsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                                  }
                                  if (ld?.done) clearInterval(autoShortLogPollRef.current);
                                } catch (e) {}
                              }, 1500);
                            } catch (e) {
                              showToast(e.response?.data?.detail || "Failed to trigger", "error");
                            }
                          }}
                          style={{
                            padding: "8px 14px", borderRadius: 7,
                            border: `1px solid ${autoShortRunning ? T.border : T.accentGreen + "60"}`,
                            background: autoShortRunning ? "transparent" : `${T.accentGreen}10`,
                            color: autoShortRunning ? T.textFaint : T.accentGreen,
                            fontSize: 11, fontFamily: "inherit",
                            cursor: autoShortRunning ? "not-allowed" : "pointer", letterSpacing: "0.06em",
                          }}
                        >
                          {autoShortRunning ? "⚙ Running..." : "▶ Run Now"}
                        </button>
                      </div>

                      {/* Progress panel */}
                      {autoShortRunning && (
                        <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                          {autoShortPrompt && (
                            <div style={{ fontSize: 11, color: T.textMid, marginBottom: 12, fontStyle: "italic" }}>
                              "{autoShortPrompt}"
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 0, alignItems: "center", marginBottom: 14 }}>
                            {STEPS.map((s, i) => {
                              const done = i < autoShortStep - 1, active = i === autoShortStep - 1;
                              return (
                                <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <div style={{
                                        width: 24, height: 24, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700,
                                        background: done ? T.accentGreen : active ? T.accent : T.bgDeep,
                                        color: done || active ? "white" : T.textFaint,
                                        transition: "all 0.4s",
                                        boxShadow: active ? `0 0 14px ${T.accent}80` : "none", zIndex: 1,
                                      }}>
                                        {done ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <div style={{
                                      fontSize: 8, color: active ? T.accent : done ? T.accentGreen : T.textFaint,
                                      letterSpacing: "0.06em", whiteSpace: "nowrap",
                                    }}>
                                      {s.toUpperCase()}
                                    </div>
                                  </div>
                                  {i < STEPS.length - 1 && (
                                    <div style={{
                                      flex: 1, height: 2,
                                      background: done ? T.accentGreen : T.border,
                                      margin: "0 3px", marginBottom: 18, transition: "background 0.4s",
                                    }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setShowAutoShortLogs(true)}
                              style={{
                                flex: 1, padding: "6px 0", borderRadius: 6,
                                border: `1px solid ${T.border}`, background: "transparent",
                                color: T.textMid, fontSize: 10, fontFamily: "inherit",
                                letterSpacing: "0.07em", cursor: "pointer",
                              }}
                            >📋 VIEW LOGS</button>
                            <button
                              onClick={() => {
                                clearInterval(autoShortLogPollRef.current);
                                setAutoShortRunning(false);
                                setAutoShortStep(0);
                                showToast("Cancelled", "error");
                              }}
                              style={{
                                padding: "6px 12px", borderRadius: 6,
                                border: `1px solid ${T.accentRed}40`, background: `${T.accentRed}08`,
                                color: T.accentRed, fontSize: 10, fontFamily: "inherit",
                                cursor: "pointer", letterSpacing: "0.07em",
                              }}
                            >🛑 CANCEL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                </div>{/* end LEFT COLUMN */}

                {/* ── RIGHT COLUMN: Configuration ── */}
                <div style={{ width: 320, flexShrink: 0, position: "sticky", top: 20 }}>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 20,
                      color: T.text,
                      marginBottom: 20,
                    }}
                  >
                    Configuration
                  </div>

                  <div
                    style={{
                      padding: "12px 16px",
                      background: `${T.accentYellow}0a`,
                      border: `1px solid ${T.accentYellow}22`,
                      borderRadius: 10,
                      fontSize: 11,
                      color: T.accentYellow,
                      marginBottom: 16,
                      lineHeight: 1.6,
                    }}
                  >
                    ⚠ API keys are configured in{" "}
                    <code style={{ background: T.inputBg, padding: "1px 5px", borderRadius: 3 }}>
                      backend/.env
                    </code>
                    . Restart the backend after changes.
                  </div>

                  {[
                    ["LLM MODEL", "Groq — llama-3.3-70b-versatile"],
                    ["TTS ENGINE", "ElevenLabs — Adam voice (deep)"],
                    ["TTS QUALITY", "mp3_44100_192 · stability 0.80"],
                    ["VIDEO RESOLUTION", "1920×1080 @ 30fps"],
                    ["CAPTIONS", "Whisper base + FFmpeg burn"],
                    ["STOCK CLIPS", "Pexels API (Pixabay fallback)"],
                    ["DATABASE", "Supabase PostgreSQL"],
                    ["YOUTUBE QUOTA", "10,000 units/day ≈ 6 uploads"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: T.bgCard,
                        borderRadius: 9,
                        marginBottom: 6,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.1em" }}>{k}</span>
                      <span style={{ fontSize: 11, color: T.textMid }}>{v}</span>
                    </div>
                  ))}
                </div>{/* end RIGHT COLUMN */}

              </div>
            )}

                {/* Auto-short log modal */}
                {showAutoShortLogs && (
                  <div
                    onClick={() => setShowAutoShortLogs(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                  >
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", maxWidth: 700, maxHeight: "70vh", background: "#0a0a0f", border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.1em" }}>AUTO-SHORT LOGS</div>
                        <button onClick={() => setShowAutoShortLogs(false)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 18 }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
                        {autoShortLogs.length === 0 ? (
                          <div style={{ color: T.textFaint }}>Waiting for pipeline output...</div>
                        ) : (
                          autoShortLogs.map((line, i) => (
                            <div key={i} style={{ color: line.startsWith("[ERROR]") ? "#ff6060" : line.startsWith("[DONE]") ? "#60ff60" : "#a0d0a0" }}>
                              {line}
                            </div>
                          ))
                        )}
                        <div ref={autoShortLogsEndRef} />
                      </div>
                    </div>
                  </div>
                )}
          </div>
        </div>

        {/* ── Video Preview Modal ─────────────────────────────────────────────────── */}
        {preview && (
          <div
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(16px)",
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 800,
                background: "#000",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 40px 120px rgba(0,0,0,0.9)",
                border: "1px solid rgba(255,255,255,0.06)",
                animation: "fadeUp 0.2s ease",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(10,14,22,0.95)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#ddeeff",
                      marginBottom: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 500,
                    }}
                  >
                    {preview.title || "Video Preview"}
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div
                      className="pill"
                      style={{
                        background: sc(preview.status).bg,
                        color: sc(preview.status).color,
                      }}
                    >
                      <div
                        className="dot"
                        style={{
                          background: sc(preview.status).pulse,
                          width: 5,
                          height: 5,
                        }}
                      />
                      {sc(preview.status).label}
                    </div>
                    {preview.duration_seconds && (
                      <span style={{ fontSize: 10, color: "#3a6080" }}>
                        {fmtDur(preview.duration_seconds)}
                      </span>
                    )}
                    {preview.resolution && (
                      <span style={{ fontSize: 10, color: "#3a6080" }}>
                        {preview.resolution}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  onClick={() => setPreview(null)}
                  style={{
                    cursor: "pointer",
                    color: "#3a6080",
                    fontSize: 22,
                    lineHeight: 1,
                    padding: "4px 6px",
                    borderRadius: 6,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#aac0d0")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#3a6080")
                  }
                >
                  ✕
                </div>
              </div>

              {/* Video player */}
              <div
                style={{
                  position: "relative",
                  background: "#000",
                  lineHeight: 0,
                }}
              >
                {getVideoUrl(preview.file_path) ? (
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      maxHeight: "60vh",
                      display: "block",
                      outline: "none",
                    }}
                    src={getVideoUrl(preview.file_path)}
                    onError={() => {
                      showToast(
                        "Video failed to load — check Supabase Storage",
                        "error",
                      );
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 320,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                      background: "#000",
                      padding: 40,
                    }}
                  >
                    <span style={{ fontSize: 48, opacity: 0.2 }}>🎬</span>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#4a6070",
                          marginBottom: 8,
                        }}
                      >
                        No preview available
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#2a4050",
                          lineHeight: 1.7,
                          maxWidth: 340,
                        }}
                      >
                        This video was generated before Supabase Storage was set
                        up.
                        <br />
                        New videos will automatically upload to storage for
                        permanent preview.
                      </div>
                    </div>
                    {preview.status === "ready" && (
                      <button
                        className="btn-primary"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          fontSize: 11,
                        }}
                        onClick={(e) => {
                          handleUpload(preview.id, e);
                          setPreview(null);
                        }}
                      >
                        🚀 Upload to YouTube anyway
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div
                style={{
                  padding: "12px 20px",
                  background: "rgba(6,10,18,0.98)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  {(preview.labels || []).map((l) => (
                    <span key={l} className="tag">
                      {l}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  {preview.status === "posted" && preview.youtube_url && (
                    <a
                      href={preview.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "8px 16px",
                        background: "rgba(0,160,220,0.1)",
                        border: "1px solid rgba(0,160,220,0.25)",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "#00b4ff",
                        textDecoration: "none",
                        letterSpacing: "0.06em",
                      }}
                    >
                      ▶ View on YouTube
                    </a>
                  )}
                  {preview.status === "ready" && (
                    <button
                      className="btn-primary"
                      style={{ padding: "8px 18px", fontSize: 10 }}
                      onClick={(e) => {
                        handleUpload(preview.id, e);
                        setPreview(null);
                      }}
                    >
                      🚀 UPLOAD TO YOUTUBE
                    </button>
                  )}
                  {preview.status === "posted" && (
                    <div style={{ fontSize: 11, color: "#2a5070" }}>
                      👁 {fmtNum(preview.views_count)} · ♥{" "}
                      {fmtNum(preview.likes_count)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail Modal ────────────────────────────────────────────────────────── */}
        {selected && (
          <div className="modal-bg" onClick={() => setSelected(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 17,
                      color: T.text,
                      marginBottom: 8,
                      lineHeight: 1.3,
                    }}
                  >
                    {selected.title || "Processing..."}
                  </div>
                  <div
                    className="pill"
                    style={{
                      background: sc(selected.status).bg,
                      color: sc(selected.status).color,
                    }}
                  >
                    <div
                      className="dot"
                      style={{ background: sc(selected.status).pulse }}
                    />
                    {sc(selected.status).label}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {getVideoUrl(selected.file_path) && (
                    <button
                      className="btn-sm"
                      onClick={() => {
                        setSelected(null);
                        setPreview(selected);
                      }}
                      style={{
                        color: T.accent,
                        borderColor: `${T.accent}40`,
                        background: `${T.accent}0d`,
                      }}
                    >
                      ▶ PREVIEW
                    </button>
                  )}
                  <div
                    onClick={() => setSelected(null)}
                    style={{
                      cursor: "pointer",
                      color: T.textDim,
                      fontSize: 18,
                      padding: "0 4px",
                    }}
                  >
                    ✕
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {[
                  ["ID", selected.id.slice(0, 8) + "..."],
                  ["Created", timeAgo(selected.created_at)],
                  ["Duration", fmtDur(selected.duration_seconds)],
                  ["Resolution", selected.resolution || "—"],
                  ["Views", fmtNum(selected.views_count)],
                  ["Likes", fmtNum(selected.likes_count)],
                  ["Category", selected.category || "—"],
                  ["YouTube", selected.youtube_id || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="detail-row">
                    <span
                      style={{
                        fontSize: 9,
                        color: T.textFaint,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {k}
                    </span>
                    <span style={{ fontSize: 12, color: T.textMid }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: T.textFaint,
                    letterSpacing: "0.1em",
                    marginBottom: 6,
                  }}
                >
                  PROMPT
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: T.textDim,
                    fontStyle: "italic",
                    padding: "10px 14px",
                    background: T.inputBg,
                    borderRadius: 8,
                    lineHeight: 1.7,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  "{selected.prompt}"
                </div>
              </div>

              {selected.description && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    DESCRIPTION
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: T.textDim,
                      padding: "10px 14px",
                      background: T.inputBg,
                      borderRadius: 8,
                      lineHeight: 1.7,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    {selected.description}
                  </div>
                </div>
              )}

              {(selected.labels?.length > 0 || selected.category) && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    LABELS
                  </div>
                  {(selected.labels || []).map((l) => (
                    <span key={l} className="tag">
                      {l}
                    </span>
                  ))}
                  {selected.category && (
                    <span
                      className="tag"
                      style={{ color: T.accent, borderColor: `${T.accent}30` }}
                    >
                      #{selected.category}
                    </span>
                  )}
                </div>
              )}

              {selected.script && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.textFaint,
                      letterSpacing: "0.1em",
                      marginBottom: 6,
                    }}
                  >
                    SCRIPT PREVIEW
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textDim,
                      padding: "12px 14px",
                      background: T.inputBg,
                      borderRadius: 8,
                      lineHeight: 1.8,
                      maxHeight: 120,
                      overflow: "auto",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    {selected.script}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {selected.status === "ready" && (
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      handleUpload(selected.id, e);
                      setSelected(null);
                    }}
                  >
                    🚀 UPLOAD TO YOUTUBE
                  </button>
                )}
                {selected.status === "posted" && selected.youtube_url && (
                  <a
                    href={selected.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 18px",
                      background: `${T.accent}0d`,
                      border: `1px solid ${T.accent}30`,
                      borderRadius: 9,
                      fontSize: 11,
                      color: T.accent,
                      textDecoration: "none",
                      letterSpacing: "0.08em",
                    }}
                  >
                    ▶ VIEW ON YOUTUBE
                  </a>
                )}
                {selected.status === "failed" && (
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      handleRetry(selected.id, e);
                      setSelected(null);
                    }}
                  >
                    ↺ RETRY
                  </button>
                )}
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      id: selected.id,
                      hasYoutube:
                        selected.status === "posted" && !!selected.youtube_id,
                      youtubeId: selected.youtube_id,
                    });
                    setSelected(null);
                  }}
                  style={{
                    padding: "10px 18px",
                    background: `${T.accentRed}0a`,
                    border: `1px solid ${T.accentRed}25`,
                    borderRadius: 9,
                    fontSize: 11,
                    color: T.accentRed,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.08em",
                  }}
                >
                  ✕ DELETE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ───────────────────────────────────────────────────────── */}
        {deleteConfirm && (
          <div className="modal-bg" onClick={() => setDeleteConfirm(null)}>
            <div
              className="modal"
              style={{ maxWidth: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: T.accentRed,
                  marginBottom: 8,
                }}
              >
                Delete Video?
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.textMid,
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                This removes the record from your dashboard.
              </div>
              {deleteConfirm.hasYoutube && (
                <div
                  style={{
                    background: `rgba(255,90,90,0.07)`,
                    border: `1px solid ${T.accentRed}30`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: T.accentRed,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    ⚠ This video is LIVE on YouTube
                  </div>
                  <div
                    style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}
                  >
                    Do you also want to delete it from YouTube? This cannot be
                    undone.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deleteConfirm.hasYoutube && (
                  <button
                    onClick={() => handleDelete(deleteConfirm.id, true)}
                    style={{
                      width: "100%",
                      padding: 11,
                      background: `${T.accentRed}15`,
                      border: `1px solid ${T.accentRed}50`,
                      borderRadius: 9,
                      color: T.accentRed,
                      fontFamily: "inherit",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🗑 DELETE FROM DASHBOARD + YOUTUBE
                  </button>
                )}
                <button
                  onClick={() => handleDelete(deleteConfirm.id, false)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: `${T.accentRed}07`,
                    border: `1px solid ${T.accentRed}25`,
                    borderRadius: 9,
                    color: T.accentRed,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >
                  {deleteConfirm.hasYoutube
                    ? "✕ DELETE FROM DASHBOARD ONLY"
                    : "✕ YES, DELETE"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    color: T.textMid,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Channel Delete Confirm Modal ────────────────────────────────────────── */}
        {channelDeleteConfirm && (
          <div
            className="modal-bg"
            onClick={() => setChannelDeleteConfirm(null)}
          >
            <div
              className="modal"
              style={{ maxWidth: 380 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: T.accentRed,
                  marginBottom: 8,
                }}
              >
                Delete from YouTube?
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.textMid,
                  marginBottom: 6,
                  lineHeight: 1.6,
                }}
              >
                This will permanently delete:
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: 18,
                  padding: "10px 12px",
                  background: T.bgBase,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  lineHeight: 1.5,
                }}
              >
                {channelDeleteConfirm.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.textMid,
                  marginBottom: 20,
                  lineHeight: 1.6,
                  padding: "10px 12px",
                  background: `rgba(220,38,38,0.06)`,
                  borderRadius: 8,
                  border: `1px solid rgba(220,38,38,0.2)`,
                }}
              >
                ⚠ This cannot be undone. The video will be removed from YouTube
                permanently.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={async () => {
                    const { id } = channelDeleteConfirm;
                    setChannelDeleteConfirm(null);
                    try {
                      await api.delete(`/channel/videos/${id}`);
                      showToast("Deleted from YouTube");
                      fetchChannel();
                    } catch (e) {
                      showToast("Delete failed", "error");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: `rgba(220,38,38,0.12)`,
                    border: `1px solid rgba(220,38,38,0.4)`,
                    borderRadius: 9,
                    color: T.accentRed,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  🗑 YES, DELETE PERMANENTLY
                </button>
                <button
                  onClick={() => setChannelDeleteConfirm(null)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    color: T.textMid,
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── YouTube Management Modal ─────────────────────────────────────────────── */}
        {ytModal && (
          <div
            onClick={() => {
              setYtModal(null);
              setYtDetails(null);
              setYtComments([]);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              backdropFilter: "blur(20px)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 720,
                maxHeight: "92vh",
                overflowY: "auto",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  position: "sticky",
                  top: 0,
                  background: T.bgCard,
                  zIndex: 2,
                  borderRadius: "18px 18px 0 0",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#a060ff",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    ⚙ YOUTUBE MANAGEMENT
                  </div>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: T.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ytModal.title || ytModal.prompt}
                  </div>
                  {ytModal.youtube_url && (
                    <a
                      href={ytModal.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        color: T.accent,
                        textDecoration: "none",
                      }}
                    >
                      ↗ {ytModal.youtube_url}
                    </a>
                  )}
                </div>
                <div
                  onClick={() => {
                    setYtModal(null);
                    setYtDetails(null);
                    setYtComments([]);
                  }}
                  style={{
                    cursor: "pointer",
                    color: T.textFaint,
                    fontSize: 20,
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  ✕
                </div>
              </div>

              {ytLoading ? (
                <div
                  style={{
                    padding: 60,
                    textAlign: "center",
                    color: T.textFaint,
                    fontSize: 12,
                  }}
                >
                  ⟳ Loading YouTube data...
                </div>
              ) : (
                <div
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* Stats grid */}
                  {ytDetails && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5,1fr)",
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          label: "VIEWS",
                          val: fmtNum(ytDetails.views),
                          color: T.accentYellow,
                        },
                        {
                          label: "LIKES",
                          val: fmtNum(ytDetails.likes),
                          color: "#e060a0",
                        },
                        {
                          label: "DISLIKES",
                          val: fmtNum(ytDetails.dislikes),
                          color: T.accentRed,
                        },
                        {
                          label: "COMMENTS",
                          val: fmtNum(ytDetails.comments),
                          color: T.accent,
                        },
                        {
                          label: "PRIVACY",
                          val: (ytDetails.privacy || "—").toUpperCase(),
                          color: T.accentGreen,
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          style={{
                            background: T.bgDeep,
                            borderRadius: 10,
                            padding: "12px 10px",
                            textAlign: "center",
                            border: `1px solid ${T.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                              fontSize: 18,
                              color: s.color,
                            }}
                          >
                            {s.val}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: T.textFaint,
                              letterSpacing: "0.08em",
                              marginTop: 3,
                            }}
                          >
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {ytDetails?.description && (
                    <div
                      style={{
                        background: T.bgDeep,
                        borderRadius: 10,
                        padding: 14,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                        }}
                      >
                        DESCRIPTION
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.textMid,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          maxHeight: 100,
                          overflowY: "auto",
                        }}
                      >
                        {ytDetails.description}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {ytDetails?.tags?.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: T.textFaint,
                          letterSpacing: "0.08em",
                          marginBottom: 8,
                        }}
                      >
                        TAGS
                      </div>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {ytDetails.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: 10,
                              color: T.accent,
                              padding: "3px 8px",
                              background: `${T.accent}0d`,
                              borderRadius: 4,
                              border: `1px solid ${T.accent}20`,
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post a comment */}
                  <div
                    style={{
                      background: T.bgDeep,
                      borderRadius: 10,
                      padding: 14,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      POST COMMENT
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          handlePostComment()
                        }
                        placeholder="Write a comment..."
                        maxLength={500}
                        style={{
                          flex: 1,
                          background: T.bg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          padding: "9px 12px",
                          color: T.text,
                          fontSize: 12,
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={postingComment || !newComment.trim()}
                        style={{
                          padding: "9px 16px",
                          background: postingComment
                            ? "transparent"
                            : "#a060ff",
                          border: `1px solid #a060ff50`,
                          borderRadius: 8,
                          color: postingComment ? T.textFaint : "white",
                          fontSize: 11,
                          cursor: postingComment ? "default" : "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {postingComment ? "⟳" : "↑ POST"}
                      </button>
                      <button
                        onClick={handleTriggerAutoComment}
                        title="Trigger one auto-comment cycle now"
                        style={{
                          padding: "9px 14px",
                          background: "transparent",
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          color: T.textFaint,
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🤖 AUTO
                      </button>
                    </div>
                    <div
                      style={{ fontSize: 10, color: T.textFaint, marginTop: 6 }}
                    >
                      Auto-comments post 2×/day automatically on your live
                      videos
                    </div>
                  </div>

                  {/* Comments list */}
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textFaint,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      COMMENTS ({ytComments.length})
                    </div>
                    {ytComments.length === 0 ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: T.textFaint,
                          textAlign: "center",
                          padding: 24,
                        }}
                      >
                        No comments yet
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {ytComments.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              background: T.bgDeep,
                              borderRadius: 10,
                              padding: 12,
                              border: `1px solid ${T.border}`,
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <img
                              src={getCommentAvatar(c.author_image, c.author)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                flexShrink: 0,
                                objectFit: "cover",
                              }}
                              alt=""
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 4,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: T.accent,
                                    fontWeight: 600,
                                  }}
                                >
                                  {c.author}
                                </span>
                                <span
                                  style={{ fontSize: 10, color: T.textFaint }}
                                >
                                  · {timeAgo(c.published_at)}
                                </span>
                                {c.likes > 0 && (
                                  <span
                                    style={{ fontSize: 10, color: "#e060a0" }}
                                  >
                                    ♥ {c.likes}
                                  </span>
                                )}
                                {c.reply_count > 0 && (
                                  <span
                                    style={{ fontSize: 10, color: T.textFaint }}
                                  >
                                    💬 {c.reply_count}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: T.textMid,
                                  lineHeight: 1.6,
                                }}
                                dangerouslySetInnerHTML={{ __html: c.text }}
                              />
                            </div>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              title="Delete comment"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: T.textFaint,
                                cursor: "pointer",
                                fontSize: 14,
                                padding: "2px 6px",
                                borderRadius: 5,
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color = T.accentRed)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = T.textFaint)
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Danger zone */}
                  <div
                    style={{
                      background: "rgba(200,40,60,0.04)",
                      borderRadius: 10,
                      padding: 14,
                      border: "1px solid rgba(200,40,60,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.accentRed,
                        letterSpacing: "0.08em",
                        marginBottom: 10,
                      }}
                    >
                      DANGER ZONE
                    </div>
                    {deleteYtConfirm === ytModal.id ? (
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMid,
                            marginBottom: 12,
                          }}
                        >
                          This permanently deletes the video from YouTube. The
                          record stays in your dashboard as "ready" so you can
                          re-upload.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            onClick={() => handleDeleteFromYt(ytModal.id)}
                            style={{
                              flex: 1,
                              padding: 10,
                              background: "rgba(200,40,60,0.09)",
                              border: "1px solid rgba(200,40,60,0.3)",
                              borderRadius: 8,
                              color: T.accentRed,
                              fontFamily: "inherit",
                              fontSize: 11,
                              letterSpacing: "0.1em",
                              cursor: "pointer",
                            }}
                          >
                            YES, DELETE FROM YOUTUBE
                          </button>
                          <button
                            onClick={() => setDeleteYtConfirm(null)}
                            style={{
                              flex: 1,
                              padding: 10,
                              background: T.bgCard,
                              border: `1px solid ${T.border}`,
                              borderRadius: 8,
                              color: T.textMid,
                              fontFamily: "inherit",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteYtConfirm(ytModal.id)}
                        style={{
                          padding: "9px 18px",
                          background: "rgba(200,40,60,0.07)",
                          border: "1px solid rgba(200,40,60,0.22)",
                          borderRadius: 8,
                          color: T.accentRed,
                          fontFamily: "inherit",
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        🗑 DELETE FROM YOUTUBE
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube Upload Modal */}
        {uploadModal && (
          <UploadModal
            video={uploadModal}
            theme={T}
            onClose={() => setUploadModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
              refresh();
            }}
          />
        )}
        {/* YouTube Settings Modal */}
        {ytSettingsModal && (
          <YouTubeSettingsModal
            video={ytSettingsModal}
            theme={T}
            onClose={() => setYtSettingsModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
              refresh();
            }}
          />
        )}
        {/* Shorts Modal */}
        {shortsModal && (
          <ShortsModal
            video={shortsModal === "new" ? null : shortsModal}
            theme={T}
            onClose={() => setShortsModal(null)}
            onSuccess={(msg) => {
              showToast(msg);
            }}
          />
        )}
      </div>
    </>
  );
}
