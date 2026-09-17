import { useCallback, useEffect, useRef, useState } from "react";
import { scopedStorageKey } from "../lib/session";

// Drafts are keyed per target (a user id or a role id) so switching between
// targets never leaks one target's unsaved edits into another.
const draftKey = (namespace: string, targetId: string): string =>
  scopedStorageKey(`permission-draft:${namespace}:${targetId}`);

export interface DraftMeta {
  savedAt: number;
}

interface UsePermissionDraftArgs<T> {
  namespace: string;
  targetId: string;
  value: T;
  // Skip persisting while the target's saved permissions are still loading,
  // otherwise the empty initial state overwrites a real draft.
  enabled: boolean;
}

interface UsePermissionDraft<T> {
  draft: T | null;
  savedAt: number | null;
  restoreDraft: () => T | null;
  destroyDraft: () => void;
  hasDraft: boolean;
}

function readDraft<T>(key: string): { value: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("value" in parsed)) return null;
    return parsed as { value: T; savedAt: number };
  } catch {
    return null;
  }
}

export function usePermissionDraft<T>({
  namespace,
  targetId,
  value,
  enabled,
}: UsePermissionDraftArgs<T>): UsePermissionDraft<T> {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // The draft that existed when this target was opened, offered for restore.
  const [draft, setDraft] = useState<T | null>(null);
  const skipNextWrite = useRef(true);

  // On target change, load whatever draft is already stored for it.
  useEffect(() => {
    skipNextWrite.current = true;
    if (!targetId) {
      setDraft(null);
      setSavedAt(null);
      return;
    }
    const stored = readDraft<T>(draftKey(namespace, targetId));
    setDraft(stored ? stored.value : null);
    setSavedAt(stored ? stored.savedAt : null);
  }, [namespace, targetId]);

  // Persist on every change once the target's real data has loaded.
  useEffect(() => {
    if (!targetId || !enabled) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const stamp = Date.now();
    try {
      localStorage.setItem(
        draftKey(namespace, targetId),
        JSON.stringify({ value, savedAt: stamp }),
      );
      setSavedAt(stamp);
    } catch {
      // storage full or blocked — drafting is a convenience, never block editing
    }
  }, [namespace, targetId, value, enabled]);

  const restoreDraft = useCallback((): T | null => {
    if (!targetId) return null;
    const stored = readDraft<T>(draftKey(namespace, targetId));
    return stored ? stored.value : null;
  }, [namespace, targetId]);

  const destroyDraft = useCallback(() => {
    if (!targetId) return;
    try {
      localStorage.removeItem(draftKey(namespace, targetId));
    } catch {
      // ignore — nothing to clean up if storage is unavailable
    }
    skipNextWrite.current = true;
    setDraft(null);
    setSavedAt(null);
  }, [namespace, targetId]);

  return {
    draft,
    savedAt,
    restoreDraft,
    destroyDraft,
    hasDraft: savedAt !== null,
  };
}
