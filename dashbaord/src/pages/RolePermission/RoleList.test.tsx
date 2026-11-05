import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoleList from "./RoleList";
import CreateRole from "./CreateRole";

const get = vi.fn();
const canAdd = vi.fn();

vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
}));
vi.mock("../../hooks/usePermission", () => ({ usePermission: () => canAdd() }));
// The card layout: the desktop table is virtualized and draws no rows in jsdom
vi.mock("../../hooks/useIsMobile", () => ({ default: () => true }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const setup = (page: React.ReactNode) =>
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>{page}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );

describe("role pages", () => {
  beforeEach(() => {
    get.mockReset();
    canAdd.mockReset();
    canAdd.mockReturnValue(true);
    get.mockResolvedValue({ data: { data: [{ _id: "1", name: "Cashier", slug: "cashier", isActive: true }] } });
  });

  it("Role List shows the store's roles and links to creating one", async () => {
    setup(<RoleList />);

    expect((await screen.findAllByText("Cashier")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Create Role" })).toHaveAttribute("href", "/create-role");
  });

  it("Role List hides the create link from people who may only view", async () => {
    canAdd.mockReturnValue(false);
    setup(<RoleList />);

    await screen.findAllByText("Cashier");
    expect(screen.queryByRole("link", { name: "Create Role" })).toBeNull();
  });

  it("Create Role is the form alone, with a way to the list", () => {
    setup(<CreateRole />);

    expect(screen.getByRole("link", { name: "Role List" })).toHaveAttribute("href", "/role-list");
    expect(screen.queryByText("Cashier")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
