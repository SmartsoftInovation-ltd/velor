import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axiosSecure from "../hooks/useAxiosSecure";

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
}

type PermissionMap = Record<string, Set<string>>;

interface AuthContextType {
  user: AuthUser | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  can: (module: string, action: string) => boolean;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
}

// Build permission map from user's direct permissions only.
// Role membership is used solely to detect superadmin — it does NOT grant permissions.
// Access is controlled per-user via the "Create User Permission" page in the dashboard.
function buildPermissionMap(user: AuthUser): PermissionMap {
  const map: PermissionMap = {};

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const isSuperAdmin = user?.roles?.some((r) => r.slug === "superadmin") ?? false;

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await axiosSecure.get("/auth/getme");
      const fetchedUser: AuthUser = res.data?.data;
      if (fetchedUser) {
        setUser(fetchedUser);
        const builtMap = buildPermissionMap(fetchedUser);
        setPermissionMap(builtMap);
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
    if (isSuperAdmin) return true;
    return permissionMap[module.toLowerCase()]?.has(action) ?? false;
  }, [isSuperAdmin, permissionMap]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setPermissionMap({});
  }, []);

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isLoading, can, refreshAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
