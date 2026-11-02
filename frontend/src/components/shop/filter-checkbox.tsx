import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * One checkbox-shaped row, built from a link: the whole filter state lives in
 * the URL, so an option is just a href to the next state. A real <input> would
 * need client JS to do exactly the same navigation.
 */
export function FilterCheckbox({
  href,
  label,
  checked,
  count,
}: {
  href: string;
  label: string;
  checked: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-pressed={checked}
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-small text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors duration-150",
          checked
            ? "border-brand-500 bg-brand-500 text-on-brand"
            : "border-border-default group-hover:border-border-strong",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="size-3" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>

      <span className={cn("flex-1", checked && "font-medium text-text-primary")}>
        {label}
      </span>

      {count === undefined ? null : (
        <span className="text-caption text-text-tertiary tabular">{count}</span>
      )}
    </Link>
  );
}
