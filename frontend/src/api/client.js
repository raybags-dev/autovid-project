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
  musicDelay = 0.0,
  useStickfigures = false,
  useStockFootage = true,
  useCaptions = true,
) => {
  const { data } = await api.post("/videos/generate", {
    prompt,
    auto_upload: autoUpload,
    profile,
    visual_mood: visualMood,
    music_style: musicStyle,
    music_volume: musicVolume,
    music_delay: musicDelay,
    use_stickfigures: useStickfigures,
    use_stock_footage: useStockFootage,
    use_captions: useCaptions,
  });
  return data;
};
export const retryVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/retry`);
  return data;
};
export const retryUploadVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/retry-upload`, {});
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

// ── Stick-Figure Video Editor ──────────────────────────────────────────────
export const listStickFigures = async (enabledOnly = true) => {
  const { data } = await api.get("/stickfigures", { params: { enabled_only: enabledOnly } });
  return data;
};

export const listStickFiguresPaged = async (skip = 0, limit = 20, enabledOnly = false) => {
  const { data } = await api.get("/stickfigures", {
    params: { enabled_only: enabledOnly, skip, limit },
  });
  return data; // { clips, total, skip, limit }
};

export const seedStickFigures = async () => {
  const { data } = await api.post("/stickfigures/seed");
  return data;
};

export const backfillStickFigureUrls = async () => {
  const { data } = await api.post("/stickfigures/backfill-urls");
  return data;
};

export const uploadStickFigure = async (file, label = "", keywords = "") => {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  form.append("keywords", keywords);
  const { data } = await api.post("/stickfigures/upload", form, {
    timeout: 120000,
  });
  return data;
};

export const updateStickFigure = async (id, fields) => {
  const { data } = await api.patch(`/stickfigures/${id}`, fields);
  return data;
};

export const deleteStickFigure = async (id, deleteFile = false) => {
  const { data } = await api.delete(`/stickfigures/${id}`, {
    params: { delete_file: deleteFile },
  });
  return data;
};

export const generateStickfigures = async (promptsText) => {
  const { data } = await api.post("/stickfigures/generate", { prompts_text: promptsText }, { timeout: 30000 });
  return data; // { job_id, pair_count }
};

export const getStickfigureGenLogs = async (jobId, since = 0) => {
  const { data } = await api.get(`/stickfigures/generate/${jobId}/logs`, { params: { since } });
  return data; // { lines, total, done }
};

export const startComposite = async (videoId, overlays, options = {}) => {
  const { data } = await api.post(`/videos/${videoId}/composite`, {
    overlays,
    mix_overlay_audio: options.mixAudio ?? true,
    chroma_color: options.chromaColor ?? "0x00FF00",
    chroma_similarity: options.chromaSimilarity ?? 0.35,
    chroma_blend: options.chromaBlend ?? 0.05,
    replace_original: options.replaceOriginal ?? false,
  });
  return data;
};

export const getCompositeStatus = async (videoId) => {
  const { data } = await api.get(`/videos/${videoId}/composite-status`);
  return data;
};

export const finalizeComposite = async (videoId) => {
  const { data } = await api.post(`/videos/${videoId}/composite-finalize`);
  return data;
};

export const startAutoComposite = async (videoId, options = {}) => {
  const { data } = await api.post(`/videos/${videoId}/auto-composite`, {
    min_gap: options.minGap ?? 8,
    max_overlays: options.maxOverlays ?? 8,
    mix_overlay_audio: options.mixAudio ?? true,
    replace_original: options.replaceOriginal ?? false,
  });
  return data;
};

export const previewAutoComposite = async (videoId, options = {}) => {
  const { data } = await api.post(`/videos/${videoId}/auto-composite/preview`, {
    min_gap: options.minGap ?? 8,
    max_overlays: options.maxOverlays ?? 8,
    mix_overlay_audio: options.mixAudio ?? true,
    replace_original: false,
  });
  return data;
};

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

export const generateShortFromScratch = async (prompt, ambience = "rain", music_style = "Laidback_Fevorite", music_volume = 0.04, music_delay = 0.0, custom_script = "", use_stickfigures = false, use_stock_footage = true, use_captions = true) => {
  const { data } = await api.post("/shorts/generate", { prompt, ambience, music_style, music_volume, music_delay, custom_script, use_stickfigures, use_stock_footage, use_captions });
  return data;
};

export const extractVideoMp3 = async (videoId) => {
  const { data } = await api.post(`/videos/${videoId}/extract-mp3`);
  return data;
};

export const addCaptionsToVideo = async (videoId) => {
  const { data } = await api.post(`/videos/${videoId}/add-captions`);
  return data;
};

export const getPromptsStatus = async () => {
  const { data } = await api.get("/prompts/status");
  return data;
};
export const addPrompts = async (prompts, pipeline = "long") => {
  const { data } = await api.post("/prompts/add", { prompts, pipeline });
  return data;
};
export const resetPrompts = async (pipeline) => {
  const { data } = await api.post(`/prompts/reset/${pipeline}`);
  return data;
};
export const generatePromptsModeA = async (pipeline) => {
  const { data } = await api.post(`/prompts/generate/${pipeline}`);
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

export const fixStuckVideos = async () => {
  const { data } = await api.post("/videos/fix-stuck");
  return data;
};

export const forceResetVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/force-reset`);
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

// ── Subscriptions / Expenditure Tracker ─────────────────────────────────────
export const getSubscriptions  = async ()       => (await api.get("/subscriptions")).data;
export const saveSubscriptions = async (list)   => (await api.post("/subscriptions", list)).data;

// ── Podbean ───────────────────────────────────────────────────────────────────
export const getPodbeanStatus    = async () => { const { data } = await api.get("/podbean/status");    return data; };
export const getPodbeanSettings  = async () => { const { data } = await api.get("/podbean/settings");  return data; };
export const savePodbeanSettings = async (s) => { const { data } = await api.post("/podbean/settings", s); return data; };
export const uploadToPodbean     = async (id) => { const { data } = await api.post(`/podcast-episode/${id}/upload-podbean`); return data; };

// ── Buzzsprout ────────────────────────────────────────────────────────────────
export const getBuzzsproutStatus   = async () => { const { data } = await api.get("/buzzsprout/status");   return data; };
export const getBuzzsproutSettings = async () => { const { data } = await api.get("/buzzsprout/settings"); return data; };
export const saveBuzzsproutSettings = async (s) => { const { data } = await api.post("/buzzsprout/settings", s); return data; };
export const uploadToBuzzsprout = async (videoId) => { const { data } = await api.post(`/podcast-episode/${videoId}/upload-buzzsprout`); return data; };

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

// ── Pipeline Metrics ──────────────────────────────────────────────────────────
export const getPipelineMetrics = async () => { const { data } = await api.get("/pipeline/metrics"); return data; };

// ── Archive ───────────────────────────────────────────────────────────────────
export const archiveVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/archive`);
  return data;
};
export const unarchiveVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/unarchive`);
  return data;
};
export const listArchivedVideos = async () => {
  const { data } = await api.get("/videos/archived");
  return data;
};

// ── Exclusive Subscription System ────────────────────────────────────────────
export const setVideoExclusive = async (id, is_exclusive) => {
  const { data } = await api.post(`/videos/${id}/set-exclusive`, { is_exclusive });
  return data;
};
export const listSubscriptionRequests = async () => {
  const { data } = await api.get("/admin/subscription-requests");
  return data;
};
export const approveSubscription = async (id) => {
  const { data } = await api.post(`/admin/subscription-requests/${id}/approve`);
  return data;
};
export const rejectSubscription = async (id) => {
  const { data } = await api.post(`/admin/subscription-requests/${id}/reject`);
  return data;
};
export const generateThumbnail = async (id) => {
  const { data } = await api.post(`/videos/${id}/generate-thumbnail`);
  return data;
};

export const deleteSubscriptionUser = async (id) => {
  const { data } = await api.delete(`/admin/subscription-requests/${id}`);
  return data;
};


export const uploadExclusivePreviewVideo = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/admin/exclusive-preview-video/upload", form, { timeout: 600000 });
  return data;
};

// ── Custom Content ────────────────────────────────────────────────────────────
export const listCustomContent = async (includeArchived = false) => {
  const { data } = await api.get("/custom-content", { params: { include_archived: includeArchived } });
  return data;
};

/** Step 1: ask backend for a signed Supabase upload URL — no file bytes sent here */
export const requestCCUpload = async ({ title, description, tags, category, privacy }) => {
  const { data } = await api.post("/custom-content/request-upload", {
    title, description: description || "", tags: tags || "",
    category: category || "Entertainment", privacy: privacy || "public",
  });
  return data; // { item, item_id, signed_url, public_url, filename }
};

/** Step 2: PUT file bytes directly to Supabase signed URL (bypasses nginx/Cloudflare).
 *  onProgress(percent) is called during upload. Returns when done. */
export const uploadFileToSignedUrl = (signedUrl, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText?.slice(0, 200)}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 0; // no timeout for large files
    xhr.send(file);
  });

/** Step 3: notify backend the file is in storage — triggers ffprobe in background */
export const finalizeCCUpload = async (itemId) => {
  const { data } = await api.post(`/custom-content/${itemId}/finalize`);
  return data;
};

export const deleteCustomContent = async (id) => {
  const { data } = await api.delete(`/custom-content/${id}`);
  return data;
};

export const archiveCustomContent = async (id) => {
  const { data } = await api.post(`/custom-content/${id}/archive`);
  return data;
};

export const unarchiveCustomContent = async (id) => {
  const { data } = await api.post(`/custom-content/${id}/unarchive`);
  return data;
};

export const uploadCCToYouTube = async (id, { title, description, tags, privacy, category }) => {
  const { data } = await api.post(`/custom-content/${id}/upload-youtube`, {
    title, description, tags, privacy, category,
  });
  return data;
};

export const generateCCMp3 = async (id) => {
  const { data } = await api.post(`/custom-content/${id}/generate-mp3`);
  return data;
};

export const getCCLogs = async (id, since = 0) => {
  const { data } = await api.get(`/custom-content/${id}/logs`, { params: { since } });
  return data;
};

export const getCustomContentItem = async (id) => {
  const { data } = await api.get(`/custom-content/${id}`);
  return data;
};

// ── Danger Zone ───────────────────────────────────────────────────────────────
export const dangerVerify = async (key) => {
  const { data } = await api.post("/admin/danger/verify", { key });
  return data;
};
export const dangerClearVideos = async (dangerToken) => {
  const { data } = await api.delete("/admin/danger/clear-videos", {
    headers: { Authorization: `Bearer ${dangerToken}` },
  });
  return data;
};
export const dangerClearStorage = async (dangerToken) => {
  const { data } = await api.delete("/admin/danger/clear-storage", {
    headers: { Authorization: `Bearer ${dangerToken}` },
  });
  return data;
};
