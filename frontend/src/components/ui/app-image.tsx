"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const FALLBACK = "/image-fallback.svg";

/**
 * The only image component in the app. Wraps next/image and fixes the three
 * house rules in one place so no call site repeats them:
 *
 *   1. Full quality — `quality={100}`, hard-coded.
 *   2. Lazy by default — override with loading="eager" for an above-the-fold
 *      hero only (pair it with `preload`; `priority` is deprecated in Next 16).
 *   3. Falls back to a placeholder when the source fails to load.
 *
 * A Client Component only because `onError` is a function prop and cannot cross
 * the RSC boundary. It is a leaf — importing it does NOT make the importing
 * page a Client Component.
 *
 * Always pass width + height, or `fill` inside a positioned parent. With `fill`
 * always set `sizes`, otherwise the browser downloads the largest candidate.
 */
export function AppImage({
  src,
  alt,
  loading = "lazy",
  className,
  ...props
}: ImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      src={failed ? FALLBACK : src}
      alt={alt}
      quality={100}
      loading={loading}
      onError={() => setFailed(true)}
      className={className}
      {...props}
    />
  );
}
