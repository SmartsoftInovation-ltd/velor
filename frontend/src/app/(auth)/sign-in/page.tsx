import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignInHeading } from "@/components/auth/sign-in-heading";
import { VisualSignIn } from "@/components/auth/visual-sign-in";
import { getStore, storeHostFrom } from "@/lib/store-api";
import { NO_INDEX } from "@/lib/seo";
import { safeReturnPath } from "@/lib/shopper-auth";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Sign in",
  description: "Sign in to track your orders and check out faster.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, expired } = await searchParams;
  const returnTo = safeReturnPath(next);
  const notice = expired === "1" ? "Your session has expired. Sign in again to continue." : undefined;
  const store = await getStore(storeHostFrom(await headers()));
  const storeName = store?.name || "this shop";

  return (
    <AuthShell
      title="Welcome"
      titleAccent="back"
      description="Sign in to track orders and check out faster."
      heading={<SignInHeading storeName={storeName} />}
      showBrand={false}
      aside={{
        headline: "Good to see you",
        script: "again",
        note: `Your orders and details at ${storeName} are waiting for you.`,
        visual: <VisualSignIn storeName={storeName} />,
      }}
      footer={
        <>
          New to {storeName}?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm returnTo={returnTo} notice={notice} />
    </AuthShell>
  );
}
