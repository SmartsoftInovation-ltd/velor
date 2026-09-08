import Link from "next/link";
import type { ReactNode } from "react";
import { AppImage } from "@/components/ui/app-image";
import { AuthAside } from "./auth-aside";

/**
 * One card split in two: the form on the left, an illustrated panel on the
 * right. The panel is `hidden lg:block` — below that width it would take the
 * fold from the form for no information.
 *
 * `titleAccent` is the second half of the heading, set in the brand colour, so
 * a page can say "Create **your account**" without markup at the call site.
 */
export function AuthShell({
  title,
  titleAccent,
  description,
  aside,
  children,
  footer,
}: {
  title: string;
  titleAccent?: string;
  description: string;
  aside: {
    headline: string;
    script: string;
    note: string;
    /** The mock that shows what this step does — see AuthAside. */
    visual: ReactNode;
  };
  children: ReactNode;
  /** The "already have an account?" line under the form. */
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-lg lg:grid-cols-2">
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <Link
            href="/"
            aria-label="ShoPzio home"
            className="mb-7 flex w-fit items-center gap-2.5 text-h3 font-bold tracking-tight text-text-primary"
          >
            <AppImage
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              loading="eager"
              className="size-9 object-contain"
            />
            ShoPzio
          </Link>

          <div className="mb-6 space-y-2">
            <h1 className="text-h1 font-bold tracking-tight text-text-primary">
              {title}
              {titleAccent ? <span className="text-brand-500"> {titleAccent}</span> : null}
            </h1>
            <p className="max-w-sm text-small text-text-secondary">{description}</p>
          </div>

          {children}

          {footer ? (
            <p className="mt-6 text-small text-text-secondary">{footer}</p>
          ) : null}
        </div>

        <AuthAside {...aside} />
      </div>
    </main>
  );
}
