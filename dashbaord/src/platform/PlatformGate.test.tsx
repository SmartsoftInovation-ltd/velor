import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { PlatformAuthProvider } from "./PlatformAuthContext";
import PlatformGate from "./PlatformGate";
import { getPlatformToken, refreshPlatformSession, setPlatformToken } from "./api";

// The refresh call is the only part of the module the gate should not really run
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, refreshPlatformSession: vi.fn() };
});
const refreshSession = vi.mocked(refreshPlatformSession);

const login = vi.fn();
const verifyOtp = vi.fn();
const resendOtp = vi.fn();
const me = vi.fn();
const logout = vi.fn();
vi.mock("./endpoints", () => ({
  authApi: {
    login: (...a: unknown[]) => login(...a),
    verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    resendOtp: (...a: unknown[]) => resendOtp(...a),
    me: (...a: unknown[]) => me(...a),
    logout: (...a: unknown[]) => logout(...a),
  },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { _id: "u1" }, isLoading: false }) }));

const operator = { _id: "p1", name: "Owner", email: "owner@platform.test", role: "superadmin", isActive: true };
const challenge = { challengeId: "11111111-2222-3333-4444-555555555555", phone: "01******62", expiresInSeconds: 300 };

// The gate navigates away when the operator leaves the console, so it needs a router
const renderGate = () =>
  render(
    <MemoryRouter initialEntries={["/platform"]}>
      <QueryClientProvider client={new QueryClient()}>
        <PlatformAuthProvider>
          <PlatformGate>
            <p>platform page</p>
          </PlatformGate>
        </PlatformAuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

const signIn = async (email = "owner@platform.test", password = "secret") => {
  // The gate first tries the refresh cookie, so wait for the form it falls back to
  await userEvent.type(await screen.findByLabelText(/email/i), email);
  // Exact: the show/hide toggle is also labelled "… password"
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /continue/i }));
};

const enterCode = async (code: string) => {
  await userEvent.type(await screen.findByLabelText(/sign-in code/i), code);
  await userEvent.click(screen.getByRole("button", { name: /enter platform console/i }));
};

describe("PlatformGate", () => {
  beforeEach(() => {
    setPlatformToken(null);
    login.mockReset();
    verifyOtp.mockReset();
    resendOtp.mockReset();
    me.mockReset();
    logout.mockReset();
    refreshSession.mockReset();
    refreshSession.mockRejectedValue(new Error("no session"));
  });

  it("opens the console only after the password and the texted code", async () => {
    login.mockResolvedValue(challenge);
    verifyOtp.mockResolvedValue({ accessToken: "platform-token", user: operator });
    renderGate();

    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
    await signIn();

    // The password alone does not open a session
    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
    expect(getPlatformToken()).toBeNull();
    expect(await screen.findByText(/01\*+62/)).toBeInTheDocument();

    await enterCode("123456");

    expect(await screen.findByText("platform page")).toBeInTheDocument();
    expect(verifyOtp).toHaveBeenCalledWith({ challengeId: challenge.challengeId, code: "123456" });
    expect(getPlatformToken()).toBe("platform-token");
  });

  it("shows the API refusal when the credentials are wrong", async () => {
    login.mockRejectedValue({ response: { data: { message: "Invalid credentials" } } });
    renderGate();
    await signIn("nobody@platform.test", "wrong");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i));
    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
  });

  it("keeps the code screen open when the code is wrong", async () => {
    login.mockResolvedValue(challenge);
    verifyOtp.mockRejectedValue({ response: { data: { message: "Invalid or expired code" } } });
    renderGate();
    await signIn();
    await enterCode("000000");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid or expired code/i));
    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
    expect(getPlatformToken()).toBeNull();
  });

  it("sends a new code on request", async () => {
    login.mockResolvedValue(challenge);
    resendOtp.mockResolvedValue({ ...challenge, challengeId: "99999999-2222-3333-4444-555555555555" });
    renderGate();
    await signIn();
    await userEvent.click(await screen.findByRole("button", { name: /send a new code/i }));

    await waitFor(() => expect(resendOtp).toHaveBeenCalledTimes(1));
  });

  it("restores an open console session", async () => {
    setPlatformToken("existing");
    me.mockResolvedValue(operator);
    renderGate();
    expect(await screen.findByText("platform page")).toBeInTheDocument();
  });

  // Signing in is a one-time cost: with the access token gone the refresh cookie
  // reopens the console, so no second password and no second code.
  it("reopens the console from the refresh cookie without another code", async () => {
    refreshSession.mockResolvedValue("fresh-token");
    me.mockResolvedValue(operator);
    renderGate();

    expect(await screen.findByText("platform page")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  // The reported bug: clicking a console submenu asked for the password again.
  // A remounted gate must not paint the sign-in form over a live session.
  it("stays open when a console submenu remounts the gate", async () => {
    setPlatformToken("existing");
    me.mockResolvedValue(operator);

    const { unmount } = renderGate();
    expect(await screen.findByText("platform page")).toBeInTheDocument();
    unmount();

    renderGate();
    expect(await screen.findByText("platform page")).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  // While the restore is in flight nothing is decided yet — neither the page nor
  // the form. Showing the form there is what asked for a second sign-in.
  it("waits for the restore instead of showing the form while it is in flight", async () => {
    setPlatformToken("existing");
    let resolveMe: (user: typeof operator) => void = () => {};
    me.mockReturnValue(new Promise((resolve) => { resolveMe = resolve; }));

    renderGate();

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument());
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText("platform page")).not.toBeInTheDocument();

    resolveMe(operator);
    expect(await screen.findByText("platform page")).toBeInTheDocument();
  });
});
