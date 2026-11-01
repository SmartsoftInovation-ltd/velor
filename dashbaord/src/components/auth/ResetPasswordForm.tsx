import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import axios from "axios";
import { FiArrowLeft, FiCheck, FiEye, FiEyeOff, FiHash, FiLock, FiUser } from "react-icons/fi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import axiosSecure from "../../hooks/useAxiosSecure";
import { getWorkspace, workspaceFromSearch } from "../../lib/session";
import { loginIdentifier, NEW_PASSWORD_MIN } from "../../lib/credentials";
import BrandMark from "./BrandMark";
import { fieldShell, inputClass } from "./authStyles";

type Identifier = { email: string } | { phone: string };

const apiMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) && error.response?.data?.message ? error.response.data.message : fallback;

const apiCode = (error: unknown): string | undefined =>
  axios.isAxiosError(error) ? error.response?.data?.code : undefined;

// Errors the user fixes in the email/phone field are shown under it, not in a toast
const IDENTIFIER_ERRORS = new Set(["ACCOUNT_NOT_FOUND", "ACCOUNT_HAS_NO_PHONE"]);

const FieldError = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1.5 text-xs text-error-500">{msg}</p> : null);

const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
    {children}
  </label>
);

const submitClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F9D63] text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(15,157,99,0.55)] transition hover:bg-[#0C8653] disabled:cursor-not-allowed disabled:opacity-70";

const signInPath = (workspace: string) => `/signin${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`;

// The code always goes by SMS to the phone number on the account.
//
// The store is named per request, not remembered: this is a public form, so
// writing an unauthenticated slug to localStorage would pair a signed-in
// session's token with a different store's x-tenant on every later request —
// and switch the query cache's namespace underneath it.
//
// Resolves to the moment the code expires (the API says how long it lasts).
const CODE_TTL_FALLBACK_SECONDS = 180;
const requestCode = async (workspace: string, who: Identifier) => {
  const res = await axiosSecure.post(
    "/auth/forgot-password",
    { workspace, ...who },
    { headers: { "x-tenant": workspace } },
  );
  const seconds = Number(res?.data?.data?.expiresIn) || CODE_TTL_FALLBACK_SECONDS;
  return Date.now() + seconds * 1000;
};

// Whole seconds left until `expiresAt`, ticking once a second
const secondsUntil = (at: number) => Math.max(0, Math.ceil((at - Date.now()) / 1000));

const useSecondsLeft = (expiresAt: number) => {
  const [seconds, setSeconds] = useState(() => secondsUntil(expiresAt));
  useEffect(() => {
    setSeconds(secondsUntil(expiresAt));
    const timer = window.setInterval(() => {
      const next = secondsUntil(expiresAt);
      setSeconds(next);
      if (next === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return seconds;
};

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Step 1: which account
const RequestCode = ({ initialWorkspace, onSent }: {
  initialWorkspace: string;
  onSent: (workspace: string, who: Identifier, expiresAt: number) => void;
}) => {
  const [workspace, setWorkspaceValue] = useState(initialWorkspace);
  const [identifier, setIdentifier] = useState("");
  const [errors, setErrors] = useState<{ workspace?: string; identifier?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const slug = workspace.trim().toLowerCase();
    const who = loginIdentifier(identifier);
    setErrors({
      workspace: slug ? undefined : "Workspace is required.",
      identifier: who ? undefined : "Enter a valid email or phone number (01XXXXXXXXX).",
    });
    if (!slug || !who) return;

    setSubmitting(true);
    try {
      onSent(slug, who, await requestCode(slug, who));
    } catch (error) {
      const message = apiMessage(error, "Could not send the reset code.");
      if (IDENTIFIER_ERRORS.has(apiCode(error) ?? "")) setErrors({ identifier: message });
      else toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-7 space-y-5">
      <div>
        <Label htmlFor="reset-workspace">Workspace</Label>
        <div className={fieldShell(Boolean(errors.workspace))}>
          <HiOutlineBuildingOffice2 aria-hidden className="size-4 shrink-0 text-gray-400" />
          <input
            id="reset-workspace"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
            value={workspace}
            onChange={(e) => setWorkspaceValue(e.target.value)}
            placeholder="your-store"
          />
        </div>
        <FieldError msg={errors.workspace} />
      </div>
      <div>
        <Label htmlFor="reset-identifier">Email or phone</Label>
        <div className={fieldShell(Boolean(errors.identifier))}>
          <FiUser aria-hidden className="size-4 shrink-0 text-gray-400" />
          <input
            id="reset-identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@company.com or 01XXXXXXXXX"
          />
        </div>
        <FieldError msg={errors.identifier} />
      </div>
      <button type="submit" disabled={submitting} className={submitClass}>
        {submitting ? "Sending…" : "Send code by SMS"}
      </button>
    </form>
  );
};

// Step 2: the SMS code and the new password
const ChooseNewPassword = ({ workspace, who, initialExpiresAt }: {
  workspace: string;
  who: Identifier;
  initialExpiresAt: number;
}) => {
  const navigate = useNavigate();
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const secondsLeft = useSecondsLeft(expiresAt);
  const expired = secondsLeft === 0;
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ otp?: string; password?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (expired) {
      setErrors({ otp: "This code has expired. Resend a new one." });
      return;
    }
    const nextErrors = {
      otp: /^\d{6}$/.test(otp) ? undefined : "Enter the 6-digit code from the SMS.",
      password: password.length >= NEW_PASSWORD_MIN ? undefined : `Use at least ${NEW_PASSWORD_MIN} characters.`,
      confirm: confirm === password ? undefined : "Passwords do not match.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      // Named per request, not remembered — see requestCode above. The signin
      // link carries the slug forward instead.
      await axiosSecure.post(
        "/auth/reset-password",
        { workspace, ...who, otp, newPassword: password },
        { headers: { "x-tenant": workspace } },
      );
      toast.success("Password updated. Sign in with your new password.");
      navigate(signInPath(workspace), { replace: true });
    } catch (error) {
      toast.error(apiMessage(error, "Could not reset the password."));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      setExpiresAt(await requestCode(workspace, who));
      setOtp("");
      setErrors({});
      toast.success("A new code has been sent.");
    } catch (error) {
      toast.error(apiMessage(error, "Could not send the reset code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-7 space-y-5">
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        We sent a 6-digit code by SMS to the phone number on this account. The code expires in 3 minutes.
      </p>
      <p
        aria-live="polite"
        data-testid="code-countdown"
        className={`text-center text-sm font-medium ${expired ? "text-error-500" : "text-gray-600 dark:text-gray-300"}`}
      >
        {expired ? (
          "Code expired. Resend a new code."
        ) : (
          <>
            Code expires in <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{mmss(secondsLeft)}</span>
          </>
        )}
      </p>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="reset-otp" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">
            SMS code
          </label>
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-60 dark:text-emerald-400"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>
        <div className={fieldShell(Boolean(errors.otp))}>
          <FiHash aria-hidden className="size-4 shrink-0 text-gray-400" />
          <input
            id="reset-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={`${inputClass} tracking-[0.3em]`}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
        </div>
        <FieldError msg={errors.otp} />
      </div>
      <div>
        <Label htmlFor="reset-new-password">New password</Label>
        <div className={fieldShell(Boolean(errors.password))}>
          <FiLock aria-hidden className="size-4 shrink-0 text-gray-400" />
          <input
            id="reset-new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="shrink-0 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
          >
            {show ? <FiEye className="size-4" /> : <FiEyeOff className="size-4" />}
          </button>
        </div>
        <FieldError msg={errors.password} />
      </div>
      <div>
        <Label htmlFor="reset-confirm-password">Confirm new password</Label>
        <div className={fieldShell(Boolean(errors.confirm))}>
          <FiCheck aria-hidden className="size-4 shrink-0 text-gray-400" />
          <input
            id="reset-confirm-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <FieldError msg={errors.confirm} />
      </div>
      <button type="submit" disabled={submitting || expired} className={submitClass}>
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
};

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const initialWorkspace = workspaceFromSearch(`?${searchParams.toString()}`) || getWorkspace() || "";
  const [sentTo, setSentTo] = useState<{ workspace: string; who: Identifier; expiresAt: number } | null>(null);
  const workspace = sentTo?.workspace ?? initialWorkspace;

  return (
    <div className="w-full max-w-[404px]">
      <BrandMark className="mb-7 size-10" />
      <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
        {sentTo ? "Enter the code" : "Forgot password?"}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {sentTo
          ? "Type the code from the SMS and choose a new password."
          : "Enter your workspace and your email or phone. We'll send a code by SMS."}
      </p>
      {sentTo ? (
        <ChooseNewPassword workspace={sentTo.workspace} who={sentTo.who} initialExpiresAt={sentTo.expiresAt} />
      ) : (
        <RequestCode initialWorkspace={initialWorkspace} onSent={(ws, who, expiresAt) => setSentTo({ workspace: ws, who, expiresAt })} />
      )}
      <Link
        to={signInPath(workspace)}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
      >
        <FiArrowLeft aria-hidden className="size-4" />
        Back to sign in
      </Link>
    </div>
  );
}
