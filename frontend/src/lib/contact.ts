import { apiFetch } from "@/lib/store-api";

/** The Contact page form, as POST /shop/contact takes it. Caps match the API. */
export type ContactInput = { name: string; email: string; subject: string; message: string };
export type ContactField = keyof ContactInput;

export const CONTACT_LIMITS: Record<ContactField, number> = { name: 100, email: 254, subject: 150, message: 500 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with each field, empty when the message can be sent */
export function contactProblems(input: ContactInput): Partial<Record<ContactField, string>> {
  const problems: Partial<Record<ContactField, string>> = {};
  if (!input.name) problems.name = "Please enter your name.";
  if (!input.email) problems.email = "Please enter your email.";
  else if (!EMAIL.test(input.email)) problems.email = "Please enter a valid email address.";
  if (!input.message) problems.message = "Please write a message.";
  for (const field of Object.keys(CONTACT_LIMITS) as ContactField[]) {
    if (!problems[field] && input[field].length > CONTACT_LIMITS[field]) {
      problems[field] = `Keep this under ${CONTACT_LIMITS[field]} characters.`;
    }
  }
  return problems;
}

export function sendContactMessage(tenantHost: string, input: ContactInput) {
  return apiFetch<null>(tenantHost, "/shop/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
