/**
 * The backend URLs, read in one place.
 *
 * A hardcoded `http://localhost:3000` fallback is right in development and
 * dangerous in a build: a production bundle that lost its env var would point
 * every request at the viewer's own machine and fail in a way that looks like a
 * network problem rather than a missing variable. So the fallback applies only
 * to a dev server, and a build without the variable fails loudly instead.
 */

const required = (name: string, value: string | undefined, devFallback: string): string => {
  if (value) return value;
  if (import.meta.env.DEV) return devFallback;
  throw new Error(`${name} is not set. Set it in the environment this bundle is built with.`);
};

// http://<host>/api/v1 — every REST call goes through this
export const apiUrl = (): string =>
  required("VITE_API_URL", import.meta.env.VITE_API_URL, "http://localhost:3000/api/v1");

// http://<host> — socket.io connects to the origin, not the API path
export const socketUrl = (): string =>
  required("VITE_SOCKET_URL", import.meta.env.VITE_SOCKET_URL, "http://localhost:3000");
