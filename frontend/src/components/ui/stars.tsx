const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

/** Five stars filled to the nearest half. `className` sizes each star (default `size-3`). */
export function Stars({ rating, className = "size-3" }: { rating: number; className?: string }) {
  const filled = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, filled - i));
        return (
          <span key={i} className={`relative inline-block ${className}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="absolute inset-0 size-full fill-border-default">
              <path d={STAR} />
            </svg>
            {fill > 0 ? (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" className={`h-full fill-warning-solid ${className}`}>
                  <path d={STAR} />
                </svg>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
