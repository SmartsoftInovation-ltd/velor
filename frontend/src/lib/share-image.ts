import { cloudinaryVariant } from "./cloudinary-image";

const WIDTH = 1200;
const HEIGHT = 630;

export type ShareImage = { url: string; width?: number; height?: number; alt: string };

/**
 * The picture a shared link shows in WhatsApp, Messenger and the like. Those
 * crawlers want an absolute URL to a JPEG or PNG in the 1200×630 card shape, and
 * WhatsApp drops a heavy file. So the image is padded, not cropped, which keeps
 * the whole product in view, on white, as a JPEG: an auto format could hand a
 * crawler WebP, and the stored URL's low quality looks poor at this size.
 *
 * Undefined for anything a crawler cannot use: an empty value, or a local
 * placeholder such as the no-photo SVG.
 */
export function shareImage(src: string | undefined, alt: string): ShareImage | undefined {
  if (!src || !/^https?:\/\//.test(src)) return undefined;
  const url = cloudinaryVariant(src, `c_pad,w_${WIDTH},h_${HEIGHT},b_white,f_jpg,q_auto:good`);
  return url ? { url, width: WIDTH, height: HEIGHT, alt } : { url: src, alt };
}
