import { ApiError, apiFetch } from "@/lib/store-api";

/**
 * Shopper accounts on the ECOMPOS API. The store is never sent: the API reads
 * it from `x-tenant-host` (the domain), so an account always belongs to the
 * shop it was created on, and the same email can hold separate accounts at
 * different shops.
 */

export type Shopper = { _id: string; name: string; email?: string; phone?: string; image?: string | null };

// The session cookies live on the shop's own domain, so each store keeps its own
export const SESSION_COOKIE = "shop_session";
export const REFRESH_COOKIE = "shop_refresh";
// Set when the shopper ticked "keep me signed in", so a renewed session keeps that choice
export const KEEP_COOKIE = "shop_keep";

export type ShopperSession = { user: Shopper; accessToken: string; refreshToken: string };

export type SignUpInput = { name: string; password: string } & ({ email: string } | { phone: string });

// POST /shop/auth/register
export const registerShopper = (tenantHost: string, input: SignUpInput) =>
  apiFetch<ShopperSession>(tenantHost, "/shop/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

export type SignInInput = { password: string } & ({ email: string } | { phone: string });

// POST /shop/auth/login — a wrong email and a wrong password answer alike
export const loginShopper = (tenantHost: string, input: SignInInput) =>
  apiFetch<ShopperSession>(tenantHost, "/shop/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

// GET /shop/me — the signed-in shopper, in the store this domain belongs to
export const getMe = async (tenantHost: string, accessToken: string) =>
  (
    await apiFetch<{ user: Shopper }>(tenantHost, "/shop/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    })
  ).user;

export type SessionTokens = Pick<ShopperSession, "accessToken" | "refreshToken">;

// POST /shop/auth/refresh — a fresh pair for a refresh token the store still honours
export const refreshShopper = (tenantHost: string, refreshToken: string) =>
  apiFetch<SessionTokens>(tenantHost, "/shop/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

const refused = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.status === 403);

/**
 * The signed-in shopper for a page render, renewing an expired access token
 * with the refresh token when there is one. Null when the store no longer
 * accepts the session. A page cannot store the renewed token; the next action does.
 */
export async function currentShopper(tenantHost: string, accessToken: string, refreshToken?: string): Promise<Shopper | null> {
  try {
    return await getMe(tenantHost, accessToken);
  } catch (error) {
    if (!refused(error)) throw error;
  }
  if (!refreshToken) return null;
  try {
    return await getMe(tenantHost, (await refreshShopper(tenantHost, refreshToken)).accessToken);
  } catch (error) {
    if (refused(error)) return null;
    throw error;
  }
}

export const PASSWORD_MIN = 8;

/** What a password still needs; empty when it is good enough */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN) problems.push(`at least ${PASSWORD_MIN} characters`);
  if (!/\d/.test(password)) problems.push("a number");
  if (!/[a-z]/i.test(password)) problems.push("a letter");
  return problems;
}

// Bangladesh mobile: 01XXXXXXXXX, optionally +880 / 880 in front
export const normalizePhone = (value: string) => value.replace(/[\s-]/g, "").replace(/^(\+?880)/, "0");
export const isPhone = (value: string) => /^01[3-9]\d{8}$/.test(normalizePhone(value));
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * Where to go after signing in: a path on this same site, or "/". Anything
 * that could leave the site (`//evil.com`, `/\evil.com`, `https://…`) is refused.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 200) return "/";
  if (!/^\/(?![/\\])/.test(value) || /[\u0000-\u001f\\]/.test(value)) return "/";
  return value;
}

/** Sign-in for a shopper whose session the API refused, coming back to `path` afterwards */
export const expiredSignInHref = (path: string) => `/sign-in?expired=1&next=${encodeURIComponent(path)}`;
