import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VariantView from "./VariantView";

const get = vi.fn();
const post = vi.fn();

vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
vi.mock("../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const variant = {
  _id: "abc123",
  slug: "polo-red",
  variantName: "Polo Red L",
  isActive: true,
  barCode: "54868",
  sku: "554868",
  size: "L",
  color: "Red",
  unit: "Piece",
  stockVariant: 3,
  alertQuantity: 5,
  alertVariantStock: 99,
  purchasePrice: 300,
  retailPrice: 1250,
  wholesalePrice: 900,
  thumbnail: { url: "https://x/one.jpg" },
  image: [{ url: "https://x/two.jpg" }],
  product: { name: "Polo Shirt", slug: "polo-shirt", category: { name: "Men", slug: "men" }, brand: { name: "Acme" } },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const setup = () =>
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/variant-view/polo-red"]}>
          <Routes>
            <Route path="/variant-view/:slug" element={<VariantView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );

describe("VariantView", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockResolvedValue({ data: { data: { variant } } });
    post.mockResolvedValue({});
  });

  it("shows the variant's identity, stock and prices", async () => {
    setup();

    expect(await screen.findByRole("heading", { name: "Polo Red L" })).toBeTruthy();
    expect(screen.getByText("54868")).toBeTruthy();
    expect(screen.getByText("৳1,250")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("judges low stock by the same alert quantity as the Low Stock list", async () => {
    setup();

    expect(await screen.findByText("Low")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByText("99")).toBeNull();
  });

  it("links a record only when it has a page to open", async () => {
    setup();

    expect((await screen.findByRole("link", { name: "Men" })).getAttribute("href")).toBe("/category-view/men");
    expect(screen.queryByRole("link", { name: "Acme" })).toBeNull();
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("switches the large image from the thumbnails", async () => {
    setup();

    const large = await screen.findByAltText("Polo Red L");
    expect(large.getAttribute("src")).toBe("https://x/one.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Show image 2" }));
    expect(screen.getByAltText("Polo Red L").getAttribute("src")).toBe("https://x/two.jpg");
  });

  it("asks before deactivating, then calls the API", async () => {
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, Deactivate" }));
    expect(post).toHaveBeenCalledWith("/variant/deactive?slug=polo-red");
  });

  it("explains when the variant does not exist", async () => {
    get.mockRejectedValue(new Error("404"));
    setup();

    expect(await screen.findByText("Variant not found")).toBeTruthy();
  });
});
