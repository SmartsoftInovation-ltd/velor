import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SmsPreview from "./SmsPreview";
import SendSmsForm from "./SendSmsForm";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ tenant: { name: "Velor" } }) }));
const post = vi.fn();
vi.mock("../../hooks/useAxiosSecure", () => ({ default: { post: (...a: unknown[]) => post(...a) } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe("SmsPreview", () => {
  it("shows the message as sent, from the store, with its count", () => {
    render(<SmsPreview message={"Hello\nworld"} recipientLabel="01712345678" recipientCount={3} />);
    expect(screen.getByText("Velor")).toBeInTheDocument();
    expect(screen.getByText("to 01712345678")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Hello\nworld")).toBeInTheDocument();
    expect(screen.getByText("11/160")).toBeInTheDocument();
    expect(screen.getByText(/English \(GSM\)/)).toBeInTheDocument();
    // 3 recipients, one SMS each
    expect(screen.getAllByText("3")).toHaveLength(2);
  });

  it("counts Bangla against the 70-character limit", () => {
    render(<SmsPreview message="আপনার বকেয়া" />);
    expect(screen.getByText(/Bangla \/ emoji/)).toBeInTheDocument();
    expect(screen.getByText(/\/70$/)).toBeInTheDocument();
  });

  it("shows the real time and keeps it current", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 1, 15, 7, 58));
      render(<SmsPreview message="Hi" />);
      expect(screen.getByText("3:07")).toBeInTheDocument();
      expect(screen.getByText("Text Message · Today 3:07")).toBeInTheDocument();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 1, 15, 8, 3));
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText("3:08")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("has a placeholder before anything is typed", () => {
    render(<SmsPreview message="  " />);
    expect(screen.getByText("Your message will appear here.")).toBeInTheDocument();
  });
});

describe("SendSmsForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    post.mockReset().mockResolvedValue({ data: {} });
  });

  it("previews as you type and sends to every valid number", async () => {
    render(<SendSmsForm />);
    await userEvent.type(screen.getByLabelText(/phone number/i), "01712345678, 01812345678");
    await userEvent.type(screen.getByRole("textbox", { name: /^message/i }), "Sale today");
    expect(screen.getByText("Sale today", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("to 2 numbers")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /send sms/i }));
    expect(post).toHaveBeenCalledWith("/sms/send-sms", { phoneNumber: "01712345678,01812345678", message: "Sale today" });
  });

  it("refuses a number that is not Bangladeshi", async () => {
    render(<SendSmsForm />);
    await userEvent.type(screen.getByLabelText(/phone number/i), "01212345678");
    await userEvent.type(screen.getByRole("textbox", { name: /^message/i }), "Hi");
    await userEvent.click(screen.getByRole("button", { name: /send sms/i }));
    expect(screen.getByText(/not a valid bangladeshi number: 01212345678/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("checks the number as soon as the field is left, and confirms a good one", async () => {
    render(<SendSmsForm />);
    const phone = screen.getByLabelText(/phone number/i);
    expect(screen.getByText(/bangladeshi mobile, e\.g\./i)).toBeInTheDocument();

    await userEvent.type(phone, "017123");
    // Not flagged while still typing
    expect(screen.queryByText(/not a valid/i)).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText(/not a valid bangladeshi number: 017123/i)).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-invalid", "true");

    await userEvent.type(phone, "45678");
    expect(screen.getByText(/✓ valid number/i)).toBeInTheDocument();
  });

  it("drops letters and catches a repeated number", async () => {
    render(<SendSmsForm />);
    const phone = screen.getByLabelText(/phone number/i);
    await userEvent.type(phone, "01a71b2345678, 01712345678");
    expect(phone).toHaveValue("01712345678, 01712345678");
    await userEvent.tab();
    expect(screen.getByText(/01712345678 is entered more than once/i)).toBeInTheDocument();
  });

  it("stops typing at one SMS", async () => {
    render(<SendSmsForm />);
    const box = screen.getByRole("textbox", { name: /^message/i });
    await userEvent.click(box);
    await userEvent.paste("a".repeat(200));
    expect((box as HTMLTextAreaElement).value).toHaveLength(160);
    expect(screen.getByText("Limit reached")).toBeInTheDocument();
  });
});
