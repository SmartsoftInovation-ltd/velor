import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The rhythm every home section shares: one page gutter, one vertical step.
 * `muted` tints the full-bleed band behind the container so two neighbouring
 * sections read as separate bands without a divider line.
 */
export function Section({
  muted = false,
  className,
  children,
}: {
  muted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(muted && "bg-bg-sunken", className)}>
      <div className="container py-12 sm:py-16">{children}</div>
    </section>
  );
}
