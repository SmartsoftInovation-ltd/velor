import { MailIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { UserIcon } from "@/components/ui/icons-nav";
import type { Shopper } from "@/lib/shopper-auth";

/**
 * The details the shop holds for this account, read-only: the API has no
 * endpoint to change them yet, so the page does not pretend it can.
 */
export function AccountDetails({ user }: { user: Shopper }) {
  const rows = [
    { Icon: UserIcon, label: "Full name", value: user.name },
    { Icon: MailIcon, label: "Email address", value: user.email },
    { Icon: PhoneIcon, label: "Mobile number", value: user.phone },
  ];

  return (
    <section
      aria-labelledby="account-details-title"
      className="rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-xs"
    >
      <h2 id="account-details-title" className="text-h3 font-semibold tracking-tight text-text-primary">
        Personal details
      </h2>
      <p className="mt-1 text-small text-text-secondary">
        What this shop uses to reach you about your orders.
      </p>

      <dl className="mt-5 divide-y divide-border-subtle">
        {rows.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-brand [&>svg]:size-4.5">
              <Icon />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-caption text-text-tertiary">{label}</dt>
              <dd className="mt-0.5 truncate text-body font-medium text-text-primary">
                {value || <span className="font-normal text-text-tertiary">Not added</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
