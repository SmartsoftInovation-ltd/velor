export type Stock = "in" | "low" | "out";

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviews: string;
  stock: Stock;
  /** Units left, when known; the card says "Only N left" when stock is low. */
  stockCount?: number;
  href: string;
  image: string;
  alt: string;
};
