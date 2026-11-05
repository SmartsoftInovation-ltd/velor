import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import axios from "axios";
import { useStorefrontContent } from "./useStorefrontContent";

vi.mock("axios");
vi.mock("../../platform/endpoints", () => ({
  tenantsApi: { get: () => Promise.resolve({ slug: "velor" }) },
}));

const get = vi.mocked(axios.get);
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const ANSWERS: Record<string, unknown> = {
  "/shop/store": { name: "Velor", logo: "https://x/logo.png" },
  "/shop/banners": { banners: [{ title: "Eid sale", image: "https://x/b.jpg" }] },
  "/shop/promo-banner": { banner: { image: "https://x/p.jpg" } },
  "/categories-active": { categories: [{ _id: "1", name: "Panjabi", image: { url: "https://x/c.jpg" } }] },
  "/shop/products": { products: [{ slug: "pant", name: "Pant", price: 10, stock: 2 }] },
};

describe("useStorefrontContent", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("reads the seller's real content, naming their store", async () => {
    get.mockImplementation((url: string) => {
      const path = Object.keys(ANSWERS).find((p) => url.endsWith(p)) as string;
      return Promise.resolve({ data: { data: ANSWERS[path] } });
    });
    const { result } = renderHook(() => useStorefrontContent("t1"), { wrapper });

    await waitFor(() => expect(result.current.live).toBe(true));
    expect(result.current).toMatchObject({
      name: "Velor",
      logo: "https://x/logo.png",
      promo: "https://x/p.jpg",
      categories: [{ name: "Panjabi", image: "https://x/c.jpg" }],
      products: [{ name: "Pant" }],
    });
    expect(get.mock.calls[0][1]).toEqual({ headers: { "x-tenant": "velor" } });
  });

  it("keeps the sample when the API cannot be reached", async () => {
    get.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useStorefrontContent("t1"), { wrapper });

    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(result.current.products.length).toBeGreaterThan(0));
    expect(result.current.live).toBe(false);
    expect(result.current.name).toBe("Your Store");
  });

  it("fills only what the seller has not added yet", async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: { data: url.endsWith("/shop/store") ? { name: "Velor" } : {} } }),
    );
    const { result } = renderHook(() => useStorefrontContent("t1"), { wrapper });

    await waitFor(() => expect(result.current.name).toBe("Velor"));
    expect(result.current.products.length).toBeGreaterThan(0);
    expect(result.current.banners.length).toBeGreaterThan(0);
  });
});
