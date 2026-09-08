export default function ShopLoading() {
  return (
    <main className="container py-8">
      <div className="h-4 w-48 animate-pulse rounded bg-bg-sunken" />
      <div className="mt-4 mb-8 space-y-2">
        <div className="h-9 w-64 animate-pulse rounded bg-bg-sunken" />
        <div className="h-4 w-40 animate-pulse rounded bg-bg-sunken" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <div className="h-[32rem] animate-pulse rounded-lg bg-bg-sunken" />
        <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {Array.from({ length: 9 }, (_, index) => (
            <li
              key={index}
              className="h-80 animate-pulse rounded-lg bg-bg-sunken"
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
