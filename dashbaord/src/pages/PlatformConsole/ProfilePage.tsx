import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff, FiLock, FiShield, FiUser } from "react-icons/fi";
import PageMeta from "../../components/common/PageMeta";
import { errorMessage } from "../../platform/api";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { ProfileUpdate } from "../../platform/endpoints";
import {
  Avatar,
  cardClass,
  ConsoleHeader,
  Field,
  formatDate,
  inputClass,
  primaryButtonClass,
} from "./ui";

const MIN_PASSWORD = 12;

const PasswordInput = ({ id, value, onChange, autoComplete, placeholder }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <FiLock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputClass} pl-10 pr-11`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-300"
      >
        {visible ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
      </button>
    </div>
  );
};

// An operator's own account. Separate from /platform/operators, which is a
// superadmin managing other people: this page is every operator's own, support
// role included, and it never offers role or active state.
const ProfilePage = () => {
  const { operator, updateProfile } = usePlatformAuth();

  const [name, setName] = useState(operator?.name ?? "");
  const [email, setEmail] = useState(operator?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const emailChanged = email.trim().toLowerCase() !== (operator?.email ?? "").toLowerCase();
  const nameChanged = name.trim() !== (operator?.name ?? "");
  // The API asks for the current password before it moves an email or a password
  const needsCurrentPassword = emailChanged || Boolean(password);

  const save = useMutation({
    mutationFn: (body: ProfileUpdate) => updateProfile(body),
    onSuccess: () => {
      toast.success(password ? "Profile and password updated" : "Profile updated");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not update your profile")),
  });

  const problem = () => {
    if (!name.trim()) return "Your name cannot be empty";
    if (!email.trim()) return "Your email cannot be empty";
    if (password && password.length < MIN_PASSWORD) return `A new password needs at least ${MIN_PASSWORD} characters`;
    if (password && password !== confirmPassword) return "The two passwords do not match";
    if (needsCurrentPassword && !currentPassword) return "Enter your current password to confirm this change";
    if (!nameChanged && !emailChanged && !password) return "Nothing to save yet";
    return null;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = problem();
    if (invalid) return toast.error(invalid);

    save.mutate({
      ...(nameChanged && { name: name.trim() }),
      ...(emailChanged && { email: email.trim() }),
      ...(password && { password }),
      ...(needsCurrentPassword && { currentPassword }),
    });
  };

  if (!operator) return null;

  return (
    <>
      <PageMeta title="Your profile · Platform Console" description="Your operator account" />

      <ConsoleHeader
        crumbs={[{ label: "Platform Console" }, { label: "Your profile" }]}
        title="Your profile"
        subtitle="Your operator account — name, sign-in email and password."
      />

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <section className={`${cardClass} h-fit p-5`}>
          <div className="flex items-center gap-3.5">
            <Avatar name={operator.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900 dark:text-white/90">{operator.name}</p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{operator.email}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 border-t border-gray-100 pt-5 text-sm dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500 dark:text-gray-400">Role</dt>
              <dd className="inline-flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                {operator.role === "superadmin" ? <FiShield className="size-3.5 text-accent-600" /> : <FiEye className="size-3.5" />}
                {operator.role === "superadmin" ? "Superadmin" : "Support"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500 dark:text-gray-400">Last sign-in</dt>
              <dd className="font-medium text-gray-800 dark:text-gray-200">{formatDate(operator.lastLoginAt, true) || "—"}</dd>
            </div>
          </dl>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            <FiShield className="mt-0.5 size-3.5 shrink-0" />
            Only a superadmin can change your role, on the Operators page.
          </p>
        </section>

        <form onSubmit={submit} className={`${cardClass} p-5`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white/90">
            <FiUser className="size-4 text-gray-400" />
            Account details
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="profile-name" label="Name">
              <input id="profile-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field id="profile-email" label="Sign-in email" hint="You sign in to the console with this address.">
              <input id="profile-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
          </div>

          <h2 className="mt-7 flex items-center gap-2 border-t border-gray-100 pt-5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white/90">
            <FiLock className="size-4 text-gray-400" />
            Change password
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Leave these empty to keep your current password. A new one signs you out of every other device; this one stays open.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="profile-new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
              <PasswordInput id="profile-new-password" value={password} onChange={setPassword} autoComplete="new-password" />
            </Field>
            <Field id="profile-confirm-password" label="Repeat new password">
              <PasswordInput id="profile-confirm-password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            </Field>
          </div>

          {needsCurrentPassword && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <Field
                id="profile-current-password"
                label="Current password"
                hint={emailChanged && !password ? "Moving your sign-in email needs it." : "Needed to set a new password."}
              >
                <PasswordInput
                  id="profile-current-password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  placeholder="Your current password"
                />
              </Field>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button type="submit" className={primaryButtonClass} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ProfilePage;
