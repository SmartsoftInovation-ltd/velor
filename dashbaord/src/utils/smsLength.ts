// One SMS part holds 160 characters of the GSM-7 alphabet (plain English
// text), or 70 UCS-2 units once any other character is in it (Bangla, emoji).
// The gateway charges per part, so a typed message is capped at one part.
// The API enforces the same rule: keep in step with
// backend/src/utils/smsLength.util.js.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Sent as an escape plus the character, so each takes two places
const GSM_EXTENDED = "^{}\\[~]|€\f";

export const GSM_LIMIT = 160;
export const UNICODE_LIMIT = 70;

const isGsm = (text: string) =>
  [...text].every((c) => GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c));

// The message's length and limit as the gateway counts them
export const smsLength = (text: string) => {
  if (isGsm(text)) {
    const length = [...text].reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0);
    return { length, limit: GSM_LIMIT, unicode: false };
  }
  return { length: text.length, limit: UNICODE_LIMIT, unicode: true };
};

// Cut a typed or pasted message down to what fits in one SMS
export const fitOneSms = (text: string) => {
  const gsm = isGsm(text);
  const limit = gsm ? GSM_LIMIT : UNICODE_LIMIT;
  let out = "";
  let used = 0;
  // Whole code points only, so an emoji is never split in half
  for (const c of text) {
    const cost = gsm ? (GSM_EXTENDED.includes(c) ? 2 : 1) : c.length;
    if (used + cost > limit) break;
    out += c;
    used += cost;
  }
  return out;
};

// The textarea's next value: an edit that fits is taken as is; one that does
// not is cut to fit, unless cutting would leave less than was there before
// (e.g. one Bangla letter typed into 150 English characters drops the limit
// to 70), in which case the edit is refused.
export const nextSmsText = (prev: string, next: string) => {
  const { length, limit } = smsLength(next);
  if (length <= limit) return next;
  const fitted = fitOneSms(next);
  return fitted.length >= prev.length ? fitted : prev;
};
