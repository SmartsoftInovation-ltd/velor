import { useAuth } from "../context/AuthContext";
import type { Action } from "../config/permissions";

// toggle maps to "edit" — activating/deactivating is an edit-level action
function resolveAction(action: Action): string {
  return action === "toggle" ? "edit" : action;
}

export function usePermission(module: string, action: Action): boolean {
  const { can, isSuperAdmin, isLoading } = useAuth();
  if (isSuperAdmin) return true;
  if (isLoading) return false;
  return can(module, resolveAction(action));
}
