import { CheckIcon } from "@/components/ui/icons-filter";
import { VisualCard } from "./visual-card";

const PERKS = [
  "৳200 off your first order",
  "Free returns for 14 days",
  "Restock alerts on your sizes",
  "Early access to new drops",
];

/**
 * Sign up: what the account is actually worth. A benefit list, because that is
 * the question someone weighs on this screen — not what the form looks like.
 */
export function VisualSignUp() {
  return (
    <VisualCard>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <p className="text-caption font-semibold tracking-wide text-[#8b8378] uppercase">
          Member perks
        </p>
        <p className="text-caption font-semibold text-[var(--orange-600)]">Free</p>
      </div>

      <ul className="space-y-3">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange-100)] text-[var(--orange-600)]">
              <CheckIcon className="size-3" />
            </span>
            <span className="text-caption leading-snug text-[#3f3a33]">{perk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#faf8f5] px-3 py-2.5">
        <span className="flex -space-x-2">
          {["#f97316", "#26324f", "#4f9a75"].map((color) => (
            <span
              key={color}
              aria-hidden="true"
              className="size-6 rounded-full border-2 border-white"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <p className="text-micro text-[#8b8378]">
          Joined by <span className="font-semibold text-[#1f2a44]">12,400+</span> shoppers
        </p>
      </div>
    </VisualCard>
  );
}
