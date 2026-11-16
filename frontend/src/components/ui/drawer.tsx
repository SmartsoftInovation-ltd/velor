"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A full-height panel that slides in from the right over a dimmed page. Like
 * Modal it is a native <dialog> opened with showModal(): the browser traps
 * focus, closes on Escape and hands focus back to the control that opened it.
 * Mount it to open it; `onClose` should unmount it.
 */
export function Drawer({
  label,
  onClose,
  className,
  children,
}: {
  /** Names the drawer for a screen reader */
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The panel covers the dialog box, so a click on the dialog itself is on the backdrop
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(27rem,100vw)] max-w-none bg-transparent p-0 text-text-primary backdrop:bg-black/55"
    >
      <div className={cn("flex h-full flex-col bg-bg-surface shadow-xl", className)}>{children}</div>
    </dialog>
  );
}
