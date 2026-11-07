"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/ui/icons-auth";

function format(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * How long the code has left. Once it reaches zero the resend link takes
 * over: the code is dead by then, so a stale timer would be a lie. A new
 * `restartKey` (a resend) starts it again from `seconds`.
 */
export function OtpCountdown({
  seconds,
  restartKey,
  onResend,
  resending,
}: {
  seconds: number;
  restartKey?: number;
  onResend: () => void;
  resending: boolean;
}) {
  const [left, setLeft] = useState(seconds);
  const [shownKey, setShownKey] = useState(restartKey);
  if (shownKey !== restartKey) {
    setShownKey(restartKey);
    setLeft(seconds);
  }

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const expired = left <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg-sunken px-3 py-2.5">
      <p className="flex items-center gap-2 text-caption text-text-secondary">
        <ClockIcon className="size-4 text-text-tertiary" />
        {expired ? (
          "This code has expired."
        ) : (
          <>
            Code expires in{" "}
            <span
              // Announces on the minute rather than every tick, which would
              // make a screen reader unusable.
              aria-live={left % 60 === 0 ? "polite" : "off"}
              className="font-semibold text-text-primary tabular"
            >
              {format(left)}
            </span>
          </>
        )}
      </p>

      <button
        type="button"
        onClick={onResend}
        disabled={!expired || resending}
        className="text-caption font-medium text-text-brand transition-opacity duration-150 hover:opacity-80 disabled:text-text-disabled disabled:hover:opacity-100"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>
    </div>
  );
}
