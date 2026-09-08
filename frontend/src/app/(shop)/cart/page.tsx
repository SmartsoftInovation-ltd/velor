import type { Metadata } from "next";
import Link from "next/link";
import { CartLineRow } from "@/components/cart/cart-line-row";
import { EmptyCart } from "@/components/cart/empty-cart";
import { OrderSummary } from "@/components/cart/order-summary";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { ArrowRightIcon } from "@/components/ui/icons";
import { CART_LINES } from "@/lib/catalog/cart-fixture";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your bag before checking out.",
};

export default function CartPage() {
  const lines = CART_LINES;
  const subtotal = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const saved = lines.reduce(
    (sum, line) =>
      sum +
      (line.product.compareAtPrice
        ? (line.product.compareAtPrice - line.product.price) * line.quantity
        : 0),
    0,
  );
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!lines.length) return <EmptyCart />;

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

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
        <ul className="space-y-3">
          {lines.map((line) => (
            <CartLineRow key={line.id} line={line} />
          ))}
        </ul>

        {/* Sticky on desktop: the summary is the thing you keep glancing at
            while editing lines further down the list. */}
        <div className="lg:sticky lg:top-32">
          <OrderSummary subtotal={subtotal} saved={saved} count={count} />
        </div>
      </div>
    </main>
  );
}
