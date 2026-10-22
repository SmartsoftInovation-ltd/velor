import { apiFetch } from "@/lib/store-api";

/**
 * Shopper accounts on the ECOMPOS API. The store is never sent: the API reads
 * it from `x-tenant-host` (the domain), so an account always belongs to the
 * shop it was created on, and the same email can hold separate accounts at
 * different shops.
 */

export type Shopper = { _id: string; name: string; email?: string; phone?: string };

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
