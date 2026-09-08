import type { ReactNode } from "react";

/** Shared heading + description wrapper for every design-system section. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-h2 font-semibold text-text-primary">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-body text-text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Monospace token name, shown under every swatch and sample. */
export function TokenName({ children }: { children: ReactNode }) {
  return (
    <code className="block font-mono text-micro text-text-tertiary">
      {children}
    </code>
  );
}

/** A bordered panel — the standard container for a group of samples. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-surface p-6 ${className}`}
    >
      {children}
    </div>
  );
}
