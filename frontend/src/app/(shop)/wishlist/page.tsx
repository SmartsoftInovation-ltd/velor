import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { ArrowRightIcon } from "@/components/ui/icons";
import { EmptyWishlist } from "@/components/wishlist/empty-wishlist";
import { WishlistCard } from "@/components/wishlist/wishlist-card";
import { WishlistToolbar } from "@/components/wishlist/wishlist-toolbar";
import { WISHLIST_ITEMS } from "@/lib/catalog/wishlist-fixture";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Everything you have saved for later.",
};

/**
 * Design only. Nothing here mutates: removing and moving to the bag would both
 * need cart state this page deliberately has none of.
 */
export default function WishlistPage() {
  const items = WISHLIST_ITEMS;

  return (
    <main className="container py-6">
      <h1 className="sr-only">Wishlist</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]}
        />

        <Link
          href="/shop"
          className="group inline-flex items-center gap-1.5 text-small font-medium text-text-secondary transition-colors duration-150 hover:text-text-brand"
        >
          Continue shopping
          <ArrowRightIcon className="size-4 transition-transform duration-200 ease-[var(--ease-hover)] group-hover:translate-x-0.5" />
        </Link>
      </div>

      {items.length ? (
        <>
          <WishlistToolbar count={items.length} />

          <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
            {items.map((item) => (
              <li key={item.id}>
                <WishlistCard item={item} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyWishlist />
      )}
    </main>
  );
}
