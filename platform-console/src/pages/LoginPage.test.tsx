import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import LoginPage from "./LoginPage";

const signIn = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ signIn: (...args: unknown[]) => signIn(...args) }) }));

describe("LoginPage", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>tenants home</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("signs in and goes to the tenant list", async () => {
    signIn.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), "owner@platform.test");
    await userEvent.type(screen.getByLabelText(/password/i), "Platform-Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("owner@platform.test", "Platform-Passw0rd!"));
    expect(await screen.findByText("tenants home")).toBeInTheDocument();
  });

  it("shows the server's error", async () => {
    // Rejects asynchronously, like a real 401 from the API
    signIn.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject({ response: { data: { message: "Invalid credentials" } } }), 5)),
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/email/i), "x@platform.test");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });
});
