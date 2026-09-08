import { cn } from "@/lib/cn";

const STEPS = ["Information", "Delivery", "Payment", "Review"] as const;

/**
 * A static progress rail. There is no wizard state anywhere — the current step
 * is a prop so the page can position it, nothing advances it.
 */
export function CheckoutSteps({ current = 2 }: { current?: number }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;

          return (
            <li key={label} className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span
                aria-current={active ? "step" : undefined}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold tabular transition-colors duration-150",
                    done && "bg-success-solid text-white",
                    active && "bg-brand-500 text-white shadow-brand",
                    !done && !active && "bg-bg-sunken text-text-tertiary",
                  )}
                >
                  {done ? "✓" : step}
                </span>
                <span
                  className={cn(
                    "hidden text-caption font-medium sm:inline",
                    active ? "text-text-primary" : "text-text-tertiary",
                  )}
                >
                  {label}
                </span>
              </span>

              {step < STEPS.length ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-4 shrink-0 sm:w-8",
                    done ? "bg-success-solid" : "bg-border-default",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
