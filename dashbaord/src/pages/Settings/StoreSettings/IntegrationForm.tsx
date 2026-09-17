import { useMemo, useState } from "react";
import { FiAlertCircle, FiCheck, FiCheckCircle, FiKey, FiLoader, FiLock, FiRotateCcw, FiShield, FiSliders, FiTrash2, FiZap } from "react-icons/fi";
import { INTEGRATIONS, fieldLabel } from "./integrationMeta";
import type { MaskedSecret, SchemaField, SectionSchema, SectionValues, TestResult } from "./types";

type Draft = Record<string, string | boolean>;
// Secret edits: string = replace, null = remove; absent = keep the stored value
type SecretEdits = Record<string, string | null>;

interface Props {
  schema: SectionSchema;
  values: SectionValues;
  canEdit: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onTest: () => Promise<TestResult>;
}

const toDraft = (schema: SectionSchema, values: SectionValues): Draft =>
  Object.fromEntries(
    schema.fields
      .filter((field) => field.type !== "secret")
      .map((field) => {
        const value = values[field.name] ?? field.default;
        if (field.type === "boolean") return [field.name, Boolean(value)];
        return [field.name, value === null || value === undefined ? "" : String(value)];
      }),
  );

const apiValue = (field: SchemaField, raw: string | boolean) => {
  if (field.type === "boolean") return raw;
  if ((field.type === "number" || field.type === "integer") && raw !== "") return Number(raw);
  return raw;
};

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 transition focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-white/[0.03]";

const SectionHeading = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className="mb-3 flex items-center gap-2.5">
    <span className="flex size-7 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">{icon}</span>
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  </div>
);

const Toggle = ({ id, label, checked, disabled, onChange }: {
  id: string; label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void;
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? "bg-accent-500" : "bg-gray-200 dark:bg-white/10"
    }`}
  >
    <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
  </button>
);

const IntegrationForm = ({ schema, values, canEdit, onSave, onTest }: Props) => {
  const meta = INTEGRATIONS[schema.key];
  const initial = useMemo(() => toDraft(schema, values), [schema, values]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [secrets, setSecrets] = useState<SecretEdits>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const patch = useMemo(() => {
    const body: Record<string, unknown> = {};
    for (const field of schema.fields) {
      if (field.type === "secret") {
        if (field.name in secrets && (secrets[field.name] === null || secrets[field.name])) body[field.name] = secrets[field.name];
      } else if (draft[field.name] !== initial[field.name]) {
        body[field.name] = apiValue(field, draft[field.name]);
      }
    }
    return body;
  }, [schema, draft, initial, secrets]);

  const dirty = Object.keys(patch).length > 0;
  const visibleValues: SectionValues = { ...values, ...draft };
  const isVisible = (field: SchemaField) => meta?.fields[field.name]?.visible?.(visibleValues) ?? true;

  const set = (name: string, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setError("");
    setTestResult(null);
  };
  const setSecret = (name: string, value: string | null | undefined) => {
    setSecrets((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return next;
    });
    setError("");
    setTestResult(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(patch);
      setSecrets({});
      setReplacing({});
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not save these settings");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await onTest());
    } catch {
      setTestResult({ ok: false, error: "The connection test could not run" });
    } finally {
      setTesting(false);
    }
  };

  const enabledField = schema.fields.find((field) => field.name === "enabled");
  const otherFields = schema.fields.filter((field) => field !== enabledField && isVisible(field));

  const renderField = (field: SchemaField) => {
    const id = `${schema.key}-${field.name}`;
    const label = fieldLabel(schema.key, field.name);
    const help = meta?.fields[field.name]?.help;
    const placeholder = meta?.fields[field.name]?.placeholder;
    const wide = field.type === "secret" || field.type === "uri" || field.type === "enum";

    const labelNode = (
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {field.required && <span className="text-error-500" aria-hidden>*</span>}
      </label>
    );

    let control;
    if (field.type === "boolean") {
      return (
        <div key={field.name} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 sm:col-span-2 dark:border-gray-800">
          <span>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            {help && <span className="block text-xs text-gray-500 dark:text-gray-400">{help}</span>}
          </span>
          <Toggle id={id} label={label} checked={Boolean(draft[field.name])} disabled={!canEdit} onChange={(value) => set(field.name, value)} />
        </div>
      );
    } else if (field.type === "enum") {
      const options = meta?.fields[field.name]?.options;
      control = (
        <select id={id} className={inputClass} value={String(draft[field.name])} disabled={!canEdit} onChange={(e) => set(field.name, e.target.value)}>
          {field.values?.map((option) => (
            <option key={option} value={option}>{options?.[option] ?? option}</option>
          ))}
        </select>
      );
    } else if (field.type === "secret") {
      const stored = values[field.name] as MaskedSecret | undefined;
      const removed = secrets[field.name] === null;
      const editing = !stored?.isSet || replacing[field.name];

      if (removed) {
        control = (
          <div className="flex h-11 items-center justify-between rounded-xl border border-dashed border-error-300 bg-error-50/60 px-3.5 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/5">
            <span className="inline-flex items-center gap-2"><FiTrash2 className="size-4" />Will be removed when you save</span>
            <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-white dark:text-gray-300 dark:hover:bg-white/5" onClick={() => setSecret(field.name, undefined)}>
              <FiRotateCcw className="size-3" />Undo
            </button>
          </div>
        );
      } else if (!editing) {
        control = (
          <div className="flex h-12 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 pl-2 pr-1.5 dark:border-gray-800 dark:bg-white/[0.03]">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                <FiLock className="size-3.5" />
              </span>
              <span className="truncate font-mono text-sm tracking-wider text-gray-700 dark:text-gray-300">{stored?.last4 ? `•••• ${stored.last4}` : "•••• saved"}</span>
              <span className="hidden rounded-md bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700 sm:inline dark:bg-accent-500/15 dark:text-accent-400">Saved</span>
            </span>
            {canEdit && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                <button type="button" className="rounded-lg px-2.5 py-1.5 text-gray-700 transition hover:bg-white hover:shadow-theme-xs dark:text-gray-300 dark:hover:bg-white/5" onClick={() => setReplacing((prev) => ({ ...prev, [field.name]: true }))}>
                  Replace
                </button>
                <button type="button" aria-label={`Remove ${label}`} className="rounded-lg px-2.5 py-1.5 text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10" onClick={() => setSecret(field.name, null)}>
                  Remove
                </button>
              </span>
            )}
          </div>
        );
        return (
          <div key={field.name} className="sm:col-span-2">
            <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
              {field.required && <span className="text-error-500" aria-hidden>*</span>}
            </span>
            {control}
            {help && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{help}</p>}
          </div>
        );
      } else {
        control = (
          <div className="relative">
            <input
              id={id}
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={secrets[field.name] ?? ""}
              disabled={!canEdit}
              placeholder={stored?.isSet ? "Enter a new value" : placeholder || "Paste the value"}
              onChange={(e) => setSecret(field.name, e.target.value)}
            />
            {replacing[field.name] && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/5"
                onClick={() => {
                  setReplacing((prev) => ({ ...prev, [field.name]: false }));
                  setSecret(field.name, undefined);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        );
      }
    } else {
      control = (
        <input
          id={id}
          type={field.type === "number" || field.type === "integer" ? "number" : field.type === "email" ? "email" : "text"}
          step={field.type === "number" ? "0.1" : undefined}
          min={field.min}
          max={field.max}
          className={inputClass}
          value={String(draft[field.name])}
          disabled={!canEdit}
          placeholder={placeholder}
          onChange={(e) => set(field.name, e.target.value)}
        />
      );
    }

    return (
      <div key={field.name} className={wide ? "sm:col-span-2" : ""}>
        {labelNode}
        {control}
        {help && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{help}</p>}
      </div>
    );
  };

  const credentialFields = otherFields.filter((field) => field.type === "secret");
  const detailFields = otherFields.filter((field) => field.type !== "secret");

  return (
    <form onSubmit={save} className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
        {enabledField && (
          <div
            className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition ${
              draft.enabled
                ? "border-accent-200 bg-accent-25 dark:border-accent-500/30 dark:bg-accent-500/10"
                : "border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.03]"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex size-9 items-center justify-center rounded-xl transition ${
                  draft.enabled ? "bg-accent-500 text-white" : "bg-white text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
                }`}
              >
                <FiZap className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white/90">{fieldLabel(schema.key, "enabled")}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {draft.enabled ? "On — used for this store once saved." : "Fill the required fields, then switch it on."}
                </span>
              </span>
            </span>
            <Toggle
              id={`${schema.key}-enabled`}
              label={fieldLabel(schema.key, "enabled")}
              checked={Boolean(draft.enabled)}
              disabled={!canEdit}
              onChange={(value) => set("enabled", value)}
            />
          </div>
        )}

        {detailFields.length > 0 && (
          <section>
            <SectionHeading icon={<FiSliders />} title="Connection details" text="Where and how this service is reached." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{detailFields.map(renderField)}</div>
          </section>
        )}

        {credentialFields.length > 0 && (
          <section>
            <SectionHeading icon={<FiKey />} title="Credentials" text="Write-only. After saving, only the last 4 characters are shown." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{credentialFields.map(renderField)}</div>
          </section>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            <FiAlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {testResult && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              testResult.ok
                ? "border-accent-200 bg-accent-25 text-accent-800 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-400"
                : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            }`}
          >
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${testResult.ok ? "bg-accent-500 text-white" : "bg-error-500 text-white"}`}>
              {testResult.ok ? <FiCheckCircle className="size-4" /> : <FiAlertCircle className="size-4" />}
            </span>
            <span className="pt-1">
              <span className="block font-semibold">{testResult.ok ? "Connection works." : "Connection failed"}</span>
              {!testResult.ok && <span className="block">{testResult.error}</span>}
            </span>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-gray-400">
          <FiShield className="size-3.5 shrink-0" />
          Keys are stored encrypted and are never sent back to the browser.
        </p>
      </div>

      {canEdit && (
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-6 py-4 backdrop-blur dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3">
            {schema.testable ? (
              <button
                type="button"
                onClick={test}
                disabled={dirty || testing}
                title={dirty ? "Save your changes to test the connection" : undefined}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
              >
                {testing ? <FiLoader className="size-4 animate-spin" /> : <FiZap className="size-4 text-accent-600" />}
                Test connection
              </button>
            ) : <span />}
            <div className="flex items-center gap-3">
              {dirty && (
                <span className="hidden items-center gap-1.5 text-xs font-medium text-warning-600 sm:inline-flex">
                  <span className="size-1.5 rounded-full bg-warning-500" />
                  Unsaved changes
                </span>
              )}
              <button
                type="submit"
                disabled={!dirty || saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-500 px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <FiLoader className="size-4 animate-spin" /> : <FiCheck className="size-4" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
          {dirty && schema.testable && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Save your changes to test the connection.</p>
          )}
        </div>
      )}
    </form>
  );
};

export default IntegrationForm;
