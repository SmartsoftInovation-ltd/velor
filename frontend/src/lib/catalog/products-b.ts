import type { CatalogProduct } from "./types";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?q=80&w=600&auto=format&fit=crop`;

/** Topwear, bottomwear and the rest of footwear. */
export const CATALOG_B: CatalogProduct[] = [
  {
    id: "dot-print-shirt", name: "Dot Print Casual Shirt", brand: "Northwell",
    price: 1490, compareAtPrice: 1890, rating: 4.8, reviews: "1.2k", stock: "in",
    href: "/product/dot-print-shirt", image: img("photo-1596755094514-f87e34085b2c"),
    alt: "Blue dot-print casual shirt on a hanger",
    categoryId: "topwear", subcategoryId: "shirt",
    colors: ["blue"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-09-03",
  },
  {
    id: "folded-dress-shirt", name: "Poplin Dress Shirt", brand: "Harrowgate",
    price: 1890, rating: 4.6, reviews: "534", stock: "in",
    href: "/product/folded-dress-shirt", image: img("photo-1602810318383-e386cc2a3ccf"),
    alt: "Folded dress shirts in navy, cream and maroon",
    categoryId: "topwear", subcategoryId: "shirt",
    colors: ["navy", "white", "maroon"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-07-14",
  },
  {
    id: "essential-tee", name: "Essential Crew Tee", brand: "Northwell",
    price: 690, rating: 4.8, reviews: "2.4k", stock: "in",
    href: "/product/essential-tee", image: img("photo-1521572163474-6864f9cf17ab"),
    alt: "Man wearing a plain white crew neck t-shirt",
    categoryId: "topwear", subcategoryId: "t-shirt",
    colors: ["white"], sizes: ["XS", "S", "M", "L", "XL", "XXL"], createdAt: "2026-08-19",
  },
  {
    id: "graphic-tee", name: "Printed Graphic Tee", brand: "Northwell",
    price: 890, rating: 4.6, reviews: "2.9k", stock: "in",
    href: "/product/graphic-tee", image: img("photo-1554568218-0f1715e72254"),
    alt: "Woman wearing a printed graphic t-shirt",
    categoryId: "topwear", subcategoryId: "t-shirt",
    colors: ["white"], sizes: ["XS", "S", "M", "L"], createdAt: "2026-08-26",
  },
  {
    id: "badge-logo-tee", name: "Badge Logo Tee", brand: "Northwell",
    price: 590, compareAtPrice: 990, rating: 4.5, reviews: "1.3k", stock: "in",
    href: "/product/badge-logo-tee", image: img("photo-1618354691373-d851c5c3a990"),
    alt: "Black t-shirt with a small badge logo on a hanger",
    categoryId: "topwear", subcategoryId: "t-shirt",
    colors: ["black"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-09-04",
  },
  {
    id: "graphic-sweatshirt", name: "Oversized Sweatshirt", brand: "Northwell",
    price: 1990, compareAtPrice: 2490, rating: 4.9, reviews: "3.1k", stock: "in",
    href: "/product/graphic-sweatshirt", image: img("photo-1614975059251-992f11792b9f"),
    alt: "Man wearing a black oversized sweatshirt",
    categoryId: "topwear", subcategoryId: "sweatshirt",
    colors: ["black"], sizes: ["M", "L", "XL", "XXL"], createdAt: "2026-08-11",
  },
  {
    id: "pink-sweatshirt", name: "Relaxed Fit Sweatshirt", brand: "Ashcroft",
    price: 1790, rating: 4.6, reviews: "308", stock: "low",
    href: "/product/pink-sweatshirt", image: img("photo-1516826957135-700dedea698c"),
    alt: "Man wearing a pink sweatshirt with ripped jeans",
    categoryId: "topwear", subcategoryId: "sweatshirt",
    colors: ["pink"], sizes: ["S", "M", "L"], createdAt: "2026-07-28",
  },
  {
    id: "flatlay-sweatshirt", name: "Cotton Crew Sweatshirt", brand: "Meridian",
    price: 1590, rating: 4.4, reviews: "221", stock: "in",
    href: "/product/flatlay-sweatshirt", image: img("photo-1620799140408-edc6dcb6d633"),
    alt: "White sweatshirt flat-laid with jeans and sneakers",
    categoryId: "topwear", subcategoryId: "sweatshirt",
    colors: ["white"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-06-11",
  },
  {
    id: "knit-sweater-bundle", name: "Ribbed Knit Sweater", brand: "Ashcroft",
    price: 1290, compareAtPrice: 2590, rating: 4.7, reviews: "526", stock: "low",
    href: "/product/knit-sweater-bundle", image: img("photo-1556905055-8f358a7a47b2"),
    alt: "Grey ribbed knit sweater with denim jeans and a beanie",
    categoryId: "topwear", subcategoryId: "sweatshirt",
    colors: ["grey"], sizes: ["S", "M", "L"], createdAt: "2026-08-08",
  },
  {
    id: "crossbody-bag", name: "Crochet Dress & Crossbody Bag", brand: "Northwell",
    price: 2190, compareAtPrice: 3990, rating: 4.6, reviews: "214", stock: "in",
    href: "/product/crossbody-bag", image: img("photo-1594633313593-bab3825d0caf"),
    alt: "Woman wearing a crochet dress with a brown crossbody bag",
    categoryId: "topwear", subcategoryId: "polo",
    colors: ["brown", "white"], sizes: ["XS", "S", "M"], createdAt: "2026-05-27",
  },
  {
    id: "denim-jeans", name: "Slim Fit Denim Jeans", brand: "Meridian",
    price: 1990, rating: 4.5, reviews: "1.4k", stock: "in",
    href: "/product/denim-jeans", image: img("photo-1542272604-787c3835535d"),
    alt: "Folded denim jeans in three washes",
    categoryId: "bottomwear", subcategoryId: "jeans",
    colors: ["blue", "black"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-07-07",
  },
  {
    id: "striped-wide-pants", name: "Striped Wide-Leg Pants", brand: "Harrowgate",
    price: 1290, compareAtPrice: 2190, rating: 4.5, reviews: "198", stock: "in",
    href: "/product/striped-wide-pants", image: img("photo-1521577352947-9bb58764b69a"),
    alt: "Woman wearing a white tee and striped wide-leg pants",
    categoryId: "bottomwear", subcategoryId: "chinos",
    colors: ["white", "black"], sizes: ["XS", "S", "M", "L"], createdAt: "2026-08-16",
  },
];
