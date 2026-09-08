"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";

/**
 * The [data-theme] attribute on <html> is the source of truth — the inline
 * script in the root layout sets it before first paint. It is an external
 * store, so it is read with useSyncExternalStore rather than mirrored into
 * state via an effect (which would cascade a render on every mount).
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** The server has no DOM; the inline script corrects this before paint. */
function getServerSnapshot(): Theme {
  return "light";
}

/**
 * `bare` drops the button's own border and ground, for use inside a container
 * that already draws one — the header's actions pill slides a ground behind it.
 */
export function ThemeToggle({ bare = false }: { bare?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage — the toggle still works this session.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      data-slot="theme"
      className={cn(
        "shine shine-dark group relative z-1 inline-flex size-10 items-center justify-center rounded-sm transition-colors duration-200 ease-[var(--ease-hover)]",
        !bare &&
          "border border-border-default bg-bg-surface shadow-xs hover:border-border-strong hover:bg-bg-hover",
      )}
    >
      <span className="relative z-2 text-text-secondary transition-[color,transform] duration-200 ease-[var(--ease-hover)] group-hover:scale-110 group-hover:text-text-primary [&>svg]:size-[18px]">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
