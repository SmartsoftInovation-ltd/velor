import { useState } from "react";
import RangeCalendar from "./RangeCalendar";
import TimeField from "./TimeField";
import { describeDuration, formatMoment, fromLocalValue, roundedNow, startOfDay, toLocalValue, withDay, withTime } from "./saleWindow";

const HOUR = 60 * 60 * 1000;
const PRESETS = [
  { label: "6 hours", ms: 6 * HOUR },
  { label: "24 hours", ms: 24 * HOUR },
  { label: "3 days", ms: 72 * HOUR },
  { label: "7 days", ms: 168 * HOUR },
];

/**
 * When the sale runs: tap the first day, then the last, on one calendar;
 * set the start and end times; or use a preset length from the start. The
 * line on top always says exactly when it runs and for how long.
 */
const SaleWindowPicker = ({
  startsAt,
  endsAt,
  onChange,
}: {
  startsAt: string;
  endsAt: string;
  onChange: (startsAt: string, endsAt: string) => void;
}) => {
  const start = fromLocalValue(startsAt);
  const end = fromLocalValue(endsAt);
  // After the first tap the next one picks the last day
  const [pickingEnd, setPickingEnd] = useState(false);
  const valid = end.getTime() > start.getTime();

  const emit = (s: Date, e: Date) => onChange(toLocalValue(s), toLocalValue(e));

  const pickDay = (day: Date) => {
    if (pickingEnd && day.getTime() >= startOfDay(start).getTime()) {
      emit(start, withDay(end, day));
      setPickingEnd(false);
      return;
    }
    // A new first day; the sale ends that same day until the last one is tapped
    emit(withDay(start, day), withDay(end, day));
    setPickingEnd(true);
  };

  return (
    <div className="space-y-4">
      <div
        aria-live="polite"
        className={`rounded-xl px-4 py-3 ${valid ? "bg-accent-50 dark:bg-accent-500/10" : "bg-error-50 dark:bg-error-500/10"}`}
      >
        <p className={`text-sm font-semibold ${valid ? "text-accent-800 dark:text-accent-300" : "text-error-700 dark:text-error-400"}`}>
          {valid ? `Runs for ${describeDuration(end.getTime() - start.getTime())}` : "The sale has to end after it starts"}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-gray-600 dark:text-gray-400">
          {formatMoment(start)} <span className="text-gray-400">to</span> {formatMoment(end)}
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
        <RangeCalendar key={`${start.getFullYear()}-${start.getMonth()}`} start={start} end={end} onPick={pickDay} />
        <p className="mt-3 text-center text-xs text-gray-400">
          {pickingEnd ? "Now tap the last day of the sale" : "Tap the first day, then the last"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TimeField label="Starts at" date={start} onChange={(h, m) => emit(withTime(start, h, m), end)} />
        <TimeField label="Ends at" date={end} onChange={(h, m) => emit(start, withTime(end, h, m))} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Quick length</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              const now = roundedNow();
              emit(now, new Date(now.getTime() + Math.max(end.getTime() - start.getTime(), HOUR)));
            }}
            className="h-8 rounded-full border border-accent-200 bg-accent-50 px-3 text-xs font-semibold text-accent-700 transition hover:bg-accent-100 dark:border-accent-500/30 dark:bg-accent-500/15 dark:text-accent-400"
          >
            Start now
          </button>
          {PRESETS.map((preset) => {
            const active = valid && end.getTime() - start.getTime() === preset.ms;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => emit(start, new Date(start.getTime() + preset.ms))}
                aria-pressed={active}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
                  active
                    ? "border-accent-500 bg-accent-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SaleWindowPicker;
