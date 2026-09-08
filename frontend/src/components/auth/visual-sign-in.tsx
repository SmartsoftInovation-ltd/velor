import { CartIcon, HeartIcon } from "@/components/ui/icons";
import { BoxIcon } from "@/components/ui/icons-nav";
import { Line, VisualCard } from "./visual-card";

const ROWS = [
  { Icon: BoxIcon, label: "Order #4821", meta: "Out for delivery", live: true },
  { Icon: HeartIcon, label: "Saved items", meta: "8 pieces" },
  { Icon: CartIcon, label: "Cart", meta: "2 items · ৳3,290" },
];

/**
 * Sign in: the account waiting behind the form. Real rows, not grey bars —
 * the point of signing in is that this is *your* data.
 */
export function VisualSignIn() {
  return (
    <VisualCard>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--orange-100)] text-body font-semibold text-[var(--orange-600)]">
          T
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Line w="w-24" />
          <Line w="w-16" />
        </div>
      </div>

      <ul className="space-y-2">
        {ROWS.map(({ Icon, label, meta, live }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-xl bg-[#faf8f5] px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--orange-500)] shadow-xs">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-caption font-semibold text-[#1f2a44]">
                {label}
              </span>
              <span className="block truncate text-micro text-[#8b8378]">{meta}</span>
            </span>
            {live ? (
              <span className="animate-glow-pulse size-2 shrink-0 rounded-full bg-[#22a06b]" />
            ) : null}
          </li>
        ))}
      </ul>
    </VisualCard>
  );
}
