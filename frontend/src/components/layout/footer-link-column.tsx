import Link from "next/link";
import type { FooterLinkGroup } from "@/lib/footer-links";

export function FooterLinkColumn({ group }: { group: FooterLinkGroup }) {
  return (
    <div className="space-y-4">
      <h3 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
        {group.title}
      </h3>
      <ul className="space-y-2.5">
        {group.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-small text-text-secondary transition-colors duration-150 hover:text-text-brand"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
