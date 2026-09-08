import type { Category, ColorOption } from "./types";

export const CATEGORIES: Category[] = [
  {
    id: "outerwear",
    name: "Outerwear",
    subcategories: [
      { id: "bomber", name: "Bomber Jackets" },
      { id: "denim-jacket", name: "Denim Jackets" },
      { id: "puffer", name: "Puffer Jackets" },
      { id: "leather", name: "Leather Jackets" },
    ],
  },
  {
    id: "topwear",
    name: "Topwear",
    subcategories: [
      { id: "t-shirt", name: "T-Shirts" },
      { id: "shirt", name: "Shirts" },
      { id: "sweatshirt", name: "Sweatshirts" },
      { id: "polo", name: "Polos" },
    ],
  },
  {
    id: "bottomwear",
    name: "Bottomwear",
    subcategories: [
      { id: "jeans", name: "Jeans" },
      { id: "chinos", name: "Chinos" },
      { id: "joggers", name: "Joggers" },
    ],
  },
  {
    id: "formal",
    name: "Formal",
    subcategories: [
      { id: "blazer", name: "Blazers" },
      { id: "suit", name: "Suits" },
    ],
  },
  {
    id: "footwear",
    name: "Footwear",
    subcategories: [
      { id: "sneakers", name: "Sneakers" },
      { id: "formal-shoes", name: "Formal Shoes" },
    ],
  },
];

export const BRANDS = ["Northwell", "Ashcroft", "Harrowgate", "Meridian"];

export const COLORS: ColorOption[] = [
  { id: "black", name: "Black", swatch: "#1c1917" },
  { id: "white", name: "White", swatch: "#ffffff" },
  { id: "grey", name: "Grey", swatch: "#9ca3af" },
  { id: "navy", name: "Navy", swatch: "#1e3a5f" },
  { id: "blue", name: "Blue", swatch: "#3b82f6" },
  { id: "brown", name: "Brown", swatch: "#8b5a2b" },
  { id: "olive", name: "Olive", swatch: "#556b2f" },
  { id: "maroon", name: "Maroon", swatch: "#7f1d3a" },
  { id: "pink", name: "Pink", swatch: "#f0aec0" },
];

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const PRICE_BOUNDS = { min: 0, max: 10000 };

export const RATING_OPTIONS = [4, 3, 2, 1];
