import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SignUpHeading } from "@/components/auth/sign-up-heading";
import { VisualSignUp } from "@/components/auth/visual-sign-up";
import { getStore, storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create an account to check out faster and track your orders.",
};

export default async function SignUpPage() {
  const store = await getStore(storeHostFrom(await headers()));
  const storeName = store?.name || "this shop";

  return (
    <AuthShell
      title="Create your account"
      description="Check out faster, follow every order, and keep your details in one place."
      heading={<SignUpHeading storeName={storeName} />}
      showBrand={false}
      aside={{
        headline: "Join once,",
        script: "shop faster",
        note: `Your details are saved with ${storeName}, so your next order takes a few taps.`,
        visual: <VisualSignUp storeName={storeName} />,
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm storeName={storeName} />
    </AuthShell>
  );
}
