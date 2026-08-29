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
