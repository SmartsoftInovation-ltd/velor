import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { sameDay, startOfDay } from "./saleWindow";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * One month, with the sale's days drawn as a band: start and end days solid
 * green, the days between tinted. Past days cannot be picked, but a running
 * sale's band still shows across them.
 */
const RangeCalendar = ({ start, end, onPick }: { start: Date; end: Date; onPick: (day: Date) => void }) => {
  const [view, setView] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const today = startOfDay(new Date());

  const firstWeekday = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];
  const shift = (months: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));

  const from = startOfDay(start).getTime();
  const to = startOfDay(end).getTime();

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/5 dark:hover:text-white">
          <FaChevronLeft className="size-3" />
        </button>
        <p className="text-sm font-semibold text-gray-900 dark:text-white/90" aria-live="polite">
          {view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/5 dark:hover:text-white">
          <FaChevronRight className="size-3" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
        {WEEKDAYS.map((d) => <span key={d} className="pb-2">{d}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const t = day.getTime();
          const isStart = sameDay(day, start);
          const isEnd = sameDay(day, end);
          const inside = t > from && t < to;
          const past = t < today.getTime();
          const isToday = t === today.getTime();
          // The band runs edge to edge between the ends, rounded at each end
          const band = inside
            ? "bg-accent-50 dark:bg-accent-500/10"
            : isStart && !isEnd ? "rounded-l-full bg-accent-50 dark:bg-accent-500/10"
            : isEnd && !isStart ? "rounded-r-full bg-accent-50 dark:bg-accent-500/10"
            : "";
          return (
            <div key={t} className={band}>
              <button
                type="button"
                disabled={past}
                onClick={() => onPick(day)}
                aria-label={day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                aria-pressed={isStart || isEnd}
                className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                  isStart || isEnd
                    ? "bg-accent-500 font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)]"
                    : past
                      ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                      : inside
                        ? "text-accent-800 hover:bg-accent-100 dark:text-accent-300 dark:hover:bg-accent-500/20"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                } ${isToday && !(isStart || isEnd) ? "ring-1 ring-inset ring-accent-300" : ""}`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RangeCalendar;
