import Link from "next/link";
import { HeartIcon } from "@/components/ui/icons";

/** Shown when nothing is saved. Mirrors EmptyCart's shape and tone. */
export function EmptyWishlist() {
  return (
    <div className="rounded-xl border border-dashed border-border-default bg-bg-surface px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-bg-sunken text-text-tertiary [&>svg]:size-6"
      >
        <HeartIcon />
      </span>

      <h2 className="text-h3 font-semibold text-text-primary">
        Your wishlist is empty
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-small text-text-secondary">
        Tap the heart on any product to save it here for later.
      </p>

      <Link
        href="/shop"
        className="shine relative mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand-500 px-6 text-body font-medium text-white shadow-brand transition-[background-color,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98]"
      >
        Browse the shop
      </Link>
    </div>
  );
}
