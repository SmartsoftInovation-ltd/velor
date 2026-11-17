import { cloudinaryVariant } from "./cloudinary-image";

/**
 * A store's browser icons, made from the logo set in Site Information.
 *
 * A logo is rarely square, and a browser tab squeezes what it is given, so a
 * logo on Cloudinary is asked for padded to a square at the size needed. iOS
 * paints a transparent icon on black, so the home-screen one gets a white
 * ground. A logo hosted anywhere else is used as it is, and a store with no
 * logo keeps the default icon in public/.
 */
const squareIcon = (logo: string, size: number, background: string) =>
  cloudinaryVariant(logo, `c_pad,w_${size},h_${size},b_${background},f_png`) ?? logo;

export function storeIcons(logo?: string) {
  if (!logo) return { icon: "/icon.png", apple: "/apple-icon.png" };
  return {
    icon: squareIcon(logo, 64, "transparent"),
    apple: squareIcon(logo, 180, "white"),
  };
}
