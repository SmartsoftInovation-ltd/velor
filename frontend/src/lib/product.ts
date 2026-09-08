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
  href: string;
  image: string;
  alt: string;
};
