import type { ReactNode } from "react";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";
import type { Store } from "@/lib/store-api";

const LINK = "transition-colors duration-150 hover:text-text-brand";

function Detail({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-lg border border-border-default bg-bg-surface p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0 space-y-1 text-body text-text-secondary">
        <h2 className="text-small font-semibold text-text-primary">{title}</h2>
        {children}
      </div>
    </li>
  );
}

/** The store's contact details from Store Information; a missing one is left out */
export function ContactDetails({ store }: { store: Store | null }) {
  const phones = [store?.phone, store?.secondaryPhone].filter((phone): phone is string => Boolean(phone));
  const { email, address, businessHours, googleMapLink } = store ?? {};

  if (!phones.length && !email && !address && !businessHours) {
    return (
      <p className="max-w-2xl rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center text-body text-text-secondary">
        Contact details have not been added yet. Please check back soon.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {phones.length ? (
        <Detail icon={<PhoneIcon />} title="Call us">
          {phones.map((phone) => (
            <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`block ${LINK}`}>
              {phone}
            </a>
          ))}
        </Detail>
      ) : null}
      {email ? (
        <Detail icon={<MailIcon />} title="Email">
          <a href={`mailto:${email}`} className={`block break-all ${LINK}`}>
            {email}
          </a>
        </Detail>
      ) : null}
      {address ? (
        <Detail icon={<MapPinIcon />} title="Address">
          <p>{address}</p>
          {googleMapLink ? (
            <a href={googleMapLink} target="_blank" rel="noopener noreferrer" className="text-small font-medium text-text-brand hover:opacity-80">
              Open in Google Maps
            </a>
          ) : null}
        </Detail>
      ) : null}
      {businessHours ? (
        <Detail icon={<ClockIcon />} title="Opening hours">
          <p>{businessHours}</p>
        </Detail>
      ) : null}
    </ul>
  );
}
