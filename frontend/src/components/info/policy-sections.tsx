import type { PolicySection } from "@/lib/policies";

/** A policy as numbered cards, one per topic */
export function PolicySections({ sections }: { sections: PolicySection[] }) {
  return (
    <ol className="max-w-3xl space-y-4">
      {sections.map((section, index) => (
        <li key={section.title} className="rounded-lg border border-border-default bg-bg-surface p-5 sm:p-6">
          <h2 className="flex items-center gap-3 text-h3 font-semibold text-text-primary">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-small font-semibold text-text-brand tabular">
              {index + 1}
            </span>
            {section.title}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-text-secondary marker:text-text-brand">
            {section.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
