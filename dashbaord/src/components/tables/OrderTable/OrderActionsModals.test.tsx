import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderStatusModal from "./OrderStatusModal";
import FraudCheckModal from "./FraudCheckModal";

const put = vi.fn();
vi.mock("../../../hooks/useAxiosSecure", () => ({ default: { put: (...args: unknown[]) => put(...args) } }));
vi.mock("../../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const order = { _id: "o1", invoiceId: "INV-77", orderStatus: "Pending" as const, shippingInfo: { fullName: "Ashfaq", phone: "0171" } };

describe("OrderStatusModal", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({});
  });

  it("changes the status only after Update, then reports it and closes", async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(<OrderStatusModal order={order} onClose={onClose} onChanged={onChanged} />);

    const update = screen.getByRole("button", { name: "Update status" }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Confirmed" }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(update);

    await waitFor(() => expect(put).toHaveBeenCalledWith("/order/order-update/o1", { orderStatus: "Confirmed" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when the save fails", async () => {
    put.mockRejectedValue(new Error("nope"));
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(<OrderStatusModal order={order} onClose={onClose} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("radio", { name: "Delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("FraudCheckModal", () => {
  it("says plainly that the figures are samples", () => {
    render(<FraudCheckModal order={order} onClose={() => {}} />);
    expect(screen.getByText(/sample figures/i)).toBeTruthy();
    expect(screen.getByText("Ashfaq")).toBeTruthy();
  });
});
