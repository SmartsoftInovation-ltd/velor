export type ShopCategory = {
  id: string;
  name: string;
  href: string;
  image: string;
  alt: string;
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    id: "jacket",
    name: "Jacket",
    href: "/category/jacket",
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop",
    alt: "Black leather jacket laid flat",
  },
  {
    id: "blazer-suit",
    name: "Blazer Suit",
    href: "/category/blazer-suit",
    image:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=400&auto=format&fit=crop",
    alt: "Man wearing a tailored blue checked blazer suit",
  },
  {
    id: "t-shirt",
    name: "T-Shirt",
    href: "/category/t-shirt",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop",
    alt: "Man wearing a plain white t-shirt",
  },
  {
    id: "shirt",
    name: "Shirt",
    href: "/category/shirt",
    image:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=400&auto=format&fit=crop",
    alt: "Folded dress shirts in navy, cream and maroon",
  },
  {
    id: "pant",
    name: "Pant",
    href: "/category/pant",
    image:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=400&auto=format&fit=crop",
    alt: "Folded denim jeans in three washes",
  },
  {
    id: "sweatshirt",
    name: "Sweatshirt",
    href: "/category/sweatshirt",
    image:
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=400&auto=format&fit=crop",
    alt: "White sweatshirt flat-laid with jeans and sneakers",
  },
];
