// The Website Color tab's copy of the storefront's ramp, for its own header strip
// and readout. Keep the mixes in step with frontend/src/lib/brand-theme.ts.

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const DARK_CANVAS: Rgb = [20, 18, 16];
const DARK_SURFACE: Rgb = [28, 25, 23];

const toRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

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

const readableOn = (color: Rgb, ground: Rgb, target: Rgb): Rgb => {
  let result = color;
  for (let amount = 0.05; contrast(result, ground) < 4.5 && amount <= 1; amount += 0.05) {
    result = mix(color, target, amount);
  }
  return result;
};

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

export type BrandRamp = {
  light: Record<RampStep, string>;
  // Only the steps the stylesheet fixes in dark mode; the rest stay as in light
  dark: Partial<Record<RampStep, string>>;
  onBrand: string;
  onBrandIsDark: boolean;
  onBrandContrast: number;
  textLight: string;
  textDark: string;
  ink: string;
};

export const brandRamp = (hex: string): BrandRamp => {
  const base = toRgb(hex);
  const onBrandIsDark = contrast(base, WHITE) < 3;
  return {
    light: {
      50: toHex(mix(base, WHITE, 0.92)),
      100: toHex(mix(base, WHITE, 0.84)),
      200: toHex(mix(base, WHITE, 0.66)),
      300: toHex(mix(base, WHITE, 0.46)),
      400: toHex(mix(base, WHITE, 0.22)),
      500: toHex(base),
      600: toHex(mix(base, BLACK, 0.12)),
      700: toHex(mix(base, BLACK, 0.3)),
      800: toHex(mix(base, BLACK, 0.45)),
      900: toHex(mix(base, BLACK, 0.58)),
    },
    dark: {
      50: toHex(mix(base, DARK_CANVAS, 0.88)),
      100: toHex(mix(base, DARK_CANVAS, 0.8)),
      200: toHex(mix(base, DARK_CANVAS, 0.66)),
      300: toHex(mix(base, DARK_CANVAS, 0.45)),
      400: toHex(mix(base, DARK_CANVAS, 0.15)),
    },
    onBrand: onBrandIsDark ? toHex(DARK_SURFACE) : "#fff",
    onBrandIsDark,
    onBrandContrast: contrast(base, onBrandIsDark ? DARK_SURFACE : WHITE),
    textLight: toHex(readableOn(mix(base, BLACK, 0.12), WHITE, BLACK)),
    textDark: toHex(readableOn(mix(base, WHITE, 0.22), DARK_SURFACE, WHITE)),
    ink: toHex(readableOn(mix(base, BLACK, 0.3), WHITE, BLACK)),
  };
};
