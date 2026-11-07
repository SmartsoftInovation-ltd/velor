// Prints one element on a sheet of its own, so nothing else on the page goes to
// the printer. The page's stylesheets are copied over; pageCss sets the paper.
export const printElement = (element: HTMLElement, pageCss: string) => {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join("");
  frame.onload = () => {
    const printer = frame.contentWindow;
    if (!printer) return;
    printer.addEventListener("afterprint", () => frame.remove());
    printer.focus();
    printer.print();
  };
  frame.srcdoc = `<!doctype html><html><head>${styles}<style>@page{${pageCss}}body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${element.outerHTML}</body></html>`;
  document.body.appendChild(frame);
};
