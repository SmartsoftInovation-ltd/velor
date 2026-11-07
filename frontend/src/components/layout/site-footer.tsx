import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { FOOTER_LINK_GROUPS } from "@/lib/footer-links";
import { FooterBrand } from "./footer-brand";
import { FooterContact } from "./footer-contact";
import { FooterLinkColumn } from "./footer-link-column";
import { FooterNewsletter } from "./footer-newsletter";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="container">
        <FooterNewsletter />

        <div className="grid gap-10 py-12 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.2fr] footer-compact:hidden">
          <FooterBrand />
          {FOOTER_LINK_GROUPS.map((group) => (
            <FooterLinkColumn key={group.title} group={group} />
          ))}
          <FooterContact />
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle py-6 sm:flex-row sm:items-center sm:justify-between footer-compact:border-t-0">
          <p className="text-caption font-medium text-text-tertiary">
            We accept
          </p>
          <div className="relative h-8 w-full max-w-2xl sm:h-9">
            <AppImage
              src="/payment-methods.png"
              alt="Accepted payment methods: Visa, Mastercard, bKash, Nagad, Rocket and more"
              fill
              sizes="(min-width: 640px) 672px, 100vw"
              className="object-contain object-left sm:object-right"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle bg-bg-sunken">
        <div className="container flex flex-col gap-2 py-5 text-caption text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ShoPzio. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-text-brand">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-text-brand">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
