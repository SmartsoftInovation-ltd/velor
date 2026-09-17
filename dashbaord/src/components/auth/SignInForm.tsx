import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import axios from "axios";
import { FiArrowRight, FiCheck, FiEye, FiEyeOff, FiLock, FiMail, FiShield } from "react-icons/fi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import axiosSecure, { setAccessToken } from "../../hooks/useAxiosSecure";
import { useAuth } from "../../context/AuthContext";
import { getWorkspace, setWorkspace, workspaceFromSearch } from "../../lib/session";
import BrandMark from "./BrandMark";

// Shown after the workspace input, e.g. "baig-digital.ecompos.app"
const WORKSPACE_DOMAIN = import.meta.env.VITE_WORKSPACE_DOMAIN || "ecompos.app";
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

type Errors = {
  workspace?: string;
  email?: string;
  password?: string;
};

const fieldShell = (hasError: boolean) =>
  `flex h-12 items-center gap-2.5 rounded-xl border bg-white px-3.5 transition focus-within:ring-4 dark:bg-white/[0.03] ${
    hasError
      ? "border-error-400 focus-within:border-error-500 focus-within:ring-error-500/10"
      : "border-gray-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/10 dark:border-gray-800"
  }`;

// auth-input: keeps the browser's autofill highlight off (see index.css)
const inputClass =
  "auth-input h-full w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30";

const RequiredDot = () => <span aria-hidden className="ml-1 inline-block size-1 translate-y-[-2px] rounded-full bg-emerald-500" />;

export default function SignInForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAuth } = useAuth();
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
    email: "",
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

    if (!formData.email) newErrors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(formData.email)) newErrors.email = "Email is invalid.";

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
      // Remember the store first: the request interceptor sends it as x-tenant
      setWorkspace(workspace);
      const response = await axiosSecure.post(
        `/auth/login`,
        { ...formData, workspace },
        { headers: { "Content-Type": "application/json" }, withCredentials: true },
      );
      const { accessToken } = response.data.data;
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

  const emailValid = EMAIL_PATTERN.test(formData.email);

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
          <label htmlFor="signin-email" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
            Email
            <RequiredDot />
          </label>
          <div className={fieldShell(Boolean(errors.email))}>
            <FiMail aria-hidden className="size-4 shrink-0 text-gray-400" />
            <input
              id="signin-email"
              type="email"
              name="email"
              autoComplete="username"
              className={inputClass}
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
            />
            {emailValid && <FiCheck role="img" aria-label="Valid email" className="size-4 shrink-0 text-emerald-600" />}
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-error-500">{errors.email}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">
              Password
              <RequiredDot />
            </label>
            <a href="/reset-password" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
              Forgot password?
            </a>
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
