"use client";

import { Children, type ReactNode, useEffect, useRef, useState } from "react";

const BATCH = 12;

/**
 * Infinite scroll over items the server already rendered: shows the first
 * batch, then the next one each time the shopper nears the end of the list.
 */
export function InfiniteList({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(BATCH);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = shown < items.length;

  // Re-observed after every batch: a sentinel still in view would not fire again
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((count) => count + BATCH);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, more]);

  return (
    <>
      <ul className={className}>{items.slice(0, shown)}</ul>
      {more ? (
        <div ref={sentinel} role="status" className="flex justify-center py-8">
          <span className="size-6 animate-spin rounded-full border-2 border-border-default border-t-brand-500" />
          <span className="sr-only">Loading more products</span>
        </div>
      ) : null}
    </>
  );
}
