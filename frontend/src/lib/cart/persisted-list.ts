/**
 * A list kept in localStorage under one tenant's key, readable with
 * `useSyncExternalStore`: `get` returns the same array until the stored text
 * changes, and `subscribe` fires on writes from this tab and from other tabs.
 *
 * Each document carries a schema version and the tenant id. A document with
 * another version or another tenant, bad JSON, or rows that fail `isItem` is
 * read as empty, never half-used. When storage is blocked (private mode, quota,
 * disabled site data) the list lives in memory for this page instead.
 *
 * Framework-free: the React side is in components/cart/shop-storage-provider.tsx.
 */

const VERSION = 1;

export type ListName = "cart" | "wishlist";

export type PersistedList<T> = {
  get: () => T[];
  set: (next: T[]) => void;
  subscribe: (listener: () => void) => () => void;
};

export const storageKey = (tenantId: string, name: ListName | "guest") => `ecompos:${tenantId}:${name}`;

function readRaw(key: string, memory: Map<string, string>): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string, memory: Map<string, string>) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function parse<T>(raw: string | null, tenantId: string, isItem: (value: unknown) => value is T): T[] {
  if (!raw) return [];
  try {
    const doc = JSON.parse(raw) as { v?: unknown; tenantId?: unknown; items?: unknown };
    if (doc?.v !== VERSION || doc.tenantId !== tenantId || !Array.isArray(doc.items)) return [];
    return doc.items.every(isItem) ? doc.items : [];
  } catch {
    return [];
  }
}

/**
 * `tenantId` empty means the store could not be named: the list then works
 * for this page only and is never written, so it cannot land under a wrong key.
 */
export function createPersistedList<T>(
  tenantId: string,
  name: ListName,
  isItem: (value: unknown) => value is T,
): PersistedList<T> {
  const key = storageKey(tenantId, name);
  const memory = new Map<string, string>();
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: T[] = [];

  const rawNow = () => (tenantId ? readRaw(key, memory) : (memory.get(key) ?? null));

  const get = () => {
    const raw = rawNow();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = parse(raw, tenantId, isItem);
    }
    return cached;
  };

  const set = (next: T[]) => {
    const raw = JSON.stringify({ v: VERSION, tenantId, items: next, updatedAt: new Date().toISOString() });
    if (tenantId) writeRaw(key, raw, memory);
    else memory.set(key, raw);
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Another tab wrote the same key
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { get, set, subscribe };
}

/** This browser's guest id at one shop, created on first use. Sent as `x-guest-id` at checkout. */
export function guestIdFor(tenantId: string): string {
  const key = storageKey(tenantId, "guest");
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
