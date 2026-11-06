interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string | number;
  emptyMessage?: string;
  /** Replaces the plain empty message, e.g. with a ListEmptyState */
  empty?: React.ReactNode;
}

// Stacked card fallback for dense tables below md. Not virtualized — mobile
// lists are short enough after filtering, and variable card height defeats a
// fixed estimateSize.
function MobileCardList<T>({
  items,
  renderCard,
  getKey,
  emptyMessage = "No records found",
  empty,
}: MobileCardListProps<T>) {
  if (!items.length) {
    if (empty) return <>{empty}</>;
    return (
      <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={getKey(item, index)}
          className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  );
}

export default MobileCardList;
