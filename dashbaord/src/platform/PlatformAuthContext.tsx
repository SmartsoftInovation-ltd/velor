import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getPlatformToken, setPlatformSessionExpiredHandler, setPlatformToken } from "./api";
import { isPlatformConsoleCode } from "./accessCode";
import { authApi } from "./endpoints";
import type { PlatformUser } from "./types";

export class WrongAccessCodeError extends Error {
  constructor() {
    super("Wrong access code");
  }
}

interface PlatformAuthValue {
  operator: PlatformUser | null;
  loading: boolean;
  isSuperadmin: boolean;
  unlock: (code: string) => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthValue | null>(null);

// Platform Console session. Opened from the dashboard session of the platform
// store owner plus the access code; ends with the dashboard session or the tab.
export const PlatformAuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [operator, setOperator] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getPlatformToken()));

  const reset = useCallback(() => {
    setPlatformToken(null);
    setOperator(null);
    setLoading(false);
    queryClient.removeQueries({ queryKey: ["platform"] });
  }, [queryClient]);

  useEffect(() => {
    setPlatformSessionExpiredHandler(reset);
    if (!getPlatformToken()) return;
    authApi
      .me()
      .then(setOperator)
      .catch(reset)
      .finally(() => setLoading(false));
  }, [reset]);

  // Signing out of the dashboard closes the console too
  useEffect(() => {
    if (authLoading || user || !getPlatformToken()) return;
    authApi.logout().catch(() => {});
    reset();
  }, [authLoading, user, reset]);

  const unlock = async (code: string) => {
    if (!isPlatformConsoleCode(code)) throw new WrongAccessCodeError();
    const result = await authApi.consoleAccess();
    setPlatformToken(result.accessToken);
    queryClient.removeQueries({ queryKey: ["platform"] });
    setOperator(result.user);
  };

  return (
    <PlatformAuthContext.Provider value={{ operator, loading, isSuperadmin: operator?.role === "superadmin", unlock }}>
      {children}
    </PlatformAuthContext.Provider>
  );
};

export const usePlatformAuth = () => {
  const context = useContext(PlatformAuthContext);
  if (!context) throw new Error("usePlatformAuth must be used inside <PlatformAuthProvider>");
  return context;
};
