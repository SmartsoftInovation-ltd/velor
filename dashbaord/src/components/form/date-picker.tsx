import { useLayoutEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
  inputClassName?: string;
  isStatic?: boolean;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  placeholder,
  inputClassName,
  isStatic = true,
}: PropsType) {
  // Caller-supplied `onChange` is very often a fresh arrow function on every
  // render (e.g. an inline handler that calls setState). Putting it directly
  // in the effect's deps re-runs the effect — destroying and recreating the
  // flatpickr instance — on every parent re-render, not just when the
  // handler's behavior actually changes. Routing through a ref keeps the
  // effect's identity stable across renders while still calling whatever the
  // latest `onChange` is.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // With `static: true` (the default), flatpickr doesn't just add a sibling
  // node — it wraps this <input> in its own <div>, moving the input inside
  // it (see flatpickr's `_.destroy` for the matching unwrap). React's virtual
  // DOM has no idea that wrapper exists; it still believes the input is a
  // direct child of the surrounding <div>. If a plain `useEffect` cleanup
  // (which React runs *after* paint, asynchronously) unwraps that wrapper at
  // the same time React's own commit phase is mutating this subtree — e.g.
  // a parent re-render right after this component's props change — the two
  // DOM mutations interleave and one of them calls removeChild on a node the
  // other has already detached, throwing "Failed to execute 'removeChild' on
  // 'Node': The node to be removed is not a child of this node." and taking
  // down the page via the nearest error boundary.
  //
  // `useLayoutEffect` cleanup runs synchronously as part of React's own
  // commit, before the browser paints and before any later effect can run —
  // so flatpickr's unwrap and React's reconciliation of this subtree can no
  // longer land in two different, unordered passes.
  useLayoutEffect(() => {
    const flatPickr = flatpickr(`#${id}`, {
      mode: mode || "single",
      static: isStatic,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate,
      onChange: (...args) => {
        const handler = onChangeRef.current;
        if (Array.isArray(handler)) {
          handler.forEach((h) => h(...args));
        } else {
          handler?.(...args);
        }
      },
    });

    return () => {
      if (Array.isArray(flatPickr)) return;
      // flatpickr's own teardown removes DOM nodes it created; if this
      // component's underlying element is already gone (parent unmounted
      // it first, e.g. during the same render pass) that removal throws.
      // Cleanup is best-effort here — nothing downstream depends on it
      // completing when the element is already gone.
      try {
        flatPickr.destroy();
      } catch {
        // element already removed from the DOM — nothing left to clean up
      }
    };
  }, [mode, id, defaultDate, isStatic]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          className={inputClassName || "h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800"}
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
