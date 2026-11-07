import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * `eyebrow` renders a small brand-tinted chip above the title. Pass `icon`
 * with it — the chip is a label, and the icon is what makes it scannable at a
 * glance next to the other section headings on the page.
 */
export function SectionHeading({
  title,
  description,
  eyebrow,
  icon,
  viewAllHref,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  viewAllHref?: string;
  /** Replaces the View All link — for a countdown or any other control. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        {eyebrow ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption font-semibold tracking-wide text-text-brand uppercase [&>svg]:size-4">
            {icon}
            {eyebrow}
          </span>
        ) : null}

        <h2 className="flex items-center gap-2.5 text-h2 font-semibold tracking-tight text-text-primary">
          {/* The rule is a short brand bar, not a full underline — it marks the
              heading's start without competing with the title itself. */}
          <span
            aria-hidden="true"
            className="h-7 w-1 shrink-0 rounded-full bg-brand-500"
          />
          {title}
        </h2>

        {/* pl-[26px] lines the copy up with the title, past the brand bar and
            its gap. */}
        {description ? (
          <p className="max-w-md pl-[26px] text-small text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>

      {action ??
        (viewAllHref ? (
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-4 py-2 text-small font-medium text-text-secondary shadow-xs transition-colors hover:border-border-strong hover:bg-bg-hover hover:text-text-primary"
          >
            View all
            <ArrowRightIcon className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        ) : null)}
    </div>
  );
}
