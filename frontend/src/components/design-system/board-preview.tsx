import { AppImage } from "@/components/ui/app-image";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CartIcon, EyeIcon, HeartIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import { Section } from "./section";

/** Dummy data — this is a token demo, not a real catalogue. */
const PRODUCTS = [
  {
    id: "shirt",
    title: "Casual Full Sleeve Shirt",
    brand: "Northwell",
    price: 45.5,
    was: 95.5,
    off: "52% OFF",
    rating: 4.8,
    reviews: "1.2k",
    stock: "in" as const,
    src: "/products/shirt.svg",
  },
  {
    id: "jacket",
    title: "Slim Fit Denim Jacket",
    brand: "Ashcroft",
    price: 78.0,
    was: 120.0,
    off: "35% OFF",
    rating: 4.6,
    reviews: "840",
    stock: "low" as const,
    src: "/products/jacket.svg",
  },
  {
    id: "tee",
    title: "Cotton Crew Neck Tee",
    brand: "Northwell",
    price: 22.9,
    was: 34.0,
    off: "32% OFF",
    rating: 4.9,
    reviews: "3.1k",
    stock: "out" as const,
    src: "/products/tee.svg",
  },
] as const;

export function BoardPreview() {
  return (
    <Section
      title="In context"
      description="The product card, assembled from tokens and the Button, Badge and AppImage primitives. Nothing here introduces a value that is not defined above — the card lifts 2px on hover and raises its shadow one step."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <article
            key={p.id}
            className="group flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-default hover:shadow-md"
          >
            {/* 4:3 well. `fill` needs a positioned parent and a `sizes` hint,
                otherwise the browser fetches the largest candidate. The image
                keeps its own aspect ratio inside it via object-contain. */}
            <div className="relative aspect-4/3 overflow-hidden bg-bg-sunken">
              <AppImage
                src={p.src}
                alt={`${p.title} by ${p.brand}`}
                fill
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                className="object-contain transition-transform duration-300 ease-out group-hover:scale-105"
              />

              <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                <Badge tone="brand" variant="solid">
                  {p.off}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Save ${p.title} to wishlist`}
                  icon={<HeartIcon />}
                  className="rounded-full hover:text-danger-solid"
                />
              </div>

              {p.stock === "out" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-bg-canvas/70 backdrop-blur-[1px]">
                  <span className="rounded-md bg-bg-inverse px-3 py-1.5 text-caption font-medium text-text-inverse">
                    Sold out
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-micro font-medium tracking-wide text-text-tertiary uppercase">
                  {p.brand}
                </p>
                <h3 className="text-h3 font-semibold text-text-primary">{p.title}</h3>
                <div className="flex items-center gap-2">
                  <Stars rating={p.rating} />
                  <span className="text-caption text-text-tertiary tabular">
                    {p.rating} ({p.reviews})
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-h3 font-semibold text-text-primary tabular">
                  ${p.price.toFixed(2)}
                </span>
                <span className="text-small text-text-tertiary line-through tabular">
                  ${p.was.toFixed(2)}
                </span>
              </div>

              {/* mt-auto pins the footer down however tall the title runs. */}
              <div className="mt-auto space-y-3">
                {p.stock === "in" ? <StatusDot tone="success">In stock</StatusDot> : null}
                {p.stock === "low" ? <StatusDot tone="warning">Only 3 left</StatusDot> : null}
                {p.stock === "out" ? <StatusDot tone="danger">Out of stock</StatusDot> : null}

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    fullWidth
                    icon={<CartIcon />}
                    disabled={p.stock === "out"}
                  >
                    Add to cart
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Quick view ${p.title}`}
                    icon={<EyeIcon />}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
