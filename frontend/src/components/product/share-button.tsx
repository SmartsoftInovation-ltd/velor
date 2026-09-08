"use client";

import { ShareIcon } from "@/components/ui/icons-filter";
import { useToast } from "@/components/ui/toast";

/**
 * Hands off to the platform share sheet where there is one, and falls back to
 * copying the link. Both paths need `window`, so this is a client leaf — the
 * rest of the summary stays server-rendered around it.
 */
export function ShareButton({ productName }: { productName: string }) {
  const toast = useToast();

  const share = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: productName, url });
        return;
      } catch {
        // Dismissing the sheet rejects — that is a cancel, not a failure, so
        // fall through to the copy path rather than reporting an error.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: "success", title: "Link copied" });
    } catch {
      toast({ tone: "danger", title: "Could not copy the link" });
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary shadow-xs transition-colors duration-150 ease-[var(--ease-hover)] hover:border-border-strong hover:text-text-primary"
    >
      <ShareIcon className="size-4" />
      Share
    </button>
  );
}
