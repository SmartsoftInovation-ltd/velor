"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { brandThemeCss } from "@/lib/brand-theme";

const STYLE_ID = "brand-preview";
const LAYOUTS = {
  banner: /^(split|full|boxed)$/,
  card: /^(standard|minimal|overlay)$/,
  grid: /^[345]$/,
  category: /^(image|round|name)$/,
  gallery: /^(left|right)$/,
  thumbs: /^(side|bottom)$/,
  filter: /^(left|right|popup)$/,
  footer: /^(full|compact)$/,
  button: /^(solid|flat|outline)$/,
  menu: /^(sunken|surface|brand|inverse)$/,
  "menu-align": /^(left|center)$/,
  announcement: /^(on|off)$/,
};

/**
 * Lets the Platform Console try a color or layout on this site while showing it
 * in a frame. It paints only this visitor's frame, saves nothing, and listens only to
 * the console's own origin: a real shopper is never framed, so this stays idle.
 */
export function BrandPreviewListener({ parentOrigin }: { parentOrigin: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (window.parent === window) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== parentOrigin || event.source !== window.parent) return;
      if (event.data?.type === "brand-preview:design") {
        // The layout's CSS keys off these attributes, so no reload is needed
        for (const [name, allowed] of Object.entries(LAYOUTS)) {
          const value = event.data[name];
          if (allowed.test(value)) document.documentElement.setAttribute(`data-${name}`, value);
        }
        // textContent, so whatever is typed stays text
        const bar = document.getElementById("announcement-bar");
        if (bar && typeof event.data.announcementText === "string") {
          bar.textContent = event.data.announcementText;
        }
        return;
      }
      if (event.data?.type !== "brand-preview:color") return;
      const css = brandThemeCss(event.data.color);
      if (!css) return;

      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        // Last in <head>: beats the saved color, which has the same specificity
        document.head.append(style);
      }
      style.textContent = css;
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [parentOrigin]);

  // Tells the console where the frame is, and asks for the color after a full
  // page load, which starts this document over without its style tag
  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: "brand-preview:ready", path: pathname }, parentOrigin);
  }, [parentOrigin, pathname]);

  return null;
}
