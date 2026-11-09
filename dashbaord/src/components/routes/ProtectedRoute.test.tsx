import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import ProtectedRoute from "./ProtectedRoute";

let auth: Record<string, unknown> = {};
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/order-list"]}>
      <Routes>
        <Route path="/signin" element={<p>Sign in page</p>} />
        <Route
          path="/order-list"
          element={
            <ProtectedRoute module="order" action="view">
              <p>Orders</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  beforeEach(() => localStorage.setItem("accessToken", "t"));
  afterEach(() => localStorage.clear());

  const base = { isSuperAdmin: false, can: () => true, isLoading: false, refreshAuth: vi.fn() };

  it("shows the page to a signed-in user", () => {
    auth = { ...base, user: { _id: "u" }, loadFailed: false };
    renderAt();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("sends a user whose session is over to sign in", () => {
    auth = { ...base, user: null, loadFailed: false };
    renderAt();
    expect(screen.getByText("Sign in page")).toBeInTheDocument();
  });

  it("keeps the user on the page with a retry when the server could not be reached", () => {
    auth = { ...base, user: null, loadFailed: true };
    renderAt();
    expect(screen.queryByText("Sign in page")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i);
    screen.getByRole("button", { name: /try again/i }).click();
    expect(base.refreshAuth).toHaveBeenCalled();
  });

  it("sends a visitor with no token to sign in", () => {
    localStorage.clear();
    auth = { ...base, user: null, loadFailed: false };
    renderAt();
    expect(screen.getByText("Sign in page")).toBeInTheDocument();
  });
});
