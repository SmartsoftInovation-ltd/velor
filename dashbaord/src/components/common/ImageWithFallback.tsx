import { useEffect, useState } from "react";

// Inline SVG placeholder — a small picture glyph on a neutral tile. Kept as a
// component rather than an asset so it inherits the surrounding text colour and
// needs no extra network request when a category has no image (or its upload
// 404s later).
const ImagePlaceholder = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
    <path
      d="M4 17.5 8.9 13a1.5 1.5 0 0 1 2.05-.06L14 15.6l1.7-1.5a1.5 1.5 0 0 1 2 .02L20 16"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  /** Classes for the <img> itself, e.g. "w-full h-full object-cover". */
  className?: string;
  /** Classes for the placeholder wrapper when there is no usable image. */
  fallbackClassName?: string;
  /** Classes for the placeholder glyph. Defaults to a size that suits a thumbnail. */
  iconClassName?: string;
}

/**
 * Renders an image, falling back to an SVG placeholder when `src` is missing or
 * the request fails. Use anywhere a record's image is optional.
 */
const ImageWithFallback = ({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  iconClassName = "size-1/2",
}: ImageWithFallbackProps) => {
  const [failed, setFailed] = useState(false);

  // A row can be recycled onto a different record (virtualised tables do this),
  // so a previous failure must not stick to the next image.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 ${fallbackClassName}`}
      >
        <ImagePlaceholder className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

export default ImageWithFallback;
