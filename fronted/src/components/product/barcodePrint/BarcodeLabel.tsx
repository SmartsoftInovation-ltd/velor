import { useEffect, useRef } from "react";
import { renderBarcodeToSvg } from "../../../utils/barcodeRender";
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
  const showSku = labelSize.widthMm >= 50 && labelSize.heightMm >= 25;
  const is38x25 = labelSize.widthMm === 38 && labelSize.heightMm === 25;
  const showColor = !is38x25;
  const svgRef = useRef<SVGSVGElement>(null);

  // Barcode graphic gets a fixed share of the label's own height so it never
  // overflows the sticker regardless of label size — was previously sized
  // off label height alone (1.1x), which made it taller than the label itself.
  // Cut 30% shorter than that share so the bars leave more room for the text
  // stack below without shrinking the label itself.
  const barcodeHeightPx = Math.max(
    16,
    labelSize.heightMm * MM_TO_PX * 0.36 * 0.7,
  );

  useEffect(() => {
    if (svgRef.current) {
      renderBarcodeToSvg(svgRef.current, code || "0000000000", {
        height: barcodeHeightPx,
        width: 1.4,
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
    }
  }, [code, labelSize, barcodeHeightPx]);

  const widthPx = labelSize.widthMm * MM_TO_PX;
  const heightPx = labelSize.heightMm * MM_TO_PX;

  return (
    <div
      className="barcode-label bg-white border border-gray-300 print:border-0 flex flex-col items-center justify-center gap-y-0.5 overflow-hidden shrink-0"
      style={{
        width: widthPx,
        height: heightPx,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 0.5,
        paddingBottom: 0.5,
        fontSize,
        lineHeight: 1.05,
      }}
    >
      {contentOptions.shopName && shopName && (
        <p
          className="font-bold uppercase text-black leading-none truncate w-full text-center"
          style={{ fontSize: fontSize * 0.9 }}
        >
          {shopName}
        </p>
      )}
      {/* SVG defaults to display:inline, which reserves font baseline/descender
          space below it. At 38x25 that reserved space is pulled in with a
          negative margin to keep the tiny label tight; every larger size gets
          a small positive margin instead so the bars don't crowd the text. */}
      <svg ref={svgRef} className={`max-w-full block ${is38x25 ? "-my-1" : "my-px"}`} />
      <p
        className="text-black leading-none text-center"
        style={{ fontSize: fontSize * 0.85 }}
      >
        {code}
      </p>
      {contentOptions.productName && productName && (
        <p
          className="font-semibold text-black leading-none truncate w-full text-center"
          style={{ fontSize: fontSize * 0.85 }}
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
          style={{ fontSize: fontSize * 0.85 }}
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
