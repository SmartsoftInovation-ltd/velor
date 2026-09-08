import { AppImage } from "@/components/ui/app-image";

export function PromoBanner() {
  return (
    <section className="container py-6 sm:py-8">
      <div className="relative h-[220px] w-full overflow-hidden rounded-xl shadow-sm sm:h-[300px] lg:h-[380px]">
        <AppImage
          src="/promo-winter-banner.png"
          alt="Winter Collection 25 — up to 50% off, free delivery, 0% EMI"
          fill
          sizes="(min-width: 1024px) 1280px, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
