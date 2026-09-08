/**
 * The 404 illustration: a big 404 with a drifting parcel wedged in the middle,
 * over a pulsing glow. Inline SVG rather than an asset so it inherits the
 * theme's tokens instead of shipping two PNGs.
 */
export function LostParcel() {
  return (
    <div className="relative flex items-center justify-center">
      <span
        aria-hidden="true"
        className="animate-glow-pulse absolute size-56 rounded-full bg-brand-500/25 blur-3xl sm:size-72"
      />

      <div className="relative flex items-center justify-center gap-1 sm:gap-3">
        <Digit delay="-0.4s" duration="3.6s">
          4
        </Digit>

        <span
          aria-hidden="true"
          className="animate-float-y"
          style={{ animationDelay: "-2s", animationDuration: "4.4s" }}
        >
          <span className="animate-spin-ease block [animation-delay:-1s]">
            <ParcelGlyph />
          </span>
        </span>

        <Digit delay="-3.1s" duration="5.2s">
          4
        </Digit>
      </div>
    </div>
  );
}

/**
 * A negative `animation-delay` starts the loop already part-way through, and a
 * different duration per glyph keeps them from holding a fixed phase — so the
 * three elements drift independently instead of rising and falling as one.
 * Both are genuinely dynamic values, hence inline styles rather than
 * interpolated Tailwind classes.
 */
function Digit({
  children,
  delay,
  duration,
}: {
  children: string;
  delay: string;
  duration: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ animationDelay: delay, animationDuration: duration }}
      className="animate-float-y bg-gradient-to-b from-text-primary to-text-tertiary bg-clip-text text-[5.5rem] leading-none font-bold tracking-tight text-transparent select-none sm:text-[8rem]"
    >
      {children}
    </span>
  );
}

function ParcelGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-20 text-brand-500 drop-shadow-lg sm:size-28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"
        className="fill-brand-500/10"
      />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      {/* A taped seam, so the box reads as sealed rather than as a cube. */}
      <path d="m7.5 4.5 8.7 5" className="opacity-60" />
    </svg>
  );
}
