import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SellerDomainsTab from "./SellerDomainsTab";

const record = (host: string) => ({ type: "TXT", name: `_ecompos-verify.${host}`, value: "ecompos-verify=TOKEN" });
const active = { _id: "d1", host: "pizza.com", status: "active", isPrimary: true, verifiedAt: "2026-10-01T00:00:00Z", lastCheckedAt: "2026-10-01T00:00:00Z", failureReason: "", createdAt: "2026-09-30T00:00:00Z", dnsRecord: record("pizza.com") };
const pending = { _id: "d2", host: "shop.pizza.com", status: "pending", isPrimary: false, verifiedAt: null, lastCheckedAt: null, failureReason: "", createdAt: "2026-10-02T00:00:00Z", dnsRecord: record("shop.pizza.com") };

let domains: unknown[] = [];
const api = {
  list: vi.fn(async () => domains),
  add: vi.fn(async (_t: string, body: { host: string }) => ({ ...pending, host: body.host })),
  verify: vi.fn(async () => ({ ...pending, status: "failed", failureReason: "No TXT record found at _ecompos-verify.shop.pizza.com" })),
  makePrimary: vi.fn(async () => ({ ...pending, status: "active", isPrimary: true })),
  remove: vi.fn(async () => ({ _id: "d2", host: "shop.pizza.com" })),
};

vi.mock("../../platform/endpoints", () => ({
  domainsApi: new Proxy({}, { get: (_, key: string) => (...args: unknown[]) => (api as never as Record<string, (...a: unknown[]) => unknown>)[key](...args) }),
}));
let superadmin = true;
vi.mock("../../platform/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ isSuperadmin: superadmin }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const renderTab = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SellerDomainsTab tenantId="t1" />
    </QueryClientProvider>,
  );

describe("SellerDomainsTab (Platform Console)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    superadmin = true;
    domains = [active, pending];
  });

  it("adds the first domain as primary", async () => {
    domains = [];
    renderTab();
    await userEvent.click(await screen.findByRole("button", { name: /add domain/i }));
    const dialog = await screen.findByRole("dialog", { name: /add domain/i });
    await userEvent.type(within(dialog).getByLabelText(/hostname/i), "pizza.com");
    await userEvent.click(within(dialog).getByRole("button", { name: /add domain/i }));

    await waitFor(() => expect(api.add).toHaveBeenCalledWith("t1", { host: "pizza.com", isPrimary: true }));
  });

  it("shows the DNS record only for unverified domains", async () => {
    renderTab();
    const row = await screen.findByRole("listitem", { name: "shop.pizza.com" });
    expect(within(row).getByText("_ecompos-verify.shop.pizza.com")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "pizza.com" })).queryByText(/_ecompos-verify/)).toBeNull();
  });

  it("gives a bare domain the short name a DNS panel expects", async () => {
    domains = [{ ...active, status: "pending" }];
    renderTab();
    const row = await screen.findByRole("listitem", { name: "pizza.com" });
    expect(within(row).getByText("_ecompos-verify")).toBeInTheDocument();
  });

  it("reports a failed DNS check", async () => {
    renderTab();
    const row = await screen.findByRole("listitem", { name: "shop.pizza.com" });
    await userEvent.click(within(row).getByRole("button", { name: /verify dns/i }));

    await waitFor(() => expect(api.verify).toHaveBeenCalledWith("t1", "d2"));
    expect(toast.error).toHaveBeenCalledWith("No TXT record found at _ecompos-verify.shop.pizza.com");
  });

  it("promotes an active domain and removes one after confirming", async () => {
    domains = [active, { ...pending, status: "active" }];
    renderTab();
    const row = await screen.findByRole("listitem", { name: "shop.pizza.com" });
    await userEvent.click(within(row).getByRole("button", { name: /make primary/i }));
    await waitFor(() => expect(api.makePrimary).toHaveBeenCalledWith("t1", "d2"));

    await userEvent.click(within(row).getByRole("button", { name: /remove shop.pizza.com/i }));
    const dialog = await screen.findByRole("dialog", { name: /remove shop.pizza.com/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /remove domain/i }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("t1", "d2"));
  });

  it("is read-only for support operators", async () => {
    superadmin = false;
    renderTab();
    await screen.findByRole("listitem", { name: "pizza.com" });
    expect(screen.queryByRole("button", { name: /add domain|verify dns|remove/i })).toBeNull();
  });
});
