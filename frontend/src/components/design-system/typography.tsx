import { Panel, Section, TokenName } from "./section";

const SCALE = [
  ["text-display", "font-semibold", "Display", "40 / 1.1 / -0.03em"],
  ["text-h1", "font-semibold", "Heading 1", "32 / 1.15 / -0.02em"],
  ["text-h2", "font-semibold", "Heading 2", "24 / 1.25 / -0.02em"],
  ["text-h3", "font-semibold", "Heading 3", "19 / 1.3 / -0.01em"],
  ["text-body", "font-normal", "Body", "15 / 1.6"],
  ["text-small", "font-normal", "Small", "13 / 1.5"],
  ["text-caption", "font-normal", "Caption", "12 / 1.4"],
  ["text-micro", "font-medium", "Micro", "11 / 1.4 / +0.02em"],
] as const;

const WEIGHTS = [
  ["font-normal", "400 Regular", "Body copy"],
  ["font-medium", "500 Medium", "Buttons, labels"],
  ["font-semibold", "600 Semibold", "Headings"],
] as const;

export function TypeScale() {
  return (
    <Section
      title="Typography"
      description="Geist, eight steps. Line-height and letter-spacing are bound to every step — set a size and the rhythm comes with it, so you never need a matching leading- or tracking- utility. Larger text tightens, smaller text opens up."
    >
      <Panel className="divide-y divide-border-subtle p-0">
        {SCALE.map(([size, weight, label, meta]) => (
          <div
            key={size}
            className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-6 py-4"
          >
            <p className={`${size} ${weight} min-w-0 truncate text-text-primary`}>
              {label}
            </p>
            <div className="flex shrink-0 items-baseline gap-4">
              <span className="text-caption text-text-tertiary tabular">{meta}</span>
              <TokenName>{size}</TokenName>
            </div>
          </div>
        ))}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        {WEIGHTS.map(([cls, label, use]) => (
          <Panel key={cls} className="space-y-1">
            <p className={`text-h3 ${cls} text-text-primary`}>{label}</p>
            <p className="text-caption text-text-tertiary">{use}</p>
            <TokenName>{cls}</TokenName>
          </Panel>
        ))}
      </div>
    </Section>
  );
}
