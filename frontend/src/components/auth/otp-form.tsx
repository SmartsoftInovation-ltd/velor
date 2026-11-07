"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendResetCodeAction, verifyResetCodeAction, type ResetFormState } from "@/lib/actions/password-reset";
import { OTP_LENGTH as LENGTH } from "@/lib/password-reset";
import { FormAlert } from "./form-alert";
import { OtpCountdown } from "./otp-countdown";

/**
 * Six single-character inputs rather than one field: it makes the expected
 * length obvious and lets each digit be corrected in place. Paste is handled
 * on the first box, which is where a pasted code lands. The digits post as
 * one `otp` field. `secondsLeft` is what the code had when the page rendered.
 */
export function OtpForm({ secondsLeft }: { secondsLeft: number }) {
  const [state, action, pending] = useActionState<ResetFormState, FormData>(verifyResetCodeAction, {});
  const [resent, setResent] = useState<ResetFormState>({});
  const [resending, startResend] = useTransition();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (index: number) => inputs.current[index]?.focus();

  const setAt = (index: number, value: string) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const onChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "").slice(-1);
    setAt(index, value);
    if (value && index < LENGTH - 1) focus(index + 1);
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setAt(index - 1, "");
      focus(index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) focus(index - 1);
    if (event.key === "ArrowRight" && index < LENGTH - 1) focus(index + 1);
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < Math.min(pasted.length, LENGTH); i += 1) next[i] = pasted[i];
    setDigits(next);
    focus(Math.min(pasted.length, LENGTH - 1));
  };

  const complete = digits.every(Boolean);
  const error = resent.error ?? state.error ?? state.fieldErrors?.otp;

  const resend = () =>
    startResend(async () => {
      const answer = await resendResetCodeAction();
      setResent(answer);
      if (!answer.error) {
        setDigits(Array(LENGTH).fill(""));
        focus(0);
      }
    });

  return (
    <form action={action} className="space-y-5">
      {error ? <FormAlert>{error}</FormAlert> : resent.sentAt ? <FormAlert tone="info">A new code is on its way.</FormAlert> : null}
      <input type="hidden" name="otp" value={digits.join("")} />
      <fieldset>
        <legend className="sr-only">Verification code</legend>
        <div className="flex justify-between gap-2">
          {digits.map((digit, index) => (
            <input
              // Position is the identity here — the boxes never reorder.
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => onChange(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1}`}
              className="h-14 w-full rounded-md border border-border-default bg-bg-surface text-center text-h3 font-semibold text-text-primary tabular shadow-xs transition-colors duration-150 hover:border-border-strong focus-visible:border-border-brand focus-visible:outline-none"
            />
          ))}
        </div>
      </fieldset>

      <OtpCountdown
        seconds={resent.expiresIn ?? secondsLeft}
        restartKey={resent.sentAt}
        onResend={resend}
        resending={resending}
      />

      <Button type="submit" size="lg" fullWidth disabled={!complete || pending}>
        {pending ? "Checking…" : "Verify code"}
      </Button>
    </form>
  );
}
