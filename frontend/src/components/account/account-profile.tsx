import { AppImage } from "@/components/ui/app-image";
import { BagIcon } from "@/components/ui/icons-nav";
import type { Shopper } from "@/lib/shopper-auth";
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
 * Who is signed in: photo or initials, name, the shop the account belongs to,
 * and the way out (SignOutButton).
 */
export function AccountProfile({ user, storeName }: { user: Shopper; storeName: string }) {
  return (
    <section
      aria-labelledby="account-name"
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-xs"
    >
      {/* A brand band behind the avatar, the card's only decoration */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-20 bg-brand-50" />

      <div className="relative flex flex-col items-center text-center">
        <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-h2 font-bold text-text-brand ring-4 ring-bg-surface">
          {user.image ? (
            <AppImage src={user.image} alt="" width={80} height={80} className="size-full object-cover" />
          ) : (
            initialsOf(user.name) || "?"
          )}
        </span>

        <h1 id="account-name" className="mt-4 text-h2 font-bold tracking-tight text-balance text-text-primary">
          {user.name}
        </h1>
        <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-brand-100 px-2 py-0.5 text-caption font-semibold text-text-brand [&>svg]:size-3.5 [&>svg]:shrink-0">
          <BagIcon />
          <span className="truncate">Member of {storeName}</span>
        </p>

        <SignOutButton />
      </div>
    </section>
  );
}
