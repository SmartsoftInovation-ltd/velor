import { useEffect, useRef, useState } from "react";
import { FiArrowRight, FiShield } from "react-icons/fi";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { OtpChallenge } from "../../platform/endpoints";
import { fieldShell, inputClass } from "./authStyles";

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/**
 * The second step of a platform operator's sign-in, shown in place of the store
 * sign-in form once their password has been accepted.
 *
 * The password alone never opens the console: it only starts a challenge, and
 * the code texted to the platform's phone is what completes it. That is the
 * whole point of the extra step, so this screen cannot be skipped past — the
 * only way back is to start over as a different account.
 */
const PlatformOtpStep = ({ challenge, credentials, onChallenge, onCancel, onVerified }: {
  challenge: OtpChallenge;
  credentials: { email: string; password: string };
  onChallenge: (challenge: OtpChallenge) => void;
  onCancel: () => void;
  onVerified: () => void;
}) => {
  const { verifyCode, resendCode } = usePlatformAuth();
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(challenge.expiresInSeconds);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // The code is only good for as long as the server said it would be
  useEffect(() => {
    setCode("");
    setSecondsLeft(challenge.expiresInSeconds);
    codeRef.current?.focus();
    const timer = setInterval(() => setSecondsLeft((s: number) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [challenge]);

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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      await verifyCode({ challengeId: challenge.challengeId, code });
      onVerified();
    }, "That code was not accepted");
  };

  const resend = () =>
    run(async () => {
      onChallenge(await resendCode({ ...credentials, challengeId: challenge.challengeId }));
    }, "Could not send a new code");

  return (
    <div>
      <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
        <FiShield className="size-5" />
      </span>

      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Enter your code</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        We sent a 6-digit code to {challenge.phone}.
      </p>

      <form onSubmit={submit} className="mt-7">
        <label htmlFor="platform-otp" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
          Sign-in code
        </label>
        <div className={fieldShell(Boolean(error))}>
          <input
            id="platform-otp"
            ref={codeRef}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-describedby="platform-otp-expiry"
            className={`${inputClass} text-center text-lg font-semibold tracking-[0.5em] tabular-nums`}
          />
        </div>

        <p id="platform-otp-expiry" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {secondsLeft > 0 ? `Expires in ${mmss(secondsLeft)}.` : "This code has expired — send a new one."}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-error-50 px-3.5 py-2.5 text-sm text-error-600 dark:bg-error-500/10">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Opening…" : "Enter Platform Console"}
          {!busy && <FiArrowRight className="size-4" />}
        </button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="font-medium text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-300"
          >
            Use a different account
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="font-semibold text-emerald-600 transition hover:text-emerald-700 disabled:opacity-60"
          >
            Send a new code
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlatformOtpStep;
