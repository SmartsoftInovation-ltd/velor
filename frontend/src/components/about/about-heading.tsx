/** A centred section title with the short brand bar under it */
export function AboutHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-center text-h2 font-semibold tracking-tight text-text-primary">
      {children}
      <span aria-hidden="true" className="mx-auto mt-3 block h-0.5 w-12 rounded-full bg-brand-500" />
    </h2>
  );
}
