import { Logo } from "./logo";
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
} from "@/components/ui/icons-footer";

const SOCIALS = [
  { label: "Facebook", href: "https://facebook.com", Icon: FacebookIcon },
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramIcon },
  { label: "Twitter", href: "https://twitter.com", Icon: TwitterIcon },
];

export function FooterBrand() {
  return (
    <div className="max-w-sm space-y-4">
      <Logo />

      <p className="text-small text-text-secondary">
        Quality clothing without the markup — everyday staples, seasonal edits and
        limited drops, delivered across Bangladesh.
      </p>

      <div className="flex items-center gap-2">
        {SOCIALS.map(({ label, href, Icon }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-9 items-center justify-center rounded-full border border-border-default bg-bg-surface text-text-secondary shadow-xs transition-colors duration-200 hover:border-border-brand hover:bg-brand-100 hover:text-text-brand"
          >
            <Icon className="size-4" />
          </a>
        ))}
      </div>
    </div>
  );
}
