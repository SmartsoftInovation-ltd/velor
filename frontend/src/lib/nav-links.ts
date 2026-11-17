export type NavLink = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "New Arrivals", href: "/shop/new-arrivals" },
  { label: "Offers", href: "/shop/offers" },
  { label: "Limited Offer", href: "/shop/limited-offers" },
  { label: "Track Order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
];
