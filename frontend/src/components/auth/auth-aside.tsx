import type { ReactNode } from "react";

/**
 * The right half of every auth screen: one illustration of what this step
 * does, and a short line under it. Kept quiet on purpose — a soft brand tint,
 * a faint dot grid for texture, no blobs — so the form stays the subject.
 *
 * The ground is the brand's quietest tint, which the token layer keeps light
 * in both themes' spirit; the type uses the semantic text tokens.
 */
export function AuthAside({
  headline,
  script,
  note,
  visual,
}: {
  headline: string;
  script: string;
  note: string;
  visual: ReactNode;
}) {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-50 lg:flex lg:flex-col">
      {/* A dot grid, faded toward the edges, gives the flat ground a surface */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-brand-200)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
      />

      {/* Illustration and its caption as one centred group */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-12 py-16">
        <div className="flex w-full max-w-md justify-center">{visual}</div>
        <div className="mt-10 max-w-sm text-center">
          <p className="text-h2 font-semibold tracking-tight text-text-primary">
            {headline} <span className="text-text-brand">{script}</span>
          </p>
          <p className="mt-2 text-small text-text-secondary">{note}</p>
        </div>
      </div>
    </aside>
  );
}
