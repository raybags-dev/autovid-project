import axios from "axios";

// Always go through Vite proxy (/api → http://localhost:8000)
// This avoids all CORS issues since the request appears same-origin to the browser.
// In production, Nginx serves the same proxy role.
const api = axios.create({
  baseURL: "/api",
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("autovid_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("autovid_token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  },
);

export const login = async (email, password) => {
  const { data } = await api.post("/auth/login", { email, password });
  localStorage.setItem("autovid_token", data.token);
  return data;
};

export const logout = () => localStorage.removeItem("autovid_token");
export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const listVideos = async (status = null) => {
  const { data } = await api.get("/videos", {
    params: status ? { status } : {},
  });
  return data;
};
export const getVideo = async (id) => {
  const { data } = await api.get(`/videos/${id}`);
  return data;
};
export const generateVideo = async (
  prompt,
  autoUpload = false,
  profile = "educational",
  visualMood = "inspirational",
  musicStyle = "ambient",
  musicVolume = 0.06,
) => {
  const { data } = await api.post("/videos/generate", {
    prompt,
    auto_upload: autoUpload,
    profile,
    visual_mood: visualMood,
    music_style: musicStyle,
    music_volume: musicVolume,
  });
  return data;
};
export const retryVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/retry`);
  return data;
};
export const retryUploadVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/retry-upload`);
  return data;
};
export const uploadVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/upload`, {});
  return data;
};
export const deleteVideo = async (id) => {
  const { data } = await api.delete(`/videos/${id}`);
  return data;
};
export const getStats = async () => {
  const { data } = await api.get("/stats");
  return data;
};
export const getQuota = async () => {
  const { data } = await api.get("/quota");
  return data;
};
export const syncYoutube = async () => {
  const { data } = await api.post("/videos/sync-youtube");
  return data;
};
export const deleteFromYoutube = async (id) => {
  const { data } = await api.delete(`/videos/${id}/youtube`);
  return data;
};
export const getYouTubeDetails = async (id) => {
  const { data } = await api.get(`/videos/${id}/youtube-details`);
  return data;
};
export const getComments = async (id) => {
  const { data } = await api.get(`/videos/${id}/comments`);
  return data;
};
export const postComment = async (id, text) => {
  const { data } = await api.post(`/videos/${id}/comments`, { text });
  return data;
};
export const deleteComment = async (videoId, commentId) => {
  const { data } = await api.delete(`/videos/${videoId}/comments/${commentId}`);
  return data;
};
export const replyComment = async (videoId, threadId, text) => {
  const { data } = await api.post(
    `/videos/${videoId}/comments/${threadId}/reply`,
    { text },
  );
  return data;
};
export const moderateComment = async (
  videoId,
  commentId,
  status,
  ban_author = false,
) => {
  const { data } = await api.post(
    `/videos/${videoId}/comments/${commentId}/moderate`,
    { status, ban_author },
  );
  return data;
};
export const triggerAutoComment = async () => {
  const { data } = await api.post("/auto-comment/trigger");
  return data;
};

export default api;

// ── YouTube upload with metadata ───────────────────────────────────────────
export const uploadVideoWithMeta = async (
  id,
  { title, description, tags, privacy, category },
) => {
  const { data } = await api.post(`/videos/${id}/upload`, {
    title,
    description,
    tags,
    privacy,
    category,
  });
  return data;
};

// ── YouTube settings update (privacy, title, etc.) ────────────────────────
export const updateYouTubeSettings = async (
  id,
  { title, description, tags, privacy, category },
) => {
  const { data } = await api.patch(`/videos/${id}/youtube-settings`, {
    title,
    description,
    tags,
    privacy,
    category,
  });
  return data;
};

// ── Shorts ────────────────────────────────────────────────────────────────
export const createShortFromVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/create-short`);
  return data;
};

export const generateShortFromScratch = async (prompt, ambience = "stars", music_style = "Birds_Atmosphere_Piano", music_volume = 0.01) => {
  const { data } = await api.post("/shorts/generate", { prompt, ambience, music_style, music_volume });
  return data;
};

// ── Auto-reply ─────────────────────────────────────────────────────────────
export const triggerAutoReply = async () => {
  const { data } = await api.post("/auto-reply/trigger");
  return data;
};

// ── Compilations ─────────────────────────────────────────────────────────────
export const listCompilations = async () => {
  const { data } = await api.get("/compilations");
  return data;
};
export const createCompilation = async (payload) => {
  const { data } = await api.post("/compilations/create", payload);
  return data;
};

export const listShorts = async (limit = 25, offset = 0) => {
  const { data } = await api.get("/shorts", { params: { limit, offset } });
  return data;
};

export const clearCache = async () => {
  const { data } = await api.post("/cache/clear");
  return data;
};

// ── Auto-Short Settings ─────────────────────────────────────────────────────
export const getAutoShortSettings = async () => {
  const { data } = await api.get("/auto-short/settings");
  return data;
};
export const saveAutoShortSettings = async (settings) => {
  const { data } = await api.post("/auto-short/settings", settings);
  return data;
};
export const triggerAutoShort = async () => {
  const { data } = await api.post("/auto-short/trigger");
  return data;
};

// ── Podcast Episode Pipeline ─────────────────────────────────────────────────
export const getPodcastSettings = async () => {
  const { data } = await api.get("/podcast-episode/settings");
  return data;
};
export const savePodcastSettings = async (settings) => {
  const { data } = await api.post("/podcast-episode/settings", settings);
  return data;
};
export const triggerAutoPodcast = async () => {
  const { data } = await api.post("/podcast-episode/trigger");
  return data;
};
export const generatePodcastEpisode = async (payload) => {
  const { data } = await api.post("/podcast-episode/generate", payload);
  return data;
};

// ── TikTok ────────────────────────────────────────────────────────────────────
export const getTikTokStatus = async () => {
  const { data } = await api.get("/tiktok/status");
  return data;
};
export const disconnectTikTok = async () => {
  const { data } = await api.post("/tiktok/disconnect");
  return data;
};
export const uploadToTikTok = async (id, privacy = "SELF_ONLY") => {
  const { data } = await api.post(`/videos/${id}/upload-tiktok`, { privacy });
  return data;
};

// ── Spotify ───────────────────────────────────────────────────────────────────
export const getSpotifyStatus    = async () => { const { data } = await api.get("/spotify/status");     return data; };
export const getSpotifyConnectUrl = async () => { const { data } = await api.get("/spotify/connect");    return data; };
export const disconnectSpotify   = async () => { const { data } = await api.post("/spotify/disconnect"); return data; };
export const getSpotifyTopTracks = async (limit = 10, range = "long_term") => { const { data } = await api.get("/spotify/top-tracks", { params: { limit, time_range: range } }); return data; };
export const getSpotifyTopArtists = async (limit = 10, range = "long_term") => { const { data } = await api.get("/spotify/top-artists", { params: { limit, time_range: range } }); return data; };

export const updateVideoMeta = async (id, fields) => {
  const { data } = await api.patch(`/videos/${id}`, fields);
  return data;
};

export const renameCompilation = async (id, title) => {
  const { data } = await api.patch(`/compilations/${id}/rename`, { title });
  return data;
};

// ── Blog (public) ────────────────────────────────────────────────────────────
export const getBlogComments = async (page = 1, fp = "") =>
  (await axios.get(`/api/blog/comments?page=${page}&limit=20&fp=${fp}`)).data;

export const submitBlogComment = async (data) =>
  (await axios.post("/api/blog/comments", data)).data;

export const toggleBlogLike = async (commentId, fingerprint) =>
  (await axios.post(`/api/blog/comments/${commentId}/like`, { fingerprint })).data;

// ── Blog (admin) ─────────────────────────────────────────────────────────────
export const adminGetBlogComments = async (status = "pending", page = 1) =>
  (await api.get(`/admin/blog/comments?status=${status}&page=${page}&limit=50`)).data;

export const adminApproveComment = async (id) =>
  (await api.post(`/admin/blog/comments/${id}/approve`)).data;

export const adminRejectComment = async (id, reason) =>
  (await api.post(`/admin/blog/comments/${id}/reject`, { reason })).data;

export const adminDeleteComment = async (id) =>
  (await api.delete(`/admin/blog/comments/${id}`)).data;

export const adminReplyComment = async (id, content) =>
  (await api.post(`/admin/blog/comments/${id}/reply`, { content })).data;
