/** Placeholder for a collection page while its products load */
export function CollectionLoading() {
  return (
    <main className="container py-6">
      <div className="h-4 w-48 animate-pulse rounded bg-bg-sunken" />
      <div className="mt-6 mb-8 space-y-2">
        <div className="h-9 w-64 animate-pulse rounded bg-bg-sunken" />
        <div className="h-4 w-80 animate-pulse rounded bg-bg-sunken" />
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="h-80 animate-pulse rounded-lg bg-bg-sunken" />
        ))}
      </ul>
    </main>
  );
}
