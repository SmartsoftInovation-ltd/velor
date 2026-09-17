import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import SignInForm from "./SignInForm";
import { getWorkspace, setWorkspace } from "../../lib/session";

const post = vi.fn();
const setAccessToken = vi.fn();
const refreshAuth = vi.fn();

vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { post: (...args: unknown[]) => post(...args) },
  setAccessToken: (token: string) => setAccessToken(token),
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ refreshAuth }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const renderAt = (url = "/signin") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SignInForm />
    </MemoryRouter>,
  );

describe("SignInForm", () => {
  beforeEach(() => {
    post.mockReset();
    setAccessToken.mockReset();
    refreshAuth.mockReset();
  });

  it("prefills the workspace from a deep link, then from the remembered value", () => {
    renderAt("/signin?workspace=PizzaShop");
    expect(screen.getByPlaceholderText(/store id/i)).toHaveValue("pizzashop");
  });

  it("prefills the remembered workspace", () => {
    setWorkspace("burgerhub");
    renderAt();
    expect(screen.getByPlaceholderText(/store id/i)).toHaveValue("burgerhub");
  });

  it("requires a workspace", async () => {
    renderAt();
    await userEvent.type(screen.getByPlaceholderText(/email/i), "staff@pizza.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/workspace is required/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("signs in to the workspace and remembers it", async () => {
    post.mockResolvedValue({ data: { data: { accessToken: "token-1", tenant: { slug: "pizzashop" } } } });
    renderAt();

    await userEvent.type(screen.getByPlaceholderText(/store id/i), "PizzaShop");
    await userEvent.type(screen.getByPlaceholderText(/email/i), "staff@pizza.com");
    await userEvent.type(screen.getByPlaceholderText(/password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/auth/login");
    expect(post.mock.calls[0][1]).toEqual({ workspace: "pizzashop", email: "staff@pizza.com", password: "Pizza-Pass1" });
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith("token-1"));
    expect(getWorkspace()).toBe("pizzashop");
    expect(refreshAuth).toHaveBeenCalled();
  });
});
