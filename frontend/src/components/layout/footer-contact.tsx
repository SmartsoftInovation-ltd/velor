import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";

const CONTACT_ITEMS = [
  { Icon: PhoneIcon, title: "Call Us 7/24", text: "+880 123 456 789", href: "tel:+880123456789" },
  { Icon: MailIcon, title: "Make a Quote", text: "hello@shopzio.com", href: "mailto:hello@shopzio.com" },
  { Icon: ClockIcon, title: "Opening Hour", text: "Sunday - Fri: 9AM-6PM" },
  { Icon: MapPinIcon, title: "Location", text: "House: 25, Road No: 2, Block A, Mirpur-1, Dhaka 1216" },
];

/** Get in touch: the row that opens the footer */
export function FooterContact() {
  return (
    <ul
      aria-label="Get in touch"
      className="grid gap-6 pt-12 sm:grid-cols-2 lg:grid-cols-[repeat(3,auto)_minmax(0,16rem)] lg:justify-between"
    >
      {CONTACT_ITEMS.map(({ Icon, title, text, href }) => (
        <li key={title} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand">
            <Icon className="size-4.5" />
          </span>
          <p className="text-small text-white">
            <span className="block">{title}</span>
            {href ? (
              <a href={href} className="transition-colors duration-150 hover:text-brand-500">
                {text}
              </a>
            ) : (
              text
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
