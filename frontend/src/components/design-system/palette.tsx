import { Panel, Section, TokenName } from "./section";

function Swatch({
  className,
  name,
  note,
  height = "h-16",
}: {
  className: string;
  name: string;
  note?: string;
  height?: string;
}) {
  return (
    <div className="space-y-2">
      <div
        className={`${height} rounded-md border border-border-subtle ${className}`}
      />
      <div className="space-y-0.5">
        <TokenName>{name}</TokenName>
        {note ? <p className="text-caption text-text-tertiary">{note}</p> : null}
      </div>
    </div>
  );
}

/* Written as complete class strings: Tailwind scans source text, so an
   interpolated `bg-brand-${step}` generates nothing. */
const BRAND = [
  ["bg-brand-50", "brand-50"],
  ["bg-brand-100", "brand-100"],
  ["bg-brand-200", "brand-200"],
  ["bg-brand-300", "brand-300"],
  ["bg-brand-400", "brand-400"],
  ["bg-brand-500", "brand-500"],
  ["bg-brand-600", "brand-600"],
  ["bg-brand-700", "brand-700"],
  ["bg-brand-800", "brand-800"],
  ["bg-brand-900", "brand-900"],
] as const;

export function BrandPalette() {
  return (
    <Section
      title="Brand"
      description="#FC630A is the one value kept from the original file — everything else in this system was rebuilt around it. The ramp inverts under the dark theme, so brand-100 is always the quiet tint and brand-800 always the loud one. Write it once; never reach for a dark: variant."
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {BRAND.map(([cls, name]) => (
          <Swatch
            key={name}
            className={cls}
            name={name}
            note={name === "brand-500" ? "Primary" : undefined}
          />
        ))}
      </div>

      <Panel className="flex flex-wrap items-center gap-6">
        <div className="space-y-1">
          <p className="text-h3 font-semibold text-text-brand">Brand text</p>
          <TokenName>text-brand</TokenName>
        </div>
        <div className="space-y-1">
          <div className="h-10 w-32 rounded-md bg-brand-500 shadow-brand" />
          <TokenName>shadow-brand</TokenName>
        </div>
        <div className="space-y-1">
          <div className="h-10 w-32 rounded-md border-2 border-border-brand" />
          <TokenName>border-brand</TokenName>
        </div>
      </Panel>
    </Section>
  );
}

const SURFACES = [
  ["bg-bg-canvas", "bg-canvas", "Page ground"],
  ["bg-bg-surface", "bg-surface", "Cards, panels"],
  ["bg-bg-elevated", "bg-elevated", "Menus, modals"],
  ["bg-bg-sunken", "bg-sunken", "Wells, inputs"],
  ["bg-bg-hover", "bg-hover", "Hover state"],
  ["bg-bg-inverse", "bg-inverse", "Inverted blocks"],
] as const;

const TEXT = [
  ["text-text-primary", "text-primary", "Headings, body"],
  ["text-text-secondary", "text-secondary", "Supporting copy"],
  ["text-text-tertiary", "text-tertiary", "Meta, captions"],
  ["text-text-disabled", "text-disabled", "Disabled state"],
] as const;

export function NeutralPalettes() {
  return (
    <Section
      title="Surfaces & text"
      description="A warm neutral ramp, not a pure grey. Every step carries a trace of the brand hue, which is what stops orange reading cold against it — the single most important decision in this palette."
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {SURFACES.map(([cls, name, note]) => (
          <Swatch key={name} className={cls} name={name} note={note} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEXT.map(([cls, name, note]) => (
          <Panel key={name} className="space-y-2">
            <p className={`text-h2 font-semibold ${cls}`}>Aa</p>
            <TokenName>{name}</TokenName>
            <p className="text-caption text-text-tertiary">{note}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Swatch className="bg-border-subtle" name="border-subtle" note="Dividers" height="h-12" />
        <Swatch className="bg-border-default" name="border-default" note="Cards, inputs" height="h-12" />
        <Swatch className="bg-border-strong" name="border-strong" note="Emphasis, hover" height="h-12" />
      </div>
    </Section>
  );
}

const STATUS = [
  ["success", "In stock", "bg-success-subtle", "text-success-text", "bg-success-solid"],
  ["danger", "Out of stock", "bg-danger-subtle", "text-danger-text", "bg-danger-solid"],
  ["warning", "Low stock", "bg-warning-subtle", "text-warning-text", "bg-warning-solid"],
  ["info", "Pre-order", "bg-info-subtle", "text-info-text", "bg-info-solid"],
] as const;

export function StatusPalette() {
  return (
    <Section
      title="Status"
      description="Four states, each a trio: a subtle tint for backgrounds, a solid for dots and fills, and a text colour that clears 4.5:1 on its own tint. Always pair -text with its matching -subtle; on any other ground the contrast is unverified."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS.map(([name, label, subtle, text, solid]) => (
          <div
            key={name}
            className={`space-y-3 rounded-lg border border-border-subtle p-5 ${subtle}`}
          >
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${solid}`} aria-hidden="true" />
              <span className={`text-body font-medium ${text}`}>{label}</span>
            </div>
            <TokenName>{`${name}-subtle / -text / -solid`}</TokenName>
          </div>
        ))}
      </div>
    </Section>
  );
}
