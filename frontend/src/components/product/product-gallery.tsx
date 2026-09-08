"use client";

import { useRef, useState } from "react";
import { AppImage } from "@/components/ui/app-image";
import { HeartIcon } from "@/components/ui/icons";
import { ZoomIcon } from "@/components/ui/icons-filter";
import { cn } from "@/lib/cn";

const ZOOM = 2.2;

export function ProductGallery({
  images,
  discountPct,
}: {
  images: { src: string; alt: string }[];
  discountPct: number | null;
}) {
  const [active, setActive] = useState(0);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const current = images[active] ?? images[0];

  const track = (event: React.MouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    setLens({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="relative flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:gap-4">
      {images.length > 1 ? (
        <ul className="order-2 flex gap-3 sm:order-none sm:w-20 sm:shrink-0 sm:flex-col">
          {images.map((image, index) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`View image ${index + 1}`}
                aria-current={index === active}
                className={cn(
                  "relative aspect-square w-20 overflow-hidden rounded-lg border transition-colors duration-200 ease-[var(--ease-hover)]",
                  index === active
                    ? "border-brand-500"
                    : "border-border-subtle hover:border-border-strong",
                )}
              >
                <AppImage src={image.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={frameRef}
        onMouseMove={track}
        onMouseLeave={() => setLens(null)}
        className="relative aspect-square flex-1 cursor-crosshair overflow-hidden rounded-xl border border-border-subtle bg-bg-sunken"
      >
        <AppImage
          src={current.src}
          alt={current.alt}
          fill
          sizes="(min-width: 640px) 30rem, 100vw"
          loading="eager"
          className="object-cover"
        />

        {/* The square marks what the panel is showing. Sized as the inverse of
            the zoom factor, so it covers exactly the visible slice. */}
        {lens ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-brand-500/70 bg-white/20"
            style={{
              width: `${100 / ZOOM}%`,
              height: `${100 / ZOOM}%`,
              left: `${clamp(lens.x)}%`,
              top: `${clamp(lens.y)}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ) : null}

        {/* Says the frame is interactive before the pointer proves it, and
            steps aside once the lens is up. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-4 left-4 hidden items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface/90 px-3 py-1.5 text-caption font-medium text-text-secondary shadow-xs backdrop-blur-sm transition-opacity duration-200 lg:flex",
            lens && "opacity-0",
          )}
        >
          <ZoomIcon className="size-4 text-text-tertiary" />
          Hover to zoom
        </span>

        {discountPct ? (
          <span
            className={cn(
              "absolute left-4 top-4 rounded-sm bg-brand-500 px-2 py-1 text-caption font-semibold text-white transition-opacity duration-200",
              lens && "opacity-0",
            )}
          >
            {discountPct}% OFF
          </span>
        ) : null}

        <button
          type="button"
          aria-label="Save to wishlist"
          className={cn(
            "absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-border-default bg-bg-surface/90 text-text-secondary shadow-xs backdrop-blur-sm transition-[color,opacity] duration-200 ease-[var(--ease-hover)] hover:text-danger-solid",
            lens && "pointer-events-none opacity-0",
          )}
        >
          <HeartIcon className="size-5" />
        </button>
      </div>

      {/* The magnified panel overlays the column to the right rather than
          taking layout space, so nothing shifts when the pointer enters. */}
      {lens ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-0 z-20 ml-4 hidden aspect-square w-[32vw] max-w-lg overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-xl lg:block"
          style={{
            backgroundImage: `url(${current.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${ZOOM * 100}%`,
            backgroundPosition: `${clamp(lens.x)}% ${clamp(lens.y)}%`,
          }}
        />
      ) : null}
    </div>
  );
}

/* Keeps the lens inside the frame: at the very edge, half of it would hang
   over the border and the panel would show blank space. */
function clamp(value: number) {
  const half = 100 / ZOOM / 2;
  return Math.min(Math.max(value, half), 100 - half);
}
