import { fitOneSms, smsLength } from "./smsLength";

// The due reminder and its placeholders. Keep in step with
// backend/src/utils/dueSmsTemplate.util.js, which fills them in on send.
// "#" is plain GSM text (one character); brackets or braces count twice.
export const DUE_NAME_TOKEN = "#name#";
export const DUE_TOKEN = "#due#";

export const DUE_SMS_TEMPLATE =
  "Dear #name# Sir/Mam, Your overall due balance is #due# taka. Please payment your due balance as soon as possible.";

export const hasDueTokens = (text: string) => text.includes(DUE_NAME_TOKEN) || text.includes(DUE_TOKEN);

const formatDue = (due: number) => Math.round(Number(due) || 0).toLocaleString("en-US");

const fill = (template: string, name: string, due: number) =>
  template.split(DUE_NAME_TOKEN).join(name).split(DUE_TOKEN).join(formatDue(due));

const fits = (text: string) => {
  const { length, limit } = smsLength(text);
  return length <= limit;
};

// One customer's text: a long name is shortened word by word (never the
// amount or the wording) so it still fits one SMS
export const renderDueSms = (template: string, customer: { fullName?: string; openingDues?: number }) => {
  const name = (customer.fullName || "").trim();
  const due = customer.openingDues || 0;
  const full = fill(template, name, due);
  if (fits(full)) return full;
  const words = name.split(/\s+/);
  for (let n = words.length - 1; n >= 1; n -= 1) {
    const shorter = fill(template, words.slice(0, n).join(" "), due);
    if (fits(shorter)) return shorter;
  }
  return fitOneSms(fill(template, "", due).replace(/\s{2,}/g, " "));
};
