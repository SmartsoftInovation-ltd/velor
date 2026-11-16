import { PencilIcon } from "@/components/ui/icons-account";

/** The small outline "Edit" / "Change" button in an account card's header */
export function EditToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3.5 text-small font-medium text-text-secondary transition-colors duration-150 hover:border-brand-500 hover:text-text-brand"
    >
      <PencilIcon className="size-3.5" />
      {label}
    </button>
  );
}
