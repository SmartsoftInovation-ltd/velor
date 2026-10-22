"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { ArrowRightIcon, CartIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { AddResult } from "@/lib/cart/cart-store";
import type { ItemSnapshot } from "@/lib/cart/types";
import { useCart } from "./use-cart";

type ButtonProps = Pick<ComponentProps<typeof Button>, "variant" | "size" | "fullWidth" | "className">;

const describe = (item: ItemSnapshot, quantity: number) =>
  [item.name, item.optionLabel, `qty ${quantity}`].filter(Boolean).join(" · ");

/**
 * Adds one product or variant to this shop's cart. A product with several
 * variants and none picked cannot be added from here; it links to the
 * product page to choose one instead.
 */
export function AddToCartButton({
  item,
  quantity = 1,
  label = "Add to cart",
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: { item: ItemSnapshot; quantity?: number; label?: string } & ButtonProps) {
  const { add } = useCart();
  const toast = useToast();

  if (item.needsOption) {
    return (
      <Link href={item.href} className={cn(buttonClassName(variant, size), fullWidth && "w-full", className)}>
        <span className="relative z-2">Choose options</span>
        <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
          <ArrowRightIcon />
        </span>
      </Link>
    );
  }

  const soldOut = item.maxQuantity < 1;

  const onAdd = () => {
    const result: AddResult = add(item, quantity);
    if (result === "added" || result === "increased") {
      toast({ tone: "success", title: "Added to cart", description: describe(item, quantity) });
    } else if (result === "capped") {
      toast({ title: "Cart updated", description: `Only ${item.maxQuantity} of ${item.name} available, so your cart holds that many.` });
    } else if (result === "full") {
      toast({ tone: "danger", title: "Your cart is full", description: "Remove an item to add another." });
    } else {
      toast({ tone: "danger", title: "Out of stock", description: `${item.name} can't be added right now.` });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      icon={<CartIcon />}
      disabled={soldOut}
      onClick={onAdd}
    >
      {soldOut ? "Sold out" : label}
    </Button>
  );
}
