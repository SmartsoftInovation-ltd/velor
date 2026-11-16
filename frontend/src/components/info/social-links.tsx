import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/icons-footer";
import type { Store } from "@/lib/store-api";

/** The store's social pages from Store Information; nothing when none is set */
export function SocialLinks({ store }: { store: Store | null }) {
  const links = [
    { label: "Facebook", href: store?.facebookLink, Icon: FacebookIcon },
    { label: "Instagram", href: store?.instagramLink, Icon: InstagramIcon },
    { label: "WhatsApp", href: store?.whatsappLink, Icon: WhatsAppIcon },
  ].filter((link) => link.href);

  if (!links.length) return null;

  return (
    <ul aria-label="Follow us" className="flex flex-wrap gap-3">
      {links.map(({ label, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 text-small font-medium text-text-primary transition-colors duration-150 hover:border-brand-500 hover:text-text-brand"
          >
            <Icon className="size-4" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
