import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDetails } from "@/components/account/account-details";
import { AccountProfile } from "@/components/account/account-profile";
import { AccountShortcuts } from "@/components/account/account-shortcuts";
import { ChangePassword } from "@/components/account/change-password";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { currentShopper, expiredSignInHref, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/shopper-auth";
import { getStore, storeHostFrom } from "@/lib/store-api";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "My account",
  description: "Your details at this shop.",
};

/**
 * The signed-in shopper's own page. The token stays in its httpOnly cookie and
 * is sent from this server; the browser never sees it. No session, or one the
 * API no longer accepts even after renewing it, goes to sign-in.
 */
export default async function AccountPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect("/sign-in");

  const host = storeHostFrom(await headers());
  const [user, store] = await Promise.all([currentShopper(host, token, jar.get(REFRESH_COOKIE)?.value), getStore(host)]);
  if (!user) redirect(expiredSignInHref("/account"));

  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "My account" }]} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <AccountProfile user={user} storeName={store?.name || "this shop"} />

        <div className="space-y-6">
          <AccountDetails user={user} />
          <ChangePassword />
          <AccountShortcuts />
        </div>
      </div>
    </main>
  );
}
