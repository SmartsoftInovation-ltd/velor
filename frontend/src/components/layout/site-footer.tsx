import { headers } from "next/headers";
import { AppImage } from "@/components/ui/app-image";
import { FOOTER_LINK_GROUPS } from "@/lib/footer-links";
import { getStore, storeHostFrom } from "@/lib/store-api";
import { FooterBrand } from "./footer-brand";
import { FooterContact } from "./footer-contact";
import { FooterLinkColumn } from "./footer-link-column";
import { FooterNewsletter } from "./footer-newsletter";

export async function SiteFooter() {
  const store = await getStore(storeHostFrom(await headers()));

  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="container">
        <FooterNewsletter />
      </div>

      {/* Black in both themes, as designed */}
      <div className="bg-black text-white">
        <div className="container">
          <div className="footer-compact:hidden">
            <FooterContact store={store} />

            <div className="grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-[1.63fr_1fr_1.1fr_auto] lg:gap-0">
              <FooterBrand slogan={store?.slogan} />
              {FOOTER_LINK_GROUPS.map((group) => (
                <FooterLinkColumn key={group.title} group={group} />
              ))}
            </div>
          </div>

          <div className="space-y-4 pb-8 footer-compact:pt-8">
            <h3 className="text-body font-medium text-white">Payment Method</h3>
            {/* Spans the footer's full width; height follows the strip's ratio */}
            <AppImage
              src="/payment-methods.png"
              alt="Accepted payment methods: Visa, Mastercard, bKash, Nagad, Rocket and more"
              width={1493}
              height={54}
              sizes="100vw"
              className="h-auto w-full"
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-brand-500/40 py-5 text-small text-white sm:flex-row sm:items-center sm:justify-between">
            <p>
              {/* Site Information's Footer Text, when the seller wrote one */}
              {store?.footerText?.trim() || `© ${new Date().getFullYear()} ${store?.name || "ShoPzio"}. All rights reserved.`}
            </p>
            <p>Design &amp; Developed By : Smartsoft Innovation</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
