import type { ReactNode } from "react";

/**
 * The frame every account section shares: an icon tile, title and one-line
 * note, an optional action on the right (Edit, Change), then the body.
 */
export function AccountCard({
  id,
  icon,
  title,
  note,
  action,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  note: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border-subtle bg-bg-surface shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-text-brand [&>svg]:size-5">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={id} className="text-body font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-0.5 text-caption text-text-tertiary">{note}</p>
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
