import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router";
import { PlatformAuthProvider } from "./PlatformAuthContext";
import PlatformGate from "./PlatformGate";
import { setPlatformToken } from "./api";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, refreshPlatformSession: vi.fn().mockRejectedValue(new Error("no session")) };
});

const login = vi.fn();
const verifyOtp = vi.fn();
const me = vi.fn();
vi.mock("./endpoints", () => ({
  authApi: {
    login: (...a: unknown[]) => login(...a),
    verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    resendOtp: vi.fn(),
    me: (...a: unknown[]) => me(...a),
    logout: vi.fn(),
  },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { _id: "u1" }, isLoading: false }) }));

const operator = { _id: "p1", name: "Owner", email: "owner@platform.test", role: "superadmin", isActive: true };

// Mirrors the console's route shape in App.tsx: the gate is the parent route and
// the pages render through its <Outlet>, so moving between submenu items does
// not unmount it.
const renderConsole = () =>
  render(
    <MemoryRouter initialEntries={["/platform/sellers"]}>
      <QueryClientProvider client={new QueryClient()}>
        <PlatformAuthProvider>
          <Routes>
            <Route element={<PlatformGate><Outlet /></PlatformGate>}>
              <Route
                path="/platform/sellers"
                element={
                  <>
                    <p>sellers page</p>
                    <Link to="/platform/operators">Operators</Link>
                  </>
                }
              />
              <Route path="/platform/operators" element={<p>operators page</p>} />
            </Route>
          </Routes>
        </PlatformAuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe("Platform Console submenu navigation", () => {
  beforeEach(() => {
    setPlatformToken(null);
    login.mockReset();
    verifyOtp.mockReset();
    me.mockReset();
  });

  // The reported bug: every submenu click asked for the password and a new code.
  it("moves between console pages without asking to sign in again", async () => {
    setPlatformToken("existing");
    me.mockResolvedValue(operator);

    renderConsole();
    expect(await screen.findByText("sellers page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: /operators/i }));

    expect(await screen.findByText("operators page")).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
