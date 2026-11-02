import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// Turns a report sheet into a PDF, however many rows it has.
//
// The sheet used to be drawn as ONE image and that whole image added again on
// every page. A long report then made a canvas taller than browsers allow
// (it came out blank or threw), and a 20-page PDF carried 20 copies of it.
// Here the sheet is drawn one page at a time: each page shows its own rows
// (never split across pages), with the table's header repeated, and only that
// page's image goes into the PDF.

export type SheetFormat = "a4" | "a5" | "80mm";

const SCALE = 2;
// Tallest canvas drawn at once, in screen pixels (browsers cap canvases at
// roughly 16k–32k pixels; this stays far below at SCALE 2)
const MAX_BAND_PX = 4000;
const PAGE_MM: Record<"a4" | "a5", { w: number; h: number }> = { a4: { w: 210, h: 297 }, a5: { w: 148, h: 210 } };
const THERMAL_WIDTH_MM = 80;

const draw = (el: HTMLElement) =>
  html2canvas(el, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true, logging: false });

// The table that holds the report's rows: the one with the most body rows
export const mainTable = (root: HTMLElement) => {
  let best: HTMLTableElement | null = null;
  let most = 0;
  root.querySelectorAll("table").forEach((t) => {
    const n = t.tBodies[0]?.rows.length ?? 0;
    if (n > most) {
      most = n;
      best = t;
    }
  });
  return best as HTMLTableElement | null;
};

// Everything before (or after) `node` inside `root`, at every level up
const siblingsAround = (node: Element, root: Element, side: "before" | "after") => {
  const out: HTMLElement[] = [];
  let cur: Element | null = node;
  while (cur && cur !== root) {
    let sib = side === "before" ? cur.previousElementSibling : cur.nextElementSibling;
    while (sib) {
      out.push(sib as HTMLElement);
      sib = side === "before" ? sib.previousElementSibling : sib.nextElementSibling;
    }
    cur = cur.parentElement;
  }
  return out;
};

const setShown = (els: HTMLElement[], shown: boolean) =>
  els.forEach((el) => (el.style.display = shown ? "" : "none"));

/**
 * Builds the PDF for a report sheet. `source` is the on-screen sheet; it is
 * copied off-screen and left untouched.
 */
export async function sheetToPdf(source: HTMLElement, format: SheetFormat): Promise<jsPDF> {
  const thermal = format === "80mm";

  // Lay a copy out off-screen at the sheet's own width, outside any scroll box
  const holder = document.createElement("div");
  holder.style.cssText = `position:absolute;left:-100000px;top:0;width:${source.offsetWidth}px;background:#fff;`;
  const sheet = source.cloneNode(true) as HTMLElement;
  sheet.style.height = "auto";
  sheet.style.maxHeight = "none";
  sheet.style.overflow = "visible";
  holder.appendChild(sheet);
  document.body.appendChild(holder);

  try {
    const widthPx = sheet.offsetWidth;
    // Page height in screen pixels at the sheet's width
    const pageHpx = thermal ? MAX_BAND_PX : Math.floor((widthPx * PAGE_MM[format].h) / PAGE_MM[format].w);

    const table = mainTable(sheet);
    const rows = table ? Array.from(table.tBodies[0].rows) : [];

    // Pages: groups of rows. With no table, the sheet is cut into page-sized slices.
    const pages: { from: number; to: number }[] = [];
    let before: HTMLElement[] = [];
    let after: HTMLElement[] = [];
    if (table && rows.length) {
      before = siblingsAround(table, sheet, "before");
      after = [...(table.tFoot ? [table.tFoot] : []), ...siblingsAround(table, sheet, "after")];
      const top = rows[0].getBoundingClientRect().top - sheet.getBoundingClientRect().top;
      const bottom = sheet.getBoundingClientRect().bottom - rows[rows.length - 1].getBoundingClientRect().bottom;
      const headH = table.tHead?.offsetHeight ?? 0;
      // A later page repeats only the table header (plus the sheet's own padding)
      const pad = parseFloat(getComputedStyle(sheet).paddingTop) || 0;
      let start = 0;
      let used = top;
      rows.forEach((row, i) => {
        const h = row.offsetHeight;
        if (i > start && used + h > pageHpx) {
          pages.push({ from: start, to: i });
          start = i;
          used = pad + headH;
        }
        used += h;
      });
      pages.push({ from: start, to: rows.length });
      // The totals and footer need room on the last page, or get one of their own
      if (used + bottom > pageHpx && rows.length - pages[pages.length - 1].from > 1) {
        const last = pages.pop() as { from: number; to: number };
        const keep = Math.max(last.from + 1, last.to - Math.ceil(bottom / Math.max(1, rows[last.to - 1].offsetHeight)));
        pages.push({ from: last.from, to: keep }, { from: keep, to: last.to });
      }
    }

    const pdf = thermal ? null : new jsPDF({ unit: "mm", format });
    let thermalPdf: jsPDF | null = null;
    const addImage = (canvas: HTMLCanvasElement, first: boolean) => {
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (thermal) {
        const h = (canvas.height * THERMAL_WIDTH_MM) / canvas.width;
        if (!thermalPdf) thermalPdf = new jsPDF({ unit: "mm", format: [THERMAL_WIDTH_MM, h] });
        else thermalPdf.addPage([THERMAL_WIDTH_MM, h]);
        thermalPdf.addImage(img, "JPEG", 0, 0, THERMAL_WIDTH_MM, h);
        return;
      }
      const { w, h } = PAGE_MM[format as "a4" | "a5"];
      if (!first) pdf!.addPage();
      // Fit the page's width; a page drawn a little taller than the sheet is shrunk to fit
      let drawW = w;
      let drawH = (canvas.height * w) / canvas.width;
      if (drawH > h) {
        drawW = (w * h) / drawH;
        drawH = h;
      }
      pdf!.addImage(img, "JPEG", (w - drawW) / 2, 0, drawW, drawH);
    };

    if (pages.length) {
      for (let p = 0; p < pages.length; p += 1) {
        const { from, to } = pages[p];
        rows.forEach((row, i) => (row.style.display = i >= from && i < to ? "" : "none"));
        setShown(before, p === 0);
        setShown(after, p === pages.length - 1);
        addImage(await draw(sheet), p === 0);
      }
    } else {
      // No row table: draw the sheet in page-sized slices of one copy at a time
      const total = sheet.offsetHeight;
      // html2canvas crops in page coordinates
      const docTop = sheet.getBoundingClientRect().top + window.scrollY;
      for (let y = 0, first = true; y < total; y += pageHpx, first = false) {
        const canvas = await html2canvas(sheet, {
          scale: SCALE,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          y: docTop + y,
          height: Math.min(pageHpx, total - y),
          windowHeight: total,
        });
        addImage(canvas, first);
      }
    }

    return (thermal ? thermalPdf : pdf) as jsPDF;
  } finally {
    holder.remove();
  }
}
