import type { ReactNode } from "react";

export { Field } from "@/components/ui/field";

/**
 * The card every checkout block sits in. A numbered heading keeps the visual
 * order of the form readable at a glance without turning each block into a
 * separate route.
 */
export function CheckoutSection({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-micro font-semibold tabular text-text-secondary"
          >
            {step}
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-body font-semibold text-text-primary">{title}</h2>
            {description ? (
              <p className="text-caption text-text-secondary">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>

      {children}
    </section>
  );
}
