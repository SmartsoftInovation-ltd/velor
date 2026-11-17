import type { Metadata } from "next";
import { headers } from "next/headers";
import { ContactDetails } from "@/components/info/contact-details";
import { ContactForm } from "@/components/info/contact-form";
import { SocialLinks } from "@/components/info/social-links";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getStore, storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact us",
  description: "Call, email, visit or send us a message.",
};

// Details and social links come from Settings → Site Information; the form's
// messages land in the dashboard under Website Settings → Contact Messages
export default async function ContactPage() {
  const store = await getStore(storeHostFrom(await headers()));

  return (
    <main className="container py-6 pb-20">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact Us" }]} />

      <header className="mx-auto mt-8 mb-12 max-w-xl space-y-3 text-center">
        <h1 className="text-h1 font-semibold tracking-tight text-text-primary">Contact Us</h1>
        <p className="text-body text-text-secondary">
          We&apos;d love to hear from you. Our team is always here to help with any questions you may have.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-2">
        <section aria-labelledby="start-conversation" className="space-y-6">
          <div className="space-y-2">
            <h2 id="start-conversation" className="text-h2 font-semibold tracking-tight text-text-primary">
              Let&apos;s Start a Conversation
            </h2>
            <p className="text-body text-text-secondary">
              We&apos;re here to help and answer any question you might have. We look forward to hearing from you.
            </p>
          </div>
          <ContactDetails store={store} />
          <SocialLinks store={store} />
        </section>

        <ContactForm />
      </div>
    </main>
  );
}
