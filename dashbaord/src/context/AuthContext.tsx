import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../hooks/useAxiosSecure";
import { clearTenantStorage, clearWorkspace } from "../lib/session";
import { disconnectSocket } from "../socket/socket";

// ---------- Types ----------
interface PermissionEntry {
  permission: { _id: string; slug: string; permissionName: string; isActive?: boolean };
  actions: string[];
}

interface AuthRole {
  _id: string;
  slug: string;
  name: string;
  isActive: boolean;
  permissions?: PermissionEntry[];
}

export interface TenantSummary {
  _id: string;
  name: string;
  slug: string;
  status: string;
  limits?: { maxStaff?: number | null };
}

export interface Features {
  sms: boolean;
  email: boolean;
  sslcommerz: boolean;
  couriers: { pathao: boolean; steadfast: boolean };
  cloudinary: boolean;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  image?: { url: string; status: string };
  roles: AuthRole[];
  permissions: PermissionEntry[];
  Options: string[];
  Reports: string[];
  discountLimit?: number;
  isActive: boolean;
  // Multi-tenant API (older API versions omit these)
  tenant?: TenantSummary | null;
  effectivePermissions?: Record<string, string[]>;
  features?: Features | null;
  isOwner?: boolean;
}

type PermissionMap = Record<string, Set<string>>;

interface AuthContextType {
  user: AuthUser | null;
  tenant: TenantSummary | null;
  features: Features | null;
  isOwner: boolean;
  /** @deprecated use isOwner — kept for existing callers */
  isSuperAdmin: boolean;
  isLoading: boolean;
  can: (module: string, action: string) => boolean;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
  /** Replace integration flags after settings change (no session reload) */
  updateFeatures: (features: Features) => void;
}

const LEGACY_OWNER_SLUGS = ["owner", "superadmin"];

// The API computes effective permissions (active roles ∪ direct grants), the same
// rule authorize() enforces. Older APIs only return direct grants.
function buildPermissionMap(user: AuthUser): PermissionMap {
  const map: PermissionMap = {};

  if (user.effectivePermissions) {
    for (const [slug, actions] of Object.entries(user.effectivePermissions)) {
      map[slug] = new Set(actions);
    }
    return map;
  }

  for (const p of user.permissions) {
    const slug = p.permission?.slug;
    if (!slug || p.permission.isActive === false) continue;
    if (!map[slug]) map[slug] = new Set();
    p.actions.forEach((a) => map[slug].add(a));
  }

  return map;
}

// ---------- Context ----------
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const isOwner =
    user?.isOwner ?? (user?.roles?.some((r) => LEGACY_OWNER_SLUGS.includes(r.slug)) || false);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await axiosSecure.get("/auth/getme");
      const fetchedUser: AuthUser = res.data?.data;
      if (fetchedUser) {
        setUser(fetchedUser);
        setPermissionMap(buildPermissionMap(fetchedUser));
      }
    } catch (err) {
      console.error("[Auth] getme FAILED:", err);
      setUser(null);
      setPermissionMap({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const can = useCallback((module: string, action: string): boolean => {
    if (isOwner) return true;
    return permissionMap[module.toLowerCase()]?.has(action) ?? false;
  }, [isOwner, permissionMap]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    // A new session must never see the previous session's cached server data
    queryClient.clear();
    await fetchUser();
  }, [fetchUser, queryClient]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setPermissionMap({});
    queryClient.clear();
    // Order matters: clearTenantStorage() reads the workspace to build its key
    // prefix, so the workspace is forgotten only after its data is gone.
    clearTenantStorage();
    clearWorkspace();
    disconnectSocket();
  }, [queryClient]);

  const updateFeatures = useCallback((features: Features) => {
    setUser((current) => (current ? { ...current, features } : current));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant: user?.tenant ?? null,
        features: user?.features ?? null,
        isOwner,
        isSuperAdmin: isOwner,
        isLoading,
        can,
        refreshAuth,
        clearAuth,
        updateFeatures,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
