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

export const getVideos = async () => {
  const { data } = await api.get("/subscribe/videos");
  return Array.isArray(data) ? data : (data.videos ?? []);
};

export default api;
