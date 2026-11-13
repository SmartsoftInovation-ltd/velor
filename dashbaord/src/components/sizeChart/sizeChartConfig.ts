import type { IconType } from "react-icons";
import { FaBoxOpen, FaCubes, FaLayerGroup, FaSitemap, FaTags } from "react-icons/fa";

// ---------- Types ----------
export type UnitType = "inch" | "cm" | "mm" | "kg" | "lbs" | "ml" | "l" | "unitless";
export type ApplicableLevel = "category" | "subCategory" | "product" | "variant" | "brand";

export interface Column { key: string; label: string; unit: UnitType; order: number; }
export interface Row { label: string; values: string[]; order: number; }
export interface IdOption { value: string; label: string; }

// ---------- Constants ----------
export const UNIT_OPTIONS: { value: UnitType; label: string; short: string }[] = [
  { value: "inch", label: "Inches (in)", short: "in" },
  { value: "cm", label: "Centimetres (cm)", short: "cm" },
  { value: "mm", label: "Millimetres (mm)", short: "mm" },
  { value: "kg", label: "Kilograms (kg)", short: "kg" },
  { value: "lbs", label: "Pounds (lbs)", short: "lbs" },
  { value: "ml", label: "Millilitres (ml)", short: "ml" },
  { value: "l", label: "Litres (l)", short: "l" },
  { value: "unitless", label: "No unit", short: "" },
];

export const LEVELS: { value: ApplicableLevel; label: string; plural: string; hint: string; icon: IconType }[] = [
  { value: "category", label: "Category", plural: "Categories", hint: "Every product in the category", icon: FaLayerGroup },
  { value: "subCategory", label: "Sub Category", plural: "Sub Categories", hint: "Every product in the sub category", icon: FaSitemap },
  { value: "brand", label: "Brand", plural: "Brands", hint: "Every product of the brand", icon: FaTags },
  { value: "product", label: "Product", plural: "Products", hint: "Single products you pick", icon: FaBoxOpen },
  { value: "variant", label: "Variant", plural: "Variants", hint: "Single variants you pick", icon: FaCubes },
];

export const LEVEL_KEY: Record<ApplicableLevel, string> = {
  category: "applicableCategories",
  subCategory: "applicableSubCategories",
  product: "applicableProducts",
  variant: "applicableVariants",
  brand: "applicableBrands",
};

export const sanitiseKey = (raw: string) =>
  raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
