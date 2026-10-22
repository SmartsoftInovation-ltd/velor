import { apiFetch } from "@/lib/store-api";

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
