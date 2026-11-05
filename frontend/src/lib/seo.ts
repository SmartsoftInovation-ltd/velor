/** Pages with nothing for a search result: a shopper's own, or internal. */
export const NO_INDEX = { index: false, follow: false };

/** schema.org for the store as a whole: its name and logo, and its search box in results. */
export function storeJsonLd(name: string, origin: string, logo?: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name,
        url: origin,
        ...(logo ? { logo } : {}),
      },
      {
        "@type": "WebSite",
        name,
        url: origin,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/shop?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
