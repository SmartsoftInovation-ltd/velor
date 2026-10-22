"use client";

import { useWishlist } from "@/components/cart/use-wishlist";
import { HeartIcon } from "@/components/ui/icons";
import { HeaderIconButton } from "./header-icon-button";

/** The header's wishlist link, counting this shop's saved items */
export function WishlistButton() {
  const { items } = useWishlist();

  return (
    <HeaderIconButton href="/wishlist" slot="wishlist" label={`Wishlist, ${items.length} items`} count={items.length}>
      <HeartIcon />
    </HeaderIconButton>
  );
}
