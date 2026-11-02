import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function HeaderIconButton({
  href,
  label,
  slot,
  count,
  className,
  children,
}: {
  href: string;
  label: string;
  /** Names this control to HeaderActions' sliding indicator. */
  slot: string;
  count?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      data-slot={slot}
      className={cn(
        "group relative z-1 flex size-10 shrink-0 items-center justify-center rounded-sm transition-colors duration-200 ease-[var(--ease-hover)]",
        className,
      )}
    >
      <span
        className="text-text-secondary transition-[color,transform] duration-200 ease-[var(--ease-hover)] group-hover:scale-110 group-hover:text-text-primary [&>svg]:size-5"
        aria-hidden="true"
      >
        {children}
      </span>
      {typeof count === "number" ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-micro font-semibold text-on-brand ring-2 ring-bg-surface">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
