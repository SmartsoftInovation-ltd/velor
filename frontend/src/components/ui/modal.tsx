"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * A centred dialog over a dimmed page. It is a native <dialog> opened with
 * showModal(), so the browser traps focus, closes on Escape and hands focus
 * back to the control that opened it. Mount it to open it; `onClose` should
 * unmount it. Clicking the dimmed page closes it too.
 */
export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  /** Names the dialog for a screen reader */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Escape: the parent unmounts the dialog, which closes it
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The dialog box is covered by its panel, so a click that lands on the
      // dialog itself is a click on the backdrop
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="modal m-auto max-h-[calc(100dvh-2rem)] w-[min(56rem,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 text-text-primary backdrop:bg-black/55"
    >
      <div className={cn("relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-bg-surface shadow-xl", className)}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-bg-sunken text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
        >
          <CloseIcon className="size-4" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
