import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const TOAST_ID = "report-print-all";

// Reports show one page of rows on screen, but Preview, Print and PDF must
// cover the whole report. While the preview is open, or a print/PDF is
// pending, `printAll` is true: the report asks for every row in one request
// (`?all=1`), and the action runs once those rows are on the sheet. Then the
// report goes back to its screen page, which React Query still has cached.
export function useReportPrintAll(previewOpen: boolean) {
  const [pending, setPending] = useState<null | (() => unknown)>(null);
  return {
    printAll: previewOpen || pending !== null,
    // A print or PDF is waiting for all rows
    preparing: pending !== null,
    pending,
    setPending,
    run: (action: () => unknown) => {
      toast.loading("Loading every row of the report…", { id: TOAST_ID });
      setPending(() => action);
    },
  };
}

type PrintAllControl = ReturnType<typeof useReportPrintAll>;

// Runs the pending print/PDF once all rows have loaded and been drawn
export function useRunWhenAllRowsReady(control: PrintAllControl, ready: boolean) {
  const { pending, setPending } = control;
  useEffect(() => {
    if (!pending || !ready) return;
    let cancelled = false;
    // Two frames: React has committed the rows and the browser has laid them out
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (cancelled) return;
        toast.dismiss(TOAST_ID);
        try {
          await pending();
        } finally {
          setPending(null);
        }
      }),
    );
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pending, ready, setPending]);
}
