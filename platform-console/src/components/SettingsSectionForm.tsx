import { useMemo, useState } from "react";
import type { MaskedSecret, SectionValues, SettingsField, SettingsSectionSchema, TestResult } from "../api/types";

type Draft = Record<string, string | boolean>;

interface Props {
  schema: SettingsSectionSchema;
  values: SectionValues;
  canEdit: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onTest?: () => Promise<TestResult>;
}

const isSecret = (field: SettingsField) => field.type === "secret";

const initialDraft = (schema: SettingsSectionSchema, values: SectionValues): Draft =>
  Object.fromEntries(
    schema.fields.map((field) => {
      if (isSecret(field)) return [field.name, ""];
      const value = values[field.name] ?? field.default;
      return [field.name, field.type === "boolean" ? Boolean(value) : value === null || value === undefined ? "" : String(value)];
    }),
  );

const toApiValue = (field: SettingsField, raw: string | boolean) => {
  if (field.type === "boolean") return raw;
  if ((field.type === "number" || field.type === "integer") && raw !== "") return Number(raw);
  return raw;
};

// Builds the PATCH body: only changed fields; secrets are write-only
// (blank = keep the stored value, "clear" = null).
export const buildPatch = (
  schema: SettingsSectionSchema,
  initial: Draft,
  draft: Draft,
  cleared: Set<string>,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (isSecret(field)) {
      if (cleared.has(field.name)) patch[field.name] = null;
      else if (draft[field.name]) patch[field.name] = draft[field.name];
    } else if (draft[field.name] !== initial[field.name]) {
      patch[field.name] = toApiValue(field, draft[field.name]);
    }
  }
  return patch;
};

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100";

const SettingsSectionForm = ({ schema, values, canEdit, onSave, onTest }: Props) => {
  const initial = useMemo(() => initialDraft(schema, values), [schema, values]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const patch = buildPatch(schema, initial, draft, cleared);
  const dirty = Object.keys(patch).length > 0;

  const set = (name: string, value: string | boolean) => setDraft((prev) => ({ ...prev, [name]: value }));
  const toggleClear = (name: string) =>
    setCleared((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(patch);
      setCleared(new Set());
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTestResult(null);
    if (onTest) setTestResult(await onTest());
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {schema.fields.map((field) => {
          const id = `${schema.key}-${field.name}`;
          const label = (
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
              {field.name}
              {field.required && <span className="text-rose-500"> *</span>}
            </label>
          );

          if (field.type === "boolean") {
            return (
              <label key={field.name} className="flex items-center gap-2 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  aria-label={field.name}
                  checked={Boolean(draft[field.name])}
                  disabled={!canEdit}
                  onChange={(e) => set(field.name, e.target.checked)}
                />
                {field.name}
              </label>
            );
          }

          if (field.type === "enum") {
            return (
              <div key={field.name}>
                {label}
                <select id={id} aria-label={field.name} className={inputClass} value={String(draft[field.name])} disabled={!canEdit} onChange={(e) => set(field.name, e.target.value)}>
                  {field.values?.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            );
          }

          if (isSecret(field)) {
            const stored = values[field.name] as MaskedSecret | undefined;
            return (
              <div key={field.name}>
                {label}
                <input
                  id={id}
                  aria-label={field.name}
                  type="password"
                  autoComplete="off"
                  className={inputClass}
                  value={String(draft[field.name])}
                  disabled={!canEdit || cleared.has(field.name)}
                  placeholder={stored?.isSet ? `•••• ${stored.last4} (set — leave blank to keep)` : "not set"}
                  onChange={(e) => set(field.name, e.target.value)}
                />
                {stored?.isSet && canEdit && (
                  <label className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" aria-label={`Clear ${field.name}`} checked={cleared.has(field.name)} onChange={() => toggleClear(field.name)} />
                    Clear stored value
                  </label>
                )}
              </div>
            );
          }

          return (
            <div key={field.name}>
              {label}
              <input
                id={id}
                aria-label={field.name}
                type={field.type === "number" || field.type === "integer" ? "number" : "text"}
                className={inputClass}
                value={String(draft[field.name])}
                disabled={!canEdit}
                onChange={(e) => set(field.name, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {canEdit && (
          <button type="submit" disabled={!dirty || saving} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        {schema.testable && onTest && canEdit && (
          <button type="button" onClick={test} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
            Test connection
          </button>
        )}
        {testResult && (
          <span role="status" className={testResult.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>
            {testResult.ok ? "Connection OK" : testResult.error}
          </span>
        )}
      </div>
    </form>
  );
};

export default SettingsSectionForm;
