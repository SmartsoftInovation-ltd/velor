import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fullSheetHtml, takeSnapshot, toPreviewHtml, useReportPrintAll, useRunWhenAllRowsReady } from "./useReportPrintAll";

vi.mock("react-hot-toast", () => ({ default: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn() } }));

const flushFrames = async () => {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    await new Promise((r) => setTimeout(r, 0));
  });
};

const sheetWith = (rows: number) => {
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-header hidden print:flex">Store</div><table class="min-w-[900px]"><thead><tr><th>Name</th></tr></thead><tbody class="body">${Array.from(
    { length: rows },
    (_, i) => `<tr><td>row ${i + 1}</td></tr>`,
  ).join("")}</tbody></table><p>Totals</p>`;
  document.body.appendChild(sheet);
  return sheet;
};

const setup = (sheet: HTMLElement | null, ready: { current: boolean }) =>
  renderHook(
    ({ open }) => {
      const ctl = useReportPrintAll(open, { sheetRef: { current: sheet }, thermalRef: { current: null } });
      useRunWhenAllRowsReady(ctl, ctl.printAll && ready.current);
      return ctl;
    },
    { initialProps: { open: false } },
  );

describe("takeSnapshot", () => {
  it("keeps one string per row and the sheet around them", () => {
    const sheet = sheetWith(3);
    const snap = takeSnapshot(sheet, null);
    expect(snap.rows).toHaveLength(3);
    expect(snap.shell).toContain("Totals");
    expect(snap.shell).not.toContain("row 1");
    // The live sheet is put back as it was
    expect(sheet.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(sheet.querySelector("tbody")?.className).toBe("body");
    const full = fullSheetHtml(snap);
    expect(full.indexOf("row 1")).toBeLessThan(full.indexOf("row 3"));
    expect(full.indexOf("row 3")).toBeLessThan(full.indexOf("Totals"));
    sheet.remove();
  });

  it("shows the print-only parts in the preview", () => {
    expect(toPreviewHtml('<div class="sheet-header hidden print:flex"></div><table class="min-w-[900px]">')).toBe(
      '<div class="sheet-header flex"></div><table class="min-w-0">',
    );
  });
});

describe("useReportPrintAll", () => {
  it("loads every row for the preview, then lets the screen go back to its page", async () => {
    const sheet = sheetWith(2);
    const ready = { current: false };
    const { result, rerender } = setup(sheet, ready);
    expect(result.current.printAll).toBe(false);

    rerender({ open: true });
    expect(result.current.printAll).toBe(true);
    // The report is covered while every row is drawn
    expect(document.querySelector(".report-capture-cover")).not.toBeNull();

    ready.current = true;
    rerender({ open: true });
    await flushFrames();
    expect(result.current.printAll).toBe(false);
    expect(document.querySelector(".report-capture-cover")).toBeNull();
    sheet.remove();
  });

  it("prints only after all rows are loaded, from its own copy of the sheet", async () => {
    const sheet = sheetWith(2);
    const ready = { current: false };
    let printed = "";
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      printed = document.getElementById("report-print-snapshot")?.textContent ?? "";
    });
    const { result, rerender } = setup(sheet, ready);

    act(() => result.current.print());
    expect(result.current.printAll).toBe(true);
    await flushFrames();
    expect(print).not.toHaveBeenCalled(); // still loading

    ready.current = true;
    rerender({ open: false });
    await flushFrames();
    expect(print).toHaveBeenCalledTimes(1);
    expect(printed).toContain("row 2");
    expect(printed).toContain("Totals");
    expect(result.current.printAll).toBe(false);

    window.dispatchEvent(new Event("afterprint"));
    expect(document.getElementById("report-print-snapshot")).toBeNull();
    print.mockRestore();
    sheet.remove();
  });

  it("prints the 80mm receipt, not the sheet, when asked for thermal", async () => {
    const sheet = sheetWith(2);
    const thermal = document.createElement("div");
    thermal.className = "thermal-receipt w-[80mm]";
    thermal.innerHTML = "<p>Receipt total</p>";
    let printed: { text: string; className: string } | null = null;
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      const host = document.getElementById("report-print-snapshot");
      printed = { text: host?.textContent ?? "", className: host?.className ?? "" };
    });
    const { result } = renderHook(() => {
      const ctl = useReportPrintAll(false, { sheetRef: { current: sheet }, thermalRef: { current: thermal } });
      useRunWhenAllRowsReady(ctl, ctl.printAll);
      return ctl;
    });

    act(() => result.current.print(true));
    await flushFrames();
    expect(print).toHaveBeenCalledTimes(1);
    expect(printed!.text).toBe("Receipt total");
    expect(printed!.className).toContain("thermal-receipt");

    window.dispatchEvent(new Event("afterprint"));
    print.mockRestore();
    sheet.remove();
  });

  it("gives up if the rows cannot be loaded", async () => {
    const action = vi.fn();
    const { result, rerender } = renderHook(
      ({ failed }) => {
        const ctl = useReportPrintAll(false, { sheetRef: { current: null }, thermalRef: { current: null } });
        useRunWhenAllRowsReady(ctl, false, ctl.printAll && failed);
        return ctl;
      },
      { initialProps: { failed: false } },
    );
    act(() => result.current.run(action));
    rerender({ failed: true });
    await flushFrames();
    expect(result.current.printAll).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
});
