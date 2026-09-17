import { useState } from "react";
import { errorMessage } from "../api/client";
import { tenantsApi, type ProvisionResult } from "../api/endpoints";

const empty = { name: "", slug: "", maxStaff: "", ownerName: "", ownerEmail: "", ownerPhone: "" };

const Field = ({ id, label, value, onChange, type = "text", hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string;
}) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
    <input id={id} type={type} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

// Provisions a ready store: tenant, default roles, owner account, settings defaults
const CreateTenantForm = ({ onCreated }: { onCreated: () => void }) => {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const set = (key: keyof typeof empty) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await tenantsApi.provision({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        ...(form.maxStaff ? { limits: { maxStaff: Number(form.maxStaff) } } : {}),
        owner: { name: form.ownerName.trim(), email: form.ownerEmail.trim(), phone: form.ownerPhone.trim() },
      });
      setResult(created);
      setForm(empty);
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "Could not create the store"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="store-name" label="Store name" value={form.name} onChange={set("name")} />
        <Field id="store-slug" label="Workspace (store ID)" value={form.slug} onChange={set("slug")} hint="lowercase letters, digits, hyphens" />
        <Field id="store-max-staff" label="Max staff" type="number" value={form.maxStaff} onChange={set("maxStaff")} hint="blank = unlimited" />
        <Field id="owner-name" label="Owner name" value={form.ownerName} onChange={set("ownerName")} />
        <Field id="owner-email" label="Owner email" type="email" value={form.ownerEmail} onChange={set("ownerEmail")} />
        <Field id="owner-phone" label="Owner phone" value={form.ownerPhone} onChange={set("ownerPhone")} hint="01XXXXXXXXX" />
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create store"}
          </button>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        </div>
      </form>

      {result && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Store "{result.tenant.name}" is ready. Send these to the owner — the password is shown only once.</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Login link</dt><dd className="font-mono break-all">{result.loginUrl}</dd>
            <dt>Email</dt><dd className="font-mono">{result.owner.email}</dd>
            {result.owner.temporaryPassword && (<><dt>Temporary password</dt><dd className="font-mono">{result.owner.temporaryPassword}</dd></>)}
          </dl>
        </div>
      )}
    </div>
  );
};

export default CreateTenantForm;
