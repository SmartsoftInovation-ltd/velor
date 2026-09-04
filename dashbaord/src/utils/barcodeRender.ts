import JsBarcode from "jsbarcode";

export interface BarcodeRenderOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  displayValue?: boolean;
}

export const renderBarcodeToCanvas = (
  canvas: HTMLCanvasElement,
  value: string,
  options: BarcodeRenderOptions = {}
): boolean => {
  if (!value) return false;
  try {
    const dpr = Math.max(6, (window.devicePixelRatio || 1) * 3);
    JsBarcode(canvas, value, {
      format: "CODE128",
      width: (options.width ?? 1.6) * dpr,
      height: (options.height ?? 40) * dpr,
      fontSize: (options.fontSize ?? 12) * dpr,
      margin: (options.margin ?? 4) * dpr,
      displayValue: options.displayValue ?? false,
      background: "#ffffff",
      lineColor: "#000000",
    });
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    return true;
  } catch {
    return false;
  }
};

// SVG rendering — vector output has no DPI/resolution ceiling, so it stays
// sharp at any print resolution and survives DOM cloning (react-to-print),
// unlike a canvas bitmap which is fixed at screen devicePixelRatio and does
// not reliably carry its drawn pixels through a cloneNode-based print pipeline.
export const renderBarcodeToSvg = (
  svg: SVGSVGElement,
  value: string,
  options: BarcodeRenderOptions = {}
): boolean => {
  if (!value) return false;
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: options.width ?? 1.6,
      height: options.height ?? 40,
      fontSize: options.fontSize ?? 12,
      margin: options.margin ?? 4,
      marginTop: options.marginTop,
      marginBottom: options.marginBottom,
      marginLeft: options.marginLeft,
      marginRight: options.marginRight,
      displayValue: options.displayValue ?? false,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return true;
  } catch {
    return false;
  }
};


/**
 * Safety margin held back on each side of a barcode by default, so a printer's
 * edge tolerance never clips the outermost bar.
 */
export const BARCODE_EDGE_INSET_PX = 3;

/**
 * Constrain a rendered barcode SVG to the width actually available to it.
 *
 * JsBarcode sizes its SVG from bar count x module width with no regard for the
 * container, so a long payload renders wider than the label or receipt it sits
 * in and the right-hand bars print off the edge — `max-w-full` shrinks the box
 * on screen but the SVG has no viewBox, so print still lays out the bars at
 * their full intrinsic width.
 *
 * Converting the intrinsic size into a viewBox and pinning the width makes the
 * bars scale down to fit and stay centered, in print as well as on screen. A
 * barcode narrower than the space available is left untouched.
 *
 * Height is deliberately NOT scaled with the width. A uniform scale would let a
 * long payload on narrow paper collapse the bars to a fraction of their height
 * (a 24-character code on 58mm drops 45px to ~25px), and short bars are exactly
 * what a scanner struggles to read. Squeezing horizontally alone keeps every
 * bar full height; scanners read narrower bars far more happily than short ones.
 *
 * @param maxWidthPx Horizontal room the bars may occupy. Omit (or pass a
 *   non-positive value) to measure the SVG's own parent element.
 * @param insetPx Safety margin held back on each side, so a printer's edge
 *   tolerance or a slightly misfed roll still prints the outermost bar in full.
 */
export const fitBarcodeSvgToWidth = (
  svg: SVGSVGElement,
  maxWidthPx?: number,
  insetPx = 0
): void => {
  // JsBarcode writes these as unit-suffixed strings ("175px"), which Number()
  // rejects — parseFloat is required or the clamp silently never runs.
  const intrinsicWidth = parseFloat(svg.getAttribute("width") ?? "") || 0;
  const intrinsicHeight = parseFloat(svg.getAttribute("height") ?? "") || 0;
  if (!intrinsicWidth || !intrinsicHeight) return;

  const room =
    maxWidthPx && maxWidthPx > 0
      ? maxWidthPx
      : (svg.parentElement?.clientWidth ?? 0);
  const available = room - insetPx * 2;
  if (available <= 0) return;

  const renderedWidth = Math.min(intrinsicWidth, available);
  if (renderedWidth >= intrinsicWidth) return;

  svg.setAttribute("viewBox", `0 0 ${intrinsicWidth} ${intrinsicHeight}`);
  // "none" lets the viewBox squeeze horizontally while the height stays put —
  // "xMidYMid meet" would scale both axes and shorten the bars.
  svg.setAttribute("preserveAspectRatio", "none");

  svg.setAttribute("width", String(renderedWidth));
  svg.setAttribute("height", String(intrinsicHeight));
  svg.style.width = `${renderedWidth}px`;
  svg.style.height = `${intrinsicHeight}px`;
};
