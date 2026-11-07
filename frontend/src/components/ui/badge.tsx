import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "danger" | "warning" | "info";
type Variant = "subtle" | "solid" | "outline";
type Size = "sm" | "md";

/* Mirrors Button: one BASE of shape and rhythm, a tone table, a size table.
   The three variants are the same six tones read three ways, so a badge can
   sit on a card, on an image, or inside a bordered row without a new colour. */
const BASE =
  "inline-flex items-center gap-1 rounded-sm font-medium whitespace-nowrap";

const SUBTLE: Record<Tone, string> = {
  neutral: "bg-bg-sunken text-text-secondary",
  brand: "bg-brand-100 text-brand-800",
  success: "bg-success-subtle text-success-text",
  danger: "bg-danger-subtle text-danger-text",
  warning: "bg-warning-subtle text-warning-text",
  info: "bg-info-subtle text-info-text",
};

const SOLID: Record<Tone, string> = {
  neutral: "bg-bg-inverse text-text-inverse",
  brand: "bg-brand-500 text-on-brand",
  success: "bg-success-solid text-white",
  danger: "bg-danger-solid text-white",
  warning: "bg-warning-solid text-white",
  info: "bg-info-solid text-white",
};

const OUTLINE: Record<Tone, string> = {
  neutral: "border border-border-default text-text-secondary",
  brand: "border border-border-brand text-text-brand",
  success: "border border-success-solid text-success-text",
  danger: "border border-danger-solid text-danger-text",
  warning: "border border-warning-solid text-warning-text",
  info: "border border-info-solid text-info-text",
};

const VARIANTS: Record<Variant, Record<Tone, string>> = {
  subtle: SUBTLE,
  solid: SOLID,
  outline: OUTLINE,
};

/* Heights match the two smallest Button steps, so a badge lines up beside a
   small button without adjustment. */
const SIZES: Record<Size, string> = {
  sm: "h-5 px-1.5 text-micro",
  md: "h-6 px-2 text-caption",
};

export function Badge({
  tone = "neutral",
  variant = "subtle",
  size = "md",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  /** Leading icon. Pass a 24-grid svg; sizing is handled here. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(BASE, VARIANTS[variant][tone], SIZES[size], className)}
    >
      {icon ? (
        <span
          className="flex shrink-0 [&>svg]:size-3"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/**
 * A coloured dot plus label, for stock and order state. Shares Badge's tone
 * names and type sizes but carries no fill — it reads as text, not a chip, so
 * it can sit inline in a card body without competing with a real badge.
 */
export function StatusDot({
  tone = "success",
  size = "md",
  children,
  className,
}: {
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  size?: Size;
  children: ReactNode;
  className?: string;
}) {
  const dot: Record<string, string> = {
    success: "bg-success-solid",
    danger: "bg-danger-solid",
    warning: "bg-warning-solid",
    info: "bg-info-solid",
    neutral: "bg-text-tertiary",
  };
  const text: Record<string, string> = {
    success: "text-success-text",
    danger: "text-danger-text",
    warning: "text-warning-text",
    info: "text-info-text",
    neutral: "text-text-tertiary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        size === "sm" ? "text-micro" : "text-caption",
        text[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dot[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
