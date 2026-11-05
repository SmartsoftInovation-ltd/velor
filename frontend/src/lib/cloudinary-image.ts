const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
// "c_limit,w_1024" or "f_auto": letters, an underscore, a value. A version or public id has no such shape.
const TRANSFORMATION = /^[a-z]{1,3}_[^/,]+(,[a-z]{1,3}_[^/,]+)*$/;

/**
 * The same Cloudinary image delivered with `transformation` instead of the
 * delivery resize stored in its URL, which applied afterwards would undo a new
 * size. Null for an image hosted anywhere else, which cannot be reshaped.
 */
export function cloudinaryVariant(url: string, transformation: string): string | null {
  const parts = url.match(CLOUDINARY_IMAGE);
  if (!parts) return null;

  const segments = parts[2].split("/");
  const firstKept = segments.findIndex((segment) => !TRANSFORMATION.test(segment));
  return `${parts[1]}${transformation}/${segments.slice(firstKept).join("/")}`;
}
