import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDetails } from "@/components/account/account-details";
import { AccountProfile } from "@/components/account/account-profile";
import { AccountShortcuts } from "@/components/account/account-shortcuts";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getMe, SESSION_COOKIE } from "@/lib/shopper-auth";
import { ApiError, getStore, storeHostFrom } from "@/lib/store-api";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "My account",
  description: "Your details at this shop.",
};

/**
 * The signed-in shopper's own page. The token stays in its httpOnly cookie and
 * is sent from this server; the browser never sees it. No session, or one the
 * API no longer accepts, goes to sign-in.
 */
export default async function AccountPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/sign-in");

  const host = storeHostFrom(await headers());
  const [user, store] = await Promise.all([
    getMe(host, token).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) redirect("/sign-in");
      throw error;
    }),
    getStore(host),
  ]);

  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "My account" }]} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <AccountProfile user={user} storeName={store?.name || "this shop"} />

        <div className="space-y-6">
          <AccountDetails user={user} />
          <AccountShortcuts />
        </div>
      </div>
    </main>
  );
}
