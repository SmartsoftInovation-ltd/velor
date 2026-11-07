import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PushSellingProducts from "./PushSellingProducts";

const post = vi.fn();

vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: { post: (...a: unknown[]) => post(...a) },
}));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PushSellingProducts />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("PushSellingProducts", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: {
        data: {
          rows: [
            { productId: "p1", variantId: "v1", productName: "Polo Shirt", size: "L", color: "Red", barcode: "54868", soldQty: 0, stockQty: 12 },
            { productId: "p2", variantId: null, productName: null, size: null, color: null, barcode: "111", soldQty: 2, stockQty: 7 },
          ],
        },
      },
    });
  });

  it("asks the push sale report for the 5 least moved items of the last 30 days", async () => {
    setup();
    await screen.findByText("Polo Shirt");

    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/report/push-sales-product?page=1&limit=5");
    expect(body).toMatchObject({ maxSold: 0, top: 5 });
    const days = (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / 86400000;
    expect(days).toBe(29);
  });

  it("lists each item's details, sold and stock", async () => {
    setup();

    expect(await screen.findByText("Polo Shirt")).toBeTruthy();
    expect(screen.getByText("54868 · L · Red")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(screen.getByRole("link", { name: /view report/i })).toHaveAttribute("href", "/push-sales-product");
  });

  it("leaves out a stored N/A size or color", async () => {
    post.mockResolvedValue({
      data: { data: { rows: [{ productId: "p3", variantId: "v3", productName: "Casual Shirt", barcode: "20003", size: "N/A", color: "N/A", soldQty: 0, stockQty: 180 }] } },
    });
    setup();

    expect(await screen.findByText("20003")).toBeTruthy();
  });

  it("widens the window from the month buttons", async () => {
    setup();
    await screen.findByText("Polo Shirt");

    await userEvent.click(screen.getByRole("button", { name: "3 Months" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const body = post.mock.calls[1][1];
    expect((new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / 86400000).toBe(89);
  });

  it("says so when nothing is stuck", async () => {
    post.mockResolvedValue({ data: { data: { rows: [] } } });
    setup();

    expect(await screen.findByText(/every product sold/i)).toBeTruthy();
  });
});
