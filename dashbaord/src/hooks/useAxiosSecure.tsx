import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { getWorkspace } from "../lib/session";
import { apiUrl } from "../lib/env";

const REFRESH_URL = "/auth/refresh-token";
const ACCESS_TOKEN_KEY = "accessToken";

/**
 * Requests carrying `_retry` have already been replayed once after a refresh.
 * If such a request 401s again the session is genuinely dead, so we log out
 * rather than loop.
 */
type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const axiosSecure = axios.create({
  baseURL: apiUrl(),
  // The refresh token lives in an httpOnly cookie set by the backend at login,
  // so every request — the refresh call included — must send credentials.
  withCredentials: true,
});

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

export const setAccessToken = (token: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  axiosSecure.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const clearAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  delete axiosSecure.defaults.headers.common["Authorization"];
};

/**
 * Hard logout. Reached only when the refresh token itself is rejected — the
 * cookie expired, was revoked at logout, or the account was blocked.
 *
 * `window.location.replace` rather than a router navigate: this module lives
 * outside the React tree and has no navigate function, and a full reload is
 * desirable here anyway — it drops every cached query and all in-memory state
 * belonging to the dead session. `replace` keeps the expired page out of
 * history so Back cannot return to it.
 */
let loggingOut = false;
const forceLogout = () => {
  clearAccessToken();
  // Guard against a burst of parallel 401s each firing their own redirect.
  if (loggingOut) return;
  loggingOut = true;

  const { pathname, search } = window.location;
  if (pathname === "/signin") return;

  // Preserve where the user was so signin can send them back after re-auth.
  const from = encodeURIComponent(`${pathname}${search}`);
  window.location.replace(`/signin?sessionExpired=1&from=${from}`);
};

// The store this dashboard is signed into. The API uses it to resolve the
// tenant for requests without a token and rejects a token from another store.
const workspaceHeaders = (): Record<string, string> => {
  const workspace = getWorkspace();
  return workspace ? { "x-tenant": workspace } : {};
};

axiosSecure.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // A caller that named its own store (sign-in, workspace switch) wins: the
  // remembered workspace is still the previous store's at that moment.
  if (!config.headers.get("x-tenant")) {
    Object.entries(workspaceHeaders()).forEach(([name, value]) => config.headers.set(name, value));
  }
  return config;
});

// A suspended store signs everyone out to a dedicated page; refreshing cannot help.
const isTenantSuspended = (error: AxiosError) =>
  (error.response?.data as { code?: string } | undefined)?.code === "TENANT_SUSPENDED";

const showStoreSuspended = () => {
  clearAccessToken();
  if (window.location.pathname !== "/store-suspended") {
    window.location.replace("/store-suspended");
  }
};

/**
 * Single-flight refresh.
 *
 * A screen that fires several requests at once (a list plus its filter
 * lookups) would otherwise get several simultaneous 401s, each POSTing to
 * /auth/refresh-token. Concurrent refreshes waste round-trips and race each
 * other into localStorage. Instead the first 401 owns the refresh and parks
 * its promise here; every other 401 awaits that same promise and then replays
 * with whatever token it produced.
 */
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (refreshPromise) return refreshPromise;

  const pending = (async () => {
    // A bare axios call, NOT axiosSecure: the request interceptor would attach
    // the already-expired access token, and a 401 from this call must never
    // re-enter the response interceptor and recurse.
    const { data } = await axios.post(
      `${apiUrl()}${REFRESH_URL}`,
      {},
      { withCredentials: true, headers: workspaceHeaders() },
    );

    const token: string | undefined = data?.data?.accessToken;
    if (!token) throw new Error("No access token in refresh response");

    setAccessToken(token);
    return token;
  })();

  refreshPromise = pending;

  // Clear the slot once settled so a later expiry can refresh again. The no-op
  // catch keeps an awaited rejection from also surfacing as unhandled.
  pending
    .catch(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });

  return pending;
};

axiosSecure.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const status = error.response?.status;

    if (isTenantSuspended(error)) {
      showStoreSuspended();
      return Promise.reject(error);
    }

    // Not an auth problem, or nothing to replay — surface untouched. A network
    // failure has no `error.response` at all; refreshing would not help and
    // would only mask the real cause.
    if (status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // The refresh endpoint itself 401ing means the refresh cookie is dead.
    if (originalRequest.url?.includes(REFRESH_URL)) {
      forceLogout();
      return Promise.reject(error);
    }

    // Second 401 on a request already replayed: refreshing did not help.
    if (originalRequest._retry) {
      forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return axiosSecure(originalRequest as AxiosRequestConfig);
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && isTenantSuspended(refreshError)) {
        showStoreSuspended();
        return Promise.reject(refreshError);
      }
      // Refresh token expired/revoked, or the account was blocked.
      forceLogout();
      return Promise.reject(refreshError);
    }
  },
);

export default axiosSecure;
