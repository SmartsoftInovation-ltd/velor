export default function Loading() {
  return (
    <main className="container py-10">
      <div className="mx-auto h-72 max-w-xl animate-pulse rounded-xl bg-bg-sunken" aria-busy="true" aria-label="Loading order status" />
    </main>
  );
}
