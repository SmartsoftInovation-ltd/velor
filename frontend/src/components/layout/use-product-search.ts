"use client";

import { useEffect, useState } from "react";
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH } from "@/lib/catalog/product-search";
import type { SearchResult } from "@/lib/catalog/types";

const DEBOUNCE_MS = 300;

type Answer = { query: string; result: SearchResult | null; failed: boolean };

/**
 * Suggestions for what is typed, asked for once typing pauses. Each new term
 * cancels the wait and any request in flight, so a slow old answer can never
 * replace a newer one. The last answer stays up until the next one lands, which
 * keeps the panel from flickering between keystrokes.
 */
export function useProductSearch(term: string) {
  const query = term.trim().slice(0, MAX_SEARCH_LENGTH);
  const ready = query.length >= MIN_SEARCH_LENGTH;
  const [answer, setAnswer] = useState<Answer>({ query: "", result: null, failed: false });

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const result: SearchResult = await res.json();
        setAnswer({ query, result, failed: false });
      } catch {
        if (!controller.signal.aborted) setAnswer({ query, result: null, failed: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, ready]);

  return {
    query,
    ready,
    result: answer.result,
    failed: answer.failed,
    loading: ready && answer.query !== query,
  };
}
