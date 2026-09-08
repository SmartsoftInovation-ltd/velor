"use client";

import { Button } from "@/components/ui/button";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-h2 font-semibold tracking-tight text-text-primary">
        The catalogue did not load
      </h1>
      <p className="max-w-md text-body text-text-secondary">
        Something went wrong fetching these products. Your filters are still in
        the address bar, so retrying keeps them.
      </p>
      {error.digest ? (
        <p className="font-mono text-caption text-text-tertiary">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
