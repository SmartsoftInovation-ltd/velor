// Card-shaped placeholders while the outlets load
export default function OutletsLoading() {
  return (
    <main className="container py-6" aria-busy="true" aria-label="Loading outlets">
      <div className="mx-auto mt-10 mb-10 h-20 max-w-xl animate-pulse rounded-lg bg-bg-sunken" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-xl bg-bg-sunken" />
        ))}
      </div>
    </main>
  );
}
