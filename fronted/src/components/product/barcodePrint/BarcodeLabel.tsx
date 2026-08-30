import { useEffect, useRef } from "react";
import {
  renderBarcodeToSvg,
  fitBarcodeSvgToWidth,
  BARCODE_EDGE_INSET_PX,
} from "../../../utils/barcodeRender";
import type { BarcodeContentOptions, LabelSize } from "./types";

interface BarcodeLabelProps {
  shopName: string;
  productName: string;
  price: number;
  size?: string;
  color?: string;
  sku?: string;
  code: string;
  contentOptions: BarcodeContentOptions;
  labelSize: LabelSize;
  fontSize: number;
}

const MM_TO_PX = 3.7795275591; // ~96 DPI
const LABEL_SIDE_PADDING_PX = 2;
const BAR_MODULE_WIDTH = 1.4;
// Text scales relative to the user-chosen base font size. Shop name, product
// name and price carry the label at a glance, so they run larger than the
// barcode digits and the color/SKU line beneath them.
const SHOP_NAME_SCALE = 1.15;
const PRODUCT_NAME_SCALE = 1;
const PRICE_SCALE = 1;

const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  shopName,
  productName,
  price,
  size,
  color,
  sku,
  code,
  contentOptions,
  labelSize,
  fontSize,
}) => {
  // SKU needs a label roomy enough to carry a second text line beside the
  // color. The 38x25 sticker is the only size too cramped for it; every larger
  // stock size, 45x35 included, prints the same content as 50x38.
  const showSku = labelSize.widthMm >= 45 && labelSize.heightMm >= 25;
  const is38x25 = labelSize.widthMm === 38 && labelSize.heightMm === 25;
  const is45x35 = labelSize.widthMm === 45 && labelSize.heightMm === 35;
  const showColor = !is38x25;
  const svgRef = useRef<SVGSVGElement>(null);

  // Barcode graphic gets a fixed share of the label's own height so it never
  // overflows the sticker regardless of label size — was previously sized
  // off label height alone (1.1x), which made it taller than the label itself.
  // Cut 30% shorter than that share so the bars leave more room for the text
  // stack below without shrinking the label itself.
  // 45x35 is the exception: its extra height is meant for the text stack, not
  // taller bars, so its barcode matches the 25mm-tall sizes instead of scaling
  // up with the label.
  const barcodeHeightMm = is45x35 ? 25 : labelSize.heightMm;
  const barcodeHeightPx = Math.max(16, barcodeHeightMm * MM_TO_PX * 0.36 * 0.7);

  const widthPx = labelSize.widthMm * MM_TO_PX;
  const heightPx = labelSize.heightMm * MM_TO_PX;

  // Horizontal room the bars may occupy: the label minus its own 2px side
  // padding, minus a symmetric safety inset so the printer's edge tolerance
  // never clips the outermost bar.
  const barcodeMaxWidthPx = widthPx - LABEL_SIDE_PADDING_PX * 2 - BARCODE_EDGE_INSET_PX * 2;

  // SVG defaults to display:inline, which reserves font baseline/descender
  // space below it. At 38x25 that reserved space was originally pulled all the
  // way in with a -4px margin to keep the tiny label tight, which left the bars
  // crowding the text; it has since been relaxed to -1px so they clear the
  // lines above and below. Larger sizes keep a small positive margin.
  const svgVerticalMargin = is38x25 ? -1 : 2;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    renderBarcodeToSvg(svg, code || "0000000000", {
      height: barcodeHeightPx,
      width: BAR_MODULE_WIDTH,
      // JsBarcode's default 4px margin applies on every side, which reads
      // as a large empty band above and below the bars since there is no
      // display value inside the SVG to fill that space. Top/bottom go to
      // zero so the bars fill their full height; left/right keep a sliver
      // so the outer bars don't touch the label edge.
      margin: 0,
      marginLeft: 1,
      marginRight: 1,
      marginTop: 0,
      marginBottom: 0,
      displayValue: false,
    });

    // A long CODE128 payload renders wider than the sticker, which prints the
    // right-hand bars off the edge; scale it into the room the label leaves.
    fitBarcodeSvgToWidth(svg, barcodeMaxWidthPx);
  }, [code, labelSize, barcodeHeightPx, barcodeMaxWidthPx]);

  return (
    <div
      className="barcode-label bg-white border border-gray-300 print:border-0 flex flex-col items-center justify-center gap-y-0.5 overflow-hidden shrink-0"
      style={{
        width: widthPx,
        height: heightPx,
        paddingLeft: LABEL_SIDE_PADDING_PX,
        paddingRight: LABEL_SIDE_PADDING_PX,
        paddingTop: 0.5,
        paddingBottom: 0.5,
        fontSize,
        lineHeight: 1.05,
      }}
    >
      {contentOptions.shopName && shopName && (
        <p
          className="font-bold uppercase text-black leading-none truncate w-full text-center"
          style={{ fontSize: fontSize * SHOP_NAME_SCALE }}
        >
          {shopName}
        </p>
      )}
      <svg
        ref={svgRef}
        className="max-w-full block"
        style={{ marginTop: svgVerticalMargin, marginBottom: svgVerticalMargin }}
      />
      <p
        className="text-black leading-none text-center"
        style={{ fontSize: fontSize * 0.85 }}
      >
        {code}
      </p>
      {contentOptions.productName && productName && (
        <p
          className="font-semibold text-black leading-none truncate w-full text-center"
          style={{ fontSize: fontSize * PRODUCT_NAME_SCALE }}
        >
          {productName}
          {contentOptions.size && size ? ` [ ${size}]` : ""}
        </p>
      )}
      {((showColor && color) || (showSku && sku)) && (
        <p
          className="text-black leading-none w-full text-center flex items-center justify-center gap-3"
          style={{ fontSize: fontSize * 0.8 }}
        >
          {showColor && color && <span>Color: {color}</span>}
          {showSku && sku && <span>SKU: {sku}</span>}
        </p>
      )}
      {contentOptions.price && (
        <p
          className="text-black leading-none text-center font-medium"
          style={{ fontSize: fontSize * PRICE_SCALE }}
        >
          {`MRP. ${price}/-${contentOptions.vatPlus ? " +VAT++" : ""}${
            contentOptions.vatIncluded ? " [INCL. VAT]" : ""
          }`}
        </p>
      )}
    </div>
  );
};

export default BarcodeLabel;
