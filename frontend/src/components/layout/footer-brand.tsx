import { Logo } from "./logo";

const DEFAULT_TAGLINE = "Discover quality products with convenience. Shop confidently with us.";

/** Logo and name, with the slogan from Site Information under them */
export function FooterBrand({ slogan }: { slogan?: string }) {
  return (
    <div className="max-w-xs space-y-4">
      <Logo onDark />

      <p className="text-small text-white/90">{slogan?.trim() || DEFAULT_TAGLINE}</p>
    </div>
  );
}
