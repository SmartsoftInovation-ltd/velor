import { Panel, Section, TokenName } from "./section";

/* Tailwind's default 4px-based scale. These six carry almost every layout in
   an ecommerce UI; reach past them only when a design genuinely demands it. */
const SPACING = [
  ["1", "4px", "Icon to label"],
  ["2", "8px", "Inside a chip"],
  ["3", "12px", "Between buttons"],
  ["4", "16px", "Card padding"],
  ["6", "24px", "Section gap"],
  ["8", "32px", "Block gap"],
] as const;

export function Spacing() {
  return (
    <Section
      title="Spacing & avatars"
      description="A 4px base grid. Sticking to these steps is what makes unrelated components line up without anyone measuring — the value of a scale is that it is short."
    >
      <Panel className="space-y-3">
        {SPACING.map(([step, px, use]) => (
          <div key={step} className="flex items-center gap-4">
            <code className="w-14 shrink-0 font-mono text-micro text-text-tertiary">
              {step}
            </code>
            {/* Inline width: a genuinely dynamic value, so not a utility. */}
            <div className="h-3 rounded-xs bg-brand-300" style={{ width: px }} />
            <span className="text-caption text-text-tertiary tabular">{px}</span>
            <span className="text-caption text-text-tertiary">{use}</span>
          </div>
        ))}
      </Panel>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          {[
            ["size-6 text-micro", "24px"],
            ["size-8 text-caption", "32px"],
            ["size-10 text-small", "40px"],
          ].map(([cls, label]) => (
            <div key={label} className="space-y-2 text-center">
              <span
                className={`inline-flex items-center justify-center rounded-full bg-brand-100 font-medium text-brand-800 ${cls}`}
                aria-hidden="true"
              >
                TZ
              </span>
              <p className="text-caption text-text-tertiary">{label}</p>
            </div>
          ))}

          <div className="space-y-2 text-center">
            {/* Negative margin overlaps the stack; the ring re-cuts each edge. */}
            <div className="flex -space-x-2">
              {["AM", "JR", "KP"].map((initials) => (
                <span
                  key={initials}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-brand-100 text-caption font-medium text-brand-800 ring-2 ring-bg-surface"
                  aria-hidden="true"
                >
                  {initials}
                </span>
              ))}
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-bg-sunken text-caption font-medium text-text-secondary ring-2 ring-bg-surface">
                +5
              </span>
            </div>
            <p className="text-caption text-text-tertiary">Stack</p>
          </div>
        </div>
        <TokenName>rounded-full · bg-brand-100 · text-brand-800</TokenName>
      </Panel>
    </Section>
  );
}
