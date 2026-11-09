import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown } from "react-icons/fa";

const MENU_WIDTH = 200;
const MENU_HEIGHT = 300;

// Soft icon chip per action, same tones as the row action buttons elsewhere
const MENU_TONES = {
  view: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  neutral: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
  edit: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  danger: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

export function OptionsMenuItem({
  icon,
  children,
  onClick,
  disabled,
  tone = "neutral",
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: keyof typeof MENU_TONES;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`shine w-full flex items-center gap-2.5 px-2.5 py-2 max-md:py-2.5 rounded text-xs font-medium text-left transition-colors focus-visible:outline-none ${
        disabled
          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          : tone === "danger"
            ? "text-error-600 hover:bg-error-50 focus-visible:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/15 dark:focus-visible:bg-error-500/15"
            : "text-gray-700 dark:text-gray-200 hover:bg-accent-50 hover:text-accent-700 focus-visible:bg-accent-50 focus-visible:text-accent-700 dark:hover:bg-accent-500/15 dark:hover:text-accent-300 dark:focus-visible:bg-accent-500/15 dark:focus-visible:text-accent-300"
      }`}
    >
      <span className={`size-7 flex items-center justify-center rounded shrink-0 ${MENU_TONES[tone]} ${disabled ? "opacity-40" : ""}`}>
        {icon}
      </span>
      {children}
    </button>
  );
}

export const OptionsMenuSeparator = () => <div role="separator" className="my-1 h-px bg-gray-100 dark:bg-gray-700" />;

/**
 * The "Options" button of a table row. The table scrolls inside an overflow
 * container, which would clip an absolutely-positioned menu, so the menu is
 * fixed and placed from the button's position on screen. `run` closes the menu
 * and then does the action.
 */
export function OptionsMenu({
  label,
  children,
}: {
  label: string;
  children: (run: (action: () => void) => () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const flipUp = rect.bottom + MENU_HEIGHT > window.innerHeight;
      setPos({
        top: flipUp ? Math.max(8, rect.top - MENU_HEIGHT - 4) : rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    // Keyboard users land on the first item.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus({ preventScroll: true }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus({ preventScroll: true }); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus({ preventScroll: true }); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus({ preventScroll: true }); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className="shine flex items-center gap-1.5 h-9 max-md:h-11 px-3 rounded border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-all active:scale-95"
      >
        Options
        <FaChevronDown className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Portalled to <body> so no sticky cell or stacking context can paint over
          it; z-index sits above the sticky app header */}
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleMenuKeyDown}
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-[100000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden p-1"
        >
          {children(run)}
        </div>,
        document.body,
      )}
    </div>
  );
}
