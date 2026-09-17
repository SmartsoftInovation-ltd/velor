const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const PHONE_PATTERN = /^01\d{9}$/;

// Staff sign in with either their email or their phone number
export const loginIdentifier = (value: string): { email: string } | { phone: string } | null => {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return EMAIL_PATTERN.test(trimmed) ? { email: trimmed.toLowerCase() } : null;
  // Accept +8801XXXXXXXXX / 8801XXXXXXXXX and spaces or dashes
  const phone = trimmed.replace(/[\s-]/g, "").replace(/^\+?880/, "0");
  return PHONE_PATTERN.test(phone) ? { phone } : null;
};

// Minimum length for any new password chosen in the dashboard
export const NEW_PASSWORD_MIN = 8;
