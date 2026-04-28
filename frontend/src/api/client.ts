import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const tgToken = localStorage.getItem("tg_access_token");
  if (tgToken) {
    config.headers.Authorization = `Bearer ${tgToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/");
    const path = window.location.pathname;
    const onAuthPage = path.startsWith("/auth") || path === "/login" || path === "/register";

    const publicPrefixes = ["/auth", "/login", "/register"];
    const publicExact = ["/"];
    const onPublicPage = publicExact.includes(path) || publicPrefixes.some((p) => path.startsWith(p));

    if (error.response?.status === 401 && !error.config._retry && !isAuthEndpoint) {
      error.config._retry = true;
      try {
        await api.post("/auth/refresh", {});
        return api(error.config);
      } catch {
        const tgRefresh = localStorage.getItem("tg_refresh_token");
        if (tgRefresh) {
          try {
            const { data } = await api.post("/auth/refresh", { refresh_token: tgRefresh });
            localStorage.setItem("tg_access_token", data.access_token);
            if (data.refresh_token) localStorage.setItem("tg_refresh_token", data.refresh_token);
            error.config.headers.Authorization = `Bearer ${data.access_token}`;
            return api(error.config);
          } catch {}
        }
        if (!onAuthPage && !onPublicPage) {
          window.location.href = "/auth";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
