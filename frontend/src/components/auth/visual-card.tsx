import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The white card every auth visual is built from. A shared shell so the five
 * mocks read as the same product, and so each visual file only carries what is
 * actually different about it.
 */
export function VisualCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_18px_40px_-16px_rgb(31_42_68/0.28)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A greyed bar standing in for text inside a mock. */
export function Line({ w = "w-full", tone = "muted" }: { w?: string; tone?: "muted" | "brand" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-2 rounded-full",
        w,
        tone === "brand" ? "bg-[var(--brand-200)]" : "bg-[#e8e5e1]",
      )}
    />
  );
}
