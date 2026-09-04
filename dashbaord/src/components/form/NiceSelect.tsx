import { useEffect, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";

interface Option {
  value: string;
  label: string;
}

interface NiceSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Custom-styled dropdown for short, non-searchable option lists. Native
// <select> option lists are OS-rendered and can't be themed — this renders
// its own panel so filter dropdowns look consistent across browsers.
const NiceSelect = ({ options, value, onChange, placeholder = "Select..." }: NiceSelectProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all duration-150 ${
          open
            ? "border-brand-500 bg-white ring-2 ring-brand-500/20 dark:bg-gray-900"
            : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900"
        }`}
      >
        <span className={selected ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <FaChevronDown
          className={`size-2.5 shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180 text-brand-500" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors duration-100 ${
                opt.value === value
                  ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="size-1.5 rounded-full bg-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NiceSelect;
