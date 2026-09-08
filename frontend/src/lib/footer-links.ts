export type FooterLinkGroup = {
  title: string;
  links: { label: string; href: string }[];
};

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "Quick Links",
    links: [
      { label: "Shop", href: "/shop" },
      { label: "New Arrivals", href: "/shop" },
      { label: "Best Sellers", href: "/shop" },
      { label: "Discount Offer", href: "/shop" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Track Order", href: "/track-order" },
      { label: "About", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Outlets", href: "/outlets" },
    ],
  },
  {
    title: "Information",
    links: [
      { label: "Shipping Info", href: "/shipping" },
      { label: "Return Policy", href: "/returns" },
      { label: "FAQ", href: "/faq" },
    ],
  },
];
