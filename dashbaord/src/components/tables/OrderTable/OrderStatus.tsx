import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../../utils/apiError";
import { ORDER_STATUSES, STATUS_LABELS, statusPillClass, toneOf, type OrderStatusType } from "./orderMeta";

interface OrderStatusProps {
  order: {
    _id: string;
    orderStatus: OrderStatusType;
  };
  onChanged?: (status: OrderStatusType) => void;
}

const MENU_WIDTH = 220;
const OPTION_HEIGHT = 36;

/**
 * The status pill opens a list of every status, each with its colour, the
 * current one ticked. The list is portalled to <body> so a table's overflow
 * never clips it, and it works with the keyboard: arrows move, Enter picks,
 * Escape closes.
 */
const OrderStatus = ({ order, onChanged }: OrderStatusProps) => {
  const [status, setStatus] = useState<OrderStatusType>(order.orderStatus);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setStatus(order.orderStatus), [order.orderStatus]);

  // Below the pill, or above it when there is no room underneath
  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // options, the list's padding and its "Move order to" heading
    const height = ORDER_STATUSES.length * OPTION_HEIGHT + 44;
    const up = rect.bottom + height + 8 > window.innerHeight && rect.top > height;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top: up ? rect.top - height - 6 : rect.bottom + 6, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    listRef.current?.focus();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const openMenu = () => {
    setActive(Math.max(0, ORDER_STATUSES.indexOf(status)));
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = async (next: OrderStatusType) => {
    closeMenu();
    if (next === status) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await axiosSecure.put(`/order/order-update/${order._id}`, { orderStatus: next });
      toast.success(`Order marked ${STATUS_LABELS[next]}`);
      onChanged?.(next);
    } catch (error) {
      showApiError(error, "Failed to update order status");
      setStatus(previous);
    } finally {
      setSaving(false);
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = ORDER_STATUSES.length - 1;
    if (event.key === "ArrowDown") setActive((i) => (i === last ? 0 : i + 1));
    else if (event.key === "ArrowUp") setActive((i) => (i === 0 ? last : i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Enter" || event.key === " ") choose(ORDER_STATUSES[active]);
    else if (event.key === "Escape" || event.key === "Tab") closeMenu();
    else return;
    event.preventDefault();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Order status: ${STATUS_LABELS[status] ?? status}. Change`}
        className={`${statusPillClass(status)} cursor-pointer pr-2 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 disabled:cursor-wait`}
      >
        {saving ? (
          <span className="size-2 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <span className={`size-1.5 rounded-full ${toneOf(status).dot}`} />
        )}
        {STATUS_LABELS[status] ?? status}
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label="Change order status"
            aria-activedescendant={`status-${order._id}-${active}`}
            onKeyDown={onListKey}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-[99999] rounded-xl border border-gray-200 bg-white p-2 shadow-xl outline-none dark:border-white/10 dark:bg-gray-900"
          >
            <li role="presentation" className="px-2.5 pb-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Move order to
            </li>
            {ORDER_STATUSES.map((option, index) => {
              const selected = option === status;
              return (
                <li
                  key={option}
                  id={`status-${order._id}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
                    index === active ? "bg-gray-100 dark:bg-white/5" : ""
                  } ${selected ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}
                  style={{ height: OPTION_HEIGHT }}
                >
                  <span className={`size-2 shrink-0 rounded-full ${toneOf(option).dot}`} />
                  <span className="flex-1">{STATUS_LABELS[option]}</span>
                  {selected ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 text-accent-600 dark:text-accent-400">
                      <path d="m5 10.5 3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
};

export default OrderStatus;
