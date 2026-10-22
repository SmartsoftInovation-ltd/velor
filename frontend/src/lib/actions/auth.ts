"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, storeHostFrom } from "@/lib/store-api";
import {
  isEmail,
  isPhone,
  loginShopper,
  normalizePhone,
  passwordProblems,
  REFRESH_COOKIE,
  registerShopper,
  SESSION_COOKIE,
  type ShopperSession,
} from "@/lib/shopper-auth";

export type SignUpState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "contact" | "password" | "confirm" | "terms", string>>;
  /** Typed values sent back so a failed submit does not empty the form */
  values?: { name: string; contact: string; method: "email" | "phone" };
};

export type SignInState = {
  error?: string;
  fieldErrors?: Partial<Record<"contact" | "password", string>>;
  values?: { contact: string; method: "email" | "phone" };
};

const DAY = 24 * 60 * 60;

/**
 * Creates a shopper account in the store this domain belongs to. The store
 * is never taken from the form: the API resolves it from the domain, and the
 * domain is read here on the server, so a visitor cannot sign up into another shop.
 */
export async function signUpAction(_prev: SignUpState, form: FormData): Promise<SignUpState> {
  const name = String(form.get("name") ?? "").trim();
  const method = form.get("method") === "phone" ? "phone" : "email";
  const contact = String(form.get("contact") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const values = { name, contact, method } as const;

  const fieldErrors: SignUpState["fieldErrors"] = {};
  if (name.length < 2) fieldErrors.name = "Enter your full name.";
  if (method === "email" && !isEmail(contact)) fieldErrors.contact = "Enter a valid email address.";
  if (method === "phone" && !isPhone(contact)) fieldErrors.contact = "Enter an 11-digit mobile number, like 01712345678.";
  const problems = passwordProblems(password);
  if (problems.length) fieldErrors.password = `Use ${problems.join(", ")}.`;
  if (confirm !== password) fieldErrors.confirm = "The passwords do not match.";
  if (form.get("terms") !== "on") fieldErrors.terms = "Accept the terms to create an account.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const tenantHost = storeHostFrom(await headers());
  if (!tenantHost) return { error: "This shop could not be found. Check the address and try again.", values };

  let session;
  try {
    session = await registerShopper(tenantHost, {
      name,
      password,
      ...(method === "email" ? { email: contact.toLowerCase() } : { phone: normalizePhone(contact) }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { fieldErrors: { contact: `An account with this ${method} already exists here. Sign in instead.` }, values };
    }
    if (error instanceof ApiError && error.status < 500) return { error: error.message, values };
    return { error: "We could not create your account just now. Please try again.", values };
  }

  await saveSession(session, true);
  redirect("/?welcome=1");
}

/**
 * Signs a shopper in to the store this domain belongs to. As with sign-up,
 * the store comes from the domain, so the same email at another shop is a
 * different account and cannot be reached from here.
 */
export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const method = form.get("method") === "phone" ? "phone" : "email";
  const contact = String(form.get("contact") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { contact, method } as const;

  const fieldErrors: SignInState["fieldErrors"] = {};
  if (method === "email" && !isEmail(contact)) fieldErrors.contact = "Enter a valid email address.";
  if (method === "phone" && !isPhone(contact)) fieldErrors.contact = "Enter an 11-digit mobile number, like 01712345678.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const tenantHost = storeHostFrom(await headers());
  if (!tenantHost) return { error: "This shop could not be found. Check the address and try again.", values };

  let session;
  try {
    session = await loginShopper(tenantHost, {
      password,
      ...(method === "email" ? { email: contact.toLowerCase() } : { phone: normalizePhone(contact) }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return { error: `That ${method === "email" ? "email" : "mobile number"} and password don't match an account here.`, values };
    }
    // Blocked account (403) and too many attempts (429) say what to do themselves
    if (error instanceof ApiError && error.status < 500) return { error: error.message, values };
    return { error: "We could not sign you in just now. Please try again.", values };
  }

  await saveSession(session, form.get("remember") === "on");
  redirect("/");
}

/** Ends the session on this shop's domain only; other shops keep theirs. */
export async function signOutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/sign-in");
}

/**
 * Stores the tokens in httpOnly cookies on the shop's domain. Without
 * "keep me signed in" they carry no expiry, so the browser drops them when it closes.
 */
async function saveSession(session: ShopperSession, remember: boolean) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax", secure, path: "/" } as const;
  jar.set(SESSION_COOKIE, session.accessToken, remember ? { ...base, maxAge: DAY } : base);
  jar.set(REFRESH_COOKIE, session.refreshToken, remember ? { ...base, maxAge: 7 * DAY } : base);
}
