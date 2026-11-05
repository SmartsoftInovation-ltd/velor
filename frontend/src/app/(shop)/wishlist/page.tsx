import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { ArrowRightIcon } from "@/components/ui/icons";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Wishlist",
  description: "Everything you have saved for later.",
};

/** The wishlist lives in the browser, per shop; WishlistView reads it there. */
export default function WishlistPage() {
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

      <WishlistView />
    </main>
  );
}
