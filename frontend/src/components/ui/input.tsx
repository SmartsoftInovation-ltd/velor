import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Focus is a single 1px brand border — no outline, no glow ring. The border
 * colour swaps in place, so the control never changes size on focus.
 */
export function Input({
  className,
  icon,
  ...props
}: { icon?: ReactNode } & ComponentProps<"input">) {
  const field = (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border-default bg-bg-surface text-body text-text-primary shadow-xs transition-colors duration-150 ease-out",
        icon ? "pr-3 pl-10" : "px-3",
        "placeholder:text-text-tertiary hover:border-border-strong",
        // focus-visible, not focus: it must also win over the hover rule above,
        // which has equal specificity and comes first in source order.
        "focus-visible:border-border-brand focus-visible:shadow-none focus-visible:outline-none focus-visible:hover:border-border-brand",
        "disabled:cursor-not-allowed disabled:bg-bg-sunken disabled:text-text-disabled disabled:hover:border-border-default",
        className,
      )}
      {...props}
    />
  );

  if (!icon) return field;

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary [&>svg]:size-4"
        aria-hidden="true"
      >
        {icon}
      </span>
      {field}
    </div>
  );
}
