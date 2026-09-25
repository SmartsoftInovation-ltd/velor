import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaCheck, FaSearch } from "react-icons/fa";
import { MdAccountBalance, MdPhoneAndroid } from "react-icons/md";
import { BsCashCoin } from "react-icons/bs";

export interface AccountOption {
  _id: string;
  name: string;
  balance?: number;
}

interface AccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // "sm" matches the dense POS payment column; "md" matches the taller rounded
  // form fields used on the sales-return page.
  size?: "sm" | "md";
  // Which side the panel opens on.
  placement?: "top" | "bottom";
}

const accountIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("bkash") || n.includes("nagad") || n.includes("rocket") || n.includes("mobile"))
    return MdPhoneAndroid;
  if (n.includes("bank") || n.includes("cheque") || n.includes("card")) return MdAccountBalance;
  return BsCashCoin;
};

const accountTone = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("bkash") || n.includes("nagad") || n.includes("rocket") || n.includes("mobile"))
    return "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400";
  if (n.includes("bank") || n.includes("cheque") || n.includes("card"))
    return "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400";
  return "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400";
};

// Custom account picker for the POS payment box. A native <select> can't be
// themed, can't show a per-account icon/balance, and can't be searched — this
// renders its own panel in a portal so it escapes the payment column's
// scroll/overflow clipping and stays on top inside modals.
const AccountSelect = ({
  accounts,
  value,
  onChange,
  placeholder = "Payment To",
  disabled,
  className,
  size = "sm",
  placement = "top",
}: AccountSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = accounts.find((a) => a._id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, query]);

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
      const idx = filtered.findIndex((a) => a._id === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      const id = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
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
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt._id);
    }
  };

  const SelectedIcon = accountIcon(selected?.name || "");

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
              ? "cursor-pointer border-accent-500 bg-white ring-2 ring-accent-500/20 dark:bg-gray-800"
              : "cursor-pointer border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800"
        }`}
      >
        {selected && (
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded ${accountTone(
              selected.name,
            )}`}
          >
            <SelectedIcon className="size-2.5" />
          </span>
        )}
        <span
          className={`flex-1 truncate text-left font-semibold ${
            selected ? "text-gray-800 dark:text-white" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {selected ? selected.name : placeholder}
        </span>
        {selected?.balance !== undefined && (
          <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            ৳{Number(selected.balance).toFixed(0)}
          </span>
        )}
        <FaChevronDown
          className={`size-2.5 shrink-0 text-gray-400 transition-transform ${
            open
              ? `text-accent-500 ${placement === "bottom" ? "rotate-180" : "-rotate-180"}`
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
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
              <FaSearch className="size-2.5 shrink-0 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search account..."
                className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
              />
            </div>

            <div className="no-scrollbar overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-gray-400">No account found</p>
              )}
              {filtered.map((a, idx) => {
                const Icon = accountIcon(a.name);
                const isSelected = a._id === value;
                return (
                  <button
                    key={a._id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(a._id)}
                    className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors ${
                      idx === activeIndex
                        ? "bg-accent-50 dark:bg-accent-500/15"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md ${accountTone(
                        a.name,
                      )}`}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        isSelected
                          ? "font-bold text-accent-700 dark:text-accent-400"
                          : "font-semibold text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {a.name}
                    </span>
                    {a.balance !== undefined && (
                      <span
                        className={`shrink-0 text-[10px] font-bold ${
                          Number(a.balance) < 0
                            ? "text-red-500"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        ৳{Number(a.balance).toFixed(2)}
                      </span>
                    )}
                    {isSelected && <FaCheck className="size-2.5 shrink-0 text-accent-600" />}
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

export default AccountSelect;
