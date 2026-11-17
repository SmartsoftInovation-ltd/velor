"use server";

import { headers } from "next/headers";
import { contactProblems, sendContactMessage, type ContactField, type ContactInput } from "@/lib/contact";
import { ApiError, storeHostFrom } from "@/lib/store-api";

export type ContactFormState = {
  sent?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ContactField, string>>;
  /** What was typed, so a refused form keeps it */
  values?: ContactInput;
};

const read = (form: FormData, key: ContactField) => String(form.get(key) ?? "").trim();

/** Sends the Contact page form to the store; the API saves it for staff to read */
export async function sendContactAction(_prev: ContactFormState, form: FormData): Promise<ContactFormState> {
  const values: ContactInput = {
    name: read(form, "name"),
    email: read(form, "email"),
    subject: read(form, "subject"),
    message: read(form, "message"),
  };

  const fieldErrors = contactProblems(values);
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  try {
    await sendContactMessage(storeHostFrom(await headers()), values);
    return { sent: true };
  } catch (error) {
    // The API words its refusals (too many messages, bad email); a crash is generic
    const message =
      error instanceof ApiError && error.status < 500
        ? error.message
        : "We could not send your message just now. Please try again.";
    return { error: message, values };
  }
}
