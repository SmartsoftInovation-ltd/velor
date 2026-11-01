import { FaChevronLeft, FaChevronRight, FaInfoCircle, FaPlus, FaSignal, FaWifi } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { smsLength } from "../../utils/smsLength";

// What the recipient will see: the message in a phone's SMS thread, plus what
// it costs to send. Messages go out exactly as typed (no per-recipient
// fields), so this is the real text, counted the way the gateway counts it.
// The phone's clock: the real time, kept current while the page is open.
// Checked every few seconds so it turns over close to the minute.
const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5000);
    return () => window.clearInterval(id);
  }, []);
  // iPhone style: "9:41", 12-hour, no AM/PM
  const h = now.getHours() % 12 || 12;
  return `${h}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const SmsPreview = ({
  message,
  recipientLabel,
  recipientCount = 1,
  compact = false,
}: {
  message: string;
  // Shown in the thread header: a phone number, a name or a group
  recipientLabel?: string;
  recipientCount?: number;
  // Smaller phone, for modals
  compact?: boolean;
}) => {
  const { tenant } = useAuth();
  const time = useClock();
  const sender = tenant?.name || "Your store";
  const text = message.trim();
  const { length, limit, unicode } = smsLength(message);
  const used = Math.min(100, Math.round((length / limit) * 100));
  const full = length >= limit;

  return (
    <div className="flex flex-col gap-3" aria-label="Message preview">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Preview</p>

      {/* iPhone: titanium frame, side buttons, Dynamic Island */}
      <div className={`relative mx-auto w-full ${compact ? "max-w-[250px]" : "max-w-[290px]"}`}>
        {/* Side buttons: action + volume on the left, power on the right */}
        <span className="absolute -left-[3px] top-[18%] h-6 w-[3px] rounded-l-sm bg-gray-400 dark:bg-gray-600" />
        <span className="absolute -left-[3px] top-[27%] h-10 w-[3px] rounded-l-sm bg-gray-400 dark:bg-gray-600" />
        <span className="absolute -left-[3px] top-[37%] h-10 w-[3px] rounded-l-sm bg-gray-400 dark:bg-gray-600" />
        <span className="absolute -right-[3px] top-[30%] h-14 w-[3px] rounded-r-sm bg-gray-400 dark:bg-gray-600" />

        {/* Frame */}
        <div className="rounded-[2.9rem] bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300 p-[3px] shadow-[0_20px_45px_-15px_rgba(0,0,0,0.45)] dark:from-gray-600 dark:via-gray-700 dark:to-gray-600">
          {/* Black bezel */}
          <div className="rounded-[2.75rem] bg-gray-950 p-[7px]">
            {/* Screen */}
            <div className="relative flex flex-col overflow-hidden rounded-[2.3rem] bg-white dark:bg-gray-900">
              {/* Status bar around the Dynamic Island */}
              <div className="relative flex h-11 items-center justify-between px-6 text-[11px] font-semibold text-gray-900 dark:text-white">
                <span className="w-12 tabular-nums">{time}</span>
                <span className="absolute left-1/2 top-2.5 h-[26px] w-[86px] -translate-x-1/2 rounded-full bg-black">
                  {/* front camera */}
                  <span className="absolute right-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-gray-900 ring-1 ring-gray-800" />
                </span>
                <span className="flex w-12 items-center justify-end gap-1">
                  <FaSignal className="size-2.5" />
                  <FaWifi className="size-2.5" />
                  {/* battery */}
                  <span className="relative ml-0.5 flex h-[10px] w-[20px] items-center rounded-[3px] border border-gray-900/40 p-[1px] dark:border-white/50">
                    <span className="h-full w-[75%] rounded-[1.5px] bg-gray-900 dark:bg-white" />
                    <span className="absolute -right-[3px] top-1/2 h-[4px] w-[1.5px] -translate-y-1/2 rounded-r-sm bg-gray-900/40 dark:bg-white/50" />
                  </span>
                </span>
              </div>

              {/* Messages header: back, avatar on the left, sender and recipient on the right */}
              <div className="flex items-center gap-2 border-b border-gray-200/80 bg-gray-50/80 px-3 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-800/60">
                <FaChevronLeft className="size-3.5 shrink-0 text-[#007AFF]" />
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-accent-400 to-accent-600 text-sm font-semibold uppercase text-white shadow-sm">
                  {sender.charAt(0)}
                  {/* online dot */}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-gray-50 bg-green-500 dark:border-gray-800" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-0.5 text-[12px] font-semibold text-gray-900 dark:text-white/90">
                    <span className="truncate">{sender}</span>
                    <FaChevronRight className="size-2 shrink-0 text-gray-400" />
                  </span>
                  <span className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                    {recipientLabel ? `to ${recipientLabel}` : "Text Message"}
                  </span>
                </span>
                <FaInfoCircle className="size-3.5 shrink-0 text-[#007AFF]" />
              </div>

              {/* Thread */}
              <div className={`flex flex-col justify-end px-3 py-3 ${compact ? "min-h-[260px]" : "min-h-[380px]"}`}>
                {text ? (
                  <>
                    <span className="mb-2 self-center text-[9px] font-medium text-gray-400">Text Message · Today {time}</span>
                    <div className="relative max-w-[85%] animate-in fade-in slide-in-from-bottom-1 duration-200 self-start rounded-[18px] rounded-bl-[6px] bg-[#E9E9EB] px-3 py-1.5 text-[12.5px] leading-snug text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                      <p className="whitespace-pre-wrap break-words">{message}</p>
                    </div>
                  </>
                ) : (
                  <p className="self-center pb-6 text-center text-[11px] text-gray-400">Your message will appear here.</p>
                )}
              </div>

              {/* Composer bar */}
              <div className="flex items-center gap-2 px-3 pb-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                  <FaPlus className="size-2.5" />
                </span>
                <span className="flex h-7 flex-1 items-center rounded-full border border-gray-300 px-3 text-[10px] text-gray-400 dark:border-gray-700">
                  Text Message
                </span>
              </div>

              {/* Home indicator */}
              <span className="mx-auto mb-2 h-1 w-24 rounded-full bg-gray-900 dark:bg-white/80" />
            </div>
          </div>
        </div>
      </div>

      {/* What it costs */}
      <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {unicode ? "Bangla / emoji" : "English (GSM)"} · 1 SMS
          </span>
          <span className={`font-semibold tabular-nums ${full ? "text-error-500" : "text-gray-700 dark:text-gray-200"}`}>
            {length}/{limit}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              full ? "bg-error-500" : used > 85 ? "bg-warning-500" : "bg-accent-500"
            }`}
            style={{ width: `${used}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Recipients</span>
          <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {recipientCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">SMS to be sent</span>
          <span className="font-semibold tabular-nums text-accent-600 dark:text-accent-400">
            {(text ? recipientCount : 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SmsPreview;
