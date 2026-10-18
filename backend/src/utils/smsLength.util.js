// One SMS part holds 160 characters of the GSM-7 alphabet (plain English
// text), or 70 UCS-2 units once any other character is in it (Bangla, emoji).
// The gateway charges per part, so a manually typed message is capped at one
// part. Keep in step with dashbaord/src/utils/smsLength.ts.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Sent as an escape plus the character, so each takes two places
const GSM_EXTENDED = "^{}\\[~]|€\f";

const GSM_LIMIT = 160;
const UNICODE_LIMIT = 70;

const isGsm = (text) =>
  [...text].every((c) => GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c));

// { length, limit } of the message as the gateway counts it
const smsLength = (text = "") => {
  if (isGsm(text)) {
    const length = [...text].reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0);
    return { length, limit: GSM_LIMIT };
  }
  return { length: text.length, limit: UNICODE_LIMIT };
};

const fitsOneSms = (text) => {
  const { length, limit } = smsLength(text);
  return length <= limit;
};

module.exports = { smsLength, fitsOneSms, GSM_LIMIT, UNICODE_LIMIT };
