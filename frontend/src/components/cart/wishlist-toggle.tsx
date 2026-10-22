"use client";

import { Button } from "@/components/ui/button";
import { HeartIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ItemSnapshot } from "@/lib/cart/types";
import { useWishlist } from "./use-wishlist";

/**
 * Saves or unsaves one product in this shop's wishlist. The heart fills when
 * it is saved; `aria-pressed` says the same to a screen reader.
 */
export function WishlistToggle({
  item,
  size = "md",
  className,
}: {
  item: ItemSnapshot;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const toast = useToast();
  const saved = has(item.productId, item.variantId);

  const onToggle = () => {
    const nowSaved = toggle(item);
    toast(
      nowSaved
        ? { tone: "success", title: "Saved to wishlist", description: item.name }
        : { title: "Removed from wishlist", description: item.name },
    );
  };

  return (
    <Button
      variant="secondary"
      size={size}
      aria-label={saved ? `Remove ${item.name} from wishlist` : `Save ${item.name} to wishlist`}
      aria-pressed={saved}
      icon={<HeartIcon className={cn(saved && "fill-current")} />}
      onClick={onToggle}
      className={cn("hover:text-danger-solid", saved && "text-danger-solid", className)}
    />
  );
}
