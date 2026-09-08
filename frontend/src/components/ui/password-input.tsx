"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { EyeIcon } from "@/components/ui/icons";
import { EyeOffIcon } from "@/components/ui/icons-filter";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * A password field with a reveal toggle. Client only for that toggle — the
 * field itself is the same Input every other form uses.
 */
export function PasswordInput({
  className,
  icon,
  ...props
}: { icon?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input
        type={shown ? "text" : "password"}
        icon={icon}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:text-text-primary"
      >
        {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}
