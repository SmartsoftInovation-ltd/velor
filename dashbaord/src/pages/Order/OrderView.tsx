import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { FaArrowLeft, FaBoxOpen, FaCreditCard, FaTruck, FaUser, FaInfoCircle } from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import { TbSticker2 } from "react-icons/tb";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import { getApiErrorMessage } from "../../utils/apiError";
import OrderStatus from "../../components/tables/OrderTable/OrderStatus";
import { ChannelTag, PaymentPill } from "../../components/tables/OrderTable/orderUi";
import { Field, ItemsTable, Section, Totals } from "../../components/order/OrderViewParts";
import OrderStickerModal from "../../components/tables/OrderTable/OrderStickerModal";

const when = (date?: string | null) => (date ? moment(date).format("DD MMM YYYY, HH:mm") : undefined);
const SOFT = "shine inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-medium transition-all active:scale-95 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10";

/** Everything about one order: items and money, customer, payment, delivery and history */
const OrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stickerOpen, setStickerOpen] = useState(false);

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await axiosSecure.get(`/order/single-order/${id}`)).data.data,
    enabled: Boolean(id),
  });

  // A web order still waiting in the header bell is seen once it is opened here
  const queryClient = useQueryClient();
  const unseenWebOrder = order?.channel === "web" && order?.staffSeen === false;
  useEffect(() => {
    if (!unseenWebOrder || !id) return;
    axiosSecure
      .patch(`/order/web-notifications/${id}/seen`)
      .catch(() => undefined)
      .finally(() => queryClient.invalidateQueries({ queryKey: ["webOrderNotifications"] }));
  }, [unseenWebOrder, id, queryClient]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-28 rounded-2xl bg-gray-100 dark:bg-white/5" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-96 rounded-2xl bg-gray-100 lg:col-span-2 dark:bg-white/5" />
          <div className="h-96 rounded-2xl bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="py-24 text-center">
        <p className="mb-4 font-semibold text-error-500">{getApiErrorMessage(error, "Order not found")}</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/order-list")}>Back to orders</Button>
          <Button size="sm" onClick={() => refetch()} className="!bg-accent-500 hover:!bg-accent-600 !text-white">Try Again</Button>
        </div>
      </div>
    );
  }

  const ship = order.shippingInfo ?? {};
  const gateway = order.paymentGatewayData ?? {};
  const online = order.paymentMethod === "sslcommerz";

  return (
    <>
      <PageMeta title={`Order ${order.invoiceId ?? ""} · Baig Ecommerce Admin Dashboard`} description="Order details" />
      <PageBreadcrumb pageTitle="Order Details" className="mb-3" hideTitle />

      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold text-gray-900 dark:text-white">{order.invoiceId}</h1>
            {order.invoice?.invoiceSerialId ? (
              <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                {order.invoice.invoiceSerialId}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Placed {when(order.createdAt)} · {moment(order.createdAt).fromNow()}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <OrderStatus order={order} onChanged={() => refetch()} />
            <PaymentPill method={order.paymentMethod} status={order.paymentStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/order-list" className={SOFT}><FaArrowLeft className="size-3.5" /> Orders</Link>
          <button type="button" onClick={() => setStickerOpen(true)} className={SOFT}><TbSticker2 className="size-4" /> Sticker</button>
          <Link to={`/invoice/${order._id}`} className="shine inline-flex h-9 items-center gap-2 rounded bg-accent-500 px-3 text-sm font-semibold text-white transition-all hover:bg-accent-600 active:scale-95">
            <IoIosPrint className="size-4" /> Print invoice
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title={`Items · ${order.totalQuantity || order.items?.length || 0} units`} icon={<FaBoxOpen className="size-3.5" />}>
            <ItemsTable items={order.items} />
            <Totals
              subtotal={order.totalAmount}
              discount={order.discountAmount}
              couponCode={order.coupon?.code}
              delivery={order.deliveryCharge?.deliveryCharge ?? 0}
              deliveryName={order.deliveryCharge?.name}
              final={order.finalAmount}
            />
          </Section>

          <Section title="Payment" icon={<FaCreditCard className="size-3.5" />}>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Field label="Method" value={online ? "Online (SSLCommerz)" : "Cash on delivery"} />
              <Field label="Status" value={<PaymentPill method={order.paymentMethod} status={order.paymentStatus} />} />
              {online ? (
                <>
                  <Field label="Paid at" value={when(order.paidAt)} />
                  <Field label="Amount received" value={gateway.currency_amount ? `৳${gateway.currency_amount}` : undefined} />
                  <Field label="Bank transaction" value={order.transactionId} mono />
                  <Field label="Validation ID" value={order.valId} mono />
                  <Field label="Card / wallet" value={gateway.card_type} />
                  <Field label="Card number" value={gateway.card_no} mono />
                  <Field label="Risk" value={gateway.risk_title ? `${gateway.risk_title} (${gateway.risk_level})` : undefined} />
                  <Field label="Session key" value={order.sessionKey} mono />
                </>
              ) : null}
            </dl>
            {gateway.review ? (
              <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
                Held for review: {gateway.review}
              </p>
            ) : null}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Customer" icon={<FaUser className="size-3.5" />}>
            <dl>
              <Field label="Name" value={ship.fullName} />
              <Field label="Phone" value={ship.phone ? <a className="hover:text-accent-600" href={`tel:${ship.phone}`}>{ship.phone}</a> : undefined} mono />
              <Field label="Email" value={ship.email} />
              <Field label="Address" value={ship.address} />
              <Field label="City" value={ship.city} />
              <Field label="Postal code" value={ship.postalCode} />
              <Field label="Note" value={ship.note} />
              <Field label="Type" value={order.guestId ? "Guest checkout" : "Registered customer"} />
              {order.user ? <Field label="Account" value={order.user.email || order.user.phone || order.user.name} /> : null}
            </dl>
          </Section>

          <Section title="Delivery" icon={<FaTruck className="size-3.5" />}>
            <dl>
              <Field label="Option" value={order.deliveryCharge?.name} />
              <Field label="Charge" value={order.deliveryCharge ? `৳${order.deliveryCharge.deliveryCharge}` : undefined} />
              <Field label="Courier" value={order.courier?.name} />
              <Field label="Tracking ID" value={order.courier?.trackingId} mono />
              <Field label="Courier status" value={order.courier?.name ? order.courier?.status : undefined} />
            </dl>
          </Section>

          <Section title="Order info" icon={<FaInfoCircle className="size-3.5" />}>
            <dl>
              <Field label="Channel" value={<ChannelTag channel={order.channel} />} />
              <Field label="Source" value={order.orderFrom} />
              <Field label="Placed by" value={order.placedBy?.name || order.placedBy?.email || (order.channel === "web" ? "Shopper (storefront)" : undefined)} />
              <Field label="Follow-up" value={order.followUp?.name || order.followUp?.email} />
              <Field label="Invoice serial" value={order.invoice?.invoiceSerialId} mono />
              <Field label="Created" value={when(order.createdAt)} />
              <Field label="Last updated" value={when(order.updatedAt)} />
            </dl>
          </Section>
        </div>
      </div>

      <OrderStickerModal orderId={stickerOpen ? order._id : null} onClose={() => setStickerOpen(false)} />
    </>
  );
};

export default OrderView;
