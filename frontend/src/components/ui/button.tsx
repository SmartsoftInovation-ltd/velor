import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "subtle" | "danger" | "onBrand";
type Size = "sm" | "md" | "lg";

/* `shine` parks a gradient band off the left edge and sweeps it across on
   hover — see globals.css. `isolation` there keeps it above the fill but
   below the label, so text never dims. */
const BASE =
  "shine relative inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-hover)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

/* Every variant carries a real background — no transparent buttons. A control
   that only appears on hover reads as text, not as something clickable. */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-brand hover:bg-brand-600 active:bg-brand-700",
  secondary:
    "border border-border-default bg-bg-surface text-text-primary shadow-xs hover:border-border-strong hover:bg-bg-hover",
  subtle:
    "shine-dark bg-bg-sunken text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  danger:
    "bg-danger-solid text-white shadow-xs hover:brightness-95 active:brightness-90",
  /* For a white control sitting on a brand or photographic fill. The surface
     is white in both themes, so the label is a fixed primitive rather than a
     text token — `text-brand` flips to a light orange in dark mode and would
     vanish here. */
  onBrand:
    "shine-dark bg-white text-[var(--orange-700)] shadow-md hover:bg-white/90",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-small",
  md: "h-10 px-4 text-body",
  lg: "h-12 px-5 text-body",
};

/* Icon-only buttons stay square rather than inheriting the text padding. */
const ICON_SIZES: Record<Size, string> = {
  sm: "size-8 px-0",
  md: "size-10 px-0",
  lg: "size-12 px-0",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  fullWidth = false,
  className,
  children,
  type = "button",
  ...props
}: {
  variant?: Variant;
  size?: Size;
  /** Leading icon. Pass a 16px svg; sizing is handled here. */
  icon?: ReactNode;
  /** Trailing icon — for chevrons and arrows. */
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
} & ComponentProps<"button">) {
  const iconOnly = !children;

  return (
    <button
      type={type}
      className={cn(
        BASE,
        VARIANTS[variant],
        iconOnly ? ICON_SIZES[size] : SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children ? <span className="relative z-2">{children}</span> : null}
      {iconEnd ? (
        <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}
