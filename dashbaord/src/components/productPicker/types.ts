// Shared by the product pickers (Limited Offer, Flash Sale)

// The fields of /product/getproduct the picker reads
export interface LookupVariant {
  _id: string;
  variantName: string;
  size?: string;
  color?: string;
  retailPrice?: number;
  stockVariant?: number;
  isActive?: boolean;
}

export interface LookupProduct {
  _id: string;
  name: string;
  variantType?: string;
  retailPrice?: number;
  stock?: number;
  thumbnail?: { url?: string };
  variant?: LookupVariant[];
}

/** "Navy / M", or the variant's name when it has neither (the dashboard's "N/A" means none) */
export const variantLabel = (v: { name?: string; variantName?: string; size?: string; color?: string }) =>
  [v.color, v.size].filter((x) => x && x !== "N/A").join(" / ") || v.name || v.variantName || "";

/** Identifies one pick: a whole product, or one variant of it */
export const pickKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;
