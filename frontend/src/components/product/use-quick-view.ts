"use client";

import { useEffect, useState } from "react";
import type { QuickView } from "@/lib/catalog/quick-view";

type State = { data?: QuickView; failed?: boolean };

/** Loads one product's options when its quick view opens (GET /api/quick-view/:slug). */
export function useQuickView(slug: string): State {
  const [state, setState] = useState<State>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/quick-view/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<QuickView>) : Promise.reject(new Error("quick view"))))
      .then((data) => setState({ data }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ failed: true });
      });
    return () => controller.abort();
  }, [slug]);

  return state;
}
