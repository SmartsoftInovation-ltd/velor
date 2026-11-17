import type { ComponentType, ReactNode } from "react";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";
import type { Store } from "@/lib/store-api";

const LINK = "transition-colors duration-150 hover:text-text-brand";
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function Detail({ Icon, title, children }: { Icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-on-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 space-y-0.5 text-small text-text-secondary">
        <h3 className="text-body font-semibold text-text-primary">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** The store's contact details from Site Information, one card each; a missing one is left out */
export function ContactDetails({ store }: { store: Store | null }) {
  const phones = [store?.phone, store?.secondaryPhone].filter((phone): phone is string => Boolean(phone?.trim()));
  const { email, address, businessHours, googleMapLink } = store ?? {};

  if (!phones.length && !email && !address && !businessHours) {
    return (
      <p className="rounded-xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-body text-text-secondary">
        Contact details have not been added yet. Please check back soon.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {address ? (
        <Detail Icon={MapPinIcon} title="Visit Us">
          <p className="break-words">{address}</p>
          {googleMapLink ? (
            <a href={googleMapLink} target="_blank" rel="noopener noreferrer" className="font-medium text-text-brand hover:opacity-80">
              Open in Google Maps
            </a>
          ) : null}
        </Detail>
      ) : null}
      {phones.length ? (
        <Detail Icon={PhoneIcon} title="Call Us">
          {phones.map((phone) => (
            <a key={phone} href={tel(phone)} className={`block ${LINK}`}>{phone}</a>
          ))}
        </Detail>
      ) : null}
      {email ? (
        <Detail Icon={MailIcon} title="Email Us">
          <a href={`mailto:${email}`} className={`block break-all ${LINK}`}>{email}</a>
          <p>We&apos;ll reply as soon as we can.</p>
        </Detail>
      ) : null}
      {businessHours ? (
        <Detail Icon={ClockIcon} title="Business Hours">
          <p className="whitespace-pre-line">{businessHours}</p>
        </Detail>
      ) : null}
    </ul>
  );
}
