// Which store (workspace) this browser is signed into, and storage helpers that
// keep one store's local data from leaking into another on a shared machine.

const WORKSPACE_KEY = "workspace";

const normalize = (slug: string) => slug.trim().toLowerCase();

const safeStorage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the workspace is simply not remembered
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing stored to remove
    }
  },
};

export const getWorkspace = (): string | null => {
  const value = safeStorage.get(WORKSPACE_KEY);
  return value ? normalize(value) : null;
};

export const setWorkspace = (slug: string) => {
  if (slug.trim()) safeStorage.set(WORKSPACE_KEY, normalize(slug));
};

// ?workspace=pizzashop deep link (the link a store owner receives)
export const workspaceFromSearch = (search: string): string | null => {
  const value = new URLSearchParams(search).get("workspace");
  return value ? normalize(value) : null;
};

export const scopedStorageKey = (key: string): string => {
  const workspace = getWorkspace();
  return workspace ? `t:${workspace}:${key}` : key;
};

// Forget which store this browser was signed into. Left behind, it would put a
// stale x-tenant header on the next sign-in attempt — at another store.
export const clearWorkspace = () => safeStorage.remove(WORKSPACE_KEY);

export const clearTenantStorage = (workspace: string | null = getWorkspace()) => {
  if (!workspace) return;
  const prefix = `t:${workspace}:`;
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage blocked: nothing stored to clear
  }
};
