import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InvoicePreview from "./InvoicePreview";

const order = {
  _id: "o1",
  invoiceId: "INV-77",
  createdAt: "2026-11-05T10:00:00.000Z",
  totalAmount: 3000,
  discountAmount: 200,
  finalAmount: 2900,
  deliveryCharge: { deliveryCharge: 100 },
  paymentMethod: "cod",
  paymentStatus: "Pending",
  shippingInfo: { fullName: "Ashfaq Rahman", phone: "01711111111", address: "House 12", city: "Dhaka" },
  items: [{ product: { name: "Polo Shirt" }, variant: { variantName: "Polo Red L" }, color: "Red", size: "L", quantity: 2, retailPrice: 1500, totalPrice: 3000 }],
};

vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: {
    get: (url: string) =>
      Promise.resolve(
        url.includes("store-information")
          ? { data: { data: { stores: [{ storeName: "Smartsoft Innovation", phone: "01999878862", adress: "Mirpur, Dhaka" }] } } }
          : { data: { data: order } },
      ),
  },
}));

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/invoice/o1"]}>
        <Routes>
          <Route path="/invoice/:id" element={<InvoicePreview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("InvoicePreview", () => {
  it("shows this store and this customer, never another shop's details", async () => {
    show();
    expect(await screen.findByText("Smartsoft Innovation")).toBeTruthy();
    expect(await screen.findByText("Ashfaq Rahman")).toBeTruthy();
    expect(screen.getByText("House 12, Dhaka")).toBeTruthy();
    expect(screen.queryByText(/Baig/)).toBeNull();
  });

  it("lists the item and adds up to what the customer pays", async () => {
    show();
    expect(await screen.findByText("Polo Shirt")).toBeTruthy();
    expect(screen.getByText("Polo Red L · Red · L")).toBeTruthy();
    expect(screen.getByText("−৳200")).toBeTruthy();
    expect(screen.getByText("৳100")).toBeTruthy();
    expect(screen.getByText("৳2,900")).toBeTruthy();
    expect(screen.getByText("Collect on delivery")).toBeTruthy();
  });
});
