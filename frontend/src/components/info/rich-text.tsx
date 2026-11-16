/**
 * Text written in the dashboard's rich-text editor. The API strips it to
 * headings, paragraphs, lists, quotes, emphasis and http(s) links before it
 * gets here (backend `richText.util.js`), so it is printed as HTML.
 */
export function RichText({ html }: { html: string }) {
  return (
    <div
      className="max-w-3xl space-y-4 rounded-lg border border-border-default bg-bg-surface p-5 text-body text-text-secondary sm:p-8 [&_a]:font-medium [&_a]:text-text-brand [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border-brand [&_blockquote]:pl-4 [&_h1]:text-h2 [&_h1]:font-semibold [&_h1]:text-text-primary [&_h2]:pt-2 [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-text-primary [&_h3]:font-semibold [&_h3]:text-text-primary [&_h4]:font-semibold [&_h4]:text-text-primary [&_li]:marker:text-text-brand [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
