import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSellerPreviewUrl } from "./useSellerPreviewUrl";

const list = vi.fn();

vi.mock("../../platform/endpoints", () => ({
  domainsApi: { list: (...a: unknown[]) => list(...a) },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const domain = (host: string, status = "active", isPrimary = false) => ({ host, status, isPrimary });

describe("useSellerPreviewUrl", () => {
  beforeEach(() => {
    list.mockReset();
    vi.stubEnv("VITE_STOREFRONT_PREVIEW_URL", "http://localhost:3001");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the seller's own domain even when a local storefront is configured", async () => {
    list.mockResolvedValue([domain("shop.example.com", "active", true)]);
    const { result } = renderHook(() => useSellerPreviewUrl("t1"), { wrapper });

    await waitFor(() => expect(result.current).toBe("https://shop.example.com"));
  });

  it("prefers the primary domain, and ignores a domain that is not live", async () => {
    list.mockResolvedValue([domain("pending.example.com", "pending", true), domain("a.example.com"), domain("b.example.com", "active", true)]);
    const { result } = renderHook(() => useSellerPreviewUrl("t1"), { wrapper });

    await waitFor(() => expect(result.current).toBe("https://b.example.com"));
  });

  it("falls back to the local storefront for a seller with no live domain", async () => {
    list.mockResolvedValue([domain("pending.example.com", "pending", true)]);
    const { result } = renderHook(() => useSellerPreviewUrl("t1"), { wrapper });

    await waitFor(() => expect(list).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe("http://localhost:3001"));
  });

  it("has nothing to show with no live domain and no local storefront", async () => {
    vi.stubEnv("VITE_STOREFRONT_PREVIEW_URL", "");
    list.mockResolvedValue([]);
    const { result } = renderHook(() => useSellerPreviewUrl("t1"), { wrapper });

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(result.current).toBe("");
  });
});
