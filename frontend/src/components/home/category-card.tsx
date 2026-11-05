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
      className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-bg-sunken category-round:aspect-auto category-round:overflow-visible category-round:bg-transparent category-card:aspect-auto category-card:overflow-visible category-card:rounded-2xl category-card:bg-bg-surface category-card:p-4 category-card:shadow-sm category-card:transition-shadow category-card:duration-200 category-card:hover:shadow-lg category-name:aspect-auto category-name:rounded-full category-name:border category-name:border-border-default category-name:bg-bg-surface"
    >
      <div className="absolute inset-0 category-round:relative category-round:aspect-square category-round:overflow-hidden category-round:rounded-full category-round:bg-bg-sunken category-card:relative category-card:mx-auto category-card:aspect-square category-card:w-full category-card:max-w-32 category-card:overflow-hidden category-card:rounded-full category-card:bg-bg-sunken category-name:hidden">
        <AppImage
          src={category.image}
          alt={category.alt}
          fill
          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 31vw, 46vw"
          className="transform-gpu object-cover transition-transform duration-500 ease-[var(--ease-hover)] group-hover:scale-[1.06]"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/35 to-transparent category-round:hidden category-card:hidden category-name:hidden"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-4 category-round:static category-round:justify-center category-round:p-0 category-round:pt-3 category-card:static category-card:justify-center category-card:p-0 category-card:pt-3 category-name:static category-name:justify-center category-name:px-4 category-name:py-3">
        <span className="text-small font-semibold text-white drop-shadow-sm category-round:text-center category-round:text-text-primary category-round:drop-shadow-none category-card:text-center category-card:font-bold category-card:text-text-primary category-card:drop-shadow-none category-name:text-center category-name:text-text-primary category-name:drop-shadow-none">
          {category.name}
        </span>
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand transition-transform duration-200 ease-[var(--ease-hover)] group-hover:translate-x-0.5 category-round:hidden category-card:hidden category-name:hidden"
        >
          <ArrowRightIcon className="size-4" />
        </span>
      </div>
    </Link>
  );
}
