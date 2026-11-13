import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaCheck, FaChevronDown, FaRulerHorizontal, FaSearch, FaTimes } from "react-icons/fa";
import { LEVELS, UNIT_OPTIONS, type ApplicableLevel, type IdOption, type UnitType } from "./sizeChartConfig";

// ---------- Section header ----------
export const StepHeader = ({ step, title, hint, icon: Icon }: { step: number; title: string; hint: string; icon: IconType }) => (
  <div className="mb-5 flex items-start gap-3">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
      <Icon className="size-4" />
    </span>
    <div>
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
        <span className="mr-1.5 text-accent-600 dark:text-accent-400">Step {step}.</span>
        {title}
      </h3>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  </div>
);

export const SectionCard = ({ children }: { children: ReactNode }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
    {children}
  </section>
);

// ---------- Level picker (icon cards) ----------
export const LevelPicker = ({ value, onChange }: { value: ApplicableLevel; onChange: (v: ApplicableLevel) => void }) => (
  <div role="radiogroup" aria-label="Where this chart applies" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
    {LEVELS.map(({ value: level, label, hint, icon: Icon }) => {
      const active = level === value;
      return (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(level)}
          className={`relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
            active
              ? "border-accent-500 bg-accent-50 ring-2 ring-accent-500/20 dark:bg-accent-500/15"
              : "border-gray-200 bg-white hover:border-accent-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-white/5"
          }`}
        >
          <span className={`flex size-8 items-center justify-center rounded-lg ${active ? "bg-accent-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>
            <Icon className="size-3.5" />
          </span>
          <span className={`text-sm font-semibold ${active ? "text-accent-700 dark:text-accent-300" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          <span className="text-xs leading-snug text-gray-500 dark:text-gray-400">{hint}</span>
          {active && (
            <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-accent-500 text-white">
              <FaCheck className="size-2" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ---------- Unit dropdown with icon ----------
export const UnitSelect = ({ value, onChange, label }: { value: UnitType; onChange: (u: UnitType) => void; label: string }) => (
  <div className="relative">
    <FaRulerHorizontal className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
    <select
      value={value}
      aria-label={`Unit for ${label || "this measurement"}`}
      onChange={(e) => onChange(e.target.value as UnitType)}
      className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs font-medium text-gray-700 outline-none transition-all hover:border-accent-300 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {UNIT_OPTIONS.map((u) => (
        <option key={u.value} value={u.value}>{u.label}</option>
      ))}
    </select>
    <FaChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-2.5 -translate-y-1/2 text-gray-400" />
  </div>
);

// ---------- MultiSelect with search ----------
export const MultiSelect = ({
  options, selected, onChange, placeholder, loading, error, icon: Icon,
}: {
  options: IdOption[]; selected: string[]; onChange: (v: string[]) => void;
  placeholder?: string; loading?: boolean; error?: string; icon?: IconType;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  return (
    <div ref={ref} className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => { setOpen(!open); setSearch(""); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        className={`flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm transition-all dark:bg-gray-900 ${
          open ? "border-accent-500 ring-2 ring-accent-500/20"
          : error ? "border-error-500"
          : "border-gray-300 hover:border-accent-400 dark:border-gray-700"
        }`}
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-gray-400" />}
        {selected.length === 0 ? (
          <span className="flex-1 text-left text-gray-400">{loading ? "Loading..." : placeholder}</span>
        ) : (
          selected.map((v) => (
            <span key={v} className="flex items-center gap-1 rounded-lg bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
              {options.find((o) => o.value === v)?.label ?? v.slice(-6)}
              <button type="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); toggle(v); }} className="text-accent-400 hover:text-error-500">
                <FaTimes className="size-2.5" />
              </button>
            </span>
          ))
        )}
        <FaChevronDown className={`ml-auto size-3 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180 text-accent-500" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 size-3 -translate-y-1/2 text-gray-400" />
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to search..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-accent-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Nothing found</div>
            ) : filtered.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                    checked ? "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}>
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-accent-500 bg-accent-500" : "border-gray-300 dark:border-gray-600"}`}>
                    {checked && <FaCheck className="size-2.5 text-white" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/30">
            <p className="text-xs text-gray-500">{selected.length} selected</p>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-error-500 hover:text-error-600">Clear all</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
