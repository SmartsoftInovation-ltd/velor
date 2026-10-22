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

export { type LookupProduct, type LookupVariant, variantLabel, pickKey } from "../productPicker/types";
