"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { UserIcon } from "@/components/ui/icons-nav";
import { NAV_LINKS } from "@/lib/nav-links";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-bg-hover hover:text-text-primary"
      >
        <MenuIcon className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg-inverse/40 backdrop-blur-[2px]"
          />
          <div className="relative ml-auto flex h-full w-72 max-w-[85vw] flex-col gap-1 bg-bg-elevated p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="mb-2 flex size-9 items-center justify-center self-end rounded-full text-text-secondary transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-bg-hover hover:text-text-primary"
            >
              <CloseIcon className="size-5" />
            </button>
            {NAV_LINKS.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-body font-medium text-text-primary transition-colors duration-150 hover:bg-bg-hover"
                >
                  {link.label}
                </Link>
                {link.children ? (
                  <div className="ml-3 flex flex-col border-l border-border-default pl-3">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className="rounded-md px-2 py-1.5 text-small text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {/* The header's own Log in is hidden below sm, so the drawer is
                the only way in on a phone. */}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="mt-auto flex h-11 items-center justify-center gap-2 rounded-md bg-brand-500 text-body font-medium text-white shadow-brand transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-brand-600"
            >
              <UserIcon className="size-4" />
              Log in
            </Link>

            <Link
              href="/sign-up"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center justify-center rounded-md border border-border-default text-body font-medium text-text-primary transition-colors duration-200 ease-[var(--ease-hover)] hover:bg-bg-hover"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
