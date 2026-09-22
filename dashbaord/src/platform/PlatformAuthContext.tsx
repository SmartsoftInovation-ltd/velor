import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPlatformToken, refreshPlatformSession, setPlatformSessionExpiredHandler, setPlatformToken } from "./api";
import { authApi, type OtpChallenge, type ProfileUpdate } from "./endpoints";
import type { PlatformUser } from "./types";

interface PlatformAuthValue {
  operator: PlatformUser | null;
  loading: boolean;
  isSuperadmin: boolean;
  /** Step 1: the password starts a challenge; the code is texted to the operator phone */
  startSignIn: (credentials: { email: string; password: string }) => Promise<OtpChallenge>;
  /** Step 2: the code opens the session */
  verifyCode: (input: { challengeId: string; code: string }) => Promise<void>;
  /** Restore a previous console session; the gate calls it when it mounts */
  restore: () => void;
  /** End the console session — the only way back to the password and the code */
  signOut: () => Promise<void>;
  /** Edit the signed-in operator's own name, email or password */
  updateProfile: (input: ProfileUpdate) => Promise<void>;
  resendCode: (input: { email: string; password: string; challengeId?: string }) => Promise<OtpChallenge>;
}

const PlatformAuthContext = createContext<PlatformAuthValue | null>(null);

// Platform Console session. Its own sign-in — the operator's email and password
// plus a one-time code by SMS — kept separate from the dashboard session. It is
// signed in once: the access token is stored and, when it has expired, the
// refresh cookie renews it, so returning to the console asks for nothing. Only
// "Sign out" in the console, or a refresh cookie past its lifetime, ends it.
export const PlatformAuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [operator, setOperator] = useState<PlatformUser | null>(null);
  // Starts true: until the first restore settles we do not know whether there is
  // a session, and the gate must not show the sign-in form on that guess.
  const [loading, setLoading] = useState(true);
  const restoring = useRef<Promise<void> | null>(null);
  // Restore runs once per page load, not once per gate mount.
  const restored = useRef(false);

  const reset = useCallback(() => {
    setPlatformToken(null);
    setOperator(null);
    // Settled — there is no session. Leaving this false holds the spinner
    // instead of showing the sign-in form.
    restored.current = true;
    setLoading(false);
    queryClient.removeQueries({ queryKey: ["platform"] });
  }, [queryClient]);

  useEffect(() => setPlatformSessionExpiredHandler(reset), [reset]);

  // Pick up the session the operator already opened. With no stored token the
  // refresh cookie is still tried once — that is what lets an operator who
  // signed in earlier back into the console without another one-time code.
  // Only the console asks for this, so no other page pays for the request.
  const restore = useCallback(() => {
    if (restoring.current || restored.current) return;
    setLoading(true);
    restoring.current = (getPlatformToken() ? authApi.me() : refreshPlatformSession().then(() => authApi.me()))
      .then(setOperator)
      .catch(() => reset())
      .finally(() => {
        restored.current = true;
        setLoading(false);
        restoring.current = null;
      });
  }, [reset]);

  const startSignIn = useCallback((credentials: { email: string; password: string }) => authApi.login(credentials), []);

  const verifyCode = useCallback(
    async (input: { challengeId: string; code: string }) => {
      const session = await authApi.verifyOtp(input);
      setPlatformToken(session.accessToken);
      restored.current = true;
      queryClient.removeQueries({ queryKey: ["platform"] });
      setOperator(session.user);
    },
    [queryClient],
  );

  const updateProfile = useCallback(async (input: ProfileUpdate) => {
    const { user, accessToken } = await authApi.updateMe(input);
    // A new password revokes the old tokens, so the API hands this device a
    // replacement — storing it is what keeps the console open.
    if (accessToken) setPlatformToken(accessToken);
    setOperator(user);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {});
    reset();
  }, [reset]);

  const resendCode = useCallback((input: { email: string; password: string; challengeId?: string }) => authApi.resendOtp(input), []);

  return (
    <PlatformAuthContext.Provider
      value={{ operator, loading, isSuperadmin: operator?.role === "superadmin", startSignIn, verifyCode, resendCode, restore, signOut, updateProfile }}
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
