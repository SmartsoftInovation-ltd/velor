import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getPlatformToken, setPlatformSessionExpiredHandler, setPlatformToken } from "./api";
import { authApi, type OtpChallenge } from "./endpoints";
import type { PlatformUser } from "./types";

interface PlatformAuthValue {
  operator: PlatformUser | null;
  loading: boolean;
  isSuperadmin: boolean;
  /** Step 1: the password starts a challenge; the code is texted to the operator phone */
  startSignIn: (credentials: { email: string; password: string }) => Promise<OtpChallenge>;
  /** Step 2: the code opens the session */
  verifyCode: (input: { challengeId: string; code: string }) => Promise<void>;
  resendCode: (input: { email: string; password: string; challengeId?: string }) => Promise<OtpChallenge>;
}

const PlatformAuthContext = createContext<PlatformAuthValue | null>(null);

// Platform Console session. Its own sign-in — the operator's email and password
// plus a one-time code by SMS — kept separate from the dashboard session, and
// closed when the dashboard session ends or the tab closes.
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

  const startSignIn = useCallback((credentials: { email: string; password: string }) => authApi.login(credentials), []);

  const verifyCode = useCallback(
    async (input: { challengeId: string; code: string }) => {
      const session = await authApi.verifyOtp(input);
      setPlatformToken(session.accessToken);
      queryClient.removeQueries({ queryKey: ["platform"] });
      setOperator(session.user);
    },
    [queryClient],
  );

  const resendCode = useCallback((input: { email: string; password: string; challengeId?: string }) => authApi.resendOtp(input), []);

  return (
    <PlatformAuthContext.Provider
      value={{ operator, loading, isSuperadmin: operator?.role === "superadmin", startSignIn, verifyCode, resendCode }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
};

export const usePlatformAuth = () => {
  const context = useContext(PlatformAuthContext);
  if (!context) throw new Error("usePlatformAuth must be used inside <PlatformAuthProvider>");
  return context;
};
