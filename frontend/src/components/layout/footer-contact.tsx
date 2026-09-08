import { MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";

const CONTACT_ITEMS = [
  { Icon: PhoneIcon, label: "+880 123 456 789", href: "tel:+880123456789" },
  { Icon: MailIcon, label: "hello@shopzio.com", href: "mailto:hello@shopzio.com" },
];

export function FooterContact() {
  return (
    <div className="space-y-4">
      <h3 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
        Get in touch
      </h3>
      <ul className="space-y-3">
        {CONTACT_ITEMS.map(({ Icon, label, href }) => (
          <li key={label}>
            <a
              href={href}
              className="flex items-center gap-2.5 text-small text-text-secondary transition-colors duration-150 hover:text-text-brand"
            >
              <Icon className="size-4 shrink-0 text-text-tertiary" />
              {label}
            </a>
          </li>
        ))}
        <li className="flex items-start gap-2.5 text-small text-text-secondary">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
          House 25, Road 2, Block A, Mirpur-1, Dhaka 1216
        </li>
      </ul>
      <p className="text-caption text-text-tertiary">
        Sunday – Friday, 9:00 AM – 6:00 PM
      </p>
    </div>
  );
}
