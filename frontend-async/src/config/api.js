import axios from "axios";

const STORAGE_KEY = "async_token";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const register = async (email, password) => {
  const { data } = await api.post("/subscribe/signup", { email, password });
  return data;
};

export const login = async (email, password) => {
  const { data } = await api.post("/subscribe/login", { email, password });
  localStorage.setItem(STORAGE_KEY, data.token);
  return data;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getMe = async () => {
  const { data } = await api.get("/subscribe/verify");
  return data;
};

export const getSampleVideos = async () => {
  const { data } = await api.get("/subscribe/videos");
  return Array.isArray(data) ? data : (data.videos ?? []);
};

export const getMyVideos = async () => {
  const { data } = await api.get("/subscribe/my-videos");
  return Array.isArray(data) ? data : (data.videos ?? []);
};

export const createVideo = async (topic, style = "educational") => {
  const { data } = await api.post("/subscribe/create-video", { topic, style });
  return data;
};

export const getVideoStatus = async (videoId) => {
  const { data } = await api.get(`/subscribe/video/${videoId}/status`);
  return data;
};

export const getVideoStreamUrl = (videoId) => `/api/subscribe/video/${videoId}/stream`;

export const getCreateYourWebsite = async () => {
  const { data } = await api.get("/subscribe/create-your-website");
  return data;
};

export const updateSubscriberSettings = async (settings) => {
  const { data } = await api.patch("/subscribe/settings", settings);
  return data;
};

export const retryVideo = async (videoId) => {
  const { data } = await api.post(`/subscribe/retry-video/${videoId}`);
  return data;
};

export const requestAccountDeletion = async () => {
  const { data } = await api.delete("/subscribe/account");
  return data;
};

export const cancelAccountDeletion = async () => {
  const { data } = await api.post("/subscribe/account/cancel-deletion");
  return data;
};

export const getYouTubeAuthUrl = async () => {
  const { data } = await api.get("/subscribe/youtube/auth-url");
  return data.auth_url;
};

export const disconnectYouTube = async () => {
  const { data } = await api.post("/subscribe/youtube/disconnect");
  return data;
};

export default api;
