"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { SizeChart } from "@/lib/catalog/types";

/** "Size Chart" beside the pickers; opens the product's chart as a table in a modal. */
export function SizeChartButton({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="h-11 shrink-0 rounded-md border border-border-default bg-bg-surface px-6 text-body text-text-secondary transition-colors duration-200 ease-[var(--ease-hover)] hover:border-border-strong hover:bg-bg-hover hover:text-text-primary"
      >
        Size Chart
      </button>

      {open ? (
        <Modal label={`${chart.name} size chart`} onClose={() => setOpen(false)} className="p-6 sm:p-8">
          <h2 className="pr-10 text-h3 font-semibold text-text-primary">{chart.name}</h2>
          {chart.description ? (
            <p className="mt-1 text-small text-text-secondary">{chart.description}</p>
          ) : null}

          <div className="mt-5 overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-left text-small">
              <thead className="bg-bg-sunken text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">Size</th>
                  {chart.columns.map((column, i) => (
                    <th key={i} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {column.label}
                      {column.unit ? (
                        <span className="ml-1 font-normal text-text-tertiary">({column.unit})</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border-subtle">
                    <th scope="row" className="px-4 py-3 font-semibold whitespace-nowrap text-text-primary">
                      {row.label}
                    </th>
                    {chart.columns.map((_, j) => (
                      <td key={j} className="px-4 py-3 tabular whitespace-nowrap text-text-secondary">
                        {row.values[j] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chart.videoUrl ? (
            <a
              href={chart.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-small font-medium text-text-brand underline-offset-2 hover:underline"
            >
              Watch how to measure
            </a>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
