import Link from "next/link";
import { CartIcon } from "@/components/ui/icons";

export function EmptyCart() {
  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-5 flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand-600"
      >
        <CartIcon className="size-7" />
      </span>

      <h1 className="text-h2 font-semibold tracking-tight text-text-primary">
        Your bag is empty
      </h1>
      <p className="mt-1.5 max-w-sm text-body text-text-secondary">
        Nothing here yet. Browse the new arrivals and the pieces that keep
        selling out.
      </p>

      <Link
        href="/shop"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-brand-500 px-6 text-body font-medium text-white shadow-brand transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-brand-600"
      >
        Browse the shop
      </Link>
    </main>
  );
}
