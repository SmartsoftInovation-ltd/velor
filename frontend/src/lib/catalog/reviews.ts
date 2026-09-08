import type { Review } from "./types";

const POOL: Review[] = [
  {
    id: "r1",
    author: "Tanvir H.",
    rating: 5,
    date: "2026-08-21",
    title: "Exactly as pictured",
    body: "Fit is true to size and the fabric has real weight to it. Third order from this brand and the quality has not slipped once.",
  },
  {
    id: "r2",
    author: "Nusrat J.",
    rating: 4,
    date: "2026-08-09",
    title: "Good, runs slightly large",
    body: "Lovely finish and the colour matches the photos. I would size down if you are between sizes — the shoulders sit a little wide on me.",
  },
  {
    id: "r3",
    author: "Rakib A.",
    rating: 5,
    date: "2026-07-30",
    title: "Worth the price",
    body: "Delivered in two days. Stitching is clean inside and out, which is not something I expected at this price point.",
  },
  {
    id: "r4",
    author: "Farhana K.",
    rating: 4,
    date: "2026-07-12",
    title: "Comfortable for daily wear",
    body: "Wore it through a full week of commuting and it still looks fresh. The only thing I would change is a slightly longer body.",
  },
  {
    id: "r5",
    author: "Imran S.",
    rating: 3,
    date: "2026-06-28",
    title: "Fine, not remarkable",
    body: "Nothing wrong with it, but the fabric is lighter than I expected from the description. Fine for indoors, not much use in wind.",
  },
];

/**
 * Fixtures, not a real review store: takes the product's headline rating and
 * returns a slice whose reviews are broadly consistent with it, so a 4.9 star
 * product is not backed by a wall of three-star write-ups.
 */
export function reviewsForRating(rating: number): Review[] {
  return rating >= 4.7 ? POOL.filter((review) => review.rating >= 4) : POOL;
}
