import type { Metadata } from "next";
import { NavBar, type NavTone } from "@/components/layout/nav-bar";

export const metadata: Metadata = {
  title: "Nav tones",
  description: "The four bands the catalogue navigation can sit on.",
};

const TONES: { tone: NavTone; name: string; note: string }[] = [
  {
    tone: "surface",
    name: "surface",
    note: "Same plane as the row above it — the two read as one header block, separated only by a hairline.",
  },
  {
    tone: "sunken",
    name: "sunken",
    note: "One step back from the row above. Reads as a distinct strip without adding colour.",
  },
  {
    tone: "brand",
    name: "brand",
    note: "Loudest of the four. Carries the orange into the chrome, but competes with the Log in button and every brand badge below it.",
  },
  {
    tone: "inverse",
    name: "inverse",
    note: "Highest contrast. Anchors the page top, but a dark band under a light header is a strong statement on every screen.",
  },
];

export default function NavTonesPage() {
  return (
    <main className="container space-y-10 py-12">
      <div className="space-y-2">
        <h1 className="text-h1 font-semibold tracking-tight">Nav tones</h1>
        <p className="max-w-2xl text-body text-text-secondary">
          The catalogue row on each of the four bands it supports. Flip the theme
          to check both — the coloured bands restate the link colours against the
          fill, so they hold in light and dark alike.
        </p>
      </div>

      {TONES.map(({ tone, name, note }) => (
        <section key={tone} className="space-y-3">
          <div className="space-y-1">
            <code className="font-mono text-small text-text-brand">
              tone=&quot;{name}&quot;
            </code>
            <p className="max-w-2xl text-small text-text-secondary">{note}</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <div className="flex h-14 items-center bg-bg-surface px-4 text-small text-text-tertiary">
              (header row above)
            </div>
            <NavBar tone={tone} />
          </div>
        </section>
      ))}
    </main>
  );
}
