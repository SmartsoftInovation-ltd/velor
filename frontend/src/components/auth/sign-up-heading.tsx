import { ShieldCheckIcon, TruckIcon } from "@/components/ui/icons";
import { BagIcon } from "@/components/ui/icons-nav";
import { BoltIcon } from "@/components/ui/icons-section";

// What the account gives, said in three words each instead of a sentence
const BENEFITS = [
  { Icon: BoltIcon, label: "Faster checkout" },
  { Icon: TruckIcon, label: "Order tracking" },
  { Icon: ShieldCheckIcon, label: "Details kept private" },
];

/** The shop's name as a small brand tag, so it reads as "this shop", not as prose */
export function StoreTag({ storeName }: { storeName: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-brand-100 px-2 py-0.5 font-semibold text-text-brand [&>svg]:size-4 [&>svg]:shrink-0">
      <BagIcon />
      <span className="truncate">{storeName}</span>
    </span>
  );
}

/**
 * The top of the sign-up form: what this is (one heading), which
 * shop it is for (the store as a tag under it), and why (three short benefits).
 */
export function SignUpHeading({ storeName }: { storeName: string }) {
  return (
    <div className="animate-rise-in">
      <h1 className="text-h1 font-bold tracking-tight text-text-primary">Create your account</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-text-secondary">
        on
        <StoreTag storeName={storeName} />
      </p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {BENEFITS.map(({ Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-canvas px-2.5 py-1 text-caption text-text-secondary [&>svg]:size-3.5 [&>svg]:text-text-brand"
          >
            <Icon />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
