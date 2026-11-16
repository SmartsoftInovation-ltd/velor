export type FooterLink = {
  label: string;
  href: string;
  /** Drawn as a brand pill button instead of a text link */
  button?: boolean;
};

export type FooterLinkGroup = {
  title: string;
  links: FooterLink[];
};

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "Quick Links",
    links: [
      { label: "Shop", href: "/shop" },
      { label: "New Arrivals", href: "/shop/new-arrivals" },
      { label: "Best Sellers", href: "/shop" },
      { label: "Discount Offer", href: "/shop/offers" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Outlets", href: "/outlets", button: true },
    ],
  },
  {
    title: "Informations",
    links: [
      { label: "Shipping Info", href: "/shipping" },
      { label: "Return Policy", href: "/returns" },
      { label: "FAQ", href: "/faq" },
    ],
  },
];
