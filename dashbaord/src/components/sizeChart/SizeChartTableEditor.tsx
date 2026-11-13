import { FaEye, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import { UNIT_OPTIONS, sanitiseKey, type Column, type Row, type UnitType } from "./sizeChartConfig";
import { UnitSelect } from "./sizeChartParts";

const MAX_COLUMNS = 10;

// One click adds a common measurement with its usual unit
const MEASUREMENT_PRESETS: { label: string; unit: UnitType }[] = [
  { label: "Chest", unit: "inch" },
  { label: "Waist", unit: "inch" },
  { label: "Hip", unit: "inch" },
  { label: "Length", unit: "inch" },
  { label: "Shoulder", unit: "inch" },
  { label: "Sleeve", unit: "inch" },
  { label: "Weight", unit: "kg" },
];

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "XS – XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "S – XL", sizes: ["S", "M", "L", "XL"] },
  { label: "28 – 40", sizes: ["28", "30", "32", "34", "36", "38", "40"] },
];

const isBlank = (row: Row) => !row.label.trim() && row.values.every((v) => !v.trim());
const unitShort = (unit: UnitType) => UNIT_OPTIONS.find((u) => u.value === unit)?.short ?? "";

const chipClass =
  "shine inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  columns: Column[];
  rows: Row[];
  setColumns: (update: (prev: Column[]) => Column[]) => void;
  setRows: (update: (prev: Row[]) => Row[]) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
  chartName: string;
};

const SizeChartTableEditor = ({ columns, rows, setColumns, setRows, errors, clearError, chartName }: Props) => {
  const hasColumn = (label: string) => columns.some((c) => c.label.trim().toLowerCase() === label.toLowerCase());

  const addColumn = (label = "", unit: UnitType = "inch") => {
    if (columns.length >= MAX_COLUMNS) return;
    // An untouched empty column is filled instead of adding a second one
    const emptyAt = label ? columns.findIndex((c) => !c.label.trim()) : -1;
    if (emptyAt >= 0) {
      setColumns((p) => p.map((c, i) => (i === emptyAt ? { ...c, label, key: sanitiseKey(label), unit } : c)));
      clearError(`col_label_${emptyAt}`);
      return;
    }
    setColumns((p) => [...p, { key: sanitiseKey(label), label, unit, order: p.length }]);
    setRows((p) => p.map((r) => ({ ...r, values: [...r.values, ""] })));
  };
  const removeColumn = (i: number) => {
    if (columns.length <= 1) return;
    setColumns((p) => p.filter((_, idx) => idx !== i));
    setRows((p) => p.map((r) => ({ ...r, values: r.values.filter((_, idx) => idx !== i) })));
  };
  const updateColumn = (i: number, patch: Partial<Column>) => {
    setColumns((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch, ...(patch.label !== undefined ? { key: sanitiseKey(patch.label) } : {}) } : c)));
    if (patch.label !== undefined) clearError(`col_label_${i}`);
  };

  const addRow = () => setRows((p) => [...p, { label: "", values: Array(columns.length).fill(""), order: p.length }]);
  const addSizes = (sizes: string[]) =>
    setRows((p) => {
      const kept = p.filter((r) => !isBlank(r));
      const have = new Set(kept.map((r) => r.label.trim().toUpperCase()));
      const added = sizes.filter((s) => !have.has(s)).map((label) => ({ label, values: Array(columns.length).fill(""), order: 0 }));
      return [...kept, ...added].map((r, order) => ({ ...r, order }));
    });
  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    setRows((p) => p.filter((_, idx) => idx !== i));
  };
  const updateRowLabel = (i: number, label: string) => {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, label } : r)));
    clearError(`row_label_${i}`);
  };
  const updateValue = (ri: number, ci: number, val: string) =>
    setRows((p) => p.map((r, i) => (i === ri ? { ...r, values: r.values.map((v, j) => (j === ci ? val : v)) } : r)));

  const inputBase =
    "h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition-all placeholder:text-gray-300 focus:ring-2 focus:ring-accent-500/20 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600";

  return (
    <div className="space-y-5">
      {/* Quick add */}
      <div className="grid gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 lg:grid-cols-2 dark:border-gray-700 dark:bg-white/[0.02]">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Add a measurement (column)</p>
          <div className="flex flex-wrap gap-2">
            {MEASUREMENT_PRESETS.map((m) => (
              <button key={m.label} type="button" disabled={hasColumn(m.label) || columns.length >= MAX_COLUMNS} onClick={() => addColumn(m.label, m.unit)}
                className={`${chipClass} border-accent-200 bg-white text-accent-700 hover:bg-accent-50 dark:border-accent-500/30 dark:bg-gray-900 dark:text-accent-400 dark:hover:bg-accent-500/15`}>
                <FaPlus className="size-2.5" /> {m.label}
              </button>
            ))}
            <button type="button" disabled={columns.length >= MAX_COLUMNS} onClick={() => addColumn()}
              className={`${chipClass} border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/10`}>
              <FaPlus className="size-2.5" /> Custom
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Add sizes (rows)</p>
          <div className="flex flex-wrap gap-2">
            {SIZE_PRESETS.map((s) => (
              <button key={s.label} type="button" onClick={() => addSizes(s.sizes)}
                className={`${chipClass} border-accent-200 bg-white text-accent-700 hover:bg-accent-50 dark:border-accent-500/30 dark:bg-gray-900 dark:text-accent-400 dark:hover:bg-accent-500/15`}>
                <FaPlus className="size-2.5" /> {s.label}
              </button>
            ))}
            <button type="button" onClick={addRow}
              className={`${chipClass} border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/10`}>
              <FaPlus className="size-2.5" /> One size
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="w-32 px-3 py-3 text-left align-bottom">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Size</span>
                <span className="block text-[11px] font-normal text-gray-400">e.g. S, M, 32</span>
              </th>
              {columns.map((col, i) => (
                <th key={i} className="min-w-44 border-l border-gray-200 px-3 py-3 text-left align-top dark:border-gray-700">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Column {i + 1}</span>
                    <button type="button" onClick={() => removeColumn(i)} disabled={columns.length <= 1} aria-label={`Remove column ${col.label || i + 1}`} title="Remove column"
                      className="flex size-6 items-center justify-center rounded bg-error-50 text-error-600 transition-all hover:bg-error-100 disabled:invisible dark:bg-error-500/15 dark:text-error-400">
                      <FaTimes className="size-2.5" />
                    </button>
                  </div>
                  <input type="text" value={col.label} onChange={(e) => updateColumn(i, { label: e.target.value })}
                    placeholder="Measurement name, e.g. Chest" aria-label={`Name of column ${i + 1}`}
                    className={`${inputBase} mb-1.5 font-semibold ${errors[`col_label_${i}`] ? "border-error-400" : "border-gray-200 focus:border-accent-500 dark:border-gray-700"}`} />
                  {errors[`col_label_${i}`] && <p className="mb-1 text-[11px] font-normal text-error-500">{errors[`col_label_${i}`]}</p>}
                  <UnitSelect value={col.unit} label={col.label} onChange={(unit) => updateColumn(i, { unit })} />
                </th>
              ))}
              <th className="w-14 border-l border-gray-200 px-2 dark:border-gray-700"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 transition-colors last:border-none hover:bg-accent-50/30 dark:border-gray-800 dark:hover:bg-accent-500/5">
                <td className="px-3 py-2.5 align-top">
                  <input type="text" value={row.label} onChange={(e) => updateRowLabel(ri, e.target.value)} placeholder="Size" aria-label={`Size of row ${ri + 1}`}
                    className={`${inputBase} text-center font-bold ${errors[`row_label_${ri}`] ? "border-error-400" : "border-gray-200 focus:border-accent-500 dark:border-gray-700"}`} />
                  {errors[`row_label_${ri}`] && <p className="mt-0.5 text-center text-[11px] text-error-500">{errors[`row_label_${ri}`]}</p>}
                </td>
                {row.values.map((val, ci) => (
                  <td key={ci} className="border-l border-gray-100 px-3 py-2.5 align-top dark:border-gray-800">
                    <div className="relative">
                      <input type="text" value={val} onChange={(e) => updateValue(ri, ci, e.target.value)} placeholder="—"
                        aria-label={`${columns[ci]?.label || `Column ${ci + 1}`} for size ${row.label || ri + 1}`}
                        className={`${inputBase} border-gray-200 pr-10 text-center focus:border-accent-500 dark:border-gray-700`} />
                      {unitShort(columns[ci]?.unit) && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{unitShort(columns[ci].unit)}</span>
                      )}
                    </div>
                  </td>
                ))}
                <td className="border-l border-gray-100 px-2 py-2.5 text-center align-top dark:border-gray-800">
                  <button type="button" onClick={() => removeRow(ri)} disabled={rows.length <= 1} aria-label={`Remove size ${row.label || ri + 1}`} title="Remove size"
                    className="mx-auto flex size-10 items-center justify-center rounded bg-error-50 text-error-600 transition-all hover:bg-error-100 active:scale-90 disabled:opacity-30 dark:bg-error-500/15 dark:text-error-400">
                    <FaTrashAlt className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {columns.length}/{MAX_COLUMNS} measurements · {rows.length} {rows.length === 1 ? "size" : "sizes"}. Empty cells show as “—” to shoppers.
      </p>

      {/* Preview, as the shopper sees it */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
          <FaEye className="size-3.5 text-accent-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Shopper preview</span>
          {chartName && <span className="truncate text-sm text-gray-500 dark:text-gray-400">· {chartName}</span>}
        </div>
        <div className="overflow-x-auto bg-white dark:bg-gray-900">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-white/5">
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Size</th>
                {columns.map((col, i) => (
                  <th key={i} className="whitespace-nowrap px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-200">
                    {col.label || <span className="font-normal text-gray-400">Column {i + 1}</span>}
                    {unitShort(col.unit) && <span className="ml-1 font-normal text-gray-400">({unitShort(col.unit)})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-gray-800 dark:text-white">{row.label || <span className="font-normal text-gray-300">—</span>}</td>
                  {row.values.map((val, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-300">{val || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SizeChartTableEditor;
