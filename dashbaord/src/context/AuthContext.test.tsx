import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import { setWorkspace } from "../lib/session";

const get = vi.fn();
vi.mock("../hooks/useAxiosSecure", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

const permission = (slug: string) => ({ _id: slug, slug, permissionName: slug, isActive: true });

const baseUser = {
  _id: "u1",
  name: "Rahim",
  email: "rahim@pizza.com",
  roles: [{ _id: "r1", slug: "manager", name: "manager", isActive: true }],
  permissions: [{ permission: permission("order"), actions: ["view"] }],
  Options: [],
  Reports: [],
  isActive: true,
};

let latest: ReturnType<typeof useAuth>;
const Probe = () => {
  latest = useAuth();
  return <span>{latest.isLoading ? "loading" : "ready"}</span>;
};

const renderAuth = (queryClient = new QueryClient()) =>
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );

describe("AuthContext", () => {
  beforeEach(() => {
    get.mockReset();
    localStorage.setItem("accessToken", "token");
  });

  it("uses the server's effective permissions (roles and direct grants)", async () => {
    get.mockResolvedValue({ data: { data: { ...baseUser, effectivePermissions: { product: ["view", "add"], order: ["view"] } } } });
    renderAuth();
    await screen.findByText("ready");

    expect(latest.can("product", "add")).toBe(true);
    expect(latest.can("order", "view")).toBe(true);
    expect(latest.can("order", "delete")).toBe(false);
  });

  it("falls back to direct permissions for an older API", async () => {
    get.mockResolvedValue({ data: { data: baseUser } });
    renderAuth();
    await screen.findByText("ready");

    expect(latest.can("order", "view")).toBe(true);
    expect(latest.can("product", "view")).toBe(false);
  });

  it("exposes tenant, features and the owner flag", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          ...baseUser,
          roles: [{ _id: "r0", slug: "owner", name: "owner", isActive: true }],
          effectivePermissions: {},
          isOwner: true,
          tenant: { _id: "t1", name: "Pizza Shop", slug: "pizzashop", status: "active", limits: { maxStaff: 5 } },
          features: { sms: true, email: true, sslcommerz: false, couriers: { pathao: false, steadfast: true }, cloudinary: false, ai: false },
        },
      },
    });
    renderAuth();
    await screen.findByText("ready");

    expect(latest.isOwner).toBe(true);
    expect(latest.isSuperAdmin).toBe(true);
    expect(latest.can("anything", "delete")).toBe(true);
    expect(latest.tenant?.slug).toBe("pizzashop");
    expect(latest.features?.cloudinary).toBe(false);
  });

  it("clearAuth drops cached server data and this store's local drafts", async () => {
    get.mockResolvedValue({ data: { data: { ...baseUser, effectivePermissions: {} } } });
    const queryClient = new QueryClient();
    queryClient.setQueryData(["orders"], [{ id: 1 }]);
    setWorkspace("pizzashop");
    localStorage.setItem("t:pizzashop:product_form_draft", "{}");
    renderAuth(queryClient);
    await screen.findByText("ready");

    act(() => latest.clearAuth());

    await waitFor(() => expect(latest.user).toBeNull());
    expect(queryClient.getQueryData(["orders"])).toBeUndefined();
    expect(localStorage.getItem("t:pizzashop:product_form_draft")).toBeNull();
  });
});
