import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { BrandPreviewListener } from "@/components/brand-preview-listener";
import { ToastProvider } from "@/components/ui/toast";
import { brandThemeCss } from "@/lib/brand-theme";
import { getStore, storeHostFrom } from "@/lib/store-api";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShoPzio — Design System",
  description:
    "Design tokens extracted from the ShoPzio Figma file.",
};

/**
 * Applies the stored theme before first paint so dark mode never flashes
 * light. Must stay synchronous and inline — a deferred script paints too late.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

const originOf = (url?: string) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Here rather than in the (shop) layout so the sign-in pages and the 404 wear
  // the store's color too. Rendered on the server, so nothing flashes orange.
  const store = await getStore(storeHostFrom(await headers()));
  const brandCss = brandThemeCss(store?.primaryColor);
  const consoleOrigin = originOf(process.env.DASHBOARD_URL);

  return (
    // The inline script below sets data-theme before React hydrates, so the
    // server HTML and the live DOM necessarily differ on this element.
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {brandCss ? <style dangerouslySetInnerHTML={{ __html: brandCss }} /> : null}
      </head>
      <body className="flex min-h-full flex-col">
        {/* A client boundary that only owns the toast stack — `children` stays
            server-rendered and passes straight through it. The site chrome is
            not here: the auth routes are full-page and carry none of it, so
            the header and footer belong to the (shop) group's layout. */}
        <ToastProvider>{children}</ToastProvider>
        {consoleOrigin ? <BrandPreviewListener parentOrigin={consoleOrigin} /> : null}
      </body>
    </html>
  );
}
