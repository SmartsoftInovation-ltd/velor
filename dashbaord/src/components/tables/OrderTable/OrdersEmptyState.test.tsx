import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OrdersEmptyState from "./OrdersEmptyState";

describe("OrdersEmptyState", () => {
  it("says the filters found nothing and offers to clear them", () => {
    const onClear = vi.fn();
    render(<OrdersEmptyState filtered onClear={onClear} />);

    expect(screen.getByText("No orders found")).toBeTruthy();
    expect(screen.getByText("No orders match these filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("has nothing to clear when no filter is on", () => {
    render(<OrdersEmptyState filtered={false} onClear={() => {}} />);

    expect(screen.getByText("New orders will show up here.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
