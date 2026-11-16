import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

/**
 * A hover/focus label for an icon button. It is drawn in a portal on
 * document.body with fixed positioning, so it never takes space inside the
 * table or card it belongs to: a tooltip inside an `overflow-x-auto` wrapper
 * used to grow that wrapper, flash a scrollbar and shake the whole list.
 * It opens below the control, or above when there is no room below.
 */
export default function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const box = anchor.current!.getBoundingClientRect();
      const below = window.innerHeight - box.bottom > 40;
      setPos({ x: box.left + box.width / 2, y: below ? box.bottom + 6 : box.top - 6, placement: below ? "bottom" : "top" });
    };
    place();
    // Scrolling or resizing moves the control; follow it, or close on scroll inside a table
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => {
    setOpen(false);
    setPos(null);
  };

  return (
    <span
      ref={anchor}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && pos
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: pos.x, top: pos.y }}
              className={`pointer-events-none fixed z-[100000] -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg dark:bg-gray-700 ${
                pos.placement === "top" ? "-translate-y-full" : ""
              }`}
            >
              {text}
              <span
                aria-hidden="true"
                className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                  pos.placement === "top"
                    ? "top-full border-t-gray-900 dark:border-t-gray-700"
                    : "bottom-full border-b-gray-900 dark:border-b-gray-700"
                }`}
              />
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
