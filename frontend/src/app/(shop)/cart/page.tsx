import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart/cart-view";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { ArrowRightIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your bag before checking out.",
};

/** The cart lives in the browser, per shop; CartView reads it there. */
export default function CartPage() {
  return (
    <main className="container py-6">
      <h1 className="sr-only">Shopping cart</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: "Cart" },
          ]}
        />

        <Link
          href="/shop"
          className="group inline-flex items-center gap-1.5 text-small font-medium text-text-secondary transition-colors duration-150 hover:text-text-brand"
        >
          Continue shopping
          <ArrowRightIcon className="size-4 transition-transform duration-200 ease-[var(--ease-hover)] group-hover:translate-x-0.5" />
        </Link>
      </div>

      <CartView />
    </main>
  );
}
