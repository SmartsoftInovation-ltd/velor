import { headers } from "next/headers";
import { ShopStorageProvider } from "@/components/cart/shop-storage-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
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

  return (
    <ShopStorageProvider tenantId={store?.id ?? ""}>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </ShopStorageProvider>
  );
}
