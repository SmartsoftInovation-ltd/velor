import { useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiCopy, FiEye, FiEyeOff, FiUser } from "react-icons/fi";
import { HiOutlineBuildingStorefront } from "react-icons/hi2";
import { errorMessage } from "../../platform/api";
import { tenantsApi, type ProvisionResult } from "../../platform/endpoints";
import { NEW_PASSWORD_MIN } from "../../lib/credentials";
import { CredentialsNoticeLine, Field, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const empty = { name: "", slug: "", maxStaff: "", ownerName: "", ownerEmail: "", ownerPhone: "", ownerPassword: "" };

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const Step = ({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) => (
  <div className="mb-4 flex items-center gap-3">
    <span className="relative flex size-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
      {icon}
      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">{n}</span>
    </span>
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  </div>
);

const CopyValue = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select it and copy manually");
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <p className="truncate font-mono text-sm text-gray-800 dark:text-gray-200" title={value}>{value}</p>
      </div>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:text-gray-900 dark:bg-white/5">
        {copied ? <FiCheck className="size-4 text-accent-600" /> : <FiCopy className="size-4" />}
      </button>
    </div>
  );
};

// Creates a ready seller: tenant, owner role and account (with the password set
// here), settings defaults. The owner is sent their sign-in details by SMS.
const CreateSellerForm = ({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) => {
  const [form, setForm] = useState(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ProvisionResult & { password: string }) | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "name" && !slugTouched ? { slug: slugify(value) } : {}),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await tenantsApi.provision({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        ...(form.maxStaff ? { limits: { maxStaff: Number(form.maxStaff) } } : {}),
        owner: { name: form.ownerName.trim(), email: form.ownerEmail.trim(), phone: form.ownerPhone.trim(), password: form.ownerPassword },
      });
      setResult({ ...created, password: form.ownerPassword });
      setShowPassword(false);
      setForm(empty);
      setSlugTouched(false);
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "Could not create the seller"));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent-50 ring-8 ring-accent-50/50 dark:bg-accent-500/15 dark:ring-accent-500/5">
            <FiCheck className="size-7 text-accent-600" />
          </span>
          <p className="text-base font-semibold text-gray-900 dark:text-white/90">{result.tenant.name} is ready</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The owner signs in with their email or phone and this password.</p>
        </div>
        <CredentialsNoticeLine notice={result.notification} owner={result.owner} />
        <div className="space-y-2 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <CopyValue label="Login link" value={result.loginUrl} />
          <CopyValue label="Email" value={result.owner.email} />
          <CopyValue label="Phone" value={result.owner.phone} />
          <CopyValue label="Password" value={result.password} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setResult(null)} className={secondaryButtonClass}>Create another</button>
          <button type="button" onClick={onClose} className={primaryButtonClass}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section>
        <Step n={1} icon={<HiOutlineBuildingStorefront />} title="Seller details" text="The business and its sign-in workspace" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="seller-name" label="Seller name">
              <input id="seller-name" className={inputClass} value={form.name} onChange={set("name")} placeholder="Pizza Shop" required />
            </Field>
          </div>
          <Field id="seller-slug" label="Workspace" hint="Lowercase letters, digits and hyphens. Staff type it at sign-in.">
            <input
              id="seller-slug"
              className={`${inputClass} font-mono`}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug")(e);
              }}
              placeholder="pizza-shop"
              required
            />
          </Field>
          <Field id="seller-max-staff" label="Max staff" hint="Leave blank for unlimited">
            <input id="seller-max-staff" type="number" min={1} className={inputClass} value={form.maxStaff} onChange={set("maxStaff")} placeholder="Unlimited" />
          </Field>
        </div>
      </section>

      <section className="border-t border-dashed border-gray-200 pt-6 dark:border-gray-800">
        <Step n={2} icon={<FiUser />} title="Owner account" text="Gets every permission in their store" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="owner-name" label="Owner name">
              <input id="owner-name" className={inputClass} value={form.ownerName} onChange={set("ownerName")} placeholder="Rahim Uddin" required />
            </Field>
          </div>
          <Field id="owner-email" label="Owner email">
            <input id="owner-email" type="email" className={inputClass} value={form.ownerEmail} onChange={set("ownerEmail")} placeholder="owner@example.com" required />
          </Field>
          <Field id="owner-phone" label="Owner phone">
            <input id="owner-phone" className={inputClass} value={form.ownerPhone} onChange={set("ownerPhone")} placeholder="01XXXXXXXXX" required />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="owner-password"
              label="Owner password"
              hint={`At least ${NEW_PASSWORD_MIN} characters. The owner can keep it or change it later from their profile.`}
            >
              <div className="relative">
                <input
                  id="owner-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={NEW_PASSWORD_MIN}
                  className={`${inputClass} pr-11`}
                  value={form.ownerPassword}
                  onChange={set("ownerPassword")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showPassword ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
                </button>
              </div>
            </Field>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Creating…" : "Create seller"}</button>
      </div>
    </form>
  );
};

export default CreateSellerForm;
