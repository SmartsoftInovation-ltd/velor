import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, setSessionExpiredHandler, setToken } from "../api/client";
import { authApi } from "../api/endpoints";
import type { PlatformUser } from "../api/types";

interface AuthContextValue {
  user: PlatformUser | null;
  loading: boolean;
  isSuperadmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const reset = useCallback(() => {
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(reset);
    if (!getToken()) return;
    authApi
      .me()
      .then(setUser)
      .catch(reset)
      .finally(() => setLoading(false));
  }, [reset]);

  const signIn = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setToken(result.accessToken);
    queryClient.clear();
    setUser(result.user);
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } finally {
      reset();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSuperadmin: user?.role === "superadmin", signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
};
