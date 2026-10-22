// Date helpers for the flash sale window. Values are "YYYY-MM-DDTHH:mm" in local
// time, the format the form keeps and turns into ISO on save.

export const toLocalValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const fromLocalValue = (value: string) => new Date(value);

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** `date` with its day taken from `day`, keeping the time of day */
export const withDay = (date: Date, day: Date) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), date.getHours(), date.getMinutes());

/** `date` with a new time of day */
export const withTime = (date: Date, hours: number, minutes: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);

/** Now, rounded up to the next 5 minutes, so "starts now" is a clean time */
export const roundedNow = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d;
};

/** "3 days 4 hours", "45 minutes" */
export const describeDuration = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "");
  return [part(days, "day"), part(hours, "hour"), days ? "" : part(mins, "minute")].filter(Boolean).join(" ") || "0 minutes";
};

export const formatMoment = (date: Date) =>
  date.toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
