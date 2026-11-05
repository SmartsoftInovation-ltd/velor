import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SizeWiseStockList from "./SizeWiseStockList";

const get = vi.fn();

vi.mock("../../../hooks/useAxiosSecure", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
// jsdom has no layout, so the virtualized table would draw no rows
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 48, end: (index + 1) * 48 })),
    getTotalSize: () => count * 48,
    measureElement: () => undefined,
  }),
}));

const polo = { _id: "p1", name: "Polo Shirt" };
const denim = { _id: "p2", name: "Denim Jacket" };
const variants = [
  { _id: "v1", product: polo, barCode: "111111", sku: "1", size: "M", color: "Red", stockVariant: 2 },
  // The barcode a scanner reads is often not the row's first variant
  { _id: "v2", product: polo, barCode: "54868", sku: "2", size: "L", color: "Red", stockVariant: 3 },
  { _id: "v3", product: denim, barCode: "222222", sku: "3", size: "M", color: "Blue", stockVariant: 4 },
];

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SizeWiseStockList />
    </QueryClientProvider>,
  );

describe("SizeWiseStockList barcode search", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((url: string) =>
      url.startsWith("/sales/get-sales-products")
        ? Promise.resolve({ data: { data: [{ _type: "variant", productName: "Polo Shirt", barCode: "54868" }] } })
        : Promise.resolve({ data: { data: { variants } } }),
    );
  });

  it("loads every page of variants and adds up a product split across pages", async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({
      _id: `m${i}`,
      product: { _id: "p9", name: "Big Range" },
      barCode: String(100000 + i),
      sku: String(i),
      size: "M",
      color: "Red",
      stockVariant: 1,
    }));
    // The oldest item sits on the last page
    many.push({ _id: "old", product: { _id: "p8", name: "Oldest Item" }, barCode: "54868", sku: "x", size: "M", color: "Red", stockVariant: 9 });
    get.mockImplementation((url: string) => {
      const q = new URL(url, "http://x").searchParams;
      const page = Number(q.get("page"));
      const limit = Number(q.get("limit"));
      return Promise.resolve({
        data: { data: { variants: many.slice((page - 1) * limit, page * limit), total: many.length, totalPages: Math.ceil(many.length / limit) } },
      });
    });

    setup();

    expect(await screen.findByText("Oldest Item")).toBeTruthy();
    expect(screen.getByText("Big Range")).toBeTruthy();
    expect(screen.getAllByText("450").length).toBeGreaterThan(0);
    expect(get.mock.calls.filter(([url]) => String(url).includes("getallmultiplevariant"))).toHaveLength(3);
  });

  it("finds a product by the barcode of any of its variants", async () => {
    setup();
    await screen.findByText("Denim Jacket");

    await userEvent.type(screen.getByPlaceholderText("Scan barcode or search product…"), "54868");

    await waitFor(() => expect(screen.queryByText("Denim Jacket")).toBeNull());
    expect(screen.getByText("Polo Shirt")).toBeTruthy();
  });
});
