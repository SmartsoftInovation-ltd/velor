import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import moment from "moment";
import toast from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import { TbSticker2 } from "react-icons/tb";
import { FaEye, FaSearch, FaSync, FaTimes } from "react-icons/fa";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../ui/table";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import { initSocket } from "../../../socket/socket";
import { showApiError, getApiErrorMessage } from "../../../utils/apiError";
import MobileCardList from "../../common/MobileCardList";
import OrderStatus from "./OrderStatus";
import ShippingInfo from "./ShippingInfo";
import { OrderItemDetails, OrderItemStack } from "./OrderItems";
import { ChannelTag, PaymentPill } from "./orderUi";
import { STATUS_LABELS, taka, type OrderItem, type OrderStatusType } from "./orderMeta";

interface Order {
  _id: string;
  createdAt: string;
  invoiceId?: string;
  invoiceSerialId?: string | null;
  items: OrderItem[];
  guestId?: string | null;
  shippingInfo: { fullName?: string; phone?: string; address?: string; city?: string; note?: string };
  orderFrom?: string;
  channel?: "web" | "pos";
  orderType?: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  deliveryCharge?: { deliveryCharge: number } | null;
  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus: OrderStatusType;
}

type Segment = "all" | string;

const ACTION = "shine flex size-8 shrink-0 items-center justify-center rounded border-none transition-all active:scale-90";
const VIEW_TONE = "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10";
// Every column gets the same width, so rows line up into an even grid
const COLUMNS = ["Serial ID", "Invoice", "Customer", "Items", "Amount", "Payment", "Source", "Status", "Actions"] as const;
const CELL = "px-4 py-4 align-top overflow-hidden";
const HEAD = "px-4 py-3 text-left text-theme-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";

// A two- or three-way toggle used for the channel and payment filters
const SegmentControl = ({ value, onChange, options, label }: {
  value: Segment;
  onChange: (value: Segment) => void;
  options: { value: Segment; label: string }[];
  label: string;
}) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          value === option.value
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Amounts = ({ order }: { order: Order }) => (
  <div className="text-right">
    <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white/90">{taka(order.finalAmount)}</p>
    <p className="font-mono text-[11px] text-gray-400">
      {taka(order.totalAmount)}
      {order.discountAmount ? <span className="text-error-500"> −{taka(order.discountAmount)}</span> : null}
      {order.deliveryCharge?.deliveryCharge ? <span> +{taka(order.deliveryCharge.deliveryCharge)}</span> : null}
    </p>
  </div>
);

// The invoice's INV-<prefix>-NN serial; the row number until one is assigned
const SerialCell = ({ order, index }: { order: Order; index: number }) =>
  order.invoiceSerialId ? (
    <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
      {order.invoiceSerialId}
    </span>
  ) : (
    <span className="font-mono text-xs font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
  );

const InvoiceCell = ({ order, index }: { order: Order; index: number }) => (
  <div className="space-y-1">
    <p className="truncate font-mono text-sm font-semibold text-gray-800 dark:text-white/90">
      {order.invoiceId || `#${index + 1}`}
    </p>
    <p className="text-xs text-gray-600 dark:text-gray-400" title={moment(order.createdAt).format("YYYY-MM-DD HH:mm")}>
      {moment(order.createdAt).format("DD MMM, HH:mm")}
    </p>
    <p className="text-[11px] text-gray-400">
      {moment(order.createdAt).fromNow()} · {order.guestId ? "Guest" : "Customer"}
    </p>
  </div>
);

const Actions = ({ order, canDelete, onDelete }: { order: Order; canDelete: boolean; onDelete: (id: string) => void }) => (
  <div className="flex items-center justify-end gap-1.5">
    <Link to={`/orderdetails/${order._id}`} aria-label="View order" title="View order" className={`${ACTION} ${VIEW_TONE}`}>
      <FaEye className="size-4" />
    </Link>
    <Link to={`/sticker/${order._id}`} aria-label="Print sticker" title="Sticker" className={`${ACTION} ${VIEW_TONE}`}>
      <TbSticker2 className="size-4" />
    </Link>
    <Link to={`/invoice/${order._id}`} aria-label="Print invoice" title="Invoice" className={`${ACTION} ${VIEW_TONE}`}>
      <IoIosPrint className="size-4" />
    </Link>
    {canDelete && (
      <Button
        onClick={() => onDelete(order._id)}
        size="sm"
        aria-label="Delete order"
        className="size-8 shrink-0 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
      >
        <MdDelete className="size-4" />
      </Button>
    )}
  </div>
);

const TableSkeleton = () => (
  <div className="animate-pulse space-y-2">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-white/5" />
    ))}
  </div>
);

export default function OrderTable({ statusFilter, onDataChanged }: {
  statusFilter: string | null;
  onDataChanged?: () => void;
}) {
  const canDelete = usePermission("order", "delete");
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Segment>("all");
  const [payment, setPayment] = useState<Segment>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await axiosSecure.get(`/order/allorders`)).data.data as Order[],
    staleTime: 30 * 1000,
  });

  // A new order anywhere in this store: reload the list and the pipeline counts
  useEffect(() => {
    const socket = initSocket();
    const onPlaced = (payload: { invoiceId?: string; message?: string }) => {
      toast.success(payload?.invoiceId ? `New order ${payload.invoiceId}` : payload?.message || "New order received!");
      refetch();
      onDataChanged?.();
    };
    socket.on("orderPlaced", onPlaced);
    return () => {
      socket.off("orderPlaced", onPlaced);
    };
  }, [refetch, onDataChanged]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? [])
      .filter((order) => order.orderType === "complete")
      .filter((order) => !statusFilter || order.orderStatus === statusFilter)
      .filter((order) => channel === "all" || (order.channel ?? "pos") === channel)
      .filter((order) => payment === "all" || (order.paymentMethod ?? "cod") === payment)
      .filter((order) => {
        if (!needle) return true;
        const info = order.shippingInfo ?? {};
        return [order.invoiceId, info.fullName, info.phone, info.address]
          .some((value) => String(value ?? "").toLowerCase().includes(needle));
      });
  }, [data, search, statusFilter, channel, payment]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const changed = () => {
    refetch();
    onDataChanged?.();
  };

  const handleDelete = async () => {
    if (isDeleting || !deleteId) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/order/delete-Order/${deleteId}`);
      toast.success("Order deleted successfully.");
      changed();
    } catch (err) {
      showApiError(err, "Failed to delete the order. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="group relative w-full lg:max-w-md">
          <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 transition group-focus-within:text-accent-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, name, phone or address"
            aria-label="Search orders"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-accent-300 focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white">
              <FaTimes className="size-3" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentControl label="Channel" value={channel} onChange={setChannel}
            options={[{ value: "all", label: "All" }, { value: "web", label: "Web" }, { value: "pos", label: "POS" }]} />
          <SegmentControl label="Payment" value={payment} onChange={setPayment}
            options={[{ value: "all", label: "Any payment" }, { value: "cod", label: "COD" }, { value: "sslcommerz", label: "Online" }]} />
          <Button
            onClick={() => changed()}
            size="sm"
            variant="outline"
            aria-label="Refresh orders"
            className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
          >
            <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-800 dark:text-white/90">{rows.length}</span> order{rows.length === 1 ? "" : "s"}
        {statusFilter ? <> · <span className="font-semibold">{STATUS_LABELS[statusFilter as OrderStatusType]}</span></> : null}
      </p>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <div className="py-16 text-center">
          <p className="mb-4 font-semibold text-error-500">{getApiErrorMessage(error, "Error fetching orders")}</p>
          <Button size="sm" onClick={() => refetch()} className="!bg-accent-500 hover:!bg-accent-600 !text-white">Try Again</Button>
        </div>
      ) : isMobile ? (
        <MobileCardList
          items={rows}
          getKey={(order) => order._id}
          emptyMessage="No orders match these filters"
          renderCard={(order, index) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <InvoiceCell order={order} index={index} />
                <Amounts order={order} />
              </div>
              <ShippingInfo order={order} />
              <OrderItemStack items={order.items} expanded={expanded.has(order._id)} onToggle={() => toggle(order._id)} />
              {expanded.has(order._id) ? <OrderItemDetails items={order.items} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatus order={order} onChanged={changed} />
                <PaymentPill method={order.paymentMethod} status={order.paymentStatus} />
                <ChannelTag channel={order.channel} source={order.orderFrom} />
              </div>
              <div className="border-t border-gray-100 pt-3 dark:border-white/[0.05]">
                <Actions order={order} canDelete={canDelete} onDelete={setDeleteId} />
              </div>
            </div>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table className="w-full min-w-[1600px] table-fixed">
              <colgroup>
                {COLUMNS.map((column) => (
                  <col key={column} style={{ width: `${100 / COLUMNS.length}%` }} />
                ))}
              </colgroup>
              <TableHeader className="border-b border-gray-100 bg-gray-50/60 dark:border-white/[0.05] dark:bg-white/[0.02]">
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column}
                      isHeader
                      className={`${HEAD} ${column === "Amount" || column === "Actions" ? "!text-right" : ""}`}
                    >
                      {column}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-4 py-16 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={COLUMNS.length}>
                      No orders match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((order, index) => (
                    <Fragment key={order._id}>
                      <TableRow className={`transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02] ${expanded.has(order._id) ? "bg-gray-50/70 dark:bg-white/[0.02]" : ""}`}>
                        <TableCell className={CELL}><SerialCell order={order} index={index} /></TableCell>
                        <TableCell className={CELL}><InvoiceCell order={order} index={index} /></TableCell>
                        <TableCell className={`${CELL} text-theme-sm`}><ShippingInfo order={order} /></TableCell>
                        <TableCell className={`${CELL} !py-3`}>
                          <OrderItemStack items={order.items} expanded={expanded.has(order._id)} onToggle={() => toggle(order._id)} />
                        </TableCell>
                        <TableCell className={CELL}><Amounts order={order} /></TableCell>
                        <TableCell className={CELL}><PaymentPill method={order.paymentMethod} status={order.paymentStatus} /></TableCell>
                        <TableCell className={CELL}><ChannelTag channel={order.channel} source={order.orderFrom} /></TableCell>
                        <TableCell className={CELL}><OrderStatus order={order} onChanged={changed} /></TableCell>
                        <TableCell className={CELL}><Actions order={order} canDelete={canDelete} onDelete={setDeleteId} /></TableCell>
                      </TableRow>
                      {expanded.has(order._id) ? (
                        <TableRow className="bg-gray-50/70 dark:bg-white/[0.02]">
                          <TableCell className="px-4 pb-4 pt-0" colSpan={COLUMNS.length}>
                            <OrderItemDetails items={order.items} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Modal isOpen={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <div className="p-8">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <MdDelete className="size-8 text-error-600" />
          </div>
          <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-white">Delete Order?</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            The order and its invoice are removed, and its stock goes back on the shelf. This cannot be undone.
          </p>
          <div className="mt-7 flex gap-3">
            <Button onClick={() => setDeleteId(null)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 !rounded-xl border-none !bg-error-500 py-2.5 text-sm font-semibold !text-white shadow-lg transition-all hover:!bg-error-600 active:scale-95"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
