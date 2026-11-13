"use client";

import { useRef } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { RulerIcon } from "@/components/ui/icons-filter";
import type { SizeChart } from "@/lib/catalog/types";

/** "Size chart" pill beside wishlist and share; opens the picked option's chart. */
export function SizeChartButton({ chart }: { chart: SizeChart }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary shadow-xs transition-colors duration-150 ease-[var(--ease-hover)] hover:border-border-strong hover:text-text-primary"
      >
        <RulerIcon className="size-4" />
        Size chart
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="size-chart-title"
        // A click on the backdrop lands on the dialog itself, not its content
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-border-subtle bg-bg-surface p-0 text-text-primary shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 id="size-chart-title" className="text-h3 font-semibold">
              {chart.name}
            </h2>
            {chart.description ? <p className="mt-1 text-small text-text-secondary">{chart.description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close size chart"
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-4">
          <table className="w-full border-collapse text-small">
            <thead>
              <tr className="bg-bg-sunken text-left">
                <th scope="col" className="border border-border-subtle px-3 py-2 font-semibold">
                  Size
                </th>
                {chart.columns.map((column) => (
                  <th key={column.label} scope="col" className="border border-border-subtle px-3 py-2 font-semibold">
                    {column.label}
                    {column.unit ? <span className="font-normal text-text-tertiary"> ({column.unit})</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border border-border-subtle px-3 py-2 text-left font-medium">
                    {row.label}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={i} className="border border-border-subtle px-3 py-2 tabular text-text-secondary">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}
