import type { Metadata } from "next";
import Link from "next/link";
import { BoardPreview } from "@/components/design-system/board-preview";
import { Media } from "@/components/design-system/media";
import { Spacing } from "@/components/design-system/spacing";
import {
  BrandPalette,
  NeutralPalettes,
  StatusPalette,
} from "@/components/design-system/palette";
import { RadiusAndElevation } from "@/components/design-system/elevation";
import { Buttons, FormControls } from "@/components/design-system/surfaces";
import { TypeScale } from "@/components/design-system/typography";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Design system", robots: NO_INDEX };

/**
 * Design-system reference page. Every value below is a token — nothing is
 * hard-coded. A Server Component: ThemeToggle is the only interactive part,
 * and it is its own client leaf.
 */
export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-16 px-6 py-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-sm bg-brand-100 px-2.5 py-1 text-micro font-semibold tracking-wide text-brand-800 uppercase">
            Design system
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/board/shop"
              className="text-small font-medium text-text-brand transition-colors duration-150 ease-out hover:text-brand-700"
            >
              Open the shop &rarr;
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <h1 className="text-display font-semibold">ShoPzio</h1>
        <p className="max-w-2xl text-body text-text-secondary">
          A modern ecommerce system built on Geist and a warm neutral ramp. The
          brand orange is the one value carried over from the original Figma
          file; everything around it &mdash; type, spacing, radius, elevation,
          and a full dark theme &mdash; was rebuilt to sit with it. Every colour
          is a semantic token, so the page re-themes from one attribute on
          &lt;html&gt;.
        </p>
      </header>

      <TypeScale />
      <BrandPalette />
      <NeutralPalettes />
      <StatusPalette />
      <Buttons />
      <FormControls />
      <RadiusAndElevation />
      <Media />
      <Spacing />
      <BoardPreview />
    </main>
  );
}
