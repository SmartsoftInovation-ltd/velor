import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import moment from "moment";
import toast from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import { TbShieldSearch, TbStatusChange, TbSticker2 } from "react-icons/tb";
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
import OrdersEmptyState from "./OrdersEmptyState";
import { OptionsMenu, OptionsMenuItem, OptionsMenuSeparator } from "../../common/OptionsMenu";
import FraudCheckModal from "./FraudCheckModal";
import OrderStatusModal from "./OrderStatusModal";
import OrderStickerModal from "./OrderStickerModal";
import ShippingInfo from "./ShippingInfo";
import { OrderItemDetails, OrderItemStack } from "./OrderItems";
import { ChannelTag, PaymentPill } from "./orderUi";
import { STATUS_LABELS, statusPillClass, taka, toneOf, type OrderItem, type OrderStatusType } from "./orderMeta";

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

// Every column gets the same width, so rows line up into an even grid
const COLUMNS = ["Serial ID", "Invoice", "Customer", "Items", "Amount", "Payment", "Source", "Status", "Actions"] as const;
// Fixed widths sized to each column's content (longest pill, serial, amount);
// Customer and Items have none, so they share whatever space is left.
const COLUMN_WIDTHS: Record<(typeof COLUMNS)[number], number | undefined> = {
  "Serial ID": 110,
  Invoice: 150,
  Customer: undefined,
  Items: undefined,
  Amount: 120,
  Payment: 160,
  Source: 100,
  Status: 150,
  Actions: 130,
};
const CELL = "px-4 py-3.5 align-middle overflow-hidden";
const HEAD = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
// The actions column stays pinned to the right edge while the table scrolls sideways
const STICKY_ACTIONS =
  "sticky right-0 z-[1] bg-white shadow-[-10px_0_12px_-10px_rgba(16,24,40,0.18)] transition-colors group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800";

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

// Read-only here: the status changes from Options
const StatusPill = ({ status }: { status: OrderStatusType }) => (
  <span className={statusPillClass(status)}>
    <span className={`size-1.5 rounded-full ${toneOf(status).dot}`} aria-hidden="true" />
    {STATUS_LABELS[status] ?? status}
  </span>
);

const Actions = ({ order, canDelete, onDelete, onSticker, onStatus, onFraud }: { order: Order; canDelete: boolean; onDelete: (id: string) => void; onSticker: (id: string) => void; onStatus: (order: Order) => void; onFraud: (order: Order) => void }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-end gap-1.5">
      <OptionsMenu label={order.invoiceId ? `Actions for order ${order.invoiceId}` : "Actions"}>
        {(run) => (
          <>
            <OptionsMenuItem tone="view" icon={<FaEye className="size-3.5" />} onClick={run(() => navigate(`/orderdetails/${order._id}`))}>
              View Details
            </OptionsMenuItem>
            <OptionsMenuItem tone="edit" icon={<TbStatusChange className="size-4" />} onClick={run(() => onStatus(order))}>
              Change Status
            </OptionsMenuItem>
            <OptionsMenuItem icon={<TbShieldSearch className="size-4" />} onClick={run(() => onFraud(order))}>
              Fraud Check
            </OptionsMenuItem>
            <OptionsMenuSeparator />
            <OptionsMenuItem icon={<TbSticker2 className="size-4" />} onClick={run(() => onSticker(order._id))}>
              Print Sticker
            </OptionsMenuItem>
            <OptionsMenuItem icon={<IoIosPrint className="size-3.5" />} onClick={run(() => navigate(`/invoice/${order._id}`))}>
              Print Invoice
            </OptionsMenuItem>
            {canDelete && (
              <>
                <OptionsMenuSeparator />
                <OptionsMenuItem tone="danger" icon={<MdDelete className="size-4" />} onClick={run(() => onDelete(order._id))}>
                  Delete
                </OptionsMenuItem>
              </>
            )}
          </>
        )}
      </OptionsMenu>
    </div>
  );
};

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
  const [stickerId, setStickerId] = useState<string | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [fraudOrder, setFraudOrder] = useState<Order | null>(null);
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

  const emptyState = (
    <OrdersEmptyState
      filtered={Boolean(search) || channel !== "all" || payment !== "all"}
      onClear={() => {
        setSearch("");
        setChannel("all");
        setPayment("all");
      }}
    />
  );

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
      ) : isMobile && rows.length === 0 ? (
        emptyState
      ) : isMobile ? (
        <MobileCardList
          items={rows}
          getKey={(order) => order._id}
          renderCard={(order, index) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <InvoiceCell order={order} index={index} />
                <Amounts order={order} />
              </div>
              <ShippingInfo order={order} hideFraudCheck />
              <OrderItemStack items={order.items} expanded={expanded.has(order._id)} onToggle={() => toggle(order._id)} />
              {expanded.has(order._id) ? <OrderItemDetails items={order.items} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={order.orderStatus} />
                <PaymentPill method={order.paymentMethod} status={order.paymentStatus} />
                <ChannelTag channel={order.channel} source={order.orderFrom} />
              </div>
              <div className="border-t border-gray-100 pt-3 dark:border-white/[0.05]">
                <Actions order={order} canDelete={canDelete} onDelete={setDeleteId} onSticker={setStickerId} onStatus={setStatusOrder} onFraud={setFraudOrder} />
              </div>
            </div>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table className="w-full min-w-[1320px] table-fixed">
              <colgroup>
                {COLUMNS.map((column) => (
                  <col key={column} style={COLUMN_WIDTHS[column] ? { width: COLUMN_WIDTHS[column] } : undefined} />
                ))}
              </colgroup>
              <TableHeader className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.05] dark:bg-white/[0.02]">
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column}
                      isHeader
                      className={`${HEAD} ${column === "Amount" ? "!text-right" : column === "Actions" ? `!text-right ${STICKY_ACTIONS} !bg-gray-50 dark:!bg-gray-900` : ""}`}
                    >
                      {column}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-0 py-0" colSpan={COLUMNS.length}>
                      {emptyState}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((order, index) => (
                    <Fragment key={order._id}>
                      <TableRow className={`group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${expanded.has(order._id) ? "bg-gray-50 dark:bg-gray-800" : ""}`}>
                        <TableCell className={CELL}><SerialCell order={order} index={index} /></TableCell>
                        <TableCell className={CELL}><InvoiceCell order={order} index={index} /></TableCell>
                        <TableCell className={`${CELL} text-theme-sm`}><ShippingInfo order={order} hideFraudCheck /></TableCell>
                        <TableCell className={CELL}>
                          <OrderItemStack items={order.items} expanded={expanded.has(order._id)} onToggle={() => toggle(order._id)} />
                        </TableCell>
                        <TableCell className={CELL}><Amounts order={order} /></TableCell>
                        <TableCell className={CELL}><PaymentPill method={order.paymentMethod} status={order.paymentStatus} /></TableCell>
                        <TableCell className={CELL}><ChannelTag channel={order.channel} source={order.orderFrom} /></TableCell>
                        <TableCell className={CELL}><StatusPill status={order.orderStatus} /></TableCell>
                        <TableCell className={`${CELL} ${STICKY_ACTIONS} !overflow-visible`}><Actions order={order} canDelete={canDelete} onDelete={setDeleteId} onSticker={setStickerId} onStatus={setStatusOrder} onFraud={setFraudOrder} /></TableCell>
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

      <OrderStickerModal orderId={stickerId} onClose={() => setStickerId(null)} />
      {statusOrder && <OrderStatusModal order={statusOrder} onClose={() => setStatusOrder(null)} onChanged={changed} />}
      {fraudOrder && <FraudCheckModal order={fraudOrder} onClose={() => setFraudOrder(null)} />}

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
