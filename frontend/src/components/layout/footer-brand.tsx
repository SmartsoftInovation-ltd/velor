import { Logo } from "./logo";

export function FooterBrand() {
  return (
    <div className="max-w-xs space-y-4">
      <Logo onDark />

      <p className="text-small text-white/90">
        Discover quality products with convenience. Shop confidently with us.
      </p>
    </div>
  );
}
