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

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

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
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (token) {
              error.config.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(error.config));
          });
        });
      }

      error.config._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh", {});
        onTokenRefreshed("");
        isRefreshing = false;
        return api(error.config);
      } catch {
        const tgRefresh = localStorage.getItem("tg_refresh_token");
        if (tgRefresh) {
          try {
            const { data } = await api.post("/auth/refresh", { refresh_token: tgRefresh });
            const newToken = data.access_token || "";
            localStorage.setItem("tg_access_token", newToken);
            if (data.refresh_token) localStorage.setItem("tg_refresh_token", data.refresh_token);
            error.config.headers.Authorization = `Bearer ${newToken}`;
            onTokenRefreshed(newToken);
            isRefreshing = false;
            return api(error.config);
          } catch {
            // fall through
          }
        }
        isRefreshing = false;
        onRefreshFailed();
        if (!onAuthPage && !onPublicPage) {
          window.location.href = "/auth";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
