import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import ProfilePage from "./ProfilePage";

const operator = {
  _id: "p1",
  name: "Owner",
  email: "owner@platform.test",
  role: "support",
  isActive: true,
  lastLoginAt: "2026-09-20T09:00:00Z",
};

const updateProfile = vi.fn();
vi.mock("../../platform/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ operator, updateProfile: (...a: unknown[]) => updateProfile(...a) }),
}));
vi.mock("../../components/common/PageMeta", () => ({ default: () => null }));
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ProfilePage /></MemoryRouter>
    </QueryClientProvider>,
  );

const save = () => userEvent.click(screen.getByRole("button", { name: /save changes/i }));

describe("ProfilePage (Platform Console)", () => {
  beforeEach(() => {
    updateProfile.mockReset();
    updateProfile.mockResolvedValue(undefined);
    toastError.mockReset();
  });

  it("renames the operator without asking for a password", async () => {
    renderPage();

    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "New Name");
    // Only an email or password change needs the current one
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await save();

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ name: "New Name" }));
  });

  it("asks for the current password before moving the sign-in phone", async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText("Phone"), "01812345678");
    await userEvent.type(await screen.findByLabelText("Current password"), "Platform-Passw0rd!");
    await save();

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        phone: "01812345678",
        currentPassword: "Platform-Passw0rd!",
      }),
    );
  });

  it("refuses a phone that is not a Bangladeshi mobile", async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText("Phone"), "12345");
    await userEvent.type(await screen.findByLabelText("Current password"), "Platform-Passw0rd!");
    await save();

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/valid Bangladeshi mobile/));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("asks for the current password before moving the sign-in email", async () => {
    renderPage();

    const email = screen.getByLabelText("Sign-in email");
    await userEvent.clear(email);
    await userEvent.type(email, "moved@platform.test");
    await userEvent.type(await screen.findByLabelText("Current password"), "Platform-Passw0rd!");
    await save();

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        email: "moved@platform.test",
        currentPassword: "Platform-Passw0rd!",
      }),
    );
  });

  it("refuses a new password that does not match its repeat", async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText("New password"), "Another-Passw0rd!");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "Another-Passw0rd?");
    await userEvent.type(screen.getByLabelText("Current password"), "Platform-Passw0rd!");
    await save();

    expect(updateProfile).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("The two passwords do not match");
  });

  // Role belongs to a superadmin on the Operators page, not to the account itself
  it("offers no way to change the role", () => {
    renderPage();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });
});
