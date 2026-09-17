import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlatformAuthProvider } from "./PlatformAuthContext";
import PlatformGate from "./PlatformGate";
import { getPlatformToken, setPlatformToken } from "./api";

const consoleAccess = vi.fn();
const me = vi.fn();
const logout = vi.fn();
vi.mock("./endpoints", () => ({
  authApi: {
    consoleAccess: (...a: unknown[]) => consoleAccess(...a),
    me: (...a: unknown[]) => me(...a),
    logout: (...a: unknown[]) => logout(...a),
  },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { _id: "u1" }, isLoading: false }) }));

const operator = { _id: "p1", name: "Owner", email: "owner@platform.test", role: "superadmin", isActive: true };

const renderGate = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlatformAuthProvider>
        <PlatformGate>
          <p>platform page</p>
        </PlatformGate>
      </PlatformAuthProvider>
    </QueryClientProvider>,
  );

const enterCode = async (code: string) => {
  await userEvent.type(screen.getByLabelText(/access code/i), code);
  await userEvent.click(screen.getByRole("button", { name: /enter platform console/i }));
};

describe("PlatformGate", () => {
  beforeEach(() => {
    setPlatformToken(null);
    consoleAccess.mockReset();
    me.mockReset();
    logout.mockReset();
  });

  it("opens the console with the secret code using the signed-in dashboard session", async () => {
    consoleAccess.mockResolvedValue({ accessToken: "platform-token", user: operator });
    renderGate();

    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    await enterCode("taufik");

    expect(await screen.findByText("platform page")).toBeInTheDocument();
    expect(consoleAccess).toHaveBeenCalledTimes(1);
    expect(getPlatformToken()).toBe("platform-token");
    expect(screen.queryByRole("button", { name: /lock/i })).not.toBeInTheDocument();
  });

  it("rejects a wrong code without calling the API", async () => {
    renderGate();
    await enterCode("nope");

    expect(await screen.findByRole("alert")).toHaveTextContent(/wrong access code/i);
    expect(consoleAccess).not.toHaveBeenCalled();
    expect(screen.queryByText("platform page")).not.toBeInTheDocument();
  });

  it("shows the API refusal when the account is not the platform owner", async () => {
    consoleAccess.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject({ response: { data: { message: "Only the platform store owner can open the Platform Console" } } }), 5)),
    );
    renderGate();
    await enterCode("taufik");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/only the platform store owner/i));
  });

  it("restores an open console session", async () => {
    setPlatformToken("existing");
    me.mockResolvedValue(operator);
    renderGate();
    expect(await screen.findByText("platform page")).toBeInTheDocument();
  });
});
