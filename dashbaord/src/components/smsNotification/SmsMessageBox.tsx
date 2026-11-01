import { nextSmsText, smsLength } from "../../utils/smsLength";

// The message textarea shared by every SMS screen: capped at one SMS as you
// type or paste (the API refuses longer), with the live count under it.
const SmsMessageBox = ({
  id,
  value,
  onChange,
  error,
  rows = 5,
  autoFocus = false,
  placeholder = "Type your message here…",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows?: number;
  autoFocus?: boolean;
  placeholder?: string;
}) => {
  const { length, limit, unicode } = smsLength(value);
  const left = limit - length;

  return (
    <div>
      <textarea
        id={id}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(nextSmsText(value, next));
        }}
        aria-invalid={!!error}
        aria-describedby={`${id}-help`}
        className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-2 dark:bg-gray-900 dark:text-white/90 ${
          error
            ? "border-error-400 focus:ring-error-500/20"
            : "border-gray-300 focus:border-accent-500 focus:ring-accent-500/20 dark:border-gray-700"
        }`}
      />
      <div id={`${id}-help`} className="mt-1 flex items-center justify-between gap-3 text-xs">
        {error ? (
          <span className="text-error-500">{error}</span>
        ) : (
          <span className="text-gray-400">
            1 SMS max{unicode ? " · Bangla/emoji: 70 characters" : " · 160 characters"}
          </span>
        )}
        <span className={`tabular-nums ${left <= 0 ? "font-semibold text-error-500" : left <= 15 ? "text-warning-600" : "text-gray-400"}`}>
          {left <= 0 ? "Limit reached" : `${left} left`}
        </span>
      </div>
    </div>
  );
};

export default SmsMessageBox;
