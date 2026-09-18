import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { PlatformAuthProvider } from "./PlatformAuthContext";
import PlatformGate from "./PlatformGate";
import { getPlatformToken, setPlatformToken } from "./api";

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
  await userEvent.type(screen.getByLabelText(/email/i), email);
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
});
