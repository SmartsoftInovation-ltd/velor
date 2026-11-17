import { AppImage } from "@/components/ui/app-image";

type Props = { name: string; logo?: string; businessType?: string };

/**
 * Our Mission, beside the store's logo from Site Information. Site Information
 * has no photo for this page, so the logo stands in, on a soft brand ground.
 */
export function AboutMission({ name, logo, businessType }: Props) {
  const kind = businessType?.trim() ? `${businessType.trim()} shopping` : "online shopping";

  return (
    <section aria-labelledby="our-mission" className="grid items-center gap-10 md:grid-cols-2">
      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-2xl bg-brand-500/10 shadow-md">
        <AppImage
          src={logo || "/logo.png"}
          alt={`${name} logo`}
          width={240}
          height={240}
          className="size-2/5 object-contain"
        />
      </div>

      <div className="space-y-4">
        <h2 id="our-mission" className="text-h2 font-semibold tracking-tight text-text-primary">
          Our Mission
          <span aria-hidden="true" className="mt-3 block h-0.5 w-12 rounded-full bg-brand-500" />
        </h2>
        <p className="text-body text-text-secondary">
          At {name}, our mission is to make {kind} accessible, secure and satisfying for everyone. With trusted
          suppliers, verified products and quick delivery, we are here to build long-term value for customers who
          expect more than just a sale.
        </p>
      </div>
    </section>
  );
}
