import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppImage } from "@/components/ui/app-image";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { BagIcon } from "@/components/ui/icons-nav";
import { getStore, storeHostFrom } from "@/lib/store-api";
import { AuthAside } from "./auth-aside";

/**
 * The whole screen split in two: the form on the left, a quiet illustrated
 * panel on the right. The panel is `hidden lg:flex` — below that width it
 * would take the fold from the form for no information.
 *
 * `titleAccent` is the second half of the heading, set in the brand colour, so
 * a page can say "Create **your account**" without markup at the call site.
 *
 * The brand on top is the store this domain belongs to: an account is made at,
 * and signs in to, one shop. `storeNotice` spells that out where it matters.
 */
export async function AuthShell({
  title,
  titleAccent,
  description,
  aside,
  children,
  footer,
  storeNotice = false,
  showBrand = true,
  heading,
}: {
  title: string;
  titleAccent?: string;
  description: string;
  aside: {
    headline: string;
    script: string;
    note: string;
    /** The illustration or mock for this step — see AuthAside. */
    visual: ReactNode;
  };
  children: ReactNode;
  /** The "already have an account?" line under the form. */
  footer?: ReactNode;
  /** Say under the heading which shop the account belongs to */
  storeNotice?: boolean;
  /** The store logo on top; a page that names the store in its heading turns it off */
  showBrand?: boolean;
  /** Replaces the default title and description with a page's own heading */
  heading?: ReactNode;
}) {
  const host = storeHostFrom(await headers());
  const store = await getStore(host);
  const storeName = store?.name || "ShoPzio";

  return (
    <main className="grid min-h-screen bg-bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-16 xl:px-24">
        {showBrand ? (
          <Link
            href="/"
            aria-label={`${storeName} home`}
            className="flex w-fit items-center gap-2.5 text-h3 font-bold tracking-tight text-text-primary"
          >
            <AppImage
              src={store?.logo || "/logo.png"}
              alt=""
              width={36}
              height={36}
              loading="eager"
              className="size-9 object-contain"
            />
            {storeName}
          </Link>
        ) : (
          <Link
            href="/"
            className="flex w-fit items-center gap-1.5 text-small font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary [&>svg]:size-4"
          >
            <ChevronLeftIcon />
            Back to shop
          </Link>
        )}

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {heading ? (
            <div className="mb-7">{heading}</div>
          ) : (
            <div className="mb-7 space-y-2">
              <h1 className="text-h1 font-bold tracking-tight text-balance text-text-primary">
                {title}
                {titleAccent ? (
                  <span className="text-text-brand"> {titleAccent}</span>
                ) : null}
              </h1>
              <p className="text-body text-text-secondary">{description}</p>
              {storeNotice ? (
                <p className="flex items-center gap-2 pt-2 text-caption text-text-tertiary">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-text-brand [&>svg]:size-3.5">
                    <BagIcon />
                  </span>
                  <span className="min-w-0 truncate">
                    For{" "}
                    <span className="font-medium text-text-primary">
                      {storeName}
                    </span>
                    {host ? <span> · {host}</span> : null}
                  </span>
                </p>
              ) : null}
            </div>
          )}

          {children}

          {footer ? (
            <p className="mt-7 text-small text-text-secondary">{footer}</p>
          ) : null}
        </div>
      </div>

      <AuthAside {...aside} />
    </main>
  );
}
