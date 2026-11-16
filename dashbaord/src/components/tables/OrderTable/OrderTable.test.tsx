import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OrderTable from "./OrderTable";

const order = {
  _id: "o1",
  invoiceId: "INV-77",
  createdAt: "2026-11-05T10:00:00.000Z",
  orderStatus: "Confirmed",
  orderType: "complete",
  totalAmount: 100,
  discountAmount: 0,
  finalAmount: 100,
  paymentMethod: "cod",
  paymentStatus: "Pending",
  items: [],
  shippingInfo: { fullName: "Ashfaq", phone: "0171" },
};

vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: { get: () => Promise.resolve({ data: { data: [order] } }), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("../../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("../../../hooks/usePermission", () => ({ usePermission: () => true }));
vi.mock("../../../socket/socket", () => ({ initSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrderTable statusFilter={null} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("OrderTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps every action under the Options button", async () => {
    show();
    await screen.findByText("INV-77");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Actions for order INV-77" }));
    const menu = within(screen.getByRole("menu"));
    ["View Details", "Fraud Check", "Print Sticker", "Print Invoice"].forEach((name) =>
      expect(menu.getByRole("menuitem", { name })).toBeTruthy(),
    );
    // The status changes from the list, not from Options
    expect(menu.queryByRole("menuitem", { name: "Change Status" })).toBeNull();
  });

  it("changes the status from the colored pill in the list", async () => {
    show();
    const pill = (await screen.findByText("Confirmed")).closest("button");
    expect(pill?.className).toContain("bg-blue-light-50");

    fireEvent.click(pill!);
    expect(screen.getByText("Change order status")).toBeTruthy();
  });
});
