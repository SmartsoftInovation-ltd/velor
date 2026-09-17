import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import SellersPage from "./SellersPage";

const seller = (id: string, name: string, slug: string, status: string) => ({
  _id: id, name, slug, status, plan: "standard", limits: { maxStaff: 5 }, webhookKey: "K", createdAt: "2026-09-17T00:00:00Z",
});

const list = vi.fn();
const suspend = vi.fn();
const activate = vi.fn();
vi.mock("../../platform/endpoints", () => ({
  tenantsApi: {
    list: (...a: unknown[]) => list(...a),
    suspend: (...a: unknown[]) => suspend(...a),
    activate: (...a: unknown[]) => activate(...a),
    provision: vi.fn(),
  },
}));
vi.mock("../../platform/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ isSuperadmin: true }) }));
vi.mock("../../components/common/PageMeta", () => ({ default: () => null }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><SellersPage /></MemoryRouter>
    </QueryClientProvider>,
  );

describe("SellersPage (Platform Console)", () => {
  beforeEach(() => {
    list.mockReset();
    suspend.mockReset();
    list.mockResolvedValue({
      items: [seller("t1", "Pizza Shop", "pizzashop", "active"), seller("t2", "Book House", "bookhouse", "suspended")],
      total: 2, page: 1, limit: 10,
      counts: { all: 2, active: 1, provisioning: 0, suspended: 1, cancelled: 0 },
    });
  });

  it("lists sellers with counts in the header and on the filter pills", async () => {
    renderPage();

    expect(await screen.findByText("Pizza Shop")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seller List" })).toBeInTheDocument();
    expect(screen.getByText(/2 sellers · 1 active · 1 suspended/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^all 2$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /create seller/i })).toBeInTheDocument();
    expect(screen.queryByText(/create store/i)).not.toBeInTheDocument();
  });

  it("filters by status from the pills", async () => {
    renderPage();
    await screen.findByText("Pizza Shop");

    await userEvent.click(screen.getByRole("button", { name: /^suspended 1$/i }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "suspended", page: 1 })));
  });

  it("suspends a seller from the row action after confirming with a reason", async () => {
    suspend.mockResolvedValue(seller("t1", "Pizza Shop", "pizzashop", "suspended"));
    renderPage();
    const row = (await screen.findByText("Pizza Shop")).closest("tr") as HTMLElement;

    await userEvent.click(within(row).getByRole("button", { name: /suspend pizza shop/i }));
    const dialog = await screen.findByRole("dialog", { name: /suspend pizza shop/i });
    await userEvent.type(within(dialog).getByLabelText(/reason/i), "Unpaid invoice");
    await userEvent.click(within(dialog).getByRole("button", { name: /^suspend seller$/i }));

    await waitFor(() => expect(suspend).toHaveBeenCalledWith("t1", "Unpaid invoice"));
  });
});
