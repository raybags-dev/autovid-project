import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, logout as apiLogout, getMe } from "../config/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("async_token");
    if (token) {
      getMe()
        .then((me) => setUser(me))
        .catch((err) => {
          // Only clear the token on a real auth failure (401); keep users
          // logged in if the backend returns a 500 or network blips occur.
          if (err?.response?.status === 401 || err?.status === 401) {
            localStorage.removeItem("async_token");
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    // Fetch full profile (includes trial info + channel URLs)
    const me = await getMe();
    setUser(me);
    return { ...data, user: me };
  };

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
