import { TruckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { PrimaryNav } from "./primary-nav";

/**
 * The catalogue row under the header. `tone` picks the band behind it, and the
 * nav's own colours follow from `data-nav-tone` — see globals.css. Compare the
 * four at /design-system/nav-tones.
 */
export type NavTone = "surface" | "sunken" | "brand" | "inverse";

const BANDS: Record<NavTone, string> = {
  surface: "border-t border-border-subtle bg-bg-surface",
  sunken: "border-t border-border-subtle bg-bg-sunken",
  brand: "bg-brand-500",
  inverse: "bg-bg-inverse",
};

// The delivery note is a chip, so it needs its own ground per band — a tint
// that reads on sand looks muddy on the brand and inverse rows.
const NOTES: Record<NavTone, string> = {
  surface: "bg-brand-50 text-brand-600",
  sunken: "bg-brand-50 text-brand-600",
  brand: "bg-white/15 text-white",
  inverse: "bg-white/10 text-text-inverse",
};

const DIVIDERS: Record<NavTone, string> = {
  surface: "bg-border-subtle",
  sunken: "bg-border-subtle",
  brand: "bg-white/25",
  inverse: "bg-white/15",
};

export function NavBar({
  tone = "surface",
  className,
}: {
  tone?: NavTone;
  className?: string;
}) {
  return (
    <div data-nav-tone={tone} className={cn(BANDS[tone], className)}>
      <div className="container flex h-14 items-center gap-4">
        {/* The nav scrolls rather than wraps when the viewport can't hold every
            pill — a second row would double the band's height. py-1 keeps the
            active pill's shadow inside the scroll box instead of clipped. */}
        <PrimaryNav className="min-w-0 flex-1 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />

        <span
          aria-hidden="true"
          className={cn("hidden h-6 w-px shrink-0 xl:block", DIVIDERS[tone])}
        />

        <p
          className={cn(
            "hidden shrink-0 items-center gap-2 rounded-full px-4 py-2 text-caption font-medium xl:flex",
            NOTES[tone],
          )}
        >
          <TruckIcon className="size-[18px]" />
          Free delivery on orders over ৳2,000
        </p>
      </div>
    </div>
  );
}
