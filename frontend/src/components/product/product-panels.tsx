import { Stars } from "@/components/ui/stars";
import { descriptionBlocks } from "@/lib/catalog/product-share";
import type { ProductDetail, Review } from "@/lib/catalog/types";
import { ReviewForm } from "./review-form";

export function DescriptionPanel({ product }: { product: ProductDetail }) {
  // The dashboard saves rich-text HTML. Shown as plain paragraphs rather than
  // injected, so nothing a seller pasted in can run on the shop's page.
  const blocks = descriptionBlocks(product.description);

  return (
    <div className="space-y-5">
      <div className="max-w-2xl space-y-3 text-body text-text-secondary">
        {blocks.length ? (
          blocks.map((block, index) => <p key={index}>{block}</p>)
        ) : (
          <p>The seller has not added a description for this product yet.</p>
        )}
      </div>
      <ul className="space-y-2">
        {product.highlights.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-small text-text-secondary">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"
            />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpecificationPanel({ product }: { product: ProductDetail }) {
  return (
    <dl className="max-w-2xl divide-y divide-border-subtle">
      {product.specs.map((spec) => (
        <div key={spec.label} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="w-40 shrink-0 text-small text-text-tertiary">{spec.label}</dt>
          <dd className="text-small text-text-primary">{spec.value}</dd>
        </div>
      ))}
      {product.sku ? (
        <div className="flex gap-4 py-2.5">
          <dt className="w-40 shrink-0 text-small text-text-tertiary">SKU</dt>
          <dd className="font-mono text-small text-text-primary">{product.sku}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function ReviewsPanel({
  reviews,
  rating,
  count,
}: {
  reviews: Review[];
  rating: number;
  count: string;
}) {
  if (!reviews.length) {
    return (
      <div className="space-y-6">
        <p className="text-body text-text-secondary">No reviews yet. Be the first to review this product.</p>
        <ReviewForm />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-lg bg-bg-sunken p-4">
        <p className="text-display font-semibold tabular text-text-primary">{rating}</p>
        <div className="space-y-1">
          <Stars rating={rating} />
          <p className="text-caption text-text-tertiary">Based on {count} ratings</p>
        </div>
      </div>

      <ReviewForm />

      <ul className="divide-y divide-border-subtle">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-2 py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              <Stars rating={review.rating} />
              <p className="text-small font-semibold text-text-primary">
                {review.title}
              </p>
            </div>
            <p className="text-small text-text-secondary">{review.body}</p>
            <p className="text-caption text-text-tertiary">
              {review.author} · {review.date}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
