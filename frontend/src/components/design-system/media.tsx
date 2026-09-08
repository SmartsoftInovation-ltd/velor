import { AppImage } from "@/components/ui/app-image";
import { Panel, Section, TokenName } from "./section";

export function Media() {
  return (
    <Section
      title="Images"
      description="AppImage is the only image component — it wraps next/image and fixes quality, lazy loading and the error fallback in one place. Never write a raw <img>: ESLint fails the build on it, and a raw tag skips optimisation, lazy loading and layout-shift protection."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="space-y-3">
          {/* Fixed width + height: the intrinsic ratio is preserved and the
              space is reserved before the bytes arrive, so nothing shifts. */}
          <AppImage
            src="/products/shirt.svg"
            alt="Casual full sleeve shirt"
            width={400}
            height={300}
            className="rounded-md"
          />
          <TokenName>width + height</TokenName>
          <p className="text-caption text-text-tertiary">
            Intrinsic ratio kept, space reserved. No layout shift.
          </p>
        </Panel>

        <Panel className="space-y-3">
          {/* `fill` needs a positioned parent and a sizes hint. object-contain
              keeps the artwork's own ratio inside a differently-shaped well. */}
          <div className="relative aspect-4/3 overflow-hidden rounded-md bg-bg-sunken">
            <AppImage
              src="/products/jacket.svg"
              alt="Slim fit denim jacket"
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-contain"
            />
          </div>
          <TokenName>fill + sizes</TokenName>
          <p className="text-caption text-text-tertiary">
            Ratio set by the parent; object-contain keeps the art undistorted.
          </p>
        </Panel>

        <Panel className="space-y-3">
          {/* A deliberately missing file: onError swaps in the placeholder. */}
          <div className="relative aspect-4/3 overflow-hidden rounded-md bg-bg-sunken">
            <AppImage
              src="/products/does-not-exist.svg"
              alt="A product image that failed to load"
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-contain"
            />
          </div>
          <TokenName>onError fallback</TokenName>
          <p className="text-caption text-text-tertiary">
            A broken source swaps to /image-fallback.svg rather than collapsing.
          </p>
        </Panel>
      </div>

      <Panel className="space-y-2">
        <h3 className="text-h3 font-semibold">The rules</h3>
        <ul className="space-y-1.5 text-body text-text-secondary">
          <li>
            <strong className="font-medium text-text-primary">quality=100</strong> is
            hard-coded, backed by a <code className="font-mono text-small">qualities</code>{" "}
            allowlist in <code className="font-mono text-small">next.config.ts</code>.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Lazy by default.</strong>{" "}
            An above-the-fold hero passes{" "}
            <code className="font-mono text-small">loading=&quot;eager&quot;</code>; in Next
            16 <code className="font-mono text-small">priority</code> is deprecated —
            use <code className="font-mono text-small">preload</code>.
          </li>
          <li>
            <strong className="font-medium text-text-primary">alt is required.</strong>{" "}
            Decorative image? <code className="font-mono text-small">alt=&quot;&quot;</code>,
            never omitted.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Dimensions always.</strong>{" "}
            Either width + height, or <code className="font-mono text-small">fill</code>{" "}
            with <code className="font-mono text-small">sizes</code> inside a positioned
            parent.
          </li>
          <li>
            <strong className="font-medium text-text-primary">Remote hosts</strong> need a{" "}
            <code className="font-mono text-small">remotePatterns</code> entry — never
            reach for <code className="font-mono text-small">unoptimized</code>.
          </li>
        </ul>
      </Panel>
    </Section>
  );
}
