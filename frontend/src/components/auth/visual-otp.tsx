import { ClockIcon } from "@/components/ui/icons-auth";
import { VisualCard } from "./visual-card";

/* 300 of 300 seconds left, drawn as a ring. The dash array is the full
   circumference, so the offset is the fraction already spent. */
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const REMAINING = 0.78;

/**
 * Verify: the five-minute window, drawn. The countdown in the form is a
 * number; this is the same fact as a shape, which is easier to feel.
 */
export function VisualOtp() {
  return (
    <VisualCard className="text-center">
      {/* The number sits inside the ring, so both are absolutely placed in one
          relative box rather than pulled together with negative margin. */}
      <div className="relative mx-auto size-32">
      <svg viewBox="0 0 110 110" className="size-full" aria-hidden="true">
        <circle cx="55" cy="55" r={RADIUS} fill="none" stroke="#f1ece5" strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={RADIUS}
          fill="none"
          stroke="var(--brand-500)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - REMAINING)}
          transform="rotate(-90 55 55)"
        />
      </svg>
        <p className="absolute inset-0 flex items-center justify-center text-h2 font-semibold text-[#1f2a44] tabular">
          3:54
        </p>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-caption font-semibold text-[#1f2a44]">
        <ClockIcon className="size-4 text-[var(--brand-500)]" />
        Code expires in 5 minutes
      </p>
      <p className="mt-1 text-micro text-[#8b8378]">
        Request a new one and the old code stops working.
      </p>
    </VisualCard>
  );
}
