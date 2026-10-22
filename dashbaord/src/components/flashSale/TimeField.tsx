import { useEffect, useId, useRef, useState } from "react";
import { FaChevronDown, FaRegClock } from "react-icons/fa";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const cell = (active: boolean) =>
  `flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${
    active
      ? "bg-accent-500 font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)]"
      : "text-gray-700 hover:bg-accent-50 hover:text-accent-700 dark:text-gray-300 dark:hover:bg-accent-500/10 dark:hover:text-accent-400"
  }`;

/**
 * A time of day: the field shows "10:30 AM"; clicking it opens a panel with
 * an hour grid, a minute grid (5-minute steps) and AM/PM. Every click applies
 * at once; the panel closes on Done, Escape or a click outside.
 */
const TimeField = ({
  label,
  date,
  onChange,
  align = "left",
}: {
  label: string;
  date: Date;
  onChange: (hours: number, minutes: number) => void;
  /** Which edge the panel lines up with; "right" for a field on the right of a row */
  align?: "left" | "right";
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const pm = date.getHours() >= 12;
  const h12 = date.getHours() % 12 || 12;
  const minute = date.getMinutes();
  const set = (hour12: number, min: number, isPm: boolean) => onChange((hour12 % 12) + (isPm ? 12 : 0), min);
  const shown = `${h12}:${String(minute).padStart(2, "0")} ${pm ? "PM" : "AM"}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 text-left text-sm font-semibold tabular-nums text-gray-800 transition dark:bg-gray-900 dark:text-white/90 ${
          open ? "border-accent-400 ring-3 ring-accent-500/20" : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
        }`}
      >
        <FaRegClock className="size-3.5 text-accent-500" />
        <span className="flex-1">{shown}</span>
        <FaChevronDown className={`size-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`${label} time`}
          className={`absolute z-50 mt-2 w-76 ${align === "right" ? "right-0" : "left-0"} rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white/90">{shown}</p>
            <div role="radiogroup" aria-label="AM or PM" className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
              {(["AM", "PM"] as const).map((half) => {
                const active = (half === "PM") === pm;
                return (
                  <button
                    key={half}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set(h12, minute, half === "PM")}
                    className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                      active ? "bg-white text-accent-700 shadow-theme-xs dark:bg-gray-800 dark:text-accent-400" : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {half}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mb-1.5 text-xs font-medium text-gray-400">Hour</p>
          <div className="mb-3 grid grid-cols-6 gap-1">
            {HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={h === h12} onClick={() => set(h, minute, pm)} className={cell(h === h12)}>
                {h}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-xs font-medium text-gray-400">Minute</p>
          <div className="grid grid-cols-6 gap-1">
            {MINUTES.map((m) => (
              <button key={m} type="button" aria-pressed={m === minute} onClick={() => set(h12, m, pm)} className={cell(m === minute)}>
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 h-9 w-full rounded-lg bg-accent-500 text-sm font-semibold text-white transition hover:bg-accent-600"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default TimeField;
