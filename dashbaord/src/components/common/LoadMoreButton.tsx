import Button from "../ui/button/Button";

/**
 * The next page of a list the server answers in pages (BUG-P2-010). Shown only
 * while there is more to load.
 */
export default function LoadMoreButton({
  hasMore,
  loading,
  onClick,
}: {
  hasMore?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button
        onClick={onClick}
        disabled={loading}
        className="!bg-accent-500 hover:!bg-accent-600 !text-white !rounded font-semibold px-5 py-2 text-sm"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Loading…
          </span>
        ) : (
          "Load more"
        )}
      </Button>
    </div>
  );
}
