const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const selectClass =
  "h-10 appearance-none rounded-lg border border-gray-200 bg-white px-2.5 text-center text-sm font-medium tabular-nums text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

/**
 * A time of day as hour, minute (5-minute steps) and AM/PM. A minute that is
 * not on a 5-minute step (a sale saved elsewhere) is kept as an extra option.
 */
const TimeField = ({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date;
  onChange: (hours: number, minutes: number) => void;
}) => {
  const h24 = date.getHours();
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const minute = date.getMinutes();
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);
  const set = (hour12: number, min: number, isPm: boolean) => onChange((hour12 % 12) + (isPm ? 12 : 0), min);

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="flex items-center gap-1.5">
        <select aria-label={`${label} hour`} value={h12} onChange={(e) => set(Number(e.target.value), minute, pm)} className={`${selectClass} w-14`}>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400">:</span>
        <select aria-label={`${label} minute`} value={minute} onChange={(e) => set(h12, Number(e.target.value), pm)} className={`${selectClass} w-14`}>
          {minutes.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
        </select>
        <div role="radiogroup" aria-label={`${label} AM or PM`} className="ml-1 flex rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
          {(["AM", "PM"] as const).map((half) => {
            const active = (half === "PM") === pm;
            return (
              <button
                key={half}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set(h12, minute, half === "PM")}
                className={`h-9 rounded-md px-2.5 text-xs font-semibold transition ${
                  active ? "bg-white text-accent-700 shadow-theme-xs dark:bg-gray-900 dark:text-accent-400" : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
                }`}
              >
                {half}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimeField;
