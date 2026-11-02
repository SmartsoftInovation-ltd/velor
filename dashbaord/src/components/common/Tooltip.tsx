import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Hover label for icon buttons. Drawn in a portal on <body>, above every
// layer, so a scrolling table, a sticky header or a virtualized row can't
// clip or cover it.
const Tooltip = ({ text, children }: { text: string; children: ReactNode }) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setCoords({ x: r.left + r.width / 2, y: r.top - 8 });
  };

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={show} onMouseLeave={() => setCoords(null)} onFocus={show} onBlur={() => setCoords(null)}>
      {children}
      {coords &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[1000000]"
            style={{ left: coords.x, top: coords.y, transform: "translate(-50%, -100%)" }}
          >
            <div className="relative whitespace-nowrap rounded bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
              {text}
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Tooltip;
