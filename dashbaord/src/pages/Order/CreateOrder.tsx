import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiCreditCard,
  FiDollarSign,
  FiMessageCircle,
  FiMinus,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiTrash2,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { HiOutlineReceiptPercent } from "react-icons/hi2";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import {
  ConsoleHeader,
  EmptyState,
  Field,
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  Select,
} from "../PlatformConsole/ui";

/**
 * Taking an order at the counter — over the phone, or for someone standing
 * there.
 *
 * The totals shown here are never computed in the browser. Every change asks
 * the server to price the order, so the figure on screen is the figure that
 * will be charged and stored; a rounding rule or a discount cap can never drift
 * between the two. The same endpoint prices storefront orders, so a counter
 * sale and a web sale of the same basket come to the same number.
 */

/**
 * A search hit is either a whole product or a standalone variant.
 *
 * A scanned barcode usually matches the variant, because that is where barcodes
 * live. A variant carries no `stock` or `name` of its own — its quantity is
 * `stockVariant` and its parent's name sits on the embedded `product` — so the
 * two shapes have to be read differently or a variant renders as "0 in stock".
 */
interface SearchHit {
  _id: string;
  name?: string;
  retailPrice?: number;
  stock?: number;
  sku?: string;
  barCode?: string;
  // Variant-only
  resultType?: "product" | "variant";
  variantName?: string;
  stockVariant?: number;
  variantType?: string;
  product?: { _id?: string; name?: string; retailPrice?: number };
}

interface CartLine {
  // Exactly one of these identifies the line, matching what the API expects
  productId?: string;
  variantId?: string;
  key: string;
  name: string;
  retailPrice: number;
  quantity: number;
  stock: number;
}

interface DeliveryOption {
  _id: string;
  name: string;
  deliveryCharge: number;
}

/**
 * Where the customer came from — Messenger, WhatsApp, over the phone. The shop
 * keeps its own list, so the options are fetched rather than hard-coded and
 * staff can add one without leaving the order they are taking.
 */
interface OrderSource {
  _id: string;
  name: string;
}

interface Quote {
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  finalAmount: number;
  totalQuantity: number;
  couponError: string | null;
}

const money = (value: number) => `৳${value.toLocaleString("en-BD", { minimumFractionDigits: 0 })}`;

/**
 * A scanned barcode goes to the dedicated `barCode` query so the backend matches
 * the field directly instead of running it through the name regex. Scanners
 * emit 8–14 digits, which is what distinguishes a scan from someone typing.
 */
const searchParam = (term: string) => (/^\d{8,14}$/.test(term) ? "barCode" : "name");

// A hit is a standalone variant, not a product, when it has no variantType of
// its own but does carry variant-only fields.
const isVariant = (hit: SearchHit) =>
  hit.resultType === "variant" || (!hit.variantType && (hit.stockVariant !== undefined || !!hit.variantName));

// One shape for the list and the basket, whichever kind of document came back
const describe = (hit: SearchHit) =>
  isVariant(hit)
    ? {
        key: `v:${hit._id}`,
        variantId: hit._id,
        name: [hit.product?.name, hit.variantName].filter(Boolean).join(" — ") || hit.variantName || "Variant",
        retailPrice: hit.retailPrice ?? hit.product?.retailPrice ?? 0,
        stock: hit.stockVariant ?? 0,
      }
    : {
        key: `p:${hit._id}`,
        productId: hit._id,
        name: hit.name ?? "Product",
        retailPrice: hit.retailPrice ?? 0,
        stock: hit.stock ?? 0,
      };

const emptyCustomer = { fullName: "", phone: "", address: "" };

const PAYMENT_METHODS = [
  { value: "cod" as const, label: "Cash on delivery", icon: <FiDollarSign className="size-4" /> },
  { value: "sslcommerz" as const, label: "Online", icon: <FiCreditCard className="size-4" /> },
];

const CreateOrder = () => {
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [couponCode, setCouponCode] = useState("");
  const [deliveryChargeId, setDeliveryChargeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "sslcommerz">("cod");

  const [orderFrom, setOrderFrom] = useState("");
  const [sources, setSources] = useState<OrderSource[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [savingSource, setSavingSource] = useState(false);

  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    axiosSecure
      .get("/delivery-charge/get-delivery-charge")
      .then((res) => setDeliveryOptions(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setDeliveryOptions([]));

    axiosSecure
      .get("/order-source")
      .then((res) => setSources(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setSources([]));
  }, []);

  const addSource = async () => {
    const name = newSource.trim();
    if (!name) return;
    setSavingSource(true);
    try {
      const res = await axiosSecure.post("/order-source", { name });
      const created: OrderSource = res.data?.data;
      setSources((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      // Selected straight away: it was added to be used on this order.
      setOrderFrom(created.name);
      setNewSource("");
      setAddingSource(false);
      toast.success(`${created.name} added`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not add that option";
      toast.error(message);
    } finally {
      setSavingSource(false);
    }
  };

  // Debounced so typing a product name does not fire a request per keystroke
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = search.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Matches both products and variants, by name or by scanned barcode
        const res = await axiosSecure.get("/product/search-product", {
          params: { [searchParam(term)]: term },
        });
        const found = res.data?.data?.products ?? [];
        setHits(Array.isArray(found) ? found.slice(0, 8) : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const addLine = (hit: SearchHit) => {
    const described = describe(hit);
    setLines((current) => {
      // Scanning the same barcode twice adds one more, rather than a second row
      const existing = current.find((line) => line.key === described.key);
      if (existing) {
        return current.map((line) =>
          line.key === described.key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { ...described, quantity: 1 }];
    });
    setSearch("");
    setHits([]);
  };

  const setQuantity = (key: string, quantity: number) =>
    setLines((current) =>
      quantity < 1
        ? current.filter((line) => line.key !== key)
        : current.map((line) => (line.key === key ? { ...line, quantity } : line)),
    );

  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key));

  const payload = useMemo(
    () => ({
      items: lines.map((line) =>
        line.variantId
          ? { variantId: line.variantId, quantity: line.quantity }
          : { productId: line.productId, quantity: line.quantity },
      ),
      couponCode: couponCode.trim() || undefined,
      deliveryChargeId: deliveryChargeId || undefined,
    }),
    [lines, couponCode, deliveryChargeId],
  );

  /**
   * Re-prices on every change. The server is the only thing that decides what
   * the order costs, so the screen asks rather than calculating.
   */
  const refreshQuote = useCallback(async () => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }
    try {
      const res = await axiosSecure.post("/order/pos/quote", payload);
      setQuote(res.data?.data ?? null);
    } catch {
      setQuote(null);
    }
  }, [lines.length, payload]);

  useEffect(() => {
    const timer = setTimeout(refreshQuote, 250);
    return () => clearTimeout(timer);
  }, [refreshQuote]);

  const canPlace = lines.length > 0 && customer.fullName.trim() && customer.phone.trim() && !placing;

  const placeOrder = async () => {
    if (!canPlace) return;
    setPlacing(true);
    try {
      const res = await axiosSecure.post("/order/pos", {
        ...payload,
        shippingInfo: customer,
        paymentMethod,
        orderFrom,
      });
      const order = res.data?.data?.order;
      toast.success(`Order ${order?.invoiceId ?? ""} placed — ${money(order?.finalAmount ?? 0)}`);

      setLines([]);
      setCustomer(emptyCustomer);
      setCouponCode("");
      setDeliveryChargeId("");
      setOrderFrom("");
      setQuote(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not place the order";
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <PageMeta title="Create Order" description="Take an order at the counter or over the phone" />

      <ConsoleHeader
        crumbs={[{ label: "Orders", to: "/order-list" }, { label: "Create order" }]}
        title="Create order"
        subtitle="Take an order over the phone or for a walk-in customer. Prices come from your catalogue."
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Products and the basket */}
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Add products</h2>
            </div>
            <div className="relative px-5 py-4">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Scan a barcode, or search by name…"
                  aria-label="Scan a barcode or search products"
                  className={`${inputClass} pl-10`}
                />
              </div>

              {search.trim().length >= 2 && (
                <div className="absolute inset-x-5 z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                  {searching && <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>}
                  {!searching && hits.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-500">No product found</p>
                  )}
                  {hits.map((hit) => {
                    const row = describe(hit);
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => addLine(hit)}
                        disabled={row.stock < 1}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
                            {row.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {row.stock > 0 ? `Stock ${row.stock}` : "Out of stock"}
                            {hit.barCode ? ` · ${hit.barCode}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums dark:text-white/90">
                          {money(row.retailPrice)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Basket{lines.length > 0 && <span className="ml-1.5 text-gray-400">({lines.length})</span>}
              </h2>
            </div>

            {lines.length === 0 ? (
              <EmptyState
                icon={<FiShoppingCart />}
                title="Nothing added yet"
                text="Search for a product above to start building this order."
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {lines.map((line) => (
                  <li key={line.key} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{line.name}</p>
                      <p className="text-xs text-gray-500">{money(line.retailPrice)} each</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Reduce ${line.name}`}
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
                      >
                        <FiMinus className="size-3.5" />
                      </button>
                      <input
                        value={line.quantity}
                        onChange={(event) => setQuantity(line.key, Number(event.target.value) || 1)}
                        aria-label={`Quantity for ${line.name}`}
                        className="h-8 w-12 rounded-lg border border-gray-200 text-center text-sm tabular-nums dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                      />
                      <button
                        type="button"
                        aria-label={`Add one ${line.name}`}
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
                      >
                        <FiPlus className="size-3.5" />
                      </button>
                    </div>

                    <p className="w-20 shrink-0 text-right text-sm font-semibold text-gray-900 tabular-nums dark:text-white/90">
                      {money(line.retailPrice * line.quantity)}
                    </p>

                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => removeLine(line.key)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-error-500 transition hover:bg-error-50 dark:hover:bg-error-500/15"
                    >
                      <FiTrash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Customer, discounts and the total */}
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <FiUser className="size-4 text-accent-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Customer</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Field id="pos-name" label="Name">
                <input
                  id="pos-name"
                  value={customer.fullName}
                  onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })}
                  placeholder="Customer name"
                  className={inputClass}
                />
              </Field>
              <Field id="pos-phone" label="Phone">
                <input
                  id="pos-phone"
                  value={customer.phone}
                  onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                  placeholder="01XXXXXXXXX"
                  className={inputClass}
                />
              </Field>
              <Field id="pos-address" label="Address" hint="Optional for a walk-in customer">
                <input
                  id="pos-address"
                  value={customer.address}
                  onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                  placeholder="Delivery address"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <HiOutlineReceiptPercent className="size-4 text-accent-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Discount & delivery</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Field id="pos-coupon" label="Coupon code">
                <input
                  id="pos-coupon"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="SAVE10"
                  className={inputClass}
                />
              </Field>
              {quote?.couponError && (
                <p role="status" className="rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
                  {quote.couponError}
                </p>
              )}

              <Field id="pos-delivery" label="Delivery">
                <Select
                  id="pos-delivery"
                  icon={<FiTruck />}
                  value={deliveryChargeId}
                  onChange={setDeliveryChargeId}
                  options={[
                    { value: "", label: "No delivery charge" },
                    ...deliveryOptions.map((option) => ({
                      value: option._id,
                      label: option.name,
                      meta: money(option.deliveryCharge),
                    })),
                  ]}
                />
              </Field>

              {/* Two choices, so they are both shown rather than hidden behind a menu */}
              <Field id="pos-payment" label="Payment">
                {/* A label's htmlFor does not reach a div, so the group names itself */}
                <div role="radiogroup" aria-label="Payment" className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const active = paymentMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                          active
                            ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
                        }`}
                      >
                        {method.icon}
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field id="pos-order-from" label="Order from" hint="Where the customer reached you">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      id="pos-order-from"
                      icon={<FiMessageCircle />}
                      value={orderFrom}
                      onChange={setOrderFrom}
                      options={[
                        { value: "", label: "Not recorded" },
                        ...sources.map((source) => ({ value: source.name, label: source.name })),
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddingSource((open) => !open)}
                    aria-label={addingSource ? "Cancel adding an order source" : "Add an order source"}
                    aria-expanded={addingSource}
                    title="Add an order source"
                    className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition ${
                      addingSource
                        ? "border-accent-500 bg-accent-50 text-accent-600 dark:bg-accent-500/15"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/5"
                    }`}
                  >
                    <FiPlus className={`size-4 transition-transform ${addingSource ? "rotate-45" : ""}`} />
                  </button>
                </div>
              </Field>

              {addingSource && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-white/[0.02]">
                  <label htmlFor="pos-new-source" className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    New order source
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="pos-new-source"
                      value={newSource}
                      onChange={(event) => setNewSource(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSource();
                        }
                        if (event.key === "Escape") setAddingSource(false);
                      }}
                      placeholder="e.g. TikTok"
                      autoFocus
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addSource}
                      disabled={!newSource.trim() || savingSource}
                      className={`${primaryButtonClass} shrink-0`}
                    >
                      {savingSource ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Summary</h2>
            </div>
            <div className="space-y-2.5 px-5 py-4 text-sm">
              {/* Every figure here came from the server, not from this screen */}
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal{quote ? ` (${quote.totalQuantity} items)` : ""}</span>
                <span className="tabular-nums">{money(quote?.subtotal ?? 0)}</span>
              </div>
              {(quote?.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-accent-600 dark:text-accent-400">
                  <span>Discount</span>
                  <span className="tabular-nums">−{money(quote?.discountAmount ?? 0)}</span>
                </div>
              )}
              {(quote?.deliveryCharge ?? 0) > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Delivery</span>
                  <span className="tabular-nums">{money(quote?.deliveryCharge ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-white/90">
                <span>Total</span>
                <span className="tabular-nums">{money(quote?.finalAmount ?? 0)}</span>
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setLines([]);
                  setCustomer(emptyCustomer);
                  setCouponCode("");
                  setDeliveryChargeId("");
                  setOrderFrom("");
                }}
                className={secondaryButtonClass}
                disabled={lines.length === 0 && !customer.fullName}
              >
                Clear
              </button>
              <button type="button" onClick={placeOrder} disabled={!canPlace} className={`${primaryButtonClass} flex-1`}>
                {placing ? "Placing…" : `Place order ${quote ? money(quote.finalAmount) : ""}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateOrder;
