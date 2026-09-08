"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const STARS = [1, 2, 3, 4, 5];

/**
 * Collects a review but does not submit one: there is no reviews endpoint yet.
 * See `.claude/specs/product-page.md` for the contract it will post to.
 */
export function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  const shown = hovered || rating;

  return (
    <form className="space-y-4 rounded-lg border border-border-subtle bg-bg-sunken p-5">
      <div className="space-y-1">
        <h3 className="text-body font-semibold text-text-primary">Write a review</h3>
        <p className="text-small text-text-secondary">
          Share how it fits and how it has held up. Only verified buyers are
          published.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-small font-medium text-text-secondary">
          Your rating
        </legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {STARS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHovered(value)}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              className="rounded-xs p-0.5 transition-transform duration-150 hover:scale-110"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={cn(
                  "size-6 transition-colors duration-150",
                  value <= shown ? "fill-warning-solid" : "fill-border-default",
                )}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
          {rating ? (
            <span className="ml-2 text-small text-text-secondary">
              {rating} of 5
            </span>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="review-name" className="text-small font-medium text-text-secondary">
            Name
          </label>
          <Input id="review-name" name="name" placeholder="How it appears publicly" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="review-title" className="text-small font-medium text-text-secondary">
            Headline
          </label>
          <Input id="review-title" name="title" placeholder="Sum it up in a line" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-body" className="text-small font-medium text-text-secondary">
          Review
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={4}
          placeholder="What did you think of the fit, fabric and finish?"
          className="w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary shadow-xs transition-colors duration-150 placeholder:text-text-tertiary hover:border-border-strong focus-visible:border-border-brand focus-visible:shadow-none focus-visible:outline-none"
        />
      </div>

      <Button type="submit" variant="primary" disabled={!rating}>
        Submit review
      </Button>
    </form>
  );
}
