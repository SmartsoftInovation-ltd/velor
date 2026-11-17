import type { ComponentType, SVGProps } from "react";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";
import type { Store } from "@/lib/store-api";

type ContactItem = { Icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; text: string; href?: string };

// One equal column per box on wide screens, so the boxes line up edge to edge
const LG_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/**
 * Get in touch: the row that opens the footer, from Site Information. A detail
 * the seller left empty is left out; with none filled in, the row is not shown.
 */
export function FooterContact({ store }: { store: Store | null }) {
  const phone = store?.phone?.trim();
  const email = store?.email?.trim();
  const hours = store?.businessHours?.trim();
  const address = store?.address?.trim();

  const items: ContactItem[] = [];
  if (phone) items.push({ Icon: PhoneIcon, title: "Call Us", text: phone, href: telHref(phone) });
  if (email) items.push({ Icon: MailIcon, title: "Email Us", text: email, href: `mailto:${email}` });
  if (hours) items.push({ Icon: ClockIcon, title: "Opening Hour", text: hours });
  if (address) items.push({ Icon: MapPinIcon, title: "Location", text: address });

  if (!items.length) return null;

  return (
    <ul aria-label="Get in touch" className={`grid gap-4 pt-12 sm:grid-cols-2 ${LG_COLUMNS[items.length]}`}>
      {items.map(({ Icon, title, text, href }) => (
        <li
          key={title}
          className="flex h-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors duration-200 hover:border-brand-500/60"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-brand">
            <Icon className="size-4.5" />
          </span>
          <p className="min-w-0 text-small text-white">
            <span className="block">{title}</span>
            {href ? (
              <a href={href} className="break-words transition-colors duration-150 hover:text-brand-500">
                {text}
              </a>
            ) : (
              <span className="break-words">{text}</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
