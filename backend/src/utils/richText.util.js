const { FilterXSS } = require("xss");

/**
 * Cleans HTML written in the dashboard's rich-text editor before it is stored
 * or sent to the storefront, which prints it as HTML. Only the formatting the
 * editor offers survives: no scripts, styles, event handlers or embeds.
 */
const TAGS = ["h1", "h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "ol", "ul", "li", "blockquote"];
const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)/i;

const filter = new FilterXSS({
  whiteList: { ...Object.fromEntries(TAGS.map((tag) => [tag, []])), a: ["href"] },
  // Anything not on the list is removed, and a script or style goes with its contents
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "noscript", "template"],
  // Every link opens in a new tab and cannot reach back into the shop's page
  onTag: (tag, html, { isClosing }) => {
    if (tag !== "a" || isClosing) return undefined;
    const href = (html.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i) || []).slice(1).find(Boolean) || "";
    if (!SAFE_LINK.test(href.trim()) || /[<>"]/.test(href)) return "<a>";
    return `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer">`;
  },
});

const cleanRichText = (html) => filter.process(typeof html === "string" ? html : "").trim();

const plain = new FilterXSS({ whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script", "style"] });

// True when nothing readable is left, e.g. the editor's empty "<p><br></p>"
const isBlankRichText = (html) => !plain.process(html || "").replace(/&nbsp;/g, " ").trim();

module.exports = { cleanRichText, isBlankRichText };
