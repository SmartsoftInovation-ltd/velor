const { smsLength } = require("./smsLength.util");

// Due SMS can carry the customer's own details: #name# and #due# are filled in
// per customer when the message is sent. "#" is plain GSM-7 (one character);
// brackets or braces would count twice against the 160-character SMS.
const NAME_TOKEN = "#name#";
const DUE_TOKEN = "#due#";

const DEFAULT_DUE_TEMPLATE =
  "Dear #name# Sir/Mam, Your overall due balance is #due# taka. Please payment your due balance as soon as possible.";

const hasTokens = (template = "") => template.includes(NAME_TOKEN) || template.includes(DUE_TOKEN);

const formatDue = (due) => Math.round(Number(due) || 0).toLocaleString("en-US");

const fill = (template, name, due) =>
  template.split(NAME_TOKEN).join(name).split(DUE_TOKEN).join(formatDue(due));

/**
 * The message one customer receives. A long name is shortened (never the
 * amount or the wording) so the text still fits one SMS; null when even an
 * empty name does not fit — the template itself is too long.
 */
const renderDueSms = (template, { name = "", due = 0 } = {}) => {
  const full = fill(template, String(name).trim(), due);
  const fits = (text) => {
    const { length, limit } = smsLength(text);
    return length <= limit;
  };
  if (fits(full)) return full;
  const words = String(name).trim().split(/\s+/);
  for (let n = words.length - 1; n >= 1; n -= 1) {
    const shorter = fill(template, words.slice(0, n).join(" "), due);
    if (fits(shorter)) return shorter;
  }
  const bare = fill(template, "", due).replace(/\s{2,}/g, " ");
  return fits(bare) ? bare : null;
};

module.exports = { NAME_TOKEN, DUE_TOKEN, DEFAULT_DUE_TEMPLATE, hasTokens, renderDueSms, formatDue };
