import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewAllStockList from "./ViewAllStockList";

const get = vi.fn();

vi.mock("../../../hooks/useAxiosSecure", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
// The card layout: the desktop table is virtualized and draws no rows in jsdom
vi.mock("../../../hooks/useIsMobile", () => ({ default: () => true }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const variantHit = {
  _id: "v1",
  resultType: "variant",
  variantName: "Polo Red L",
  barCode: "77012",
  stockVariant: 7,
  subcategory: { _id: "s1", name: "Shirts" },
  product: { _id: "p1", name: "Polo Shirt" },
};

const parentWithVariant = {
  _id: "p1",
  resultType: "product",
  name: "Polo Shirt",
  variantType: "multipleVariant",
  variant: [{ ...variantHit, resultType: undefined, product: "p1" }],
};

// Answers the way /product/search-product does: name finds names only, barCode
// finds barcodes only, and several terms widen the search.
const respondLikeApi = (url: string) => {
  if (!url.startsWith("/product/search-product")) {
    return Promise.resolve({ data: { data: { products: [] } } });
  }
  const q = new URL(url, "http://x").searchParams;
  const products: unknown[] = [];
  const name = q.get("name")?.toLowerCase();
  const code = q.get("barCode");
  if (name && "polo shirt".includes(name)) products.push(parentWithVariant, variantHit);
  if (code && "77012".startsWith(code)) products.push(variantHit);
  return Promise.resolve({ data: { data: { products } } });
};

const search = (text: string) =>
  userEvent.type(screen.getByPlaceholderText("Scan barcode or search product…"), text);

describe("ViewAllStockList search", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(respondLikeApi);
  });

  it("finds a variant by a barcode shorter than 8 digits", async () => {
    render(<ViewAllStockList />);
    await search("77012");

    expect(await screen.findByText("Polo Shirt")).toBeTruthy();
    expect(screen.getByText("77012")).toBeTruthy();
  });

  it("still finds a product by name, listing a variant once", async () => {
    render(<ViewAllStockList />);
    await search("polo");

    await screen.findAllByText("Polo Shirt");
    await waitFor(() => expect(screen.getAllByText("77012")).toHaveLength(1));
  });
});
