import { useState, type ReactNode } from "react";
import { FiArrowRight, FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { TbBuildingCommunity } from "react-icons/tb";
import { errorMessage } from "./api";
import { usePlatformAuth, WrongAccessCodeError } from "./PlatformAuthContext";

// The Platform Console opens for the platform store owner after the access code
const PlatformGate = ({ children }: { children: ReactNode }) => {
  const { operator, loading, unlock } = usePlatformAuth();
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <div className="size-10 animate-spin rounded-full border-4 border-accent-100 border-t-accent-500" />
      </div>
    );
  }

  if (operator) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await unlock(code);
      setCode("");
    } catch (err) {
      setError(err instanceof WrongAccessCodeError ? "Wrong access code. Try again." : errorMessage(err, "Could not open the Platform Console"));
    } finally {
      setBusy(false);
    }
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
          <p className="relative mt-1 text-sm text-white/70">Create sellers, set their information and manage integrations.</p>
        </div>

        <form onSubmit={submit} className="-mt-4 space-y-4 rounded-t-3xl bg-white px-8 pb-8 pt-7 dark:bg-gray-900">
          <div>
            <label htmlFor="platform-access-code" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Access code</label>
            <div className="relative">
              <FiLock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                id="platform-access-code"
                type={visible ? "text" : "password"}
                autoComplete="off"
                autoFocus
                placeholder="Enter the secret code"
                className={`h-12 w-full rounded-xl border bg-white pl-10 pr-11 text-sm tracking-wide text-gray-800 placeholder:tracking-normal placeholder:text-gray-400 transition focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
                  error ? "border-error-300 focus:ring-error-500/15" : "border-gray-200 focus:border-accent-400 focus:ring-accent-500/15 dark:border-gray-800"
                }`}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                required
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide code" : "Show code"}
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-700"
              >
                {visible ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-error-600">{error}</p>}

          <button
            type="submit"
            disabled={busy || !code}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Opening…" : "Enter Platform Console"}
            {!busy && <FiArrowRight className="size-4" />}
          </button>
          <p className="text-center text-xs text-gray-400">Only the platform store owner can open the console.</p>
        </form>
      </div>
    </div>
  );
};

export default PlatformGate;
