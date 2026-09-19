import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import SignInForm from "./SignInForm";
import { clearWorkspace, getWorkspace, setWorkspace } from "../../lib/session";

const post = vi.fn();
const setAccessToken = vi.fn();
const clearAccessToken = vi.fn();
const refreshAuth = vi.fn();
// The real clearAuth forgets the workspace, which is what this form relies on
const clearAuth = vi.fn(() => clearWorkspace());
const platformStartSignIn =
  vi.fn<(credentials: { email: string; password: string }) => Promise<{ challengeId: string; phone: string; expiresInSeconds: number }>>(
    () => Promise.reject(new Error("not an operator")),
  );

vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { post: (...args: unknown[]) => post(...args) },
  setAccessToken: (token: string) => setAccessToken(token),
  clearAccessToken: () => clearAccessToken(),
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ refreshAuth, clearAuth }) }));
// A platform operator's sign-in is a different account in a different collection;
// these tests cover the store path, so the console's own step never starts.
vi.mock("../../platform/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ startSignIn: platformStartSignIn, verifyCode: vi.fn(), resendCode: vi.fn() }),
}));
vi.mock("../../platform/visibility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../platform/visibility")>()),
  PLATFORM_WORKSPACES: ["console"],
}));
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
    clearAccessToken.mockReset();
    refreshAuth.mockReset();
    clearAuth.mockClear();
    localStorage.clear();
  });

  it("prefills the workspace from a deep link, then from the remembered value", () => {
    renderAt("/signin?workspace=PizzaShop");
    expect(screen.getByLabelText(/^workspace/i)).toHaveValue("pizzashop");
  });

  it("prefills the remembered workspace", () => {
    setWorkspace("burgerhub");
    renderAt();
    expect(screen.getByLabelText(/^workspace/i)).toHaveValue("burgerhub");
  });

  it("marks a valid email and toggles password visibility", async () => {
    renderAt();
    await userEvent.type(screen.getByLabelText(/^email or phone/i), "Staff@Pizza.com");
    expect(screen.getByLabelText(/valid email/i)).toBeInTheDocument();

    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("requires a workspace", async () => {
    renderAt();
    await userEvent.type(screen.getByLabelText(/^email or phone/i), "Staff@Pizza.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/workspace is required/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("signs in to the workspace and remembers it", async () => {
    post.mockResolvedValue({ data: { data: { accessToken: "token-1", tenant: { slug: "pizzashop" } } } });
    renderAt();

    await userEvent.type(screen.getByLabelText(/^workspace/i), "PizzaShop");
    await userEvent.type(screen.getByLabelText(/^email or phone/i), "Staff@Pizza.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/auth/login");
    expect(post.mock.calls[0][1]).toEqual({ workspace: "pizzashop", email: "staff@pizza.com", password: "Pizza-Pass1" });
    expect(post.mock.calls[0][2]).toMatchObject({ headers: { "x-tenant": "pizzashop" } });
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith("token-1"));
    expect(getWorkspace()).toBe("pizzashop");
    expect(refreshAuth).toHaveBeenCalled();
  });

  // A failed attempt must not leave the new store's x-tenant paired with the
  // previous store's session: the workspace is written only on success.
  it("drops the previous session first and does not remember a workspace it failed to sign into", async () => {
    setWorkspace("burgerhub");
    post.mockRejectedValue(new Error("nope"));
    renderAt();

    await userEvent.clear(screen.getByLabelText(/^workspace/i));
    await userEvent.type(screen.getByLabelText(/^workspace/i), "pizzashop");
    await userEvent.type(screen.getByLabelText(/^email or phone/i), "staff@pizza.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(clearAuth).toHaveBeenCalled();
    expect(clearAccessToken).toHaveBeenCalled();
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(getWorkspace()).toBeNull();
  });

  it("signs in with a phone number instead of an email", async () => {
    post.mockResolvedValue({ data: { data: { accessToken: "token-2", tenant: { slug: "pizzashop" } } } });
    renderAt("/signin?workspace=pizzashop");

    await userEvent.type(screen.getByLabelText(/^email or phone/i), "+880 1711-000000");
    await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toEqual({ workspace: "pizzashop", phone: "01711000000", password: "Pizza-Pass1" });
  });

  it("rejects input that is neither an email nor a phone number", async () => {
    renderAt("/signin?workspace=pizzashop");

    await userEvent.type(screen.getByLabelText(/^email or phone/i), "rahim");
    await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/valid email or phone/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  // The console's operator lives in its own collection, so the store login can
  // never match them: the platform endpoint is tried first, and only for the
  // workspace that owns the console.
  describe("platform operator", () => {
    it("starts the console's code step instead of a store session", async () => {
      platformStartSignIn.mockResolvedValueOnce({
        challengeId: "challenge-1",
        phone: "01*******62",
        expiresInSeconds: 300,
      });
      renderAt("/signin?workspace=console");

      await userEvent.type(screen.getByLabelText(/^email or phone/i), "operator@platform.test");
      await userEvent.type(screen.getByLabelText(/^password/i), "Platform-Pass1");
      await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

      expect(await screen.findByLabelText(/sign-in code/i)).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
      expect(setAccessToken).not.toHaveBeenCalled();
    });

    it("falls back to the store login when the account is not an operator", async () => {
      post.mockResolvedValue({ data: { data: { accessToken: "token-3" } } });
      renderAt("/signin?workspace=console");

      await userEvent.type(screen.getByLabelText(/^email or phone/i), "owner@console.test");
      await userEvent.type(screen.getByLabelText(/^password/i), "Owner-Pass1");
      await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => expect(post).toHaveBeenCalled());
      expect(setAccessToken).toHaveBeenCalledWith("token-3");
    });

    it("leaves another workspace's sign-in untouched", async () => {
      post.mockResolvedValue({ data: { data: { accessToken: "token-4" } } });
      renderAt("/signin?workspace=pizzashop");

      await userEvent.type(screen.getByLabelText(/^email or phone/i), "staff@pizza.com");
      await userEvent.type(screen.getByLabelText(/^password/i), "Pizza-Pass1");
      await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => expect(post).toHaveBeenCalled());
      expect(platformStartSignIn).not.toHaveBeenCalled();
    });
  });
});
