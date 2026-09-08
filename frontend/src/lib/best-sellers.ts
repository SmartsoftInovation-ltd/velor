import type { Product } from "./product";

export const BEST_SELLERS: Product[] = [
  {
    id: "tailored-suit",
    name: "Tailored Two-Piece Suit",
    brand: "Harrowgate",
    price: 6990,
    compareAtPrice: 8490,
    rating: 4.9,
    reviews: "1.6k",
    stock: "in",
    href: "/product/tailored-suit",
    image:
      "https://images.unsplash.com/photo-1618886614638-80e3c103d31a?q=80&w=600&auto=format&fit=crop",
    alt: "Man wearing a tailored black two-piece suit",
  },
  {
    id: "shearling-jacket",
    name: "Shearling Collar Jacket",
    brand: "Ashcroft",
    price: 4290,
    rating: 4.7,
    reviews: "742",
    stock: "low",
    href: "/product/shearling-jacket",
    image:
      "https://images.unsplash.com/photo-1608063615781-e2ef8c73d114?q=80&w=600&auto=format&fit=crop",
    alt: "Woman wearing a brown shearling collar jacket",
  },
  {
    id: "puffer-jacket",
    name: "Quilted Puffer Jacket",
    brand: "Northwell",
    price: 3590,
    compareAtPrice: 4290,
    rating: 4.8,
    reviews: "1.1k",
    stock: "in",
    href: "/product/puffer-jacket",
    image:
      "https://images.unsplash.com/photo-1548126032-079a0fb0099d?q=80&w=600&auto=format&fit=crop",
    alt: "Man wearing a black quilted puffer jacket over a red hoodie",
  },
  {
    id: "graphic-tee",
    name: "Printed Graphic Tee",
    brand: "Northwell",
    price: 890,
    rating: 4.6,
    reviews: "2.9k",
    stock: "in",
    href: "/product/graphic-tee",
    image:
      "https://images.unsplash.com/photo-1554568218-0f1715e72254?q=80&w=600&auto=format&fit=crop",
    alt: "Woman wearing a printed graphic t-shirt",
  },
];
