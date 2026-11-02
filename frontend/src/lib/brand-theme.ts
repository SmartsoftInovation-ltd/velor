/**
 * A store's brand color as CSS. The chosen color is the 500 step, exactly; the
 * rest of the ramp is mixed from it so every tint and hover in globals.css
 * follows without knowing about stores.
 *
 * The output goes into a <style> tag, so anything but a plain hex is refused
 * here as well as where the setting is saved.
 */

type Rgb = [number, number, number];

const HEX = /^#[0-9a-f]{6}$/i;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// --sand-950 and --sand-900: the dark theme's canvas and its text on a fill
const DARK_CANVAS: Rgb = [20, 18, 16];
const DARK_SURFACE: Rgb = [28, 25, 23];

const toRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

// `amount` of `target` over `color`
const mix = (color: Rgb, target: Rgb, amount: number): Rgb =>
  color.map((c, i) => c + (target[i] - c) * amount) as Rgb;

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Moves the color toward `target` until it can be read on `ground`
const readableOn = (color: Rgb, ground: Rgb, target: Rgb): Rgb => {
  let result = color;
  for (let amount = 0.05; contrast(result, ground) < 4.5 && amount <= 1; amount += 0.05) {
    result = mix(color, target, amount);
  }
  return result;
};

const vars = (entries: Record<string, Rgb | string>) =>
  Object.entries(entries)
    .map(([name, value]) => `${name}:${typeof value === "string" ? value : toHex(value)};`)
    .join("");

/** The CSS for a store's color, or "" to keep the stylesheet's own default */
export function brandThemeCss(color?: string | null): string {
  if (!color || !HEX.test(color)) return "";
  const base = toRgb(color);

  // White on the default orange is 3.2:1, the lowest any store's button text goes
  const onBrand = contrast(base, WHITE) >= 3 ? "#fff" : toHex(DARK_SURFACE);

  const light = vars({
    "--brand-50": mix(base, WHITE, 0.92),
    "--brand-100": mix(base, WHITE, 0.84),
    "--brand-200": mix(base, WHITE, 0.66),
    "--brand-300": mix(base, WHITE, 0.46),
    "--brand-400": mix(base, WHITE, 0.22),
    "--brand-500": base,
    "--brand-600": mix(base, BLACK, 0.12),
    "--brand-700": mix(base, BLACK, 0.3),
    "--brand-800": mix(base, BLACK, 0.45),
    "--brand-900": mix(base, BLACK, 0.58),
    "--color-on-brand": onBrand,
    "--brand-ink": readableOn(mix(base, BLACK, 0.3), WHITE, BLACK),
    "--color-text-brand": readableOn(mix(base, BLACK, 0.12), WHITE, BLACK),
  });

  // The stylesheet's dark ramp is fixed values for these steps, not primitives
  const dark = vars({
    "--color-brand-50": mix(base, DARK_CANVAS, 0.88),
    "--color-brand-100": mix(base, DARK_CANVAS, 0.8),
    "--color-brand-200": mix(base, DARK_CANVAS, 0.66),
    "--color-brand-300": mix(base, DARK_CANVAS, 0.45),
    "--color-brand-400": mix(base, DARK_CANVAS, 0.15),
    "--color-text-brand": readableOn(mix(base, WHITE, 0.22), DARK_SURFACE, WHITE),
  });

  // `html` raises the specificity: this tag can land before globals.css, and
  // must win over it wherever it lands.
  return `html:root{${light}}html[data-theme="dark"]{${dark}}`;
}
