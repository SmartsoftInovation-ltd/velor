import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiRefreshCw, FiX } from "react-icons/fi";

// Building blocks for the Platform Console pages (ECOMPOS style, accent green #0F9D63)

export const cardClass =
  "rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]";

export const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 focus:outline-none focus-visible:ring-3 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5";

export const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/15 read-only:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90";

export const ConsoleHeader = ({ crumbs, title, subtitle, actions }: {
  crumbs: { label: string; to?: string }[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-400">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-gray-300 dark:text-gray-600">·</span>}
            {crumb.to ? (
              <Link to={crumb.to} className="transition hover:text-accent-600">{crumb.label}</Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "text-gray-600 dark:text-gray-300" : ""}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-white/90">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

export const RefreshButton = ({ onClick, spinning }: { onClick: () => void; spinning?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Refresh"
    title="Refresh"
    className="inline-flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/5"
  >
    <FiRefreshCw className={`size-4 ${spinning ? "animate-spin" : ""}`} />
  </button>
);

export interface PillOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export const FilterPills = <T extends string>({ options, value, onChange }: {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          aria-label={option.count === undefined ? option.label : `${option.label} ${option.count}`}
          onClick={() => onChange(option.value)}
          className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
            active
              ? "bg-gray-900 text-white shadow-theme-xs dark:bg-white dark:text-gray-900"
              : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:bg-transparent dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${
                active ? "bg-white/20 text-white dark:bg-gray-900/10 dark:text-gray-900" : "bg-gray-100 text-gray-500 dark:bg-white/5"
              }`}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

const TONES = {
  gray: "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10",
  green: "bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25",
  red: "bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25",
  amber: "bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25",
};

export const IconAction = ({ label, icon, tone = "gray", to, onClick }: {
  label: string;
  icon: ReactNode;
  tone?: keyof typeof TONES;
  to?: string;
  onClick?: () => void;
}) => {
  const className = `inline-flex size-8 items-center justify-center rounded-lg text-[15px] transition ${TONES[tone]}`;
  return to ? (
    <Link to={to} aria-label={label} title={label} className={className}>{icon}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>{icon}</button>
  );
};

const AVATAR_TONES = [
  "from-accent-400 to-accent-600",
  "from-blue-light-400 to-blue-light-600",
  "from-orange-400 to-orange-600",
  "from-theme-purple-500 to-brand-600",
  "from-warning-400 to-warning-600",
  "from-theme-pink-500 to-error-500",
];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

// The seller's logo when `src` is given and loads, otherwise coloured initials
export const Avatar = ({ name, size = "md", src }: { name: string; size?: "md" | "lg"; src?: string }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const tone = AVATAR_TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  const dims = size === "lg" ? "size-14 rounded-2xl text-lg" : "size-10 rounded-xl text-sm";
  if (src && !broken) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900 ${dims}`}>
        <img src={src} alt={`${name} logo`} loading="lazy" onError={() => setBroken(true)} className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br font-semibold text-white ${dims} ${tone}`}>
      <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0_6px,transparent_6px_12px)]" />
      <span className="relative">{initials(name)}</span>
    </span>
  );
};

export const Chip = ({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gray" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
      tone === "green"
        ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    {children}
  </span>
);

export const Pagination = ({ page, pages, shown, total, noun, onChange }: {
  page: number;
  pages: number;
  shown: number;
  total: number;
  noun: string;
  onChange: (page: number) => void;
}) => {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const nav = "inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5";
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
      <p className="text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium text-gray-800 dark:text-gray-200">{shown}</span> of{" "}
        <span className="font-medium text-gray-800 dark:text-gray-200">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={nav} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <FiChevronLeft className="size-4" />Prev
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
            className={`size-8 rounded-lg text-sm font-semibold tabular-nums transition ${
              n === page ? "bg-accent-500 text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)]" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            }`}
          >
            {n}
          </button>
        ))}
        <button type="button" className={nav} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next<FiChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
};

export const Modal = ({ title, description, icon, onClose, children, width = "max-w-lg" }: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) => {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-99999 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`no-scrollbar relative max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-theme-xl sm:rounded-3xl dark:bg-gray-900 ${width}`}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
          {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-lg text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white/90">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5">
            <FiX className="size-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export interface SelectOption {
  value: string;
  label: string;
  /** Shown right-aligned and dimmed — a price, a count, a hint */
  meta?: string;
}

/**
 * A select whose menu this app draws itself.
 *
 * A native <select> renders its option list with the operating system, so the
 * panel keeps square corners, the OS highlight colour and a white background
 * in dark mode however the closed control is styled — none of it reachable
 * from CSS. The list here is ordinary markup, so it matches the rest of the
 * console, and it keeps the keyboard behaviour people expect from a select:
 * arrows move, Enter and Space choose, Escape closes, Home and End jump.
 */
export const Select = ({ id, value, onChange, options, placeholder = "Select…", icon, disabled }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? null;

  // Clicking anywhere else closes it, the way a native menu behaves
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Opening lands on the current choice, and the highlight is always in view
  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === value);
    setActive(index < 0 ? 0 : index);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (disabled) return;
    if (!open && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative min-w-0">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900 ${
          open
            ? "border-accent-400 ring-3 ring-accent-500/15"
            : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
        }`}
      >
        {icon && <span className="flex size-4 shrink-0 items-center justify-center text-gray-400">{icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-gray-800 dark:text-white/90" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.meta && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">{selected.meta}</span>
        )}
        <FiChevronDown className={`size-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-activedescendant={`${listId}-${active}`}
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Nothing to choose</li>}
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(index)}
                onPointerMove={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  index === active ? "bg-accent-50 dark:bg-accent-500/15" : ""
                } ${isSelected ? "font-medium text-accent-700 dark:text-accent-300" : "text-gray-700 dark:text-gray-300"}`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.meta && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{option.meta}</span>
                )}
                <FiCheck className={`size-4 shrink-0 text-accent-600 ${isSelected ? "" : "invisible"}`} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const Field = ({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
);

export const EmptyState = ({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-50 text-2xl text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">{icon}</span>
    <p className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</p>
    <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{text}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const formatDate = (value: string | null | undefined, withTime = false) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";

// What happened to the owner's sign-in details after a create or password change
export const CredentialsNoticeLine = ({ notice, owner }: {
  notice: { channel: "sms" | null; sent: boolean };
  owner: { phone: string };
}) => {
  const { channel, sent } = notice;
  const tone = sent
    ? "border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-400"
    : "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400";
  const text = sent
    ? `Sign-in details sent by SMS to ${owner.phone}.`
    : channel
      ? "Could not send the sign-in details by SMS. Send them to the owner yourself."
      : "Platform SMS is not set up, so nothing was sent. Send these details to the owner yourself.";
  return <p role="status" className={`rounded-xl border px-3.5 py-2.5 text-sm ${tone}`}>{text}</p>;
};
