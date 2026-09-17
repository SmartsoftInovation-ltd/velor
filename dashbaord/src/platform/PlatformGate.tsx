import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiShield } from "react-icons/fi";
import { TbBuildingCommunity } from "react-icons/tb";
import { errorMessage } from "./api";
import { usePlatformAuth } from "./PlatformAuthContext";
import type { OtpChallenge } from "./endpoints";

const inputClass = (invalid: boolean) =>
  `h-12 w-full rounded-xl border bg-white pl-10 pr-11 text-sm text-gray-800 placeholder:text-gray-400 transition focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
    invalid ? "border-error-300 focus:ring-error-500/15" : "border-gray-200 focus:border-accent-400 focus:ring-accent-500/15 dark:border-gray-800"
  }`;

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// The Platform Console has its own sign-in: the operator's email and password,
// then a one-time code texted to the platform's operator phone.
const PlatformGate = ({ children }: { children: ReactNode }) => {
  const { operator, loading, startSignIn, verifyCode, resendCode } = usePlatformAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // The code is only good for as long as the server says
  useEffect(() => {
    if (!challenge) return;
    setSecondsLeft(challenge.expiresInSeconds);
    codeRef.current?.focus();
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <div className="size-10 animate-spin rounded-full border-4 border-accent-100 border-t-accent-500" />
      </div>
    );
  }

  if (operator) return <>{children}</>;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const submitCredentials = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      setChallenge(await startSignIn({ email: email.trim(), password }));
      setCode("");
    }, "Could not sign in");
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    return run(() => verifyCode({ challengeId: challenge!.challengeId, code }), "Could not open the Platform Console");
  };

  const resend = () =>
    run(async () => {
      setChallenge(await resendCode({ email: email.trim(), password, challengeId: challenge?.challengeId }));
      setCode("");
    }, "Could not send a new code");

  const startOver = () => {
    setChallenge(null);
    setCode("");
    setError("");
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="relative overflow-hidden bg-[#0b3d2a] px-8 pb-10 pt-8 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent-500/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:14px_14px]" />
          <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/20">
            <TbBuildingCommunity />
          </span>
          <h1 className="relative mt-5 text-2xl font-semibold tracking-tight">Platform Console</h1>
          <p className="relative mt-1 text-sm text-white/70">
            {challenge ? "Enter the code we texted you." : "Sign in with your platform operator account."}
          </p>
        </div>

        {challenge ? (
          <form onSubmit={submitCode} className="-mt-4 space-y-4 rounded-t-3xl bg-white px-8 pb-8 pt-7 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A 6-digit code was sent to <span className="font-medium text-gray-700 dark:text-gray-300">{challenge.phone}</span>.
            </p>

            <div>
              <label htmlFor="platform-otp" className={labelClass}>Sign-in code</label>
              <div className="relative">
                <FiShield className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="platform-otp"
                  ref={codeRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className={`${inputClass(Boolean(error))} pr-4 text-center text-lg tracking-[0.4em]`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {secondsLeft > 0 ? `Expires in ${mmss(secondsLeft)}.` : "This code has expired — send a new one."}
              </p>
            </div>

            {error && <p role="alert" className="text-sm text-error-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening…" : "Enter Platform Console"}
              {!busy && <FiArrowRight className="size-4" />}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={startOver} className="font-medium text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-300">
                Use a different account
              </button>
              <button type="button" onClick={resend} disabled={busy} className="font-semibold text-accent-600 transition hover:text-accent-700 disabled:opacity-60">
                Send a new code
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitCredentials} className="-mt-4 space-y-4 rounded-t-3xl bg-white px-8 pb-8 pt-7 dark:bg-gray-900">
            <div>
              <label htmlFor="platform-email" className={labelClass}>Email</label>
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="platform-email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  placeholder="you@example.com"
                  className={inputClass(Boolean(error))}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="platform-password" className={labelClass}>Password</label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="platform-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className={inputClass(Boolean(error))}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-700"
                >
                  {showPassword ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-error-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending code…" : "Continue"}
              {!busy && <FiArrowRight className="size-4" />}
            </button>
            <p className="text-center text-xs text-gray-400">We text a one-time code to the platform operator phone.</p>
          </form>
        )}
      </div>
    </div>
  );
};

export default PlatformGate;
