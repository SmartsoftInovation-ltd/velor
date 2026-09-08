import type { CatalogProduct } from "./types";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?q=80&w=600&auto=format&fit=crop`;

/** Outerwear and formal. Split across two files to stay under the line cap. */
export const CATALOG_A: CatalogProduct[] = [
  {
    id: "bomber-jacket", name: "Classic Bomber Jacket", brand: "Ashcroft",
    price: 3290, rating: 4.6, reviews: "840", stock: "low",
    href: "/product/bomber-jacket", image: img("photo-1591047139829-d91aecb6caea"),
    alt: "Rust brown bomber jacket on a hanger",
    categoryId: "outerwear", subcategoryId: "bomber",
    colors: ["brown"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-08-14",
  },
  {
    id: "denim-jacket", name: "Light Wash Denim Jacket", brand: "Ashcroft",
    price: 2790, rating: 4.5, reviews: "612", stock: "out",
    href: "/product/denim-jacket", image: img("photo-1495105787522-5334e3ffa0ef"),
    alt: "Light wash denim jacket with an enamel pin",
    categoryId: "outerwear", subcategoryId: "denim-jacket",
    colors: ["blue"], sizes: ["S", "M", "L"], createdAt: "2026-07-02",
  },
  {
    id: "denim-hoodie-combo", name: "Denim Jacket & Hoodie", brand: "Northwell",
    price: 2490, compareAtPrice: 4290, rating: 4.6, reviews: "312", stock: "in",
    href: "/product/denim-hoodie-combo", image: img("photo-1517841905240-472988babdf9"),
    alt: "Woman wearing a denim jacket over a grey hoodie",
    categoryId: "outerwear", subcategoryId: "denim-jacket",
    colors: ["blue", "grey"], sizes: ["XS", "S", "M", "L"], createdAt: "2026-08-30",
  },
  {
    id: "puffer-jacket", name: "Quilted Puffer Jacket", brand: "Northwell",
    price: 3590, compareAtPrice: 4290, rating: 4.8, reviews: "1.1k", stock: "in",
    href: "/product/puffer-jacket", image: img("photo-1548126032-079a0fb0099d"),
    alt: "Man wearing a black quilted puffer jacket over a red hoodie",
    categoryId: "outerwear", subcategoryId: "puffer",
    colors: ["black"], sizes: ["M", "L", "XL", "XXL"], createdAt: "2026-08-22",
  },
  {
    id: "shearling-jacket", name: "Shearling Collar Jacket", brand: "Ashcroft",
    price: 4290, rating: 4.7, reviews: "742", stock: "low",
    href: "/product/shearling-jacket", image: img("photo-1608063615781-e2ef8c73d114"),
    alt: "Woman wearing a brown shearling collar jacket",
    categoryId: "outerwear", subcategoryId: "leather",
    colors: ["brown"], sizes: ["XS", "S", "M"], createdAt: "2026-06-18",
  },
  {
    id: "leather-biker-jacket", name: "Leather Biker Jacket", brand: "Harrowgate",
    price: 3990, compareAtPrice: 7990, rating: 4.8, reviews: "389", stock: "in",
    href: "/product/leather-biker-jacket", image: img("photo-1520975954732-35dd22299614"),
    alt: "Man wearing a black leather biker jacket",
    categoryId: "outerwear", subcategoryId: "leather",
    colors: ["black"], sizes: ["S", "M", "L", "XL"], createdAt: "2026-09-01",
  },
  {
    id: "moto-jacket", name: "Cropped Moto Jacket", brand: "Meridian",
    price: 4790, rating: 4.4, reviews: "168", stock: "in",
    href: "/product/moto-jacket", image: img("photo-1551028719-00167b16eac5"),
    alt: "Black leather moto jacket laid flat",
    categoryId: "outerwear", subcategoryId: "leather",
    colors: ["black"], sizes: ["XS", "S", "M", "L"], createdAt: "2026-05-09",
  },
  {
    id: "utility-field-jacket", name: "Utility Field Jacket", brand: "Ashcroft",
    price: 2990, compareAtPrice: 5490, rating: 4.7, reviews: "255", stock: "low",
    href: "/product/utility-field-jacket", image: img("photo-1544022613-e87ca75a784a"),
    alt: "Woman wearing an olive utility field jacket",
    categoryId: "outerwear", subcategoryId: "bomber",
    colors: ["olive"], sizes: ["S", "M", "L"], createdAt: "2026-08-05",
  },
  {
    id: "checked-blazer", name: "Windowpane Check Blazer", brand: "Harrowgate",
    price: 5490, compareAtPrice: 6490, rating: 4.7, reviews: "455", stock: "in",
    href: "/product/checked-blazer", image: img("photo-1594938298603-c8148c4dae35"),
    alt: "Man wearing a navy windowpane check blazer suit",
    categoryId: "formal", subcategoryId: "blazer",
    colors: ["navy"], sizes: ["M", "L", "XL"], createdAt: "2026-07-21",
  },
  {
    id: "tailored-suit", name: "Tailored Two-Piece Suit", brand: "Harrowgate",
    price: 6990, compareAtPrice: 8490, rating: 4.9, reviews: "1.6k", stock: "in",
    href: "/product/tailored-suit", image: img("photo-1618886614638-80e3c103d31a"),
    alt: "Man wearing a tailored black two-piece suit",
    categoryId: "formal", subcategoryId: "suit",
    colors: ["black"], sizes: ["M", "L", "XL", "XXL"], createdAt: "2026-08-28",
  },
  {
    id: "leather-brogues", name: "Leather Brogue Shoes", brand: "Harrowgate",
    price: 3990, compareAtPrice: 4590, rating: 4.9, reviews: "980", stock: "in",
    href: "/product/leather-brogues", image: img("photo-1490114538077-0a7f8cb49891"),
    alt: "Brown leather brogue shoes in a box with accessories",
    categoryId: "footwear", subcategoryId: "formal-shoes",
    colors: ["brown"], sizes: ["S", "M", "L"], createdAt: "2026-06-30",
  },
  {
    id: "corduroy-shirt-dress", name: "Corduroy Shirt Dress", brand: "Ashcroft",
    price: 1690, compareAtPrice: 3390, rating: 4.8, reviews: "467", stock: "low",
    href: "/product/corduroy-shirt-dress", image: img("photo-1585487000160-6ebcfceb0d03"),
    alt: "Woman wearing a maroon corduroy shirt dress",
    categoryId: "topwear", subcategoryId: "shirt",
    colors: ["maroon"], sizes: ["XS", "S", "M"], createdAt: "2026-09-02",
  },
];
