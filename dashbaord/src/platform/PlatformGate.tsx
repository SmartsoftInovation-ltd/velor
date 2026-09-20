import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { FiArrowRight, FiChevronLeft, FiEye, FiEyeOff, FiLock, FiMail, FiShield, FiSliders, FiUsers } from "react-icons/fi";
import { TbBuildingCommunity } from "react-icons/tb";
import BrandMark from "../components/auth/BrandMark";
import { errorMessage } from "./api";
import { usePlatformAuth } from "./PlatformAuthContext";
import type { OtpChallenge } from "./endpoints";

const CAPABILITIES = [
  { icon: FiUsers, title: "Create and manage sellers", text: "Provision a store and its owner in one step" },
  { icon: FiSliders, title: "Set every store's integrations", text: "SMS, email, payments and couriers per seller" },
  { icon: FiShield, title: "Protected by a one-time code", text: "The password alone never opens the console" },
];

const inputClass = (invalid: boolean) =>
  `h-12 w-full rounded-xl border bg-white pl-11 pr-11 text-sm text-gray-800 placeholder:text-gray-400 transition focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
    invalid
      ? "border-error-300 focus:border-error-400 focus:ring-error-500/15"
      : "border-gray-200 focus:border-accent-400 focus:ring-accent-500/15 dark:border-gray-800"
  }`;

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const iconClass = "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400";

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// The Platform Console has its own sign-in: the operator's email and password,
// then a one-time code texted to the platform's operator phone. It takes over the
// window — this is a separate account from the dashboard session behind it.
const PlatformGate = ({ children }: { children: ReactNode }) => {
  const { operator, loading, restore, startSignIn, verifyCode, resendCode } = usePlatformAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Pick up a session opened on an earlier visit, so the console asks for the
  // password and a code only the first time.
  useEffect(() => {
    restore();
  }, [restore]);

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
    <div className="fixed inset-0 z-99999 flex min-h-screen overflow-y-auto bg-white font-outfit dark:bg-gray-900">
      {/* Form side */}
      <div className="flex min-h-screen w-full flex-col px-5 py-5 sm:px-7 lg:w-[53.6%]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FiChevronLeft className="size-4" />
            Back to dashboard
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <TbBuildingCommunity className="size-3.5" />
            Operator access
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">
            <BrandMark className="size-11 rounded-2xl" />

            {challenge ? (
              <form onSubmit={submitCode} className="mt-7">
                <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">Check your phone</h1>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                  We texted a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{challenge.phone}</span>.
                </p>

                <div className="mt-7">
                  <label htmlFor="platform-otp" className={labelClass}>Sign-in code</label>

                  {/* One real input behind six boxes: paste and SMS autofill keep
                      working, which they do not with six separate fields. */}
                  <div className="relative" onClick={() => codeRef.current?.focus()}>
                    <input
                      id="platform-otp"
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      aria-describedby="platform-otp-expiry"
                      className="absolute inset-0 z-10 size-full cursor-default rounded-xl bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setError("");
                      }}
                      required
                    />
                    <div aria-hidden className="flex gap-2 sm:gap-2.5">
                      {Array.from({ length: 6 }, (_, index) => {
                        const digit = code[index];
                        // The cursor sits on the first empty box, or the last one when full
                        const active = index === Math.min(code.length, 5);
                        return (
                          <span
                            key={index}
                            className={`flex h-14 flex-1 items-center justify-center rounded-xl border text-xl font-semibold tabular-nums transition ${
                              error
                                ? "border-error-300 bg-error-50/50 text-error-600 dark:bg-error-500/10"
                                : digit
                                  ? "border-accent-400 bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
                                  : "border-gray-200 bg-gray-50/60 text-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-600"
                            } ${active && !error ? "border-accent-500 ring-3 ring-accent-500/15" : ""}`}
                          >
                            {digit ?? ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <p id="platform-otp-expiry" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {secondsLeft > 0 ? `Expires in ${mmss(secondsLeft)}.` : "This code has expired — send a new one."}
                  </p>
                </div>

                {error && <p role="alert" className="mt-4 rounded-xl bg-error-50 px-3.5 py-2.5 text-sm text-error-600 dark:bg-error-500/10">{error}</p>}

                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Opening…" : "Enter Platform Console"}
                  {!busy && <FiArrowRight className="size-4" />}
                </button>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button type="button" onClick={startOver} className="font-medium text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-300">
                    Use a different account
                  </button>
                  <button type="button" onClick={resend} disabled={busy} className="font-semibold text-accent-600 transition hover:text-accent-700 disabled:opacity-60">
                    Send a new code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitCredentials} className="mt-7">
                <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">Platform Console</h1>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Sign in with your platform operator account.</p>

                <div className="mt-7 space-y-4">
                  <div>
                    <label htmlFor="platform-email" className={labelClass}>Email</label>
                    <div className="relative">
                      <FiMail className={iconClass} />
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
                      <FiLock className={iconClass} />
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
                        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showPassword ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && <p role="alert" className="mt-4 rounded-xl bg-error-50 px-3.5 py-2.5 text-sm text-error-600 dark:bg-error-500/10">{error}</p>}

                <button
                  type="submit"
                  disabled={busy || !email || !password}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Sending code…" : "Continue"}
                  {!busy && <FiArrowRight className="size-4" />}
                </button>

                <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                  <FiShield className="mt-0.5 size-3.5 shrink-0" />
                  After your password we text a one-time code to the platform operator phone.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden flex-1 flex-col overflow-hidden bg-[#0a1812] px-10 py-8 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-emerald-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 size-[28rem] rounded-full bg-emerald-400/[0.06] blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="size-7 rounded-lg" />
            <span className="text-sm font-semibold tracking-wide">ECOMPOS</span>
          </div>
          <span className="rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-white/60">
            PLATFORM CONSOLE
          </span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center">
          <h2 className="max-w-[26rem] text-[32px] font-bold leading-[1.15] tracking-tight">
            The control room behind every store on the platform.
          </h2>

          <ul className="mt-6 flex flex-col gap-2.5">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-xs text-white/50">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-xs text-white/45">
          <span>
            Crafted by <span className="font-semibold text-white/80">Smartsoft Innovation</span>
          </span>
          <span className="flex items-center gap-4">
            <a href="tel:01999878862" className="transition hover:text-emerald-400">01999878862</a>
            <a href="https://smartsoftinnovation.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-emerald-400">
              smartsoftinnovation.com
            </a>
          </span>
        </footer>
      </aside>
    </div>
  );
};

export default PlatformGate;
