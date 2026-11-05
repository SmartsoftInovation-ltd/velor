import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CategoryStockDetailList from "./CategoryStockDetailList";

const get = vi.fn();

vi.mock("../../../hooks/useAxiosSecure", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
// The card layout: the desktop table is virtualized and draws no rows in jsdom
vi.mock("../../../hooks/useIsMobile", () => ({ default: () => true }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const subcategory = { _id: "s1", name: "Shirts" };

const variantHit = {
  _id: "v1",
  resultType: "variant",
  variantName: "Polo Red L",
  barCode: "77012",
  size: "L",
  color: "Red",
  initialStock: 2,
  purchaseQuantityStock: 5,
  stockVariant: 7,
  subcategory,
  product: { _id: "p1", name: "Polo Shirt", subcategory: "s1" },
};

const singleProduct = {
  _id: "p2",
  resultType: "product",
  name: "Linen Scarf",
  variantType: "singleVariant",
  barCode: "88001234",
  initialStock: 3,
  subcategory,
};

const parentWithVariant = {
  _id: "p1",
  resultType: "product",
  name: "Polo Shirt",
  variantType: "multipleVariant",
  variant: [{ ...variantHit, resultType: undefined }],
  subcategory,
};

// Answers the way /product/search-product does: name finds names only, barCode
// finds barcodes only, and several terms widen the search.
const respondLikeApi = (url: string) => {
  const q = new URL(url, "http://x").searchParams;
  if (!url.startsWith("/product/search-product")) {
    return Promise.resolve({ data: { data: { products: [], categories: [], subCategories: [] } } });
  }
  const products: unknown[] = [];
  const name = q.get("name")?.toLowerCase();
  const code = q.get("barCode");
  if (name && "polo shirt".includes(name)) products.push(parentWithVariant, variantHit);
  if (code && "77012".startsWith(code)) products.push(variantHit);
  if (code && "88001234".startsWith(code)) products.push(singleProduct);
  return Promise.resolve({ data: { data: { products } } });
};

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CategoryStockDetailList />
    </QueryClientProvider>,
  );

const search = (text: string) =>
  userEvent.type(screen.getByPlaceholderText("Scan barcode or search product…"), text);

describe("CategoryStockDetailList search", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(respondLikeApi);
  });

  it("finds a variant by a short barcode, with its product name and stock", async () => {
    setup();
    await search("77012");

    expect(await screen.findByText("Polo Shirt")).toBeTruthy();
    expect(screen.getByText("77012")).toBeTruthy();
    // Opening 2 + purchase 5
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });

  it("finds a single-variant product by barcode", async () => {
    setup();
    await search("88001234");

    expect(await screen.findByText("Linen Scarf")).toBeTruthy();
  });

  it("still finds a product by name, listing a variant once", async () => {
    setup();
    await search("polo");

    await screen.findAllByText("Polo Shirt");
    await waitFor(() => expect(screen.getAllByText("77012")).toHaveLength(1));
  });
});
