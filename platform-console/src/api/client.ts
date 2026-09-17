import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

// Platform operator session. The access token lives in sessionStorage (closing the
// tab ends it); the refresh token is an httpOnly cookie scoped to /platform/auth.
const TOKEN_KEY = "platformAccessToken";

let token: string | null = sessionStorage.getItem(TOKEN_KEY);
let onSessionExpired: () => void = () => {};

export const getToken = () => token;

export const setToken = (value: string | null) => {
  token = value;
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
};

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1/platform",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };
const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshing: Promise<string> | null = null;
const refresh = () => {
  refreshing ??= api
    .post("/auth/refresh")
    .then((res) => {
      const next = res.data?.data?.accessToken as string;
      setToken(next);
      return next;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as Retryable | undefined;
    if (error.response?.status !== 401 || !original || original._retry || NO_REFRESH.includes(original.url || "")) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const next = await refresh();
      original.headers.Authorization = `Bearer ${next}`;
      return api(original);
    } catch (refreshError) {
      setToken(null);
      onSessionExpired();
      return Promise.reject(refreshError);
    }
  },
);

export const errorMessage = (error: unknown, fallback = "Something went wrong") =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;
