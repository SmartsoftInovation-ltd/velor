import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The storefront chrome. Everything shopping-facing sits under it; the (auth)
 * group deliberately does not, so a sign-in page is a page on its own with no
 * nav to wander off into mid-flow.
 */
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
