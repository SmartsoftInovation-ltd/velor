"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { callAsShopper, shopperIdentity, storeSession } from "@/lib/actions/shopper-identity";
import {
  changeShopperPassword,
  isEmail,
  isPhone,
  KEEP_COOKIE,
  normalizePhone,
  passwordProblems,
  removeShopperPhoto,
  updateShopper,
  uploadShopperPhoto,
} from "@/lib/shopper-auth";
import { ApiError, storeHostFrom } from "@/lib/store-api";

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "phone", string>>;
  values?: { name: string; email: string; phone: string };
};

export type PasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"current" | "password" | "confirm", string>>;
};

const NO_SHOP = "This shop could not be found. Check the address and try again.";

/** The signed-in shopper's bearer header; a guest id never reaches these actions */
async function signedIn() {
  const who = await shopperIdentity(null);
  return who?.authorization ? who : null;
}

/** Saves the shopper's name, email and phone. One of email or phone must stay: it is how they sign in. */
export async function updateProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const values = { name, email, phone };

  const fieldErrors: ProfileState["fieldErrors"] = {};
  if (name.length < 2) fieldErrors.name = "Enter your full name.";
  if (email && !isEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone && !isPhone(phone)) fieldErrors.phone = "Enter an 11-digit mobile number, like 01712345678.";
  if (!email && !phone) fieldErrors.email = "Keep an email or a mobile number to sign in with.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const host = storeHostFrom(await headers());
  if (!host) return { error: NO_SHOP, values };
  const who = await signedIn();
  if (!who) return { error: "Your session has ended. Sign in again to save your details.", values };

  try {
    await callAsShopper(
      host,
      who,
      (as) => updateShopper(host, as, { name, email, phone: phone ? normalizePhone(phone) : "" }),
      "/account",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const field = /email/i.test(error.message) ? "email" : "phone";
      return { fieldErrors: { [field]: `Another account here already uses this ${field === "email" ? "email" : "number"}.` }, values };
    }
    if (error instanceof ApiError && error.status < 500) return { error: error.message, values };
    return { error: "We could not save your details just now. Please try again.", values };
  }

  revalidatePath("/account");
  return { ok: true, values };
}

export type PhotoState = { ok?: boolean; error?: string };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The browser shrinks the photo first (avatar-uploader.tsx); this is the backstop
const PHOTO_MAX_BYTES = 900 * 1024;

/** Sends a new profile photo, or removes the current one when `remove` is set */
export async function updatePhotoAction(_prev: PhotoState, form: FormData): Promise<PhotoState> {
  const remove = form.get("remove") === "1";
  const photo = form.get("photo");
  if (!remove) {
    if (!(photo instanceof Blob) || !photo.size) return { error: "Choose a photo to upload." };
    if (!PHOTO_TYPES.includes(photo.type)) return { error: "Use a JPG, PNG or WEBP photo." };
    if (photo.size > PHOTO_MAX_BYTES) return { error: "That photo is too large. Try a smaller one." };
  }

  const host = storeHostFrom(await headers());
  if (!host) return { error: NO_SHOP };
  const who = await signedIn();
  if (!who) return { error: "Your session has ended. Sign in again to change your photo." };

  try {
    await callAsShopper(
      host,
      who,
      (as) => (remove ? removeShopperPhoto(host, as) : uploadShopperPhoto(host, as, photo as Blob)),
      "/account",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) return { error: error.message };
    return { error: "We could not update your photo just now. Please try again." };
  }

  revalidatePath("/account");
  return { ok: true };
}

/**
 * Changes the password after the API checks the current one. The API ends every
 * other session; the fresh pair it returns keeps this browser signed in.
 */
export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const fieldErrors: PasswordState["fieldErrors"] = {};
  if (!current) fieldErrors.current = "Enter your current password.";
  const problems = passwordProblems(password);
  if (problems.length) fieldErrors.password = `Use ${problems.join(", ")}.`;
  else if (password === current) fieldErrors.password = "Choose a password different from your current one.";
  if (confirm !== password) fieldErrors.confirm = "The passwords do not match.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const host = storeHostFrom(await headers());
  if (!host) return { error: NO_SHOP };
  const who = await signedIn();
  if (!who) return { error: "Your session has ended. Sign in again to change your password." };

  let session;
  try {
    session = await callAsShopper(
      host,
      who,
      (as) => changeShopperPassword(host, as, { currentPassword: current, newPassword: password }),
      "/account",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && /current password is not correct/i.test(error.message)) {
      return { fieldErrors: { current: "That is not your current password." } };
    }
    if (error instanceof ApiError && error.status < 500) return { error: error.message };
    return { error: "We could not change your password just now. Please try again." };
  }

  await storeSession(session, (await cookies()).has(KEEP_COOKIE));
  return { ok: true };
}
