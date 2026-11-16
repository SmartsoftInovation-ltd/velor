"use client";

/** Minus, the count, plus. Stays between 1 and `max`. `compact` is the size for a tight row. */
export function QuantityStepper({
  value,
  max,
  onChange,
  compact = false,
  disabled = false,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const step =
    (compact ? "size-8" : "size-11") +
    " flex items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:hover:bg-transparent";

  return (
    <div className={`inline-flex items-center rounded-md border border-border-default ${compact ? "h-8" : "h-11"}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
        className={`${step} rounded-l-md`}
      >
        −
      </button>
      <span className={`text-center font-medium tabular ${compact ? "w-8 text-small" : "w-10 text-body"}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={`${step} rounded-r-md`}
      >
        +
      </button>
    </div>
  );
}
