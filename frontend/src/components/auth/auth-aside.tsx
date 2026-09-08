import type { ReactNode } from "react";

/**
 * The right half of every auth card. It is not decoration: each screen passes
 * its own `visual`, a small mock of what that step actually does — the account
 * you sign into, the code in flight, the timer running down. Someone who lands
 * mid-flow can read the panel and know where they are.
 *
 * The panel keeps one fixed peach ground in both themes, and its type is set
 * in fixed ink to match, because the mocks inside it are lit from one side.
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
    <aside className="relative hidden min-h-[36rem] flex-col justify-between overflow-hidden bg-[#fdf1e6] p-10 lg:flex">
      {/* Two soft washes give the flat ground some depth without an image. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/45 blur-2xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-[var(--orange-200)]/45 blur-2xl"
      />

      <div className="relative z-1 space-y-0.5">
        <p className="text-h2 font-semibold tracking-tight text-[#1f2a44]">
          {headline}
        </p>
        <p className="text-h1 font-semibold text-brand-500 italic">{script}</p>
        <svg viewBox="0 0 180 12" aria-hidden="true" className="h-3 w-44 text-brand-500">
          <path
            d="M4 8c40-6 92-8 172-4"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <p className="max-w-xs pt-3 text-small text-[#5b5348]">{note}</p>
      </div>

      <div className="relative z-1 flex flex-1 items-center justify-center py-8">
        {visual}
      </div>
    </aside>
  );
}
