"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/checkout/field-error";

export type AppliedCoupon = { code: string; discountAmount: number };

type Props = {
  applied: AppliedCoupon | null;
  /** Asks the shop what the code is worth; resolves to the error to show, if any */
  onApply: (code: string) => Promise<string | undefined>;
  onRemove: () => void;
  disabled?: boolean;
};

/**
 * The coupon box in the order panel. The discount it shows is the shop's
 * answer for this bag; the order checks the code again when it is placed.
 */
export function CouponField({ applied, onApply, onRemove, disabled = false }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-success-subtle px-3 py-2">
        <p className="min-w-0 text-small text-success-text">
          <span className="font-semibold">{applied.code}</span> applied
        </p>
        <Button variant="secondary" size="sm" onClick={onRemove} disabled={disabled}>
          Remove
        </Button>
      </div>
    );
  }

  const apply = () =>
    startTransition(async () => {
      setError(undefined);
      const problem = await onApply(code);
      if (problem) setError(problem);
      else setCode("");
    });

  return (
    <div>
      <label htmlFor="checkout-coupon" className="mb-1.5 block text-caption font-medium text-text-secondary">
        Coupon code
      </label>
      <div className="flex gap-2">
        <Input
          id="checkout-coupon"
          value={code}
          maxLength={40}
          autoComplete="off"
          placeholder="SAVE10"
          aria-invalid={Boolean(error)}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            // Enter applies the coupon instead of submitting the whole order
            if (event.key === "Enter") {
              event.preventDefault();
              if (code.trim()) apply();
            }
          }}
        />
        <Button variant="secondary" onClick={apply} disabled={disabled || pending || !code.trim()}>
          {pending ? "Checking…" : "Apply"}
        </Button>
      </div>
      <FieldError message={error} />
    </div>
  );
}
