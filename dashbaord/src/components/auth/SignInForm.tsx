import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import axios from "axios";
import { FiArrowRight, FiCheck, FiEye, FiEyeOff, FiLock, FiShield, FiUser } from "react-icons/fi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import axiosSecure, { clearAccessToken, setAccessToken } from "../../hooks/useAxiosSecure";
import { useAuth } from "../../context/AuthContext";
import { getWorkspace, setWorkspace, workspaceFromSearch } from "../../lib/session";
import { loginIdentifier } from "../../lib/credentials";
import BrandMark from "./BrandMark";
import { fieldShell, inputClass } from "./authStyles";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import { PLATFORM_WORKSPACES } from "../../platform/visibility";
import type { OtpChallenge } from "../../platform/endpoints";
import PlatformOtpStep from "./PlatformOtpStep";

// Shown after the workspace input, e.g. "baig-digital.ecompos.app"
const WORKSPACE_DOMAIN = import.meta.env.VITE_WORKSPACE_DOMAIN || "ecompos.app";
type Errors = {
  workspace?: string;
  identifier?: string;
  password?: string;
};

const RequiredDot = () => <span aria-hidden className="ml-1 inline-block size-1 translate-y-[-2px] rounded-full bg-emerald-500" />;

/**
 * A platform operator signs in on this same form.
 *
 * Their account lives in its own collection, so the store login can never match
 * it — the attempt is made against the platform endpoint instead, but only for
 * the workspace that owns the console and only for an email. Everyone else
 * takes the store path exactly as before, with no extra request.
 */
const looksLikePlatformOperator = (workspace: string, identifier: string) =>
  PLATFORM_WORKSPACES.includes(workspace) && identifier.includes("@");

export default function SignInForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAuth, clearAuth } = useAuth();
  const { startSignIn } = usePlatformAuth();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // The axios interceptor redirects here with ?sessionExpired=1 when the
  // refresh token is rejected, so the user is told why they were signed out
  // instead of silently landing on a login screen.
  const expiredNotified = useRef(false);
  useEffect(() => {
    if (searchParams.get("sessionExpired") && !expiredNotified.current) {
      expiredNotified.current = true;
      toast.error("Your session expired. Please sign in again.");
    }
  }, [searchParams]);

  // Where the user was before the session died, so we can send them back.
  const redirectTo = searchParams.get("from") || "/";
  const [formData, setFormData] = useState({
    // Deep link (?workspace=) wins over the store this browser used last
    workspace: workspaceFromSearch(`?${searchParams.toString()}`) || getWorkspace() || "",
    identifier: "",
    password: "",
  });
  const [errors, setErrors] = useState<Errors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const newErrors: Errors = {};

    if (!formData.workspace.trim()) newErrors.workspace = "Workspace is required.";

    if (!formData.identifier.trim()) newErrors.identifier = "Email or phone is required.";
    else if (!loginIdentifier(formData.identifier)) newErrors.identifier = "Enter a valid email or phone number (01XXXXXXXXX).";

    if (!formData.password) newErrors.password = "Password is required.";
    else if (formData.password.length < 4) newErrors.password = "Password must be at least 4 characters.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const workspace = formData.workspace.trim().toLowerCase();

      // Drop whatever session this browser still held before naming a new store,
      // so a failed sign-in cannot leave the previous store's token paired with
      // this store's x-tenant. The workspace is remembered only once the API
      // accepted the credentials.
      clearAuth();
      clearAccessToken();

      // The console's own workspace: try the platform account first, because a
      // store user and an operator can share an email address and only the
      // platform endpoint knows the operator's password.
      if (looksLikePlatformOperator(workspace, formData.identifier.trim())) {
        try {
          const started = await startSignIn({
            email: formData.identifier.trim().toLowerCase(),
            password: formData.password,
          });
          setWorkspace(workspace);
          setChallenge(started);
          return;
        } catch {
          // Not an operator, or not their password — fall through to the store
          // login, which is what an owner signing in here expects.
        }
      }

      // No x-tenant here: the body's `workspace` already names the store, and
      // the header is resolved before the sign-in is read — so a mistyped
      // workspace answered "Store not found" instead of "Invalid credentials".
      const response = await axiosSecure.post(
        `/auth/login`,
        { workspace, ...loginIdentifier(formData.identifier), password: formData.password },
        { headers: { "Content-Type": "application/json" }, withCredentials: true },
      );
      const { accessToken, tenant } = response.data.data;
      // Remember the slug the API resolved, not what was typed — every later
      // request sends it as x-tenant, which accepts nothing else.
      setWorkspace(tenant?.slug || workspace);
      setAccessToken(accessToken);
      toast.success("Login successful");
      await refreshAuth();
      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 500);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("An error occurred during login.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const identifierValid = Boolean(loginIdentifier(formData.identifier));

  // A platform operator's password was accepted: the console opens only once
  // the texted code is entered, so the store form gives way to that step.
  if (challenge) {
    return (
      <div className="w-full max-w-[404px]">
        <BrandMark className="mb-7 size-10" />
        <PlatformOtpStep
          challenge={challenge}
          credentials={{ email: formData.identifier.trim().toLowerCase(), password: formData.password }}
          onChallenge={setChallenge}
          onCancel={() => {
            setChallenge(null);
            setFormData((prev) => ({ ...prev, password: "" }));
          }}
          onVerified={() => navigate("/platform/sellers", { replace: true })}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[404px]">
      <BrandMark className="mb-7 size-10" />

      <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter your workspace and credentials to continue.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        <div>
          <label htmlFor="signin-workspace" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
            Workspace
            <RequiredDot />
          </label>
          <div className={fieldShell(Boolean(errors.workspace))}>
            <HiOutlineBuildingOffice2 aria-hidden className="size-4 shrink-0 text-gray-400" />
            {/* auth-autosize: the input is exactly as wide as its text, so the
                domain suffix sits right after the workspace name */}
            <span className="flex h-full min-w-0 flex-1 items-center">
              <input
                id="signin-workspace"
                name="workspace"
                autoComplete="organization"
                autoCapitalize="none"
                spellCheck={false}
                className={`${inputClass} auth-autosize`}
                value={formData.workspace}
                onChange={handleChange}
                placeholder="your-store"
              />
              <span aria-hidden className="min-w-0 truncate text-sm text-gray-400 dark:text-white/30">.{WORKSPACE_DOMAIN}</span>
            </span>
          </div>
          {errors.workspace && <p className="mt-1.5 text-xs text-error-500">{errors.workspace}</p>}
        </div>

        <div>
          <label htmlFor="signin-identifier" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
            Email or phone
            <RequiredDot />
          </label>
          <div className={fieldShell(Boolean(errors.identifier))}>
            <FiUser aria-hidden className="size-4 shrink-0 text-gray-400" />
            <input
              id="signin-identifier"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
              value={formData.identifier}
              onChange={handleChange}
              placeholder="you@company.com or 01XXXXXXXXX"
            />
            {identifierValid && <FiCheck role="img" aria-label="Valid email or phone" className="size-4 shrink-0 text-emerald-600" />}
          </div>
          {errors.identifier && <p className="mt-1.5 text-xs text-error-500">{errors.identifier}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">
              Password
              <RequiredDot />
            </label>
            <Link
              to={`/reset-password${formData.workspace.trim() ? `?workspace=${encodeURIComponent(formData.workspace.trim().toLowerCase())}` : ""}`}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              Forgot password?
            </Link>
          </div>
          <div className={fieldShell(Boolean(errors.password))}>
            <FiLock aria-hidden className="size-4 shrink-0 text-gray-400" />
            <input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              className={`${inputClass} ${showPassword ? "" : "tracking-[0.2em]"}`}
              value={formData.password}
              onChange={handleChange}
              placeholder="Your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="shrink-0 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showPassword ? <FiEye className="size-4" /> : <FiEyeOff className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-error-500">{errors.password}</p>}
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="size-[18px] cursor-pointer rounded-[5px] accent-emerald-600"
          />
          Keep me signed in on this device
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F9D63] text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(15,157,99,0.55)] transition hover:bg-[#0C8653] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <FiArrowRight aria-hidden className="size-4" />}
        </button>

        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
          <FiShield aria-hidden className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          Protected workspace. You are signed out automatically when your session expires.
        </div>
      </form>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        Don&apos;t have a workspace?{" "}
        <a
          href="mailto:smartsoftinnovationbd@gmail.com?subject=Workspace%20access%20request"
          className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
        >
          Request access
        </a>
      </p>
    </div>
  );
}
