import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformOtpStep from "./PlatformOtpStep";

const verifyCode = vi.fn(() => Promise.resolve());
const resendCode = vi.fn();

vi.mock("../../platform/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ verifyCode, resendCode }),
}));

const CHALLENGE = { challengeId: "challenge-1", phone: "01*******62", expiresInSeconds: 300 };

const renderStep = (props: Partial<Parameters<typeof PlatformOtpStep>[0]> = {}) =>
  render(
    <PlatformOtpStep
      challenge={CHALLENGE}
      credentials={{ email: "operator@platform.test", password: "Platform-Pass1" }}
      onChallenge={vi.fn()}
      onCancel={vi.fn()}
      onVerified={vi.fn()}
      {...props}
    />,
  );

const box = (position: number) => screen.getByLabelText(new RegExp(`digit ${position} of 6`, "i")) as HTMLInputElement;

describe("PlatformOtpStep", () => {
  beforeEach(() => {
    verifyCode.mockClear();
    resendCode.mockClear();
  });

  it("puts the cursor in the first box", () => {
    renderStep();
    expect(box(1)).toHaveFocus();
  });

  it("moves to the next box as digits are typed", async () => {
    renderStep();

    await userEvent.keyboard("12");

    expect(box(1).value).toBe("1");
    expect(box(2).value).toBe("2");
    expect(box(3)).toHaveFocus();
  });

  // The code usually arrives by SMS, so it is pasted rather than typed
  it("spreads a pasted code across every box", async () => {
    renderStep();

    await userEvent.paste("123456");

    expect([1, 2, 3, 4, 5, 6].map((position) => box(position).value)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("ignores anything that is not a digit", async () => {
    renderStep();

    await userEvent.keyboard("a1");

    expect(box(1).value).toBe("1");
  });

  it("steps back on backspace so the code can be walked out", async () => {
    renderStep();

    await userEvent.keyboard("12");
    await userEvent.keyboard("{Backspace}");
    expect(box(2).value).toBe("");

    await userEvent.keyboard("{Backspace}");
    expect(box(1).value).toBe("");
  });

  it("verifies the whole code once six digits are in", async () => {
    const onVerified = vi.fn();
    renderStep({ onVerified });

    await userEvent.paste("123456");
    await userEvent.click(screen.getByRole("button", { name: /enter platform console/i }));

    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "123456" }));
    expect(onVerified).toHaveBeenCalled();
  });

  it("keeps the button disabled until the code is complete", async () => {
    renderStep();

    const submit = screen.getByRole("button", { name: /enter platform console/i });
    expect(submit).toBeDisabled();

    await userEvent.paste("12345");
    expect(submit).toBeDisabled();

    await userEvent.keyboard("6");
    expect(submit).toBeEnabled();
  });
});
