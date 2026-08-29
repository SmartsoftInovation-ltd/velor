import { useEffect, useRef } from "react";

// Keeps an in-progress form alive across a page reload.
//
// Only the fields the caller passes are stored — fetched lists (customers,
// accounts, search results) and transient UI flags (open dropdowns, modals)
// are deliberately left out, since restoring those would either go stale or
// reopen a dialog the user had closed.
//
// sessionStorage rather than localStorage: a half-finished sale should survive
// F5 but not linger in another tab or turn up days later on a shared till.

const PREFIX = "sales-draft:";

export const loadDraft = <T,>(key: string): Partial<T> | null => {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    // Corrupt or unreadable draft is not worth failing the page over.
    return null;
  }
};

export const clearDraft = (key: string) => {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Storage blocked — nothing to clear.
  }
};

/**
 * Writes `values` to sessionStorage under `key` whenever they change.
 *
 * Pass `enabled: false` to disable persistence entirely — used for edit mode,
 * where the form is seeded from a saved sale and a stale draft would silently
 * overwrite real data.
 */
export const useFormDraft = <T extends Record<string, unknown>>(
  key: string,
  values: T,
  enabled = true,
) => {
  // The first render is skipped so an empty initial form cannot overwrite a
  // draft before the restore has had a chance to apply it.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(values));
    } catch {
      // Quota exceeded or storage blocked — the form still works, it just
      // will not survive a reload.
    }
  }, [key, values, enabled]);
};
