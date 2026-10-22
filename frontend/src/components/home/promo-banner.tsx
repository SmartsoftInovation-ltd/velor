import Link from "next/link";
import { headers } from "next/headers";
import { AppImage } from "@/components/ui/app-image";
import { getPromoBanner } from "@/lib/catalog/featured";
import { storeHostFrom } from "@/lib/store-api";

/**
 * The seller's promo banner (dashboard: Website Management → Promo Banner).
 * Promo artwork carries its own text, so the image is shown as designed and
 * the whole banner is the link; the headline and description are read out to
 * screen readers instead of printed over it. Hidden when there is none.
 */
export async function PromoBanner() {
  const banner = await getPromoBanner(storeHostFrom(await headers()));
  if (!banner) return null;

  const label = [banner.headLine || banner.title, banner.description].filter(Boolean).join(". ");
  const frame = "group relative block h-[220px] w-full overflow-hidden rounded-xl shadow-sm sm:h-[300px] lg:h-[380px]";
  const image = (
    <AppImage
      src={banner.image}
      alt={label}
      fill
      sizes="(min-width: 1024px) 1280px, 100vw"
      className="object-cover transition-transform duration-500 ease-[var(--ease-hover)] group-hover:scale-[1.02]"
    />
  );

  return (
    <section className="container py-6 sm:py-8">
      {banner.link ? (
        <Link href={banner.link} className={frame}>
          {image}
        </Link>
      ) : (
        <div className={frame}>{image}</div>
      )}
    </section>
  );
}
