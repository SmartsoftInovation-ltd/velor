export const fieldShell = (hasError: boolean) =>
  `flex h-12 items-center gap-2.5 rounded-xl border bg-white px-3.5 transition focus-within:ring-4 dark:bg-white/[0.03] ${
    hasError
      ? "border-error-400 focus-within:border-error-500 focus-within:ring-error-500/10"
      : "border-gray-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/10 dark:border-gray-800"
  }`;

// auth-input: keeps the browser's autofill highlight off (see index.css)
export const inputClass =
  "auth-input h-full w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30";
