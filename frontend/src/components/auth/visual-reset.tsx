import { CheckIcon } from "@/components/ui/icons-filter";
import { ShieldLockIcon } from "@/components/ui/icons-auth";
import { VisualCard } from "./visual-card";

const CHECKS = ["8+ characters", "A number or symbol", "Not used before"];

/**
 * Reset: the strength meter filling and the rules going green. It shows what
 * "a good password" means here, rather than leaving the requirements as a list
 * of text the form already repeats.
 */
export function VisualReset() {
  return (
    <VisualCard>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--orange-100)] text-[var(--orange-600)]">
          <ShieldLockIcon className="size-5" />
        </span>
        <div>
          <p className="text-caption font-semibold text-[#1f2a44]">Password strength</p>
          <p className="text-micro text-[#8b8378]">Strong</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((step) => (
          <span
            key={step}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: step < 3 ? "#22a06b" : "#eae6e0" }}
          />
        ))}
      </div>

      <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-[#faf8f5] px-3 py-3">
        {Array.from({ length: 11 }).map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[#c9c3ba]"
          />
        ))}
      </div>

      <ul className="space-y-2">
        {CHECKS.map((check) => (
          <li key={check} className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e6f4ee] text-[#22a06b]">
              <CheckIcon className="size-3" />
            </span>
            <span className="text-caption text-[#3f3a33]">{check}</span>
          </li>
        ))}
      </ul>
    </VisualCard>
  );
}
