import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A real <input type="checkbox">, restyled with `appearance-none` so it keeps
 * native keyboard behaviour and form participation. The tick is a background
 * image rather than a child element, which an input cannot have.
 */
export function Checkbox({
  label,
  className,
  ...props
}: { label: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-small text-text-secondary">
      <input
        type="checkbox"
        className={cn(
          "mt-0.5 size-4 shrink-0 appearance-none rounded-xs border border-border-default bg-bg-surface transition-colors duration-150",
          "checked:border-brand-500 checked:bg-brand-500",
          "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M5 12.5l4.5 4.5L19 7%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          "hover:border-border-strong checked:hover:border-brand-500",
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
