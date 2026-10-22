// Website Management → Limited Offer (backend: /limited-offer)

export interface LimitedOfferItem {
  _id: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  product: { _id: string; name: string; slug: string; isActive: boolean } | null;
  variant: { _id: string; name: string; size: string; color: string; isActive: boolean } | null;
  image: string;
  price: number;
  stock: number;
  /** Opens the product on the store's website; empty until the store has a domain */
  storefrontUrl: string;
}

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
