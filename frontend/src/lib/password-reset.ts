import { apiFetch } from "@/lib/store-api";

/**
 * Forgotten password on the storefront: a 6-digit code goes by SMS to the
 * account's mobile number, is checked, then sets the new password. The store
 * comes from the domain, like every shopper call.
 */

const post = <T>(tenantHost: string, path: string, body: unknown) =>
  apiFetch<T>(tenantHost, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// POST /shop/auth/forgot-password — answers alike whether or not the number has an account
export const requestResetCode = (tenantHost: string, phone: string) =>
  post<{ expiresIn: number }>(tenantHost, "/shop/auth/forgot-password", { phone });

// POST /shop/auth/verify-reset-code — a wrong code counts against it
export const verifyResetCode = (tenantHost: string, phone: string, otp: string) =>
  post<null>(tenantHost, "/shop/auth/verify-reset-code", { phone, otp });

// POST /shop/auth/reset-password — uses the code up and ends every session
export const resetPassword = (tenantHost: string, phone: string, otp: string, newPassword: string) =>
  post<null>(tenantHost, "/shop/auth/reset-password", { phone, otp, newPassword });

export const RESET_COOKIE = "shop_reset";

export const OTP_LENGTH = 6;
export const isOtp = (value: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);

/** 01712345678 shown as 017•••••678 */
export const maskPhone = (phone: string) => `${phone.slice(0, 3)}${"•".repeat(Math.max(phone.length - 6, 0))}${phone.slice(-3)}`;

/**
 * What the reset flow carries from one page to the next, kept in a short-lived
 * httpOnly cookie rather than the URL, so the number and code never land in
 * history or logs. `otp` is set once the code has been checked.
 */
export type ResetProgress = { phone: string; otp?: string; sentAt: number; expiresIn: number };

export function readResetProgress(raw: string | undefined): ResetProgress | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { phone, otp, sentAt, expiresIn } = value as Record<string, unknown>;
    if (typeof phone !== "string" || !/^01[3-9]\d{8}$/.test(phone)) return null;
    if (typeof sentAt !== "number" || typeof expiresIn !== "number") return null;
    if (otp !== undefined && (typeof otp !== "string" || !isOtp(otp))) return null;
    return { phone, otp, sentAt, expiresIn };
  } catch {
    return null;
  }
}

/** Seconds the code has left, never below 0 */
export const secondsLeft = (progress: ResetProgress, now = Date.now()) =>
  Math.max(0, Math.round(progress.expiresIn - (now - progress.sentAt) / 1000));
