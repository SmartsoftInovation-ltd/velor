import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReportPrintAll, useRunWhenAllRowsReady } from "./useReportPrintAll";

vi.mock("react-hot-toast", () => ({ default: { loading: vi.fn(), dismiss: vi.fn() } }));

const flushFrames = async () => {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("useReportPrintAll", () => {
  it("asks for every row while the preview is open", () => {
    const { result, rerender } = renderHook(({ open }) => useReportPrintAll(open), { initialProps: { open: false } });
    expect(result.current.printAll).toBe(false);
    rerender({ open: true });
    expect(result.current.printAll).toBe(true);
  });

  it("prints only after all rows are loaded, then goes back to the screen page", async () => {
    const print = vi.fn();
    const { result, rerender } = renderHook(
      ({ ready }) => {
        const ctl = useReportPrintAll(false);
        useRunWhenAllRowsReady(ctl, ready && ctl.printAll);
        return ctl;
      },
      { initialProps: { ready: false } },
    );

    act(() => result.current.run(print));
    expect(result.current.printAll).toBe(true);
    await flushFrames();
    expect(print).not.toHaveBeenCalled(); // still loading

    rerender({ ready: true });
    await flushFrames();
    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.printAll).toBe(false);
  });
});
