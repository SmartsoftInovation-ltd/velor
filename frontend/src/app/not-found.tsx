import type { Metadata } from "next";
import Link from "next/link";
import { LostParcel } from "@/components/not-found/lost-parcel";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/icons-nav";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for does not exist.",
};

const SUGGESTIONS = [
  { label: "Shop all", href: "/shop" },
  { label: "Track an order", href: "/track-order" },
  { label: "Your wishlist", href: "/wishlist" },
  { label: "Your bag", href: "/cart" },
] as const;

/**
 * Rendered for any unmatched route, and by `notFound()`. Everything animates
 * with transform/opacity only; the global reduced-motion block flattens it.
 */
export default function NotFound() {
  return (
    <main className="container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <LostParcel />

      <div className="animate-rise-in mt-10 max-w-md space-y-3 [animation-delay:120ms]">
        <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
          This page went missing
        </h1>
        <p className="text-body text-text-secondary">
          The link may be broken, or the page moved. Nothing in your bag was
          affected.
        </p>
      </div>

      <div className="animate-rise-in mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:220ms]">
        <Link
          href="/"
          className="shine relative inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-500 px-6 text-body font-medium text-white shadow-brand transition-[background-color,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98]"
        >
          Back to home
          <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
            <ArrowRightIcon />
          </span>
        </Link>

        <Link
          href="/shop"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-default bg-bg-surface px-6 text-body font-medium text-text-primary shadow-xs transition-colors duration-200 ease-[var(--ease-hover)] hover:border-border-strong hover:bg-bg-hover"
        >
          <SearchIcon className="size-4" />
          Browse products
        </Link>
      </div>

      <div className="animate-rise-in mt-10 [animation-delay:320ms]">
        <p className="text-caption font-medium text-text-tertiary">
          Or jump to
        </p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex h-8 items-center rounded-full border border-border-subtle bg-bg-surface px-3.5 text-caption font-medium text-text-secondary transition-colors duration-150 hover:border-border-brand hover:text-text-brand"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
