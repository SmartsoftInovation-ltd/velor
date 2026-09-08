"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon } from "./icons";
import { cn } from "@/lib/cn";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: "default" | "success" | "danger";
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Throws rather than no-oping: a toast that silently never shows is a bug. */
export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside <ToastProvider>");
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: ToastInput) => {
    setToasts((current) => [
      ...current.slice(-2),
      { id: Date.now() + Math.random(), tone: "default", ...toast },
    ]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

const TONES: Record<Toast["tone"], string> = {
  default: "text-text-primary",
  success: "text-success-text",
  danger: "text-danger-text",
};

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <li className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border-default bg-bg-elevated p-4 shadow-lg [animation:toast-in_200ms_var(--ease-out)]">
      <div className="flex-1 space-y-0.5">
        <p className={cn("text-small font-medium", TONES[toast.tone])}>
          {toast.title}
        </p>
        {toast.description ? (
          <p className="text-caption text-text-secondary">{toast.description}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-m-1 shrink-0 rounded-md p-1 text-text-tertiary transition-colors duration-150 hover:text-text-primary"
      >
        <CloseIcon className="size-4" />
      </button>
    </li>
  );
}
