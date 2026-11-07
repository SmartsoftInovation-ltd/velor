"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPhone, normalizePhone, passwordProblems } from "@/lib/shopper-auth";
import {
  isOtp,
  RESET_COOKIE,
  readResetProgress,
  requestResetCode,
  resetPassword,
  verifyResetCode,
  type ResetProgress,
} from "@/lib/password-reset";
import { ApiError, storeHostFrom } from "@/lib/store-api";

export type ResetFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"phone" | "otp" | "password" | "confirm", string>>;
  phone?: string;
  /** Set after a resend, so the countdown starts again from `expiresIn` */
  sentAt?: number;
  expiresIn?: number;
};

// The API words its refusals for the shopper (bad number, wrong code, no SMS); a crash is generic
const shown = (error: unknown, fallback: string) =>
  error instanceof ApiError && (error.status < 500 || error.status === 503) ? error.message : fallback;

async function progress() {
  return readResetProgress((await cookies()).get(RESET_COOKIE)?.value);
}

async function keep(value: ResetProgress) {
  (await cookies()).set(RESET_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
}

async function host() {
  return storeHostFrom(await headers());
}

/** Step 1: sends a code to the number, then on to the code page */
export async function requestResetCodeAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const raw = String(form.get("phone") ?? "").trim();
  if (!isPhone(raw)) return { fieldErrors: { phone: "Enter an 11-digit mobile number, like 01712345678." }, phone: raw };
  const phone = normalizePhone(raw);

  try {
    const sent = await requestResetCode(await host(), phone);
    await keep({ phone, sentAt: Date.now(), expiresIn: sent.expiresIn });
  } catch (error) {
    return { error: shown(error, "We could not send a code just now. Please try again."), phone: raw };
  }
  redirect("/verify-otp");
}

/** Step 2, again: a fresh code to the same number */
export async function resendResetCodeAction(): Promise<ResetFormState> {
  const current = await progress();
  if (!current) redirect("/forgot-password");
  try {
    const sent = await requestResetCode(await host(), current.phone);
    const sentAt = Date.now();
    await keep({ phone: current.phone, sentAt, expiresIn: sent.expiresIn });
    return { sentAt, expiresIn: sent.expiresIn };
  } catch (error) {
    return { error: shown(error, "We could not send a new code just now. Please try again.") };
  }
}

/** Step 2: checks the code, then on to choosing a password */
export async function verifyResetCodeAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const current = await progress();
  if (!current) redirect("/forgot-password");
  const otp = String(form.get("otp") ?? "").trim();
  if (!isOtp(otp)) return { fieldErrors: { otp: "Enter all 6 digits." } };

  try {
    await verifyResetCode(await host(), current.phone, otp);
  } catch (error) {
    return { error: shown(error, "We could not check the code just now. Please try again.") };
  }
  await keep({ ...current, otp });
  redirect("/reset-password");
}

/** Step 3: the new password. Every old session ends; the shopper signs in again. */
export async function resetPasswordAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const current = await progress();
  if (!current?.otp) redirect("/forgot-password");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const fieldErrors: ResetFormState["fieldErrors"] = {};
  const problems = passwordProblems(password);
  if (problems.length) fieldErrors.password = `Use ${problems.join(", ")}.`;
  if (confirm !== password) fieldErrors.confirm = "The passwords do not match.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await resetPassword(await host(), current.phone, current.otp, password);
  } catch (error) {
    // A dead code cannot be retried from here; the shopper starts over
    if (error instanceof ApiError && error.status === 400 && !/password/i.test(error.message)) {
      (await cookies()).delete(RESET_COOKIE);
      return { error: "Your code has expired. Ask for a new one to reset your password." };
    }
    return { error: shown(error, "We could not change your password just now. Please try again.") };
  }
  (await cookies()).delete(RESET_COOKIE);
  redirect("/sign-in?reset=1");
}
