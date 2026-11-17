import type { ComponentType } from "react";
import { LinkedInIcon, XIcon, YouTubeIcon } from "@/components/ui/icons-chat";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/icons-footer";
import { chatChannels } from "@/lib/chat-channels";
import type { Store } from "@/lib/store-api";

const ICONS: Partial<Record<string, ComponentType<{ className?: string }>>> = {
  facebook: FacebookIcon,
  twitter: XIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  whatsapp: WhatsAppIcon,
};

/** Follow Us: the store's social pages from Site Information; nothing when none is set */
export function SocialLinks({ store }: { store: Store | null }) {
  // chatChannels turns a page name or handle into a full link, as the chat button does
  const links = chatChannels(store).filter((channel) => ICONS[channel.id]);
  if (!links.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-caption font-semibold tracking-wide text-text-primary uppercase">Follow Us</h3>
      <ul aria-label="Follow us" className="flex flex-wrap gap-2">
        {links.map(({ id, label, href }) => {
          const Icon = ICONS[id]!;
          return (
            <li key={id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex size-9 items-center justify-center rounded-md bg-bg-sunken text-text-secondary transition-colors duration-150 hover:bg-brand-500 hover:text-on-brand"
              >
                <Icon className="size-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
