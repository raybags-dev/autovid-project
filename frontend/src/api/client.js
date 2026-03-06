import axios from "axios";

// Always go through Vite proxy (/api → http://localhost:8000)
// This avoids all CORS issues since the request appears same-origin to the browser.
// In production, Nginx serves the same proxy role.

// const api = axios.create({
//   baseURL: "/api",
//   timeout: 60000,
// });

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
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
  profile = "funny",
) => {
  const { data } = await api.post("/videos/generate", {
    prompt,
    auto_upload: autoUpload,
    profile,
  });
  return data;
};
export const retryVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/retry`);
  return data;
};
export const uploadVideo = async (id) => {
  const { data } = await api.post(`/videos/${id}/upload`);
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
