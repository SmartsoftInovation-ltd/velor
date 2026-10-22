import Link from "next/link";
import { CartIcon, HeartIcon, TruckIcon } from "@/components/ui/icons";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { BagIcon } from "@/components/ui/icons-nav";

const SHORTCUTS = [
  { href: "/track-order", Icon: TruckIcon, label: "Track an order", note: "See where your parcel is" },
  { href: "/wishlist", Icon: HeartIcon, label: "Wishlist", note: "Items you saved for later" },
  { href: "/cart", Icon: CartIcon, label: "Cart", note: "Ready when you are" },
  { href: "/shop", Icon: BagIcon, label: "Keep shopping", note: "Browse the full catalogue" },
] as const;

/** Where a shopper usually goes next from their account. */
export function AccountShortcuts() {
  return (
    <section aria-labelledby="account-shortcuts-title">
      <h2 id="account-shortcuts-title" className="mb-3 text-h3 font-semibold tracking-tight text-text-primary">
        Quick links
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map(({ href, Icon, label, note }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-xs transition-[border-color,box-shadow] duration-200 ease-[var(--ease-hover)] hover:border-brand-300 hover:shadow-sm"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-text-brand [&>svg]:size-4.5">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-text-primary">{label}</span>
                <span className="block truncate text-caption text-text-tertiary">{note}</span>
              </span>
              <ArrowRightIcon className="size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-[var(--ease-hover)] group-hover:translate-x-0.5 group-hover:text-text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
