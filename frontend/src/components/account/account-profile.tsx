import { MailIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { BagIcon } from "@/components/ui/icons-nav";
import type { Shopper } from "@/lib/shopper-auth";
import { AvatarUploader } from "./avatar-uploader";
import { SignOutButton } from "./sign-out-button";

// Up to two letters from the name, for when there is no photo
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Who is signed in: the photo (changeable here), name, how the shop reaches
 * them, the shop the account belongs to, and the way out.
 */
export function AccountProfile({ user, storeName }: { user: Shopper; storeName: string }) {
  const contacts = [
    { Icon: MailIcon, value: user.email },
    { Icon: PhoneIcon, value: user.phone },
  ].filter((row) => row.value);

  return (
    <section
      aria-labelledby="account-name"
      className="relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm"
    >
      {/* A soft brand band behind the photo, the card's only decoration */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-24 bg-linear-to-br from-brand-500 via-brand-400 to-brand-300 opacity-90"
      />

      <div className="relative flex flex-col items-center px-6 pt-10 pb-6 text-center">
        <AvatarUploader image={user.image ?? null} pending={Boolean(user.imagePending)} initials={initialsOf(user.name)} />

        <h1 id="account-name" className="mt-2 text-h2 font-bold tracking-tight text-balance text-text-primary">
          {user.name}
        </h1>
        <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption font-semibold text-text-brand [&>svg]:size-3.5 [&>svg]:shrink-0">
          <BagIcon />
          <span className="truncate">Member of {storeName}</span>
        </p>

        {contacts.length ? (
          <ul className="mt-5 w-full space-y-2 border-t border-border-subtle pt-5 text-left">
            {contacts.map(({ Icon, value }) => (
              <li key={value} className="flex items-center gap-2.5 text-small text-text-secondary">
                <Icon className="size-4 shrink-0 text-text-tertiary" />
                <span className="truncate">{value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <SignOutButton />
      </div>
    </section>
  );
}
