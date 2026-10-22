"use client";

import { useEffect, useState } from "react";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: number): TimeLeft {
  const diff = Math.max(target - Date.now(), 0);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

/** Counts down to `endsAt` (an ISO time from the API). */
export function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => setTimeLeft(getTimeLeft(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="flex items-center gap-2">
      {UNITS.map((unit) => (
        <div
          key={unit.key}
          className="flex w-14 flex-col items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-surface py-2 shadow-xs sm:w-16"
        >
          <span className="text-h3 font-semibold tabular text-text-primary">
            {String(timeLeft ? timeLeft[unit.key] : 0).padStart(2, "0")}
          </span>
          <span className="text-micro font-medium uppercase tracking-wide text-text-tertiary">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
