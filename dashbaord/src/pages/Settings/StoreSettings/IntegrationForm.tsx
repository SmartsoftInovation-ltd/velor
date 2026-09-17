import { useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiLoader, FiZap } from "react-icons/fi";
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
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-white/[0.03]";

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
      checked ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"
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
        <div key={field.name} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 sm:col-span-2 dark:border-gray-800">
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
          <div className="flex h-11 items-center justify-between rounded-lg border border-dashed border-error-300 px-3.5 text-sm text-error-600 dark:border-error-500/40">
            Will be removed when you save
            <button type="button" className="text-xs font-medium text-gray-600 hover:underline dark:text-gray-300" onClick={() => setSecret(field.name, undefined)}>
              Undo
            </button>
          </div>
        );
      } else if (!editing) {
        control = (
          <div className="flex h-11 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 dark:border-gray-800 dark:bg-white/[0.03]">
            <span className="font-mono text-sm tracking-wider text-gray-700 dark:text-gray-300">{stored?.last4 ? `•••• ${stored.last4}` : "•••• saved"}</span>
            {canEdit && (
              <span className="flex items-center gap-3 text-xs font-medium">
                <button type="button" className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => setReplacing((prev) => ({ ...prev, [field.name]: true }))}>
                  Replace
                </button>
                <button type="button" aria-label={`Remove ${label}`} className="text-error-600 hover:underline" onClick={() => setSecret(field.name, null)}>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:underline"
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

  return (
    <form onSubmit={save} className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {enabledField && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-gray-800 dark:bg-white/[0.03]">
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{fieldLabel(schema.key, "enabled")}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Required fields must be filled before enabling.</span>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{otherFields.map(renderField)}</div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            <FiAlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {testResult && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
              testResult.ok
                ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400"
                : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            }`}
          >
            {testResult.ok ? <FiCheckCircle className="mt-0.5 size-4 shrink-0" /> : <FiAlertCircle className="mt-0.5 size-4 shrink-0" />}
            {testResult.ok ? "Connection works." : testResult.error}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          {dirty && schema.testable && (
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Save your changes to test the connection.</p>
          )}
          <div className="flex items-center justify-between gap-3">
            {schema.testable ? (
              <button
                type="button"
                onClick={test}
                disabled={dirty || testing}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                {testing ? <FiLoader className="size-4 animate-spin" /> : <FiZap className="size-4" />}
                Test connection
              </button>
            ) : <span />}
            <button
              type="submit"
              disabled={!dirty || saving}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default IntegrationForm;
