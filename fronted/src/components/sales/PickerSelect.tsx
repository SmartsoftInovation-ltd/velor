import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaCheck, FaSearch } from "react-icons/fa";
import type { IconType } from "react-icons";

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: IconType;
  tone?: string;
}

interface PickerSelectProps {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  // "sm" matches the dense POS bottom bar; "md" matches the taller rounded
  // form fields used on the sales-return page.
  size?: "sm" | "md";
  // Which side the panel opens on.
  placement?: "top" | "bottom";
}

// Generic themed dropdown for the POS bottom bar. Same behaviour as
// AccountSelect (portal panel, keyboard nav, opens upward) but with
// free-form options so it can drive salesman, invoice status, and similar.
const PickerSelect = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchable = false,
  disabled,
  className,
  size = "sm",
  placement = "top",
}: PickerSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel || "").toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const common = { position: "fixed" as const, left: rect.left, width: rect.width };
      // Default is upward: these sit low on the POS screen, where a downward
      // list would fall off the viewport. Forms higher up pass placement="bottom".
      setPanelStyle(
        placement === "bottom"
          ? { ...common, top: rect.bottom + 4, maxHeight: Math.max(160, Math.min(300, spaceBelow - 12)) }
          : { ...common, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.max(160, Math.min(300, rect.top - 12)) },
      );
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, filtered.length, placement]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = filtered.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      if (searchable) {
        const id = window.setTimeout(() => searchRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length ? (i - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt.value);
    }
  };

  const SelectedIcon = selected?.icon;

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center gap-1.5 border text-xs transition-colors ${
          size === "md" ? "h-10 rounded-xl px-3.5" : "h-7 rounded-md px-2"
        } ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-700"
            : open
              ? "cursor-pointer border-teal-500 bg-white ring-2 ring-teal-500/20 dark:bg-gray-800"
              : "cursor-pointer border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800"
        }`}
      >
        {SelectedIcon && (
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded ${
              selected?.tone ??
              "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
            }`}
          >
            <SelectedIcon className="size-2.5" />
          </span>
        )}
        <span
          className={`flex-1 truncate text-left font-semibold ${
            selected
              ? "text-gray-800 dark:text-white"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        {selected?.badge && (
          <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {selected.badge}
          </span>
        )}
        <FaChevronDown
          className={`size-2.5 shrink-0 text-gray-400 transition-transform ${
            open
              ? `text-teal-500 ${placement === "bottom" ? "rotate-180" : "-rotate-180"}`
              : ""
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            onKeyDown={handleKeyDown}
            className="z-[99999] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            {searchable && (
              <div className="flex items-center gap-1.5 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
                <FaSearch className="size-2.5 shrink-0 text-gray-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="Search..."
                  className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
                />
              </div>
            )}

            <div className="no-scrollbar overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-gray-400">
                  Nothing found
                </p>
              )}
              {filtered.map((o, idx) => {
                const Icon = o.icon;
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value || `opt-${idx}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(o.value)}
                    className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors ${
                      idx === activeIndex
                        ? "bg-teal-50 dark:bg-teal-500/10"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {Icon && (
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
                          o.tone ??
                          "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                        }`}
                      >
                        <Icon className="size-3" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${
                          isSelected
                            ? "font-bold text-teal-700 dark:text-teal-300"
                            : "font-semibold text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {o.label}
                      </span>
                      {o.sublabel && (
                        <span className="block truncate text-[10px] text-gray-400 dark:text-gray-500">
                          {o.sublabel}
                        </span>
                      )}
                    </span>
                    {o.badge && (
                      <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                        {o.badge}
                      </span>
                    )}
                    {isSelected && (
                      <FaCheck className="size-2.5 shrink-0 text-teal-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default PickerSelect;
