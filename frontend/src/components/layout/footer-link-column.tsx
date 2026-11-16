import Link from "next/link";
import { MapPinIcon } from "@/components/ui/icons-footer";
import type { FooterLinkGroup } from "@/lib/footer-links";

export function FooterLinkColumn({ group }: { group: FooterLinkGroup }) {
  return (
    <div className="space-y-5">
      <h3 className="text-body font-medium text-white">{group.title}</h3>
      <ul className="space-y-3">
        {group.links.map((link) => (
          <li key={link.label}>
            {link.button ? (
              <Link
                href={link.href}
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-small font-medium text-on-brand transition-opacity duration-150 hover:opacity-90"
              >
                <MapPinIcon className="size-4 shrink-0" />
                {link.label}
              </Link>
            ) : (
              <Link
                href={link.href}
                className="text-small text-white/90 transition-colors duration-150 hover:text-brand-500"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
