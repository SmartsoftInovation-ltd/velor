"use client";

import { useShopStorage } from "@/components/cart/shop-storage-provider";
import { useWishlist } from "@/components/cart/use-wishlist";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Signs out through the Server Action. On the way out it clears this shop's
 * wishlist and checkout draft from the browser, so the next person on a shared
 * computer does not see them; the cart is kept, as a shopper would expect.
 */
export function SignOutButton() {
  const { clear } = useWishlist();
  const { checkoutDraft } = useShopStorage();

  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clear();
        checkoutDraft.set([]);
      }}
      className="mt-6 w-full"
    >
      <Button type="submit" variant="secondary" fullWidth iconEnd={<ArrowRightIcon />}>
        Sign out
      </Button>
    </form>
  );
}
