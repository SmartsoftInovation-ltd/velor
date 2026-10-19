import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import OperatorsPage from "./OperatorsPage";

const me = { _id: "p1", name: "Owner", email: "owner@platform.test", phone: "01712345678", role: "superadmin", isActive: true };
const support = { _id: "p2", name: "Helper", email: "help@platform.test", phone: null, role: "support", isActive: true };

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("../../platform/endpoints", () => ({
  usersApi: {
    list: () => list(),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));
vi.mock("../../platform/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ operator: me, isSuperadmin: true }),
}));
vi.mock("../../components/common/PageMeta", () => ({ default: () => null }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><OperatorsPage /></MemoryRouter>
    </QueryClientProvider>,
  );

describe("OperatorsPage (Platform Console)", () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([me, support]);
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
  });

  it("creates an operator with the phone their sign-in code goes to", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /add operator/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "New Person");
    await userEvent.type(within(dialog).getByLabelText("Email"), "new@platform.test");
    await userEvent.type(within(dialog).getByLabelText("Phone"), "01812345678");
    await userEvent.type(within(dialog).getByLabelText("Password"), "Support-Pass-123");
    await userEvent.click(within(dialog).getByRole("button", { name: /add operator/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: "New Person",
        email: "new@platform.test",
        phone: "01812345678",
        password: "Support-Pass-123",
        role: "support",
      }),
    );
  });

  it("shows each operator's phone and edits another operator from the actions column", async () => {
    renderPage();

    expect(await screen.findByText("01712345678")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    // Your own account is edited on your profile, behind your password
    expect(screen.getByRole("link", { name: "Edit your profile" })).toHaveAttribute("href", "/platform/profile");
    expect(screen.queryByRole("button", { name: `Delete ${me.email}` })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Deactivate ${me.email}` })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: `Edit ${support.email}` }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Phone"), "01912345678");
    await userEvent.click(within(dialog).getByText("Superadmin"));
    await userEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));

    // Only what changed is sent
    await waitFor(() => expect(update).toHaveBeenCalledWith("p2", { phone: "01912345678", role: "superadmin" }));
  });

  it("shows an operator's details", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: `View ${support.email}` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Helper")).toBeInTheDocument();
    expect(within(dialog).getByText("Support")).toBeInTheDocument();
  });

  it("deactivates an operator only after confirming", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: `Deactivate ${support.email}` }));
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("p2", { isActive: false }));
  });

  it("deletes an operator only after confirming", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: `Delete ${support.email}` }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: `Delete ${support.email}` }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("p2"));
  });
});
