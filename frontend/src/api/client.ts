import axios from "axios";
import { TG_TOKEN_KEY, TG_REFRESH_KEY } from "@/utils/telegram";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  // Hard cap so a hung connection (we have a Pixel 8a report where the page
  // never paints because /user/me sits open) cannot freeze the UI forever.
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const tgToken = localStorage.getItem(TG_TOKEN_KEY);
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
            // Mark as retried so a failed retry doesn't re-trigger another refresh
            error.config._retry = true;
            if (token) {
              error.config.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(error.config));
          });
        });
      }

      error.config._retry = true;
      isRefreshing = true;

      const applyTokens = (accessToken: string, refreshToken?: string) => {
        if (accessToken) {
          localStorage.setItem(TG_TOKEN_KEY, accessToken);
          if (refreshToken) localStorage.setItem(TG_REFRESH_KEY, refreshToken);
          error.config.headers.Authorization = `Bearer ${accessToken}`;
        }
        onTokenRefreshed(accessToken);
        isRefreshing = false;
      };

      try {
        // Cookie-based refresh: backend returns new tokens in the response body too.
        // We must save them to localStorage so the Bearer header on retries is fresh.
        const { data } = await api.post("/auth/refresh", {});
        applyTokens(data?.access_token || "", data?.refresh_token);
        return api(error.config);
      } catch {
        const tgRefresh = localStorage.getItem(TG_REFRESH_KEY);
        if (tgRefresh) {
          try {
            const { data } = await api.post("/auth/refresh", { refresh_token: tgRefresh });
            applyTokens(data?.access_token || "", data?.refresh_token);
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
