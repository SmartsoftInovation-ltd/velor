import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { AppImage } from "@/components/ui/app-image";
import type { ShopCategory } from "@/lib/shop-categories";

/**
 * A portrait tile: the photo is the card, and the label rides on top of it
 * inside a gradient scrim. The scrim is a fixed dark wash rather than a token —
 * white text has to stay legible over the photo in both themes, so the ground
 * under it cannot follow the theme.
 */
export function CategoryCard({ category }: { category: ShopCategory }) {
  return (
    <Link
      href={category.href}
      className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-bg-sunken"
    >
      <AppImage
        src={category.image}
        alt={category.alt}
        fill
        sizes="(min-width: 1024px) 16vw, (min-width: 640px) 31vw, 46vw"
        className="transform-gpu object-cover transition-transform duration-500 ease-[var(--ease-hover)] group-hover:scale-[1.06]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-4">
        <span className="text-small font-semibold text-white drop-shadow-sm">
          {category.name}
        </span>
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-transform duration-200 ease-[var(--ease-hover)] group-hover:translate-x-0.5"
        >
          <ArrowRightIcon className="size-4" />
        </span>
      </div>
    </Link>
  );
}
