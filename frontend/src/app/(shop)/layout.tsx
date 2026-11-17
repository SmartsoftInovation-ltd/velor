import { headers } from "next/headers";
import { ShopStorageProvider } from "@/components/cart/shop-storage-provider";
import { ChatButton } from "@/components/home/chat-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { chatChannels } from "@/lib/chat-channels";
import { getStore, storeHostFrom } from "@/lib/store-api";

/**
 * The storefront chrome. Everything shopping-facing sits under it; the (auth)
 * group deliberately does not, so a sign-in page is a page on its own with no
 * nav to wander off into mid-flow.
 *
 * The cart and wishlist are opened here, keyed by the store this domain
 * belongs to, so the header count and every page below share them.
 */
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const store = await getStore(storeHostFrom(await headers()));
  // Site Information's chat and social links; no button until one is filled in
  const channels = chatChannels(store);

  return (
    <ShopStorageProvider tenantId={store?.id ?? ""}>
      {/* Always in the page, hidden unless the store turned it on, so the Platform
          Console's preview can show it without a reload. */}
      <p
        id="announcement-bar"
        className="hidden bg-brand-500 px-4 py-2 text-center text-small font-medium text-on-brand announcement-on:block"
      >
        {store?.announcementText}
      </p>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {channels.length ? <ChatButton channels={channels} /> : null}
    </ShopStorageProvider>
  );
}
