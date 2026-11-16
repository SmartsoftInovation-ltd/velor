import { CheckCircleIcon } from "@/components/ui/icons-filter";

/** The green confirmation under a card after a save */
export function SavedNote({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-4 flex items-center gap-2 rounded-lg border border-success-solid/30 bg-success-subtle px-3 py-2 text-small font-medium text-success-text"
    >
      <CheckCircleIcon className="size-4 shrink-0" />
      {children}
    </p>
  );
}
