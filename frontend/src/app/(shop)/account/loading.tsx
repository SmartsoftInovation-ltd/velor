export default function AccountLoading() {
  return (
    <main className="container py-6">
      <div className="h-5 w-40 animate-pulse rounded bg-bg-sunken" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="h-80 animate-pulse rounded-xl bg-bg-sunken" />
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-xl bg-bg-sunken" />
          <div className="h-40 animate-pulse rounded-xl bg-bg-sunken" />
        </div>
      </div>
    </main>
  );
}
