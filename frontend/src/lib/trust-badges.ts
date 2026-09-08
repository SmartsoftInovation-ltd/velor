export type TrustBadge = {
  id: string;
  title: string;
  description: string;
  icon: "truck" | "headset" | "shield" | "return";
};

export const TRUST_BADGES: TrustBadge[] = [
  {
    id: "fast-delivery",
    title: "Fast Delivery",
    description: "Free on orders over ৳40",
    icon: "truck",
  },
  {
    id: "support",
    title: "24/7 Support",
    description: "Dedicated live chat",
    icon: "headset",
  },
  {
    id: "pay-security",
    title: "Pay Security",
    description: "100% secure payment",
    icon: "shield",
  },
  {
    id: "easy-return",
    title: "Easy Return",
    description: "On orders over ৳150",
    icon: "return",
  },
];
