import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import SellerDetailPage from "./SellerDetailPage";

const tenant = { _id: "t1", name: "Pizza Shop", slug: "pizzashop", status: "active", plan: "standard", limits: { maxStaff: 5 }, webhookKey: "K", createdAt: "2026-09-17T00:00:00Z" };
const features = { sms: true, email: false, sslcommerz: false, couriers: { pathao: false, steadfast: false }, cloudinary: true, ai: false };

const tenants = {
  get: vi.fn(async () => tenant),
  suspend: vi.fn(async () => ({ ...tenant, status: "suspended" })),
  activate: vi.fn(),
  update: vi.fn(async () => tenant),
  audit: vi.fn(async () => ({ items: [{ _id: "a1", action: "TENANT_SETTINGS_UPDATED", actorEmail: "owner@platform.test", changes: ["sms.apiKey"], createdAt: "2026-09-17T00:00:00Z" }], total: 1, page: 1, limit: 20 })),
};
const settings = {
  schema: vi.fn(async () => [
    { key: "general", path: "general", testable: false, fields: [{ name: "invoicePrefix", type: "string", required: false, default: "INV", pattern: "^[A-Z0-9]{2,8}$" }] },
    { key: "sms", path: "sms", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }, { name: "senderId", type: "string", required: true, default: "" }] },
    { key: "sslcommerz", path: "payment/sslcommerz", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }, { name: "storeId", type: "string", required: true, default: "" }] },
  ]),
  get: vi.fn(async () => ({ settings: { general: { invoicePrefix: "PIZZAS" }, sms: { enabled: true, senderId: "880" }, sslcommerz: { enabled: false, storeId: "" } }, features, version: 3 })),
  update: vi.fn(async () => ({ changes: ["x"], version: 4 })),
  test: vi.fn(async () => ({ ok: true })),
  webhooks: vi.fn(async () => ({ sslcommerz: { ipn: "https://api/hooks/sslcommerz/K/ipn" }, pathao: "https://api/hooks/pathao/K", steadfast: "https://api/hooks/steadfast/K" })),
};

const logo = {
  get: vi.fn(async () => ({ url: "https://x/old.png", status: "uploaded", lastError: "", hasStoreInformation: true })),
  upload: vi.fn(async () => ({ url: "https://x/old.png", status: "pending", lastError: "", hasStoreInformation: true })),
};

vi.mock("../../platform/endpoints", () => {
  // Resolved lazily: the mock factory is hoisted above the mocks it forwards to
  const forward = (pick: () => Record<string, (...a: unknown[]) => unknown>) =>
    new Proxy({}, { get: (_, key: string) => (...args: unknown[]) => pick()[key](...args) });
  return {
    tenantsApi: forward(() => tenants as never),
    settingsApi: forward(() => settings as never),
    domainsApi: { list: async () => [] },
    logoApi: forward(() => logo as never),
  };
});
vi.mock("../../platform/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ isSuperadmin: true }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/platform/sellers/t1"]}>
        <Routes><Route path="/platform/sellers/:tenantId" element={<SellerDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("SellerDetailPage (Platform Console)", () => {
  it("suspends a seller with a reason", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Pizza Shop" });

    await userEvent.click(screen.getByRole("button", { name: /^suspend seller$/i }));
    const dialog = await screen.findByRole("dialog", { name: /suspend pizza shop/i });
    await userEvent.type(within(dialog).getByLabelText(/reason/i), "Unpaid");
    await userEvent.click(within(dialog).getByRole("button", { name: /^suspend seller$/i }));

    await waitFor(() => expect(tenants.suspend).toHaveBeenCalledWith("t1", "Unpaid"));
  });

  it("updates the seller information", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Pizza Shop" });

    const name = screen.getByLabelText(/seller name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Pizza Palace");
    await userEvent.click(screen.getByRole("button", { name: /save seller info/i }));

    await waitFor(() => expect(tenants.update).toHaveBeenCalledWith("t1", { name: "Pizza Palace" }));
  });

  it("configures a seller integration through the platform API", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /integrations/i }));

    const card = await screen.findByRole("article", { name: "SSLCommerz" });
    await userEvent.click(within(card).getByRole("button", { name: /configure/i }));
    const panel = await screen.findByRole("dialog", { name: /sslcommerz/i });
    await userEvent.type(within(panel).getByLabelText(/store id/i), "pizza_live");
    await userEvent.click(within(panel).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(settings.update).toHaveBeenCalledWith("t1", "payment/sslcommerz", { storeId: "pizza_live" }));
  });

  it("lets the platform change the invoice prefix", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /integrations/i }));

    const prefix = await screen.findByLabelText(/invoice prefix/i);
    await userEvent.clear(prefix);
    await userEvent.type(prefix, "PZS");
    await userEvent.click(screen.getByRole("button", { name: /save prefix/i }));

    await waitFor(() => expect(settings.update).toHaveBeenCalledWith("t1", "general", { invoicePrefix: "PZS" }));
  });

  it("lets the platform pick a suggested website color", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /website color/i }));

    await userEvent.click(await screen.findByRole("button", { name: /use color #0f9d63/i }));
    expect(screen.getByLabelText(/^custom color$/i)).toHaveValue("#0f9d63");
    await userEvent.click(screen.getByRole("button", { name: /save color/i }));

    await waitFor(() => expect(settings.update).toHaveBeenCalledWith("t1", "general", { primaryColor: "#0f9d63" }));
  });

  it("lets the platform set the website color, and refuses anything but a hex value", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /website color/i }));

    const color = await screen.findByLabelText(/^custom color$/i);
    const save = screen.getByRole("button", { name: /save color/i });

    await userEvent.type(color, "green");
    expect(save).toBeDisabled();

    await userEvent.clear(color);
    await userEvent.type(color, "#0F9D63");
    await userEvent.click(save);

    await waitFor(() => expect(settings.update).toHaveBeenCalledWith("t1", "general", { primaryColor: "#0F9D63" }));
  });

  it("saves the website design the platform picks", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /website design/i }));

    const save = await screen.findByRole("button", { name: /save design/i });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /banner: full image/i }));
    await userEvent.click(screen.getByRole("button", { name: /product card: overlay/i }));
    await userEvent.click(screen.getByRole("button", { name: /product grid: 5 per row/i }));

    await userEvent.click(screen.getByRole("button", { name: /menu color: color/i }));
    await userEvent.click(screen.getByRole("button", { name: /shop filters: popup/i }));
    await userEvent.click(screen.getByLabelText(/show the bar/i));
    await userEvent.type(screen.getByLabelText(/announcement text/i), " Eid sale ");
    await userEvent.click(save);

    await waitFor(() =>
      expect(settings.update).toHaveBeenCalledWith(
        "t1",
        "general",
        expect.objectContaining({
          bannerLayout: "full",
          cardLayout: "overlay",
          gridColumns: "5",
          menuColor: "brand",
          filterLayout: "popup",
          announcementEnabled: "on",
          announcementText: "Eid sale",
          footerLayout: "full",
        }),
      ),
    );
  });

  it("shows webhook URLs and the audit trail", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: /webhooks/i }));
    expect(await screen.findByText("https://api/hooks/pathao/K")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /audit/i }));
    expect(await screen.findByText("TENANT_SETTINGS_UPDATED")).toBeInTheDocument();
  });

  it("uploads a new seller logo from the overview tab, and shows it in the header", async () => {
    // jsdom has no object URLs; the card previews the chosen file with one
    URL.createObjectURL = vi.fn(() => "blob:logo");
    URL.revokeObjectURL = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/platform/sellers/t1"]}>
          <Routes><Route path="/platform/sellers/:tenantId" element={<SellerDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByAltText("Seller logo")).toHaveAttribute("src", "https://x/old.png");
    expect(await screen.findByAltText("Pizza Shop logo")).toHaveAttribute("src", "https://x/old.png");

    const file = new File(["png"], "logo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/choose logo image/i), file);
    await userEvent.click(screen.getByRole("button", { name: /save logo/i }));

    await waitFor(() => expect(logo.upload).toHaveBeenCalledWith("t1", file));
    expect(await screen.findByText(/uploading to the seller's image storage/i)).toBeInTheDocument();
  });
});
