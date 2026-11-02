import { MailIcon } from "@/components/ui/icons-footer";
import { Line, VisualCard } from "./visual-card";

/**
 * Forgot password: the mail on its way. The envelope carries a code, not a
 * password — which is the one thing worth saying on this screen.
 */
export function VisualForgot() {
  return (
    <div className="w-full max-w-xs space-y-4">
      <VisualCard className="relative">
        <span
          aria-hidden="true"
          className="animate-float-y absolute -top-5 -right-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--brand-500)] text-on-brand shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--brand-500)_70%,transparent)]"
        >
          <MailIcon className="size-5" />
        </span>

        <p className="mb-1 text-caption font-semibold text-[#1f2a44]">
          Your reset code
        </p>
        <p className="mb-4 text-micro text-[#8b8378]">ShoPzio · just now</p>

        <div className="mb-4 space-y-2">
          <Line w="w-full" />
          <Line w="w-4/5" />
        </div>

        <div className="flex justify-between gap-1.5">
          {["4", "9", "2", "7", "1", "5"].map((digit, index) => (
            <span
              key={index}
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#faf8f5] text-body font-semibold text-[#1f2a44] tabular"
            >
              {digit}
            </span>
          ))}
        </div>
      </VisualCard>

      <p className="text-center text-micro text-[#8b8378]">
        We never send your password — only a code that expires.
      </p>
    </div>
  );
}
