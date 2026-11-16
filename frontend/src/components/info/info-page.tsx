import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/shop/breadcrumb";

/** The frame of an information page (About, Contact, policies): crumb, heading, body */
export function InfoPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: title }]} />

      <header className="mt-6 mb-8 max-w-2xl space-y-3">
        <h1 className="text-h1 font-semibold tracking-tight text-text-primary">{title}</h1>
        <p className="text-body text-text-secondary">{intro}</p>
      </header>

      {children}
    </main>
  );
}
