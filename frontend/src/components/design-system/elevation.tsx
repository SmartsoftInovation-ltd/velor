import { Section, TokenName } from "./section";

const RADII = [
  ["rounded-xs", "4px", "Focus ring"],
  ["rounded-sm", "6px", "Badges"],
  ["rounded-md", "8px", "Buttons, inputs"],
  ["rounded-lg", "12px", "Cards, panels"],
  ["rounded-xl", "16px", "Modals"],
  ["rounded-full", "999px", "Avatars, dots"],
] as const;

const SHADOWS = [
  ["shadow-xs", "Resting borders"],
  ["shadow-sm", "Cards"],
  ["shadow-md", "Hovered cards"],
  ["shadow-lg", "Dropdowns"],
  ["shadow-xl", "Modals"],
  ["shadow-brand", "Primary button"],
] as const;

export function RadiusAndElevation() {
  return (
    <Section
      title="Radius & elevation"
      description="Radius climbs with the size of the surface. Every shadow — shadow-brand included — is tinted with the neutral hue, never the brand: a coloured shadow reads as a glow and muddies the edge it sits under."
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {RADII.map(([cls, px, use]) => (
          <div key={cls} className="space-y-2">
            <div className={`h-16 border-2 border-border-brand bg-brand-100 ${cls}`} />
            <TokenName>{cls}</TokenName>
            <p className="text-caption text-text-tertiary">
              {px} · {use}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 rounded-lg bg-bg-canvas p-8 sm:grid-cols-3">
        {SHADOWS.map(([cls, use]) => (
          <div key={cls} className="space-y-2">
            <div
              className={`flex h-20 items-center justify-center rounded-lg bg-bg-surface ${cls}`}
            >
              <span className="text-caption text-text-tertiary">{use}</span>
            </div>
            <TokenName>{cls}</TokenName>
          </div>
        ))}
      </div>
    </Section>
  );
}
