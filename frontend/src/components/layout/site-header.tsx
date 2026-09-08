import Link from "next/link";
import { HeartIcon } from "@/components/ui/icons";
import { UserIcon } from "@/components/ui/icons-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WISHLIST_ITEMS } from "@/lib/catalog/wishlist-fixture";
import { CartButton } from "./cart-button";
import { HeaderActions } from "./header-actions";
import { HeaderIconButton } from "./header-icon-button";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavBar } from "./nav-bar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-surface/85 backdrop-blur-md">
      {/* Identity, search, account. A three-track grid rather than a flex row.
          The outer tracks size to their content and the middle one takes the
          rest, so the field centres in the gap between the logo and the
          actions — not on the page, which the two unequal sides would skew.
          The field is one element that wraps to its own line below md — a
          second one for small screens would put two identical labels in the
          DOM. */}
      <div className="container flex flex-wrap items-center gap-x-4 gap-y-3 py-3 md:grid md:h-16 md:grid-cols-[auto_1fr_auto] md:py-0">
        <Logo />

        <HeaderSearch className="order-3 w-full md:order-none md:mx-auto md:max-w-[35rem]" />

        <div className="ml-auto flex items-center gap-2">
          {/* One pill, one sliding ground — see HeaderActions. */}
          <HeaderActions>
            <HeaderIconButton
              href="/wishlist"
              slot="wishlist"
              label={`Wishlist, ${WISHLIST_ITEMS.length} items`}
              count={WISHLIST_ITEMS.length}
            >
              <HeartIcon />
            </HeaderIconButton>

            {/* Hairlines between the three slots. z-1 keeps them above the
                sliding ground, which passes behind. */}
            <span
              aria-hidden="true"
              className="relative z-1 mx-0.5 h-5 w-px shrink-0 bg-border-default"
            />

            <CartButton itemCount={0} subtotal="0.00" />

            <span
              aria-hidden="true"
              className="relative z-1 mx-0.5 h-5 w-px shrink-0 bg-border-default"
            />

            <ThemeToggle bare />
          </HeaderActions>

          {/* A link, not a Button: nesting a <button> inside an <a> gives the
              row two focus stops for one target. */}
          <Link
            href="/sign-in"
            className="shine ml-2 hidden h-10 items-center gap-2 rounded-md bg-brand-500 px-4 text-body font-medium whitespace-nowrap text-white shadow-brand transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 sm:inline-flex"
          >
            <UserIcon className="relative z-2 size-4" />
            <span className="relative z-2">Log in</span>
          </Link>

          <MobileMenu />
        </div>
      </div>

      {/* Catalogue navigation. The mobile drawer covers this below lg. */}
      <NavBar tone="sunken" className="hidden lg:block" />
    </header>
  );
}
