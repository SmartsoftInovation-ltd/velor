import { useEffect, useRef } from "react";

/**
 * The next page of a list the server answers in pages, loaded as soon as the
 * end of the list scrolls into view (BUG-P2-010). Watches the page scroll, so
 * it suits lists that grow the page; a table with its own scroll box loads
 * from its virtualizer instead and passes `watch={false}` to show only the
 * spinner.
 */
export default function InfiniteScrollTrigger({
  hasMore,
  loading,
  onLoadMore,
  watch = true,
  label = "Loading more…",
}: {
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  watch?: boolean;
  label?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!watch || !el || !hasMore || loading || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      // Start a little before the end is reached so the rows are there in time
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [watch, hasMore, loading, onLoadMore]);

  return (
    <>
      {watch && hasMore && <div ref={sentinel} aria-hidden="true" className="h-px" />}
      {loading && (
        <div
          role="status"
          className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-500" />
          {label}
        </div>
      )}
    </>
  );
}
