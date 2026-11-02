import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { mainTable } from "../utils/sheetPdf";

const TOAST_ID = "report-print-all";
// Attribute on the empty <tbody> left in the snapshot's shell, where rows go back in
const ROWS_ATTR = "data-report-rows";
const ROWS_SLOT = `${ROWS_ATTR}=""></tbody>`;
// Rows added to the preview per step as it scrolls
const PREVIEW_CHUNK = 300;
const PRINT_HOST_ID = "report-print-snapshot";
const COVER_CLASS = "report-capture-cover";

// Reports show one page of rows on screen, but Preview, Print and PDF must
// cover the whole report, without the screen table ever showing more than its
// page:
//
// 1. Capture: the report asks for every row in one request (`?all=1`) and
//    draws them once on its sheet, under a cover so the screen never shows it.
// 2. Snapshot: the drawn sheet is copied as HTML, one string per row, and the
//    report goes straight back to its screen page (still cached).
// 3. The snapshot feeds everything else:
//    - Preview adds rows as you scroll (PREVIEW_CHUNK at a time), so even a
//      20,000-row report opens at once and scrolls smoothly.
//    - Print puts the whole snapshot in its own print-only node, because the
//      browser prints only what is in the page.
//    - PDF draws the snapshot page by page (utils/sheetPdf).

export type ReportSnapshot = {
  shell: string;
  rows: string[];
  className: string;
  width: number;
  thermalHtml: string;
  thermalClassName: string;
};

type Options = {
  sheetRef: RefObject<HTMLElement | null>;
  thermalRef: RefObject<HTMLElement | null>;
  // Lets long cell text wrap in the preview, for sheets laid out on one line
  wrapText?: boolean;
};

// The sheet's print-only pieces (letterhead, period row) are `hidden print:*`
// and its table is sized for the screen, so the preview applies the print
// variants itself to show the sheet as it will print.
export const toPreviewHtml = (html: string, wrapText = false) => {
  const out = html
    .replace(/hidden print:flex/g, "flex")
    .replace(/hidden print:block/g, "block")
    .replace(/hidden print:table-cell/g, "table-cell")
    .replace(/hidden print:table-row/g, "table-row")
    .replace(/hidden preview-only/g, "flex")
    .replace(/print:hidden/g, "hidden")
    .replace(/overflow-x-auto/g, "overflow-visible")
    .replace(/min-w-\[\d+px\]/g, "min-w-0");
  return wrapText ? out.replace(/whitespace-nowrap/g, "whitespace-normal") : out;
};

export function takeSnapshot(sheet: HTMLElement, thermal: HTMLElement | null): ReportSnapshot {
  const body = mainTable(sheet)?.tBodies[0];
  let shell = sheet.innerHTML;
  let rows: string[] = [];
  if (body && body.rows.length) {
    rows = Array.from(body.rows, (r) => r.outerHTML);
    // Serialise the sheet without its rows: swap in an empty tbody for a moment
    const slot = body.cloneNode(false) as HTMLElement;
    slot.setAttribute(ROWS_ATTR, "");
    body.replaceWith(slot);
    try {
      shell = sheet.innerHTML;
    } finally {
      slot.replaceWith(body);
    }
  }
  return {
    shell,
    rows,
    className: sheet.className,
    width: sheet.offsetWidth,
    thermalHtml: thermal?.innerHTML ?? "",
    thermalClassName: thermal?.className ?? "",
  };
}

// The whole sheet, every row back in place
export const fullSheetHtml = (snap: ReportSnapshot) =>
  snap.rows.length ? snap.shell.split(ROWS_SLOT).join(`${ROWS_ATTR}="">${snap.rows.join("")}</tbody>`) : snap.shell;

const imagesReady = (root: HTMLElement) =>
  Promise.race([
    Promise.all(
      Array.from(root.querySelectorAll("img")).map((img) =>
        img.complete
          ? null
          : new Promise((r) => {
              img.addEventListener("load", r);
              img.addEventListener("error", r);
            }),
      ),
    ),
    new Promise((r) => setTimeout(r, 3000)),
  ]);

const removePrintHost = () => {
  document.getElementById(PRINT_HOST_ID)?.remove();
  document.body.classList.remove("print-snapshot");
};

async function printSnapshot(snap: ReportSnapshot) {
  removePrintHost();
  const host = document.createElement("div");
  host.id = PRINT_HOST_ID;
  host.className = snap.className;
  host.innerHTML = fullSheetHtml(snap);
  document.body.appendChild(host);
  document.body.classList.add("print-snapshot");
  window.addEventListener("afterprint", removePrintHost, { once: true });
  await imagesReady(host);
  window.print();
}

// Fills the preview with the shell and the first rows, then adds the next
// rows each time the last one comes within reach of the view
function renderPreview(el: HTMLElement, snap: ReportSnapshot, wrapText: boolean) {
  el.innerHTML = toPreviewHtml(snap.shell, wrapText);
  const tbody = el.querySelector(`[${ROWS_ATTR}]`);
  if (!tbody || !snap.rows.length) return () => {};
  let next = 0;
  const append = () => {
    const html = snap.rows.slice(next, next + PREVIEW_CHUNK).join("");
    tbody.insertAdjacentHTML("beforeend", toPreviewHtml(html, wrapText));
    next += PREVIEW_CHUNK;
  };
  append();
  if (next >= snap.rows.length || typeof IntersectionObserver === "undefined") {
    while (next < snap.rows.length) append();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      append();
      if (next < snap.rows.length && tbody.lastElementChild) io.observe(tbody.lastElementChild);
    },
    { rootMargin: "1200px 0px" },
  );
  if (tbody.lastElementChild) io.observe(tbody.lastElementChild);
  return () => io.disconnect();
}

const previewMessage = (el: HTMLElement | null, text: string) => {
  if (!el) return;
  el.innerHTML = "";
  const p = document.createElement("p");
  p.className = "report-preview-status";
  p.textContent = text;
  el.appendChild(p);
};

// Hides the report area while every row is drawn for the snapshot
const showCover = () => {
  if (document.querySelector(`.${COVER_CLASS}`)) return;
  const area = document.getElementById("app-content-column")?.getBoundingClientRect();
  const cover = document.createElement("div");
  cover.className = COVER_CLASS;
  if (area) Object.assign(cover.style, { top: `${area.top}px`, left: `${area.left}px`, width: `${area.width}px`, height: `${area.height}px` });
  cover.innerHTML = `<span class="${COVER_CLASS}-spinner"></span><span>Preparing every row of the report…</span>`;
  document.body.appendChild(cover);
};
const hideCover = () => document.querySelectorAll(`.${COVER_CLASS}`).forEach((el) => el.remove());

export function useReportPrintAll(previewOpen: boolean, { sheetRef, thermalRef, wrapText = false }: Options) {
  // True while every row is loaded and drawn for a snapshot
  const [printAll, setPrintAll] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const snapRef = useRef<ReportSnapshot | null>(null);
  snapRef.current = snapshot;
  const pending = useRef<null | (() => unknown)>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const thermalPreviewRef = useRef<HTMLDivElement>(null);
  const pdfHosts = useRef<HTMLElement[]>([]);

  const capture = useCallback(() => {
    setFailed(false);
    setPrintAll(true);
    showCover();
  }, []);

  // Opening the preview takes a fresh snapshot; closing it lets the snapshot go
  useEffect(() => {
    if (previewOpen) {
      if (!snapRef.current) capture();
    } else if (!pending.current) {
      setSnapshot(null);
    }
  }, [previewOpen, capture]);

  useEffect(() => () => {
    hideCover();
    removePrintHost();
  }, []);

  // The preview: the sheet with rows added as it scrolls, or the thermal receipt
  useEffect(() => {
    if (!previewOpen) return;
    if (!snapshot) {
      previewMessage(previewRef.current, failed ? "Could not load the report. Close and try again." : "Loading every row of the report…");
      return;
    }
    if (thermalPreviewRef.current) thermalPreviewRef.current.innerHTML = snapshot.thermalHtml;
    if (!previewRef.current) return;
    return renderPreview(previewRef.current, snapshot, wrapText);
  }, [previewOpen, snapshot, failed, wrapText]);

  const finish = useCallback(async (snap: ReportSnapshot | null) => {
    const action = pending.current;
    pending.current = null;
    if (!action || !snap) return;
    try {
      await action();
    } finally {
      pdfHosts.current.forEach((el) => el.remove());
      pdfHosts.current = [];
      if (!previewOpen) setSnapshot(null);
    }
  }, [previewOpen]);

  const run = (action: () => unknown) => {
    pending.current = action;
    if (snapRef.current) {
      void finish(snapRef.current);
      return;
    }
    toast.loading("Loading every row of the report…", { id: TOAST_ID });
    capture();
  };

  // Called by useRunWhenAllRowsReady once the drawn rows can be copied
  const onReady = useCallback(() => {
    const sheet = sheetRef.current;
    const snap = sheet ? takeSnapshot(sheet, thermalRef.current) : null;
    toast.dismiss(TOAST_ID);
    hideCover();
    setSnapshot(snap);
    snapRef.current = snap;
    setPrintAll(false);
    void finish(snap);
  }, [sheetRef, thermalRef, finish]);

  const onFailed = useCallback(() => {
    toast.error("Could not load every row of the report.", { id: TOAST_ID });
    hideCover();
    pending.current = null;
    setFailed(true);
    setPrintAll(false);
  }, []);

  return {
    printAll,
    preparing: printAll && pending.current !== null,
    previewRef,
    thermalPreviewRef,
    run,
    print: () => run(() => (snapRef.current ? printSnapshot(snapRef.current) : undefined)),
    // An off-screen copy of the snapshot for the PDF builder, removed once the PDF is done
    pdfSource: (thermal: boolean): HTMLElement | null => {
      const snap = snapRef.current;
      if (!snap) return null;
      const el = document.createElement("div");
      el.className = thermal ? snap.thermalClassName : snap.className;
      el.innerHTML = thermal ? snap.thermalHtml : fullSheetHtml(snap);
      el.style.cssText = `position:absolute;left:-100000px;top:0;${thermal ? "" : `width:${snap.width}px;`}`;
      document.body.appendChild(el);
      pdfHosts.current.push(el);
      return el;
    },
    onReady,
    onFailed,
  };
}

type PrintAllControl = ReturnType<typeof useReportPrintAll>;

// Takes the snapshot once all rows have loaded and been drawn, or gives up
// if they could not be loaded
export function useRunWhenAllRowsReady(control: PrintAllControl, ready: boolean, failed = false) {
  const { printAll, onReady, onFailed } = control;
  useEffect(() => {
    if (!printAll) return;
    if (failed) {
      onFailed();
      return;
    }
    if (!ready) return;
    let cancelled = false;
    // Two frames: React has committed the rows and the browser has laid them out
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!cancelled) onReady();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [printAll, ready, failed, onReady, onFailed]);
}
