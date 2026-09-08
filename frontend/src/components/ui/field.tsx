import type { ReactNode } from "react";

/** Label + control + optional hint, so no call site repeats the wiring. */
export function Field({
  label,
  htmlFor,
  hint,
  action,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Sits opposite the label — a "Forgot password?" link, say. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="block text-caption font-medium text-text-secondary"
        >
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint ? <p className="mt-1.5 text-micro text-text-tertiary">{hint}</p> : null}
    </div>
  );
}
