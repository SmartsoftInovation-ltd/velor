import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import ResetPasswordForm from "./ResetPasswordForm";

const post = vi.fn();
vi.mock("../../hooks/useAxiosSecure", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: (msg: string) => toastError(msg) } }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/signin" element={<p>Sign in page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    post.mockReset();
    toastError.mockReset();
  });

  it("sends a code by SMS, then resets the password with it", async () => {
    post.mockResolvedValue({ data: {} });
    renderAt("/reset-password?workspace=pizzashop");

    expect(screen.getByLabelText(/^workspace/i)).toHaveValue("pizzashop");
    await userEvent.type(screen.getByLabelText(/email or phone/i), "01711000000");
    await userEvent.click(screen.getByRole("button", { name: /send code by sms/i }));

    // The store is named per request; nothing is written to localStorage, so a
    // signed-in session's token cannot end up paired with another store's header.
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/auth/forgot-password",
        { workspace: "pizzashop", phone: "01711000000" },
        { headers: { "x-tenant": "pizzashop" } },
      ),
    );
    expect(localStorage.getItem("workspace")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent(/6-digit code/i);

    await userEvent.type(screen.getByLabelText(/sms code/i), "12a34");
    await userEvent.type(screen.getByLabelText(/^new password/i), "Pizza-New-Pass1");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "Pizza-New-Pass1");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    expect(await screen.findByText(/6-digit code from the sms/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/sms code/i), "56");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        "/auth/reset-password",
        {
          workspace: "pizzashop",
          phone: "01711000000",
          otp: "123456",
          newPassword: "Pizza-New-Pass1",
        },
        { headers: { "x-tenant": "pizzashop" } },
      ),
    );
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
  });

  it("can resend the code", async () => {
    post.mockResolvedValue({ data: {} });
    renderAt("/reset-password?workspace=pizzashop");

    await userEvent.type(screen.getByLabelText(/email or phone/i), "rahim@pizza.com");
    await userEvent.click(screen.getByRole("button", { name: /send code by sms/i }));
    await userEvent.click(await screen.findByRole("button", { name: /resend code/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]).toEqual([
      "/auth/forgot-password",
      { workspace: "pizzashop", email: "rahim@pizza.com" },
      { headers: { "x-tenant": "pizzashop" } },
    ]);
  });

  it("shows why the code could not be sent", async () => {
    post.mockRejectedValue({ isAxiosError: true, response: { data: { message: "Password reset by SMS is not available." } } });
    renderAt("/reset-password?workspace=pizzashop");

    await userEvent.type(screen.getByLabelText(/email or phone/i), "01711000000");
    await userEvent.click(screen.getByRole("button", { name: /send code by sms/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Password reset by SMS is not available."));
    expect(screen.queryByLabelText(/sms code/i)).not.toBeInTheDocument();
  });

  it("counts down the 3 minutes, then blocks the old code until a new one is sent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      post.mockResolvedValue({ data: { data: { expiresIn: 180 } } });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderAt("/reset-password?workspace=pizzashop");

      await user.type(screen.getByLabelText(/email or phone/i), "01711000000");
      await user.click(screen.getByRole("button", { name: /send code by sms/i }));
      expect(await screen.findByTestId("code-countdown")).toHaveTextContent(/expires in 3:00|expires in 2:59/);

      await act(async () => { vi.advanceTimersByTime(61_000); });
      expect(screen.getByTestId("code-countdown")).toHaveTextContent(/expires in 1:5\d/);

      await act(async () => { vi.advanceTimersByTime(120_000); });
      expect(screen.getByTestId("code-countdown")).toHaveTextContent(/code expired/i);
      expect(screen.getByRole("button", { name: /set new password/i })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: /resend code/i }));
      await waitFor(() => expect(screen.getByTestId("code-countdown")).toHaveTextContent(/expires in (3:00|2:59)/));
      expect(screen.getByRole("button", { name: /set new password/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
