export default function ProductLoading() {
  return (
    <main className="container py-6">
      <div className="mb-6 h-6 w-72 animate-pulse rounded bg-bg-sunken" />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="aspect-4/5 animate-pulse rounded-xl bg-bg-sunken" />

        <div className="space-y-5">
          <div className="h-4 w-24 animate-pulse rounded bg-bg-sunken" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-bg-sunken" />
          <div className="h-4 w-48 animate-pulse rounded bg-bg-sunken" />
          <div className="h-10 w-40 animate-pulse rounded bg-bg-sunken" />
          <div className="h-24 animate-pulse rounded bg-bg-sunken" />
          <div className="h-12 w-64 animate-pulse rounded bg-bg-sunken" />
        </div>
      </div>
    </main>
  );
}
