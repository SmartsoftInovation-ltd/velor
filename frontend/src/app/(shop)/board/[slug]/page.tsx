import Link from "next/link";
import { BoardPreview } from "@/components/design-system/board-preview";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Placeholder so the design-system page's "Open the shop" link resolves.
 * Replace with the real catalogue UI.
 */
export default async function ShopPage({ params }: PageProps<"/board/[slug]">) {
  const { slug } = await params;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-semibold capitalize">{slug}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/design-system"
            className="text-small font-medium text-text-brand transition-colors duration-150 ease-out hover:text-brand-700"
          >
            &larr; Design system
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <BoardPreview />
    </main>
  );
}
