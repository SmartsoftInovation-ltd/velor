import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import CreateOrder from "./CreateOrder";

const get = vi.fn();

vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { get: (...a: unknown[]) => get(...a), post: vi.fn().mockResolvedValue({ data: {} }) },
}));
vi.mock("../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const variantHit = {
  _id: "v1",
  resultType: "variant",
  variantName: "Polo Red L",
  barCode: "77012",
  retailPrice: 500,
  stockVariant: 7,
  product: { _id: "p1", name: "Polo Shirt" },
};

// Answers the way /product/search-product does: name finds names only, barCode
// finds barcodes only, and several terms widen the search.
const respondLikeApi = (url: string, config?: { params?: Record<string, string> }) => {
  if (url !== "/product/search-product") return Promise.resolve({ data: { data: [] } });
  const { name, barCode } = config?.params ?? {};
  const products: unknown[] = [];
  if (name && "polo red l".includes(name.toLowerCase())) products.push(variantHit);
  else if (barCode && "77012".startsWith(barCode)) products.push(variantHit);
  return Promise.resolve({ data: { data: { products } } });
};

const setup = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <CreateOrder />
      </MemoryRouter>
    </HelmetProvider>,
  );

const search = (text: string) =>
  userEvent.type(screen.getByPlaceholderText("Scan a barcode, or search by name…"), text);

describe("CreateOrder product search", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(respondLikeApi);
  });

  it("finds a variant by a barcode shorter than 8 digits", async () => {
    setup();
    await search("77012");

    expect(await screen.findByText(/77012/)).toBeTruthy();
  });

  it("still finds a variant by name", async () => {
    setup();
    await search("polo");

    expect(await screen.findByText(/77012/)).toBeTruthy();
  });
});
