import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import TenantDetailPage from "./TenantDetailPage";

const tenant = { _id: "t1", name: "Pizza Shop", slug: "pizzashop", status: "active", plan: "standard", limits: { maxStaff: 5 }, webhookKey: "K", createdAt: "2026-09-17T00:00:00Z" };
const api = {
  get: vi.fn(async () => tenant),
  suspend: vi.fn(async () => ({ ...tenant, status: "suspended" })),
  activate: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(async () => ({ items: [{ _id: "a1", action: "TENANT_SETTINGS_UPDATED", actorEmail: "owner@platform.test", changes: ["sms.apiKey"], createdAt: "2026-09-17T00:00:00Z" }], total: 1, page: 1, limit: 20 })),
};
const settings = {
  schema: vi.fn(async () => [
    { key: "sms", path: "sms", testable: true, fields: [{ name: "senderId", type: "string", required: true, default: "" }] },
    { key: "sslcommerz", path: "payment/sslcommerz", testable: true, fields: [{ name: "storeId", type: "string", required: true, default: "" }] },
  ]),
  get: vi.fn(async () => ({ settings: { sms: { senderId: "880" }, sslcommerz: { storeId: "" } }, features: {}, version: 3 })),
  update: vi.fn(async () => ({ changes: ["sms.senderId"], version: 4 })),
  test: vi.fn(async () => ({ ok: true })),
  webhooks: vi.fn(async () => ({ sslcommerz: { ipn: "https://api/hooks/sslcommerz/K/ipn" }, pathao: "https://api/hooks/pathao/K", steadfast: "https://api/hooks/steadfast/K" })),
};

vi.mock("../api/endpoints", () => ({
  tenantsApi: new Proxy({}, { get: (_, key: string) => (...args: unknown[]) => (api as Record<string, (...a: unknown[]) => unknown>)[key](...args) }),
  settingsApi: new Proxy({}, { get: (_, key: string) => (...args: unknown[]) => (settings as Record<string, (...a: unknown[]) => unknown>)[key](...args) }),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ isSuperadmin: true }) }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/tenants/t1"]}>
        <Routes><Route path="/tenants/:tenantId" element={<TenantDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("TenantDetailPage", () => {
  it("suspends a store with a reason", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Pizza Shop" });

    await userEvent.type(screen.getByLabelText(/suspension reason/i), "Unpaid");
    await userEvent.click(screen.getByRole("button", { name: /suspend/i }));

    await waitFor(() => expect(api.suspend).toHaveBeenCalledWith("t1", "Unpaid"));
  });

  it("saves a settings section to its API path", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /settings/i }));

    const section = await screen.findByRole("region", { name: "sms" });
    const sender = within(section).getByLabelText("senderId");
    await userEvent.clear(sender);
    await userEvent.type(sender, "8809617");
    await userEvent.click(within(section).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(settings.update).toHaveBeenCalledWith("t1", "sms", { senderId: "8809617" }));
    expect(screen.getByRole("region", { name: "sslcommerz" })).toBeInTheDocument();
  });

  it("shows webhook URLs and the audit trail", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /webhooks/i }));
    expect(await screen.findByText("https://api/hooks/pathao/K")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /audit/i }));
    expect(await screen.findByText("TENANT_SETTINGS_UPDATED")).toBeInTheDocument();
    expect(screen.getByText("sms.apiKey")).toBeInTheDocument();
  });
});
