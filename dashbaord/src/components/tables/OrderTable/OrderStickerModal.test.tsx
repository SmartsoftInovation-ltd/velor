import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OrderStickerModal, { collection } from "./OrderStickerModal";

const get = vi.fn();
vi.mock("../../../hooks/useAxiosSecure", () => ({ default: { get: (url: string) => get(url) } }));
vi.mock("../../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("../../../utils/barcodeRender", () => ({ renderBarcodeToSvg: vi.fn(() => true) }));

const order = {
  _id: "o1",
  invoiceId: "INV-77",
  createdAt: "2026-11-05T10:00:00.000Z",
  finalAmount: 2450,
  paymentMethod: "cod",
  paymentStatus: "Pending",
  items: [{ quantity: 2 }, { quantity: 3 }],
  shippingInfo: { fullName: "Ashfaq Rahman", phone: "01711111111", address: "House 12, Road 4", city: "Dhaka", postalCode: "1212", note: "Call first" },
};

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OrderStickerModal orderId="o1" onClose={() => {}} />
    </QueryClientProvider>,
  );

describe("OrderStickerModal", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((url: string) =>
      url.includes("store-information")
        ? Promise.resolve({ data: { data: { stores: [{ storeName: "Smartsoft Innovation", phone: "01999878862", adress: "Mirpur, Dhaka" }] } } })
        : Promise.resolve({ data: { data: order } }),
    );
  });

  it("shows the store and the delivery details in a modal", async () => {
    show();

    expect(await screen.findByText("Smartsoft Innovation")).toBeTruthy();
    expect(screen.getByText("01999878862")).toBeTruthy();
    expect(screen.getByText("Mirpur, Dhaka")).toBeTruthy();
    expect(await screen.findByText("Ashfaq Rahman")).toBeTruthy();
    expect(screen.getByText("01711111111")).toBeTruthy();
    expect(screen.getByText("House 12, Road 4, Dhaka, 1212")).toBeTruthy();
    expect(screen.getByText("Call first")).toBeTruthy();
    expect(screen.getByText("৳2,450")).toBeTruthy();
    expect(screen.getByRole("button", { name: /print/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download/i })).toBeTruthy();
  });

  it("counts units, not lines", async () => {
    show();
    expect(await screen.findByText("5")).toBeTruthy();
  });

  it("never prints another shop's name", async () => {
    show();
    await screen.findByText("Ashfaq Rahman");
    expect(screen.queryByText(/Baig/)).toBeNull();
  });

  it("says what the courier must collect", () => {
    expect(collection({ finalAmount: 500, paymentMethod: "cod", paymentStatus: "Pending" })).toEqual({ label: "Collect on delivery", amount: 500 });
    expect(collection({ finalAmount: 500, paymentMethod: "sslcommerz", paymentStatus: "success" })).toEqual({ label: "Paid online", amount: 0 });
    expect(collection({ finalAmount: 500, paymentMethod: "cod", paymentStatus: "success" })).toEqual({ label: "Paid", amount: 0 });
    expect(collection({ finalAmount: 500, paymentMethod: "sslcommerz", paymentStatus: "Pending" })).toEqual({ label: "Payment pending", amount: 500 });
  });
});
