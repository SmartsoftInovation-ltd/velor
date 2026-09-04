import { useState, useRef, useEffect, useCallback } from "react";
import type { IconType } from "react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { IoPersonAddSharp } from "react-icons/io5";
import {
    FaCartPlus,
    FaTimes,
    FaUserTie,
    FaFileInvoiceDollar,
    FaCheckCircle,
    FaRegClock,
    FaRegEdit,
} from "react-icons/fa";
import {
    MdOutlineQrCodeScanner,
    MdDelete,
    MdSms,
    MdOutlineStickyNote2,
} from "react-icons/md";
import Input from "../form/input/InputField";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { Modal } from "../ui/modal";
import DatePicker from "../form/date-picker";
import useDebouncedCallback from "../../hooks/useDebouncedCallback";
import { invalidateStockQueries } from "../../utils/invalidateStock";
import QuickCreateCustomerModal from "../customer/QuickCreateCustomerModal";
import AccountSelect from "./AccountSelect";
import SalesEmptyState from "./SalesEmptyState";
import PickerSelect from "./PickerSelect";
// Aliased: this file already has a local clearDraft() that resets the item
// entry panel, which is a different thing from the persisted form draft.
import {
    useFormDraft,
    loadDraft,
    clearDraft as clearStoredDraft,
} from "../../hooks/useFormDraft";
import { showApiError } from "../../utils/apiError";

// The subset of the form worth surviving a reload: what the user typed or
// picked. Fetched lists, the draft item panel and open/closed UI state are
// deliberately excluded.
interface SalesDraft {
    [key: string]: unknown;
    date: string;
    selectedCustomerId: string | null;
    customerName: string;
    mobile: string;
    email: string;
    address: string;
    tableProducts: any[];
    discount: string;
    vat: string;
    delivery: string;
    labour: string;
    lessTaka: string;
    paid: string;
    salesman: string;
    remarks: string;
}
// Matches the backend's isLikelyCode check (sales.controller.js) — a scanned
// barcode/SKU/QR value is a plain alphanumeric code, not a free-text name search.
const isLikelyCode = (val: string) => /^[0-9A-Za-z\-_.]{4,}$/.test(val.trim());

// Units per group/pack, e.g. a "Packet" of 6. Falls back to the legacy Dozen
// guess for records saved before groupUnitQuantity existed; 1 means loose units.
const packSizeOf = (product: { groupUnitQuantity?: number; groupUnit?: string } | null): number =>
    product?.groupUnitQuantity || (product?.groupUnit === "Dozen" ? 12 : 1);

// Final quantity = (packs x pack size) + loose units.
const totalUnits = (row: { qty?: number; groupQty?: number; groupUnitQuantity?: number }): number =>
    (row.qty || 0) + (row.groupQty || 0) * (row.groupUnitQuantity || 1);

interface Customer {
    id: string;
    fullName: string;
    mobileNumber: string;
    emailAddress?: string;
    presentAddress?: string;
    openingDues?: number;
    customerType?: { customerType?: string };
    regularDiscountPercent?: number;
    dueLimit?: number;
}

interface Employee {
    _id: string;
    fullName: string;
    employeeId: string;
    designation?: {
        _id: string;
        name: string;
    };
}

const invoiceStatuses = ["Complete", "Pending", "Draft"];
const invoiceStatusMeta: Record<string, { icon: IconType; tone: string }> = {
    Complete: {
        icon: FaCheckCircle,
        tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    Pending: {
        icon: FaRegClock,
        tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
    Draft: {
        icon: FaRegEdit,
        tone: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
    },
};
const inputCls =
    "border border-gray-300 dark:border-gray-600 rounded-md text-xs h-7 px-2 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none w-full box-border transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";
const readonlyInputCls =
    "border border-gray-200 dark:border-gray-700 rounded-md text-xs h-7 px-2 bg-gray-50 dark:bg-gray-700 outline-none w-full box-border text-gray-700 dark:text-gray-200 font-semibold";
function RightRow({ label, children, emphasis }: { label: string; children: React.ReactNode; emphasis?: boolean }) {
    return (
        <div className={`flex items-center gap-2 mb-1.5 ${emphasis ? "py-0.5" : ""}`}>
            <span className={`text-[11px] font-bold uppercase w-28 flex-shrink-0 tracking-wide ${emphasis ? "text-teal-700" : "text-gray-500 dark:text-gray-400"}`}>
                {label}
            </span>
            {children}
        </div>
    );
}

interface EditSale {
    _id: string;
    invoiceNumber?: string;
    date?: string;
    deliveryDate?: string;
    customerType?: any;
    searchItem?: any[];
    salesMen?: { _id?: string } | string | null;
    discountPercent?: number;
    vatPercent?: number;
    deliveryCost?: number;
    labourCost?: number;
    lessTaka?: number;
    customerAdvancePaymentAdjust?: number;
    paid?: number;
    previousDue?: number;
    invoiceStatus?: string;
    remark?: string;
    sendSms?: boolean;
    paymentMethod?: {
        singlePayment?: { amount?: number; paymentTo?: { _id?: string } | string; remark?: string } | null;
        multiplePayment?: { amount?: number; paymentTo?: { _id?: string } | string; remark?: string }[];
    };
}

export default function CreateWholeSalesForm({
    editSale,
    onUpdated,
    orderMode = false,
}: {
    editSale?: EditSale;
    onUpdated?: () => void;
    // Sale-order mode: the sale is saved as a pending order (stock is not
    // deducted server-side until it's completed) and marked as a wholesaleorder.
    orderMode?: boolean;
} = {}) {
    const isEdit = !!editSale;
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    // Drafts are kept per mode so a wholesale sale and a wholesale order do
    // not overwrite each other. Edit mode never persists — the form is seeded
    // from a saved sale there, and a stale draft would silently replace it.
    const draftKey = orderMode ? "whole-order" : "whole-sale";
    const draftEnabled = !isEdit;
    const draft = draftEnabled ? loadDraft<SalesDraft>(draftKey) : null;

    const [date, setDate] = useState(
        () => draft?.date || new Date().toISOString().split("T")[0],
    );
    const [deliveryDate, setDeliveryDate] = useState("");
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(draft?.selectedCustomerId ?? null);
    const [customerName, setCustomerName] = useState(draft?.customerName || "");
    const [mobile, setMobile] = useState(draft?.mobile || "");
    const [email, setEmail] = useState(draft?.email || "");
    const [address, setAddress] = useState(draft?.address || "");
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const customerDropdownRef = useRef<HTMLDivElement>(null);
    const [showMultiplePayModal, setShowMultiplePayModal] = useState(false);
    const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [draftProduct, setDraftProduct] = useState<any>(null);
    const [draftGroupQty, setDraftGroupQty] = useState("");
    const [draftQty, setDraftQty] = useState("");
    const [draftPrice, setDraftPrice] = useState("");
    const [tableProducts, setTableProducts] = useState<any[]>(draft?.tableProducts || []);
    // Marks the row just added so it can play the row-in animation, then
    // clears so the animation does not replay on later re-renders.
    const [newRowId, setNewRowId] = useState<string | null>(null);
    const [discount, setDiscount] = useState(draft?.discount || "");
    const [vat, setVat] = useState(draft?.vat || "");
    const [delivery, setDelivery] = useState(draft?.delivery || "");
    const [labour, setLabour] = useState(draft?.labour || "");
    const [lessTaka, setLessTaka] = useState(draft?.lessTaka || "");
    const [customerAdvance, setCustomerAdvance] = useState(false);
    const [customerAdvanceAmount, setCustomerAdvanceAmount] = useState(0);
    const [paid, setPaid] = useState(draft?.paid || "");
    const [prevDues, setPrevDues] = useState(0);
    // 0 = no limit configured for this customer, so no ceiling is enforced.
    const [dueLimit, setDueLimit] = useState(0);
    // The logged-in seller's max allowed discount %. 0 = no limit (mirrors dueLimit).
    const [discountLimit, setDiscountLimit] = useState(0);
    const [employeeList, setEmployeeList] = useState<Employee[]>([]);
    const [salesman, setSalesman] = useState(draft?.salesman || "");
    const [invoiceStatus, setInvoiceStatus] = useState(
        orderMode ? "Pending" : "Complete",
    );
    const [remarks, setRemarks] = useState(draft?.remarks || "");
    const [sendSms, setSendSms] = useState(true);
    const [paymentType, setPaymentType] = useState<"single" | "multiple">("single");
    const [singlePayment, setSinglePayment] = useState({ amount: "", paymentTo: "", remark: "" });
    const [multiplePayments, setMultiplePayments] = useState([{ amount: "", paymentTo: "", remark: "" }]);
    const [tempMultiplePayments, setTempMultiplePayments] = useState([{ amount: "", paymentTo: "", remark: "" }]);
    const [accountList, setAccountList] = useState<{ _id: string; name: string; balance?: number }[]>([]);
    const [multiPayError, setMultiPayError] = useState("");

    // Mirror the in-progress sale to sessionStorage so a reload does not lose it.
    useFormDraft<SalesDraft>(
        draftKey,
        {
            date,
            selectedCustomerId,
            customerName,
            mobile,
            email,
            address,
            tableProducts,
            discount,
            vat,
            delivery,
            labour,
            lessTaka,
            paid,
            salesman,
            remarks,
        },
        draftEnabled,
    );
    // Cash account, remembered so resetForm can restore it as the payment default.
    const defaultAccountId = useRef("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        axiosSecure
            .get("/customer/get-customers")
            .then((res) => setCustomerList(res?.data?.data?.customers || []))
            .catch((error) => showApiError(error, "Failed to load customers."));
    }, []);

    // Load the logged-in seller's discount ceiling. getme returns the full user,
    // so discountLimit comes with it.
    useEffect(() => {
        axiosSecure
            .get("/auth/getme")
            .then((res) => {
                setDiscountLimit(Number(res?.data?.data?.discountLimit || 0));
            })
            .catch(() => {
                // Non-fatal: leaving limit at 0 (no ceiling) keeps the POS usable.
            });
    }, []);

    useEffect(() => {
        axiosSecure
            .get("/employee/get-employee")
            .then((res) => {
                const allEmployees: Employee[] = res?.data?.data?.employees || [];
                const salesEmployees = allEmployees.filter((emp) =>
                    emp?.designation?.name?.toLowerCase().includes("sales")
                );
                setEmployeeList(salesEmployees);
            })
            .catch((error) => showApiError(error, "Failed to load employees."));
        axiosSecure
            .get("/account/all-account")
            .then((res) => {
                const accounts = res?.data?.data?.accounts || [];
                setAccountList(accounts);
                const cashAccount = accounts.find((a: any) => a.name.toLowerCase().includes("cash"));
                if (cashAccount) {
                    defaultAccountId.current = cashAccount._id;
                    setSinglePayment((prev) => ({ ...prev, paymentTo: cashAccount._id }));
                }
            })
            .catch((error) => showApiError(error, "Failed to load accounts."));
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
                setCustomerDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Barcode scanner focus management ────────────────────────────────────
    // A USB barcode scanner behaves like a keyboard: it only "types" into
    // whichever element currently has focus. Keep the search box focused by
    // default so scanning works without the cashier clicking into it first.
    const focusSearchInput = useCallback(() => {
        searchInputRef.current?.focus();
    }, []);

    useEffect(() => {
        focusSearchInput();
    }, [focusSearchInput]);

    const handleSearchBlur = () => {
        // Only auto-restore focus if the user didn't intentionally focus another
        // form control (typing a name, entering qty, clicking Add, etc.) —
        // otherwise this would make every other field on the page unusable.
        window.setTimeout(() => {
            const active = document.activeElement;
            const isFormField =
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement ||
                active instanceof HTMLSelectElement ||
                active instanceof HTMLButtonElement;
            if (!isFormField) {
                focusSearchInput();
            }
        }, 150);
    };

    // Walking is the default customer for a counter sale.
    const [isWalking, setIsWalking] = useState(true);

    // Auto-sync single pay amount with PAID field
    useEffect(() => {
        if (paymentType === "single") {
            setSinglePayment((prev) => ({ ...prev, amount: paid }));
        }
    }, [paid, paymentType]);

    const handleWalkingSelect = () => {
        setIsWalking(true);
        setSelectedCustomerId(null);
        setCustomerName("");
        setMobile("");
        setEmail("");
        setAddress("");
        setPrevDues(0);
        setDueLimit(0);
        setDiscount("");
        setCustomerDropdownOpen(false);
        setCustomerSearch("");
    };

    const handleCustomerSelect = (customer: Customer) => {
        setIsWalking(false);
        setSelectedCustomerId(customer.id);
        setCustomerName(customer.fullName);
        setMobile(customer.mobileNumber);
        setEmail(customer.emailAddress || "");
        setAddress(customer.presentAddress || "");
        setPrevDues(customer.openingDues ?? 0);
        setDueLimit(customer.dueLimit ?? 0);
        setDiscount(customer.regularDiscountPercent?.toString() || "");
        setCustomerDropdownOpen(false);
        setCustomerSearch("");
    };

    const listedCustomers = customerList?.filter(
        (c) => c.customerType?.customerType?.toLowerCase() !== "walking"
    );

    const filterCustomers = (list: Customer[]) =>
        list.filter(
            (c) =>
                c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.mobileNumber.includes(customerSearch)
        );

    const handleCustomerAdvanceToggle = async (checked: boolean) => {
        setCustomerAdvance(checked);
        console.log("CAA toggle | checked:", checked, "| selectedCustomerId:", selectedCustomerId);
        if (checked && selectedCustomerId) {
            try {
                const res = await axiosSecure.get(`/customer/get-customer-advance-payment-reviced?customer=${selectedCustomerId}`);
                console.log("CAA API response:", res.data);
                const balance = res.data.data?.customerAdvancePayment?.balance;
                console.log("balance value:", balance);
                setCustomerAdvanceAmount(balance || 0);
            } catch (err) {
                console.error("CAA fetch error:", err);
                showApiError(err, "Failed to load advance payment.");
                setCustomerAdvanceAmount(0);
            }
        } else {
            setCustomerAdvanceAmount(0);
        }
    };

    // Prefill every input from the sale being edited. Totals stay derived, so
    // only the raw inputs are seeded here. The stored item quantity is the
    // pack-expanded total, so the loose qty is recovered by subtracting the
    // groups back out.
    useEffect(() => {
        if (!editSale) return;
        const s = editSale;

        if (s.date) setDate(new Date(s.date).toISOString().split("T")[0]);
        if (s.deliveryDate)
          setDeliveryDate(new Date(s.deliveryDate).toISOString().split("T")[0]);

        const ct = s.customerType;
        if (ct?.type === "listed") {
            setIsWalking(false);
            setSelectedCustomerId(ct.customerId?._id || ct.customerId || null);
            // The dropdown button shows `${customerName} - ${mobile}` for a
            // listed customer, so seed those or it reads " - ".
            setCustomerName(ct.customerId?.fullName || "");
            setMobile(ct.customerId?.mobileNumber || "");
        } else {
            setIsWalking(true);
            setCustomerName(ct?.walking?.customerName || "");
            setMobile(ct?.walking?.mobileNumber || "");
            setEmail(ct?.walking?.email || "");
            setAddress(ct?.walking?.address || "");
        }

        setTableProducts(
            (s.searchItem || []).map((it: any) => {
                const variant = it.variantId;
                const product = it.productId;
                const packSize = packSizeOf(variant || product);
                const groupQty = it.groupQuantity || 0;
                const looseQty = Math.max(0, (it.quantity || 0) - groupQty * packSize);
                return {
                    id: variant?._id || product?._id || it.barcode || Math.random().toString(36),
                    productId: it.productId?._id ?? it.productId ?? null,
                    variantId: it.variantId?._id ?? it.variantId ?? null,
                    barcode: it.barcode,
                    name: it.productDescription,
                    color: it.color,
                    size: it.size,
                    stock: variant?.stockVariant ?? product?.stock ?? 0,
                    qty: looseQty,
                    groupQty,
                    groupUnit: variant?.groupUnit || product?.groupUnit || "",
                    groupUnitQuantity: packSize,
                    unit: it.unit || "",
                    salesRate: it.salesRate ?? 0,
                    dis: it.discount ?? 0,
                    // Read back from the sale rather than assumed. Sales saved
                    // before discountType existed have no value, and "amount"
                    // is the right fallback for them — it is how they were
                    // being read all along, so their totals stay unchanged.
                    disType: it.discountType === "percent" ? "percent" : "amount",
                    // A discount that comes from the product itself stays
                    // locked when the sale is edited, exactly as it is when the
                    // item is first added. Leaving this false let a seller
                    // overwrite the product's own mandated discount simply by
                    // reopening the sale.
                    isDiscountReadOnly: !!(variant?.discount || product?.discount),
                };
            }),
        );

        const salesmanId =
            typeof s.salesMen === "object" ? s.salesMen?._id : s.salesMen;
        setSalesman(salesmanId || "");

        setDiscount(s.discountPercent ? String(s.discountPercent) : "");
        setVat(s.vatPercent ? String(s.vatPercent) : "");
        setDelivery(s.deliveryCost ? String(s.deliveryCost) : "");
        setLabour(s.labourCost ? String(s.labourCost) : "");
        setLessTaka(s.lessTaka ? String(s.lessTaka) : "");
        setPaid(s.paid != null ? String(s.paid) : "");
        setPrevDues(s.previousDue || 0);
        setInvoiceStatus(
            s.invoiceStatus
                ? s.invoiceStatus.charAt(0).toUpperCase() + s.invoiceStatus.slice(1)
                : "Complete",
        );
        setRemarks(s.remark || "");
        setSendSms(!!s.sendSms);

        if (s.customerAdvancePaymentAdjust) {
            setCustomerAdvance(true);
            setCustomerAdvanceAmount(s.customerAdvancePaymentAdjust);
        }

        const single = s.paymentMethod?.singlePayment;
        const multiple = s.paymentMethod?.multiplePayment || [];
        const accId = (p: any) =>
            typeof p?.paymentTo === "object" ? p.paymentTo?._id : p?.paymentTo;
        if (multiple.length > 0) {
            setPaymentType("multiple");
            setMultiplePayments(
                multiple.map((mp: any) => ({
                    amount: mp.amount != null ? String(mp.amount) : "",
                    paymentTo: accId(mp) || "",
                    remark: mp.remark || "",
                })),
            );
        } else if (single) {
            setPaymentType("single");
            setSinglePayment({
                amount: single.amount != null ? String(single.amount) : "",
                paymentTo: accId(single) || "",
                remark: single.remark || "",
            });
        }
        // Seed once from the fetched sale; later edits are the user's own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editSale]);

    // Gross line value, before any item-level discount. Kept separate because
    // the seller's discount-limit check measures discounts as a % of gross.
    const grossTotal = tableProducts.reduce(
        (sum, p) => sum + p.salesRate * totalUnits(p),
        0,
    );
    // What the rows actually add up to. Each row is rounded exactly as the
    // table renders it, so the invoice total always equals the sum of the
    // visible SUB TOTAL cells rather than a separately-rounded figure.
    // Money keeps 2 decimals everywhere — never rounded to whole taka, so the
    // displayed figure always matches the exact arithmetic.
    const money = (n: number): number =>
        Math.round((Number(n) || 0) * 100) / 100;

    const subTotal = tableProducts.reduce((sum, p) => {
        const q = totalUnits(p);
        return (
            sum +
            money(
                p.disType === "amount"
                    ? (p.salesRate - p.dis) * q
                    : p.salesRate * q * (1 - p.dis / 100),
            )
        );
    }, 0);
    const discountAmt = discount ? (subTotal * parseFloat(discount)) / 100 : 0;
    const vatAmt = vat ? ((subTotal - discountAmt) * parseFloat(vat)) / 100 : 0;
    const total = subTotal;
    const payable =
        subTotal -
        discountAmt +
        vatAmt +
        (parseFloat(delivery) || 0) +
        (parseFloat(labour) || 0) -
        (parseFloat(lessTaka) || 0) -
        (customerAdvance ? customerAdvanceAmount : 0);
    const change = Math.max(0, (parseFloat(paid) || 0) - payable);
    const presDues = Math.max(0, payable - (parseFloat(paid) || 0));
    const balance = presDues + prevDues;
    // Walking customers have no account to carry a due, and dueLimit 0 means
    // no limit was set for this customer.
    const isDueLimitExceeded = !isWalking && dueLimit > 0 && balance > dueLimit;

    // ── Seller discount-limit guard ─────────────────────────────────────────
    // A product/variant that already carries its own discount marks its row
    // isDiscountReadOnly. When any such item is in the cart, the invoice-level
    // discount and less-taka fields are locked so the seller can't stack a
    // second discount on top of the product's own (double discount).
    const hasItemDiscount = tableProducts.some(
        (p) => p.isDiscountReadOnly || Number(p.dis) > 0,
    );

    // Discount and less-taka are mutually exclusive: giving one locks the other,
    // so a seller can't stack two invoice-level discounts. A product-level
    // discount (hasItemDiscount) locks both.
    const discountLocked = hasItemDiscount || (parseFloat(lessTaka) || 0) > 0;
    const lessTakaLocked = hasItemDiscount || (parseFloat(discount) || 0) > 0;

    // The invoice discount % can never be typed above the seller's own limit.
    // 0 = no limit. Item-level product discounts are separate (they lock this
    // field entirely via hasItemDiscount instead of being summed in here).
    const handleDiscountChange = (raw: string) => {
        if (raw === "") return setDiscount("");
        let n = parseFloat(raw);
        if (isNaN(n)) return;
        if (n < 0) n = 0;
        const ceiling = discountLimit > 0 ? discountLimit : 100;
        if (n > ceiling) n = ceiling;
        setDiscount(String(n));
    };

    // Total discount given, as a % of the gross line value, combining item-level
    // discountLimit caps. 0 gross or 0 limit => no cap.
    // Only what the seller adds on top counts — the invoice discount% and
    // less-taka. A product's own discount comes from the catalogue, not the
    // seller, so it never counts against their limit (matching the backend).
    const totalDiscountAmt = discountAmt + (parseFloat(lessTaka) || 0);
    // Measured against gross: the limit caps total discount as a share of the
    // undiscounted line value, so dividing by the already-discounted subTotal
    // would overstate the percentage.
    const effectiveDiscountPercent =
        grossTotal > 0 ? (totalDiscountAmt / grossTotal) * 100 : 0;
    const isDiscountLimitExceeded =
        discountLimit > 0 &&
        Math.round(effectiveDiscountPercent * 100) / 100 > discountLimit;

    // Debounced so a barcode scanner's rapid keystrokes (or fast typing) don't
    // fire an API request per character — only once input pauses.
    const debouncedFetchResults = useDebouncedCallback(async (val: string) => {
        try {
            const res = await axiosSecure.get(`/sales/get-sales-products?q=${val}`);
            setSearchResults(res.data.data || []);
        } catch {
            setSearchResults([]);
        }
    }, 400);

    // Clears the draft slot — the selected product and every field derived from
    // it — so nothing from the previous product can be carried into the next add.
    const clearDraft = () => {
        setDraftProduct(null);
        setDraftGroupQty("");
        setDraftQty("");
        setDraftPrice("");
    };

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (val.length > 0) {
            setShowDropdown(true);
            debouncedFetchResults(val);
        } else {
            setShowDropdown(false);
            setSearchResults([]);
            // Emptying the search box unselects the product, so drop its values too.
            clearDraft();
        }
    };

    const selectProduct = (product: any) => {
        setDraftProduct(product);
        setDraftPrice(product.wholesalePrice?.toString() || "");
        // One pack by default — the pack size itself is shown read-only beside it.
        setDraftGroupQty("1");
        setDraftQty("");
        setSearchQuery(
            product._type === "variant"
                ? `${product.productName || ""} ${product.variantName || ""}`.trim()
                : product.name || "",
        );
        setShowDropdown(false);
        // Move straight to QTY so a scan → type qty → Enter/Add flow needs no mouse.
        window.setTimeout(() => qtyInputRef.current?.focus(), 0);
    };

    // ── Barcode scan submit ──────────────────────────────────────────────────
    // USB scanners emit the code as fast keystrokes terminated by Enter. When
    // that happens, skip the "click a dropdown row" step entirely: hit the
    // same search API and load the matching product into the draft slot
    // immediately (wholesale still requires a manual QTY, so it can't be
    // auto-added to the cart the way retail sale is).
    const handleScanSubmit = async (val: string) => {
        const query = val.trim();
        if (!query) return;

        setIsScanning(true);
        try {
            const res = await axiosSecure.get(`/sales/get-sales-products?q=${query}`);
            const results = res.data.data || [];

            if (results.length === 0) {
                toast.error(`No product found for "${query}"`);
                setSearchResults([]);
                setShowDropdown(false);
                return;
            }

            const exactMatch =
                results.find(
                    (p: any) => p.barCode === query || p.sku === query || p.qrCode === query,
                ) || results[0];

            selectProduct(exactMatch);

            if (results.length > 1 && !exactMatch) {
                toast(`Multiple matches for "${query}" — loaded the closest match.`, {
                    icon: "⚠️",
                });
            }
        } catch (error) {
            showApiError(error, "Barcode lookup failed. Please try again.");
        } finally {
            setIsScanning(false);
            focusSearchInput();
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        if (searchResults.length > 0 && isLikelyCode(searchQuery)) {
            const exactMatch = searchResults.find(
                (p: any) =>
                    p.barCode === searchQuery || p.sku === searchQuery || p.qrCode === searchQuery,
            );
            if (exactMatch) {
                selectProduct(exactMatch);
                return;
            }
        }

        if (searchResults.length > 0) {
            selectProduct(searchResults[0]);
            return;
        }

        handleScanSubmit(searchQuery);
    };

    const handleAddDraftProduct = () => {
        if (!draftProduct) {
            toast.error("Please select a product first.");
            return;
        }

        const exists = tableProducts.find((p) => p.id === draftProduct._id);
        if (!exists) {
            const isVariant = draftProduct._type === "variant";
            let initialDis = 0;
            let disType = "percent";
            let isDiscountReadOnly = false;

            if (draftProduct?.discount?.discountType === "tk") {
                initialDis = draftProduct.discount.discountValueByAmount || 0;
                disType = "amount";
                isDiscountReadOnly = true;
            } else if (draftProduct?.discount?.discountType === "percentance") {
                initialDis = draftProduct.discount.discountValueByPercentance || 0;
                disType = "percent";
                isDiscountReadOnly = true;
            }

            const q = parseInt(draftQty) || 0;
            const gq = parseInt(draftGroupQty) || 0;
            const sr = parseFloat(draftPrice) || draftProduct.wholesalePrice || 0;

            if (q === 0 && gq === 0) {
                toast.error("Please enter QTY or GROUP QTY.");
                return;
            }

            setTableProducts((prev) => [
                ...prev,
                {
                    id: draftProduct._id,
                    productId: isVariant ? null : draftProduct._id,
                    variantId: isVariant ? draftProduct._id : null,
                    barcode: draftProduct.barCode,
                    name: isVariant
                        ? draftProduct.productName
                            ? `${draftProduct.productName} — ${draftProduct.variantName || ""}`
                            : draftProduct.variantName
                        : draftProduct.name,
                    color: draftProduct.color || "",
                    size: draftProduct.size || "",
                    stock: isVariant ? draftProduct.stockVariant : draftProduct.stock,
                    qty: q,
                    groupQty: gq,
                    groupUnit: draftProduct.groupUnit || "",
                    groupUnitQuantity: packSizeOf(draftProduct),
                    unit: draftProduct.unit || "",
                    salesRate: sr,
                    dis: initialDis,
                    disType,
                    isDiscountReadOnly,
                },
            ]);
            setNewRowId(draftProduct._id);
            window.setTimeout(() => setNewRowId(null), 400);
        } else {
            toast.error("Product already added.");
        }

        clearDraft();
        setSearchQuery("");
        focusSearchInput();
    };

    const updateRow = (id: string, field: string, value: any) =>
        setTableProducts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
        );

    const removeRow = (id: string) =>
        setTableProducts((prev) => prev.filter((p) => p.id !== id));

    // Wipes the whole sale so the next customer starts clean. Loaded lists
    // (customers, employees, accounts) and the cash-account default are kept —
    // they aren't part of this sale.
    const resetForm = () => {
        // Stored draft goes too, otherwise the next sale would reopen carrying
        // this one's items.
        clearStoredDraft(draftKey);
        clearDraft();
        setTableProducts([]);
        setSearchQuery("");
        setSearchResults([]);
        setShowDropdown(false);

        setIsWalking(true);
        setSelectedCustomerId(null);
        setCustomerName("");
        setMobile("");
        setEmail("");
        setAddress("");
        setCustomerSearch("");
        setPrevDues(0);
        setDueLimit(0);

        setDiscount("");
        setVat("");
        setDelivery("");
        setLabour("");
        setLessTaka("");
        setCustomerAdvance(false);
        setCustomerAdvanceAmount(0);
        setPaid("");

        setSalesman("");
        setInvoiceStatus(orderMode ? "Pending" : "Complete");
        setRemarks("");
        setSendSms(true);

        setPaymentType("single");
        setSinglePayment({ amount: "", paymentTo: defaultAccountId.current, remark: "" });
        setMultiplePayments([{ amount: "", paymentTo: "", remark: "" }]);
        setTempMultiplePayments([{ amount: "", paymentTo: "", remark: "" }]);
        setMultiPayError("");

        setDate(new Date().toISOString().split("T")[0]);
        focusSearchInput();
    };

    // ── SAVE HANDLER ──────────────────────────────────────────────────────────
    const handleSave = async (shouldPrint: boolean = false) => {
        // ── Validation ──
        if (!date) {
            toast.error("Date is required.");
            return;
        }

        if (tableProducts.length === 0) {
            toast.error("Please add at least one product.");
            return;
        }

        if (isWalking && !mobile.trim()) {
            toast.error("Mobile number is required for a walking customer.");
            return;
        }

        if (!isWalking && !selectedCustomerId) {
            toast.error("Please select a customer.");
            return;
        }

        if (!salesman) {
            toast.error("Please select a salesman.");
            return;
        }

        // A customer's due limit caps how much they may still owe after this sale.
        if (isDueLimitExceeded) {
            toast.error(
                `Due limit exceeded — balance ৳${balance.toFixed(2)} is over the ৳${dueLimit.toFixed(2)} limit. Collect ৳${(balance - dueLimit).toFixed(2)} more.`,
            );
            return;
        }


        // ── Customer Type object ──
        const customerType = isWalking
            ? {
                type: "walking",
                walking: {
                    customerName,
                    mobileNumber: mobile,
                    email,
                    address,
                },
            }
            : {
                type: "listed",
                customerId: selectedCustomerId,
            };

        // ── searchItem (product rows) ──
        const searchItem = tableProducts.map((p) => {
            const q = totalUnits(p);
            // Rounded the same way the table renders it, so the subtotal sent
            // to the backend is exactly the figure the seller saw on the row.
            const rowTotal = money(
                p.disType === "amount"
                    ? (p.salesRate - p.dis) * q
                    : p.salesRate * q * (1 - p.dis / 100),
            );
            return {
                productId: p.variantId ? null : p.productId ?? p.id ?? null,
                variantId: p.variantId ?? null,
                barcode: p.barcode,
                productDescription: p.name,
                color: p.color,
                size: p.size,
                salesStatus: "sale",
                quantity: q,
                groupQuantity: p.groupQty || 0,
                unit: p.unit || "",
                salesRate: p.salesRate,
                discount: p.dis,
                // Persisted so editing this sale later can tell ৳10 from 10%.
                discountType: p.disType === "percent" ? "percent" : "amount",
                subtotal: rowTotal,
            };
        });

        // ── Payment Method ──
        const paymentMethod =
            paymentType === "single"
                ? {
                    singlePayment: {
                        amount: parseFloat(singlePayment.amount) || 0,
                        paymentTo: singlePayment.paymentTo,
                        remark: singlePayment.remark,
                    },
                }
                : {
                    multiplePayment: multiplePayments.map((mp) => ({
                        amount: parseFloat(mp.amount) || 0,
                        paymentTo: mp.paymentTo,
                        remark: mp.remark,
                    })),
                };

        // ── Payment Status ──
        const paidNum = parseFloat(paid) || 0;
        const paymentStatus =
            paidNum >= payable ? "paid" : paidNum > 0 ? "partial" : "due";

        // ── Full Payload ──
        const payload = {
            date,
            // On edit an empty picker means "clear it": send null so $set removes
      // the stored date. undefined would be dropped from the payload and the
      // old value would survive.
      deliveryDate: deliveryDate || (isEdit ? null : undefined),
            customerType,
            searchItem,
            salesMen: salesman,
            invoiceStatus: invoiceStatus.toLowerCase(),
            remark: remarks,
            sendSms,
            total: money(total),
            discountPercent: parseFloat(discount) || 0,
            vatPercent: parseFloat(vat) || 0,
            deliveryCost: parseFloat(delivery) || 0,
            labourCost: parseFloat(labour) || 0,
            lessTaka: parseFloat(lessTaka) || 0,
            customerAdvancePaymentAdjust: customerAdvance ? customerAdvanceAmount : 0,
            payable: money(payable),
            paid: paidNum,
            changes: money(change),
            presentDue: money(presDues),
            previousDue: prevDues,
            balance: money(balance),
            paymentMethod,
            paymentStatus,
            salesType: orderMode ? "wholesaleorder" : "wholesale",
        };

        setIsSaving(true);
        try {
            if (isEdit && editSale) {
                const res = await axiosSecure.put(`/sales/update-sales/${editSale._id}`, payload);
                toast.success("Sale updated successfully!");
                invalidateStockQueries(queryClient);
                queryClient.invalidateQueries({ queryKey: ["sales"] });
                queryClient.invalidateQueries({ queryKey: ["sale-invoice"] });
                queryClient.invalidateQueries({ queryKey: ["customers"] });
                queryClient.invalidateQueries({ queryKey: ["accounts"] });
                queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
                onUpdated?.();
                if (shouldPrint) {
                    const invoiceNumber = res?.data?.data?.invoiceNumber || editSale.invoiceNumber;
                    if (invoiceNumber) {
                        navigate(`/sales-receipt-print/${encodeURIComponent(invoiceNumber)}`);
                    }
                }
                return;
            }

            const res = await axiosSecure.post("/sales/create-sales", payload);
            toast.success("Sale created successfully!");
            invalidateStockQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
            queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
            resetForm();
            if (shouldPrint) {
                const invoiceNumber = res?.data?.data?.invoiceNumber;
                if (invoiceNumber) {
                    navigate(`/sales-receipt-print/${encodeURIComponent(invoiceNumber)}`);
                }
            }
        } catch (err: any) {
            showApiError(err, isEdit ? "Failed to update sale." : "Failed to create sale.");
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <>
            <div className="flex flex-col md:flex-row gap-3 md:gap-0 h-auto md:h-full min-h-0 flex-1 text-gray-800 dark:text-gray-100 bg-transparent md:bg-gray-100 dark:bg-transparent dark:md:bg-gray-900 rounded-xl overflow-visible md:overflow-hidden md:border md:border-gray-200 dark:md:border-gray-700">

                {/* ── Main Left Area ── */}
                <div className="flex flex-col flex-1 gap-3 md:gap-2 min-w-0 min-h-0 bg-transparent md:bg-gray-100 dark:md:bg-gray-900">

                    {/* ── Customer Info Card (mobile) ── */}
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white shadow-sm p-3 md:rounded-none md:border-0 md:bg-transparent md:dark:bg-transparent md:shadow-none md:p-2.5 md:pb-0">
                    {/* Date + Customer Dropdown */}
                    <div className="flex flex-wrap md:flex-nowrap gap-2">
                        <div className="w-36">
                            <DatePicker
                                id="date-picker-sales"
                                label=""
                                placeholder="Select a date *"
                                defaultDate={date}
                                onChange={(_selectedDates: Date[], dateStr: string) => setDate(dateStr)}
                                isStatic={false}
                                inputClassName={`border rounded-md text-xs h-9 px-2.5 pr-8 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none w-36 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${date ? "border-gray-300 dark:border-gray-600" : "border-red-400 dark:border-red-500"
                                    }`}
                            />
                        </div>
                        {/* Delivery date is optional — the sale saves without it. */}
                        <div className="w-36">
                            <DatePicker
                                id="delivery-date-picker-sales-whole"
                                label=""
                                placeholder="Delivery date"
                                defaultDate={deliveryDate}
                                onChange={(_selectedDates: Date[], dateStr: string) => setDeliveryDate(dateStr)}
                                isStatic={false}
                                inputClassName="border border-gray-300 dark:border-gray-600 rounded-md text-xs h-9 px-2.5 pr-8 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none w-36 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                            />
                        </div>

                        {/* Customer Grouped Dropdown */}
                        <div className="relative flex-1" ref={customerDropdownRef}>
                            <button
                                onClick={() => setCustomerDropdownOpen((prev) => !prev)}
                                className={`w-full h-9 border rounded-md text-xs px-2.5 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none text-left flex items-center justify-between transition-colors ${customerDropdownOpen ? "border-teal-500 ring-2 ring-teal-500/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}
                            >
                                <span className={selectedCustomerId || isWalking ? "text-gray-800 dark:text-gray-100 font-medium" : "text-gray-400"}>
                                    {isWalking
                                        ? "Walking Customer"
                                        : selectedCustomerId
                                            ? `${customerName} - ${mobile}`
                                            : "Select Customer"}
                                </span>
                                <span className={`text-gray-400 transition-transform ${customerDropdownOpen ? "rotate-180" : ""}`}>▾</span>
                            </button>

                            {customerDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    <div className="p-2 sticky top-0 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white border-b border-gray-100 dark:border-gray-700">
                                        <input
                                            autoFocus
                                            placeholder="Search customer..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md text-xs h-7 px-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                        />
                                    </div>

                                    {/* Walking Option */}
                                    <div
                                        onClick={handleWalkingSelect}
                                        className="px-3 py-2.5 text-xs cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors border-b border-gray-200 dark:border-gray-700 font-bold text-teal-700 bg-teal-50 dark:bg-teal-900"
                                    >
                                        Walking Customer
                                    </div>

                                    {/* Listed Group */}
                                    {filterCustomers(listedCustomers).length > 0 && (
                                        <>
                                            {/* <div className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 tracking-wide">
                        Listed
                      </div> */}
                                            {filterCustomers(listedCustomers).map((c) => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => handleCustomerSelect(c)}
                                                    className="px-3 py-2.5 text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-b-0"
                                                >
                                                    <span className="font-medium text-gray-800 dark:text-gray-100">{c.fullName}</span>
                                                    <span className="text-gray-400 ml-2">{c.mobileNumber}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {filterCustomers(listedCustomers).length === 0 && customerSearch && (
                                        <div className="px-3 py-4 text-xs text-center text-gray-400">No customers found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer Info Row */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap md:flex-nowrap gap-2 items-stretch sm:items-center bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                        <input
                            placeholder="Customer Name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full sm:flex-1 sm:min-w-[140px] border border-gray-300 dark:border-gray-600 rounded-md text-xs h-8 px-2.5 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        />
                        <input
                            placeholder={isWalking ? "Mobile Number *" : "Mobile Number"}
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            className={`w-full sm:flex-1 sm:min-w-[140px] border rounded-md text-xs h-8 px-2.5 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${isWalking && !mobile.trim()
                                ? "border-red-400 dark:border-red-500"
                                : "border-gray-300 dark:border-gray-600"
                                }`}
                        />
                        <input
                            placeholder="youremail@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full sm:flex-1 sm:min-w-[140px] border border-gray-300 dark:border-gray-600 rounded-md text-xs h-8 px-2.5 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        />
                        <div className="flex w-full sm:contents gap-2">
                            <input
                                placeholder="Enter Address Here"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full sm:flex-[2] sm:min-w-[160px] border border-gray-300 dark:border-gray-600 rounded-md text-xs h-8 px-2.5 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                            />
                            <button
                                title="Add new customer"
                                onClick={() => setShowCreateCustomerModal(true)}
                                className="bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-95 text-[#1D4ED8] rounded-md w-8 h-8 cursor-pointer text-sm shrink-0 flex justify-center items-center transition-all shadow-sm"
                            >
                                <IoPersonAddSharp size={16} />
                            </button>
                        </div>
                    </div>
                    </div>

                    {/* ── Products Card (mobile) ── */}
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white shadow-sm p-3 flex-1 min-h-0 md:rounded-none md:border-0 md:bg-transparent md:dark:bg-transparent md:shadow-none md:p-2.5 md:pt-0">
                    {/* Search and Wholesale QTY */}
                    <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                            <Input
                                ref={searchInputRef}
                                placeholder="Scan barcode or search product by name…"
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                onBlur={handleSearchBlur}
                                autoComplete="off"
                                disabled={isScanning}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md h-9 pl-9 pr-8 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-gray-100 dark:bg-gray-900 disabled:cursor-wait shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={focusSearchInput}
                                title="Click to resume scanning"
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
                            >
                                <MdOutlineQrCodeScanner size={16} />
                            </button>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSearchResults([]);
                                        setShowDropdown(false);
                                        focusSearchInput();
                                    }}
                                    title="Clear"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <FaTimes size={12} />
                                </button>
                            )}
                            {showDropdown && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {searchResults.map((p) => {
                                        const isVariant = p._type === "variant";
                                        const displayName = isVariant
                                            ? p.productName
                                                ? `${p.productName} — ${p.variantName || ""}`
                                                : p.variantName
                                            : p.name;
                                        const stockQty = isVariant ? p.stockVariant : p.stock;
                                        return (
                                            <div
                                                key={p._id}
                                                onClick={() => selectProduct(p)}
                                                className="flex justify-between items-center px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-xs hover:bg-teal-50 dark:bg-teal-900 transition-colors"
                                            >
                                                <span>
                                                    <strong className="text-gray-800 dark:text-gray-100">{displayName}</strong>
                                                    <span className="text-gray-400 ml-2">| {p.barCode}</span>
                                                    <span className="text-gray-400 ml-2">| {p.sku}</span>
                                                    <span className="text-gray-400 ml-2">| {p.color}</span>
                                                    <span className="text-gray-400 ml-2">| {p.size}</span>
                                                    <span className="text-gray-400 ml-2">| Stock: {stockQty ?? 0}</span>
                                                    {/* Wholesale price only — this form
                                                        never sells at retail, so falling
                                                        back to retailPrice would show a
                                                        price it will not charge. */}
                                                    <span className="text-teal-600 ml-2 font-semibold">| ৳{p.wholesalePrice}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Wholesale Inputs */}
                        <div className="flex flex-wrap items-center bg-teal-600 text-white p-1.5 rounded-md gap-1.5 shadow-md">
                            <div className="bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white/90 text-gray-800 dark:text-gray-100 px-2 h-8 flex items-center justify-center text-[11px] font-bold rounded shadow-sm tracking-wide whitespace-nowrap flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto">GROUP QTY</div>
                            <input
                                placeholder="CTN,BOX"
                                value={draftGroupQty}
                                onChange={(e) => setDraftGroupQty(e.target.value)}
                                className="h-8 px-2 text-xs outline-none rounded border border-teal-700/30 text-center text-gray-800 dark:text-gray-100 font-bold shadow-inner bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white focus:ring-2 focus:ring-white/50 transition-shadow flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto sm:w-20"
                            />

                            <input
                                readOnly
                                placeholder={draftProduct?.groupUnit || "Group"}
                                value={draftProduct ? packSizeOf(draftProduct) : ""}
                                title={draftProduct?.groupUnit ? `Units per ${draftProduct.groupUnit}` : "Units per group"}
                                className="h-8 px-2 text-xs outline-none rounded border border-teal-700/30 text-center text-gray-600 dark:text-gray-300 font-bold shadow-inner bg-gray-50 dark:bg-gray-700 cursor-not-allowed flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto sm:w-20"
                            />

                            <div className="bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white/90 text-gray-800 dark:text-gray-100 px-2 h-8 flex items-center justify-center text-[11px] font-bold rounded shadow-sm tracking-wide whitespace-nowrap flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto">QTY</div>
                            <input
                                ref={qtyInputRef}
                                placeholder="PCS"
                                value={draftQty}
                                onChange={(e) => setDraftQty(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddDraftProduct();
                                    }
                                }}
                                className="h-8 px-2 text-xs outline-none rounded border border-teal-700/30 text-center text-gray-800 dark:text-gray-100 font-bold shadow-inner bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white focus:ring-2 focus:ring-white/50 transition-shadow flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto sm:w-16"
                            />

                            <div className="bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white/90 text-gray-800 dark:text-gray-100 px-2 h-8 flex items-center justify-center text-[11px] font-bold rounded shadow-sm tracking-wide whitespace-nowrap flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto">PRICE</div>
                            <input
                                readOnly
                                placeholder="Amount"
                                value={draftPrice}
                                title="Wholesale price — set on the product"
                                className="h-8 px-2 text-xs outline-none rounded border border-teal-700/30 text-center text-gray-600 dark:text-gray-300 font-bold shadow-inner bg-gray-50 dark:bg-gray-700 cursor-not-allowed flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto sm:w-20"
                            />

                            <button
                                onClick={handleAddDraftProduct}
                                className="bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-95 text-[#1D4ED8] px-4 h-8 flex items-center justify-center gap-1.5 text-xs font-bold rounded transition-all cursor-pointer shadow-md whitespace-nowrap flex-1 sm:flex-none basis-[calc(33.333%-0.5rem)] sm:basis-auto"
                            >
                                <FaCartPlus size={14} /> Add
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 min-h-[55vh] md:min-h-0 overflow-auto bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <table className={`w-full min-w-[980px] md:min-w-0 border-collapse text-xs bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white ${tableProducts.length === 0 ? "h-full" : ""}`}>
                            <thead className="sticky top-0 z-20 bg-teal-600">
                                <tr className="bg-teal-600 text-white">
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap">BARCODE</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap">PRODUCT DESCRIPTION</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-20">COLOR</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-14">SIZE</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-14">STOCK</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-24">GROUP QTY</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-20">QTY</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-24">TOTAL QTY</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-32">SALES RATE</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap w-14">DIS.</th>
                                    <th className="px-2 py-2.5 text-center font-bold tracking-wide whitespace-nowrap">SUB TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableProducts.map((p, i) => {
                                    const q = totalUnits(p);
                                    // Discounts arrive in two shapes: a flat taka
                                    // amount off each unit, or a percentage of the
                                    // line. Both round to whole taka so the row
                                    // agrees with the invoice total.
                                    const isAmountDis = p.disType === "amount";
                                    const rowTotal = money(
                                        isAmountDis
                                            ? (p.salesRate - p.dis) * q
                                            : p.salesRate * q * (1 - p.dis / 100),
                                    );
                                    // What the discount takes off this line, so a
                                    // % discount shows its taka effect too.
                                    // Hidden per request — keep for easy re-enable alongside the JSX below.
                                    // const disAmount = Math.round(
                                    //     isAmountDis
                                    //         ? p.dis * q
                                    //         : (p.salesRate * q * p.dis) / 100,
                                    // );
                                    // Per-unit rate after discount — what SUB
                                    // TOTAL is actually built from.
                                    const netRate = money(
                                        isAmountDis
                                            ? p.salesRate - p.dis
                                            : p.salesRate * (1 - p.dis / 100),
                                    );
                                    return (
                                        <tr
                                            key={p.id}
                                            className={`border-b border-gray-100 dark:border-gray-700 hover:bg-teal-50 dark:bg-teal-900/40 transition-colors ${i % 2 === 0 ? "bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white" : "bg-gray-50 dark:bg-gray-700/70 dark:bg-gray-700/70"} ${p.id === newRowId ? "animate-row-in" : ""}`}
                                        >
                                            <td className="px-1 py-1 text-center">
                                                <input value={p.barcode} readOnly className={`${readonlyInputCls} w-full text-center font-mono`} />
                                            </td>
                                            <td className="px-1 py-1 text-center">
                                                <input value={p.name} readOnly className={`${readonlyInputCls} w-full text-center`} />
                                            </td>
                                            <td className="px-1 py-1 text-center">
                                                <input value={p.color} readOnly className={`${readonlyInputCls} w-full text-center`} />
                                            </td>
                                            <td className="px-1 py-1 text-center">
                                                <input value={p.size} readOnly className={`${readonlyInputCls} w-full text-center`} />
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                <input value={p.stock} readOnly className={`${readonlyInputCls} w-full text-right`} />
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                <input
                                                    type="number"
                                                    value={p.groupQty || ""}
                                                    onChange={(e) => updateRow(p.id, "groupQty", parseInt(e.target.value) || 0)}
                                                    className={`${inputCls} w-full text-right`}
                                                />
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                <input
                                                    type="number"
                                                    value={p.qty || ""}
                                                    onChange={(e) => updateRow(p.id, "qty", parseInt(e.target.value) || 0)}
                                                    className={`${inputCls} w-full text-right`}
                                                />
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                <input
                                                    readOnly
                                                    value={q}
                                                    title={`(${p.groupQty || 0} ${p.groupUnit || "group"} x ${p.groupUnitQuantity || 1}) + ${p.qty || 0} ${p.unit || "unit"} = ${q}`}
                                                    className={`${readonlyInputCls} w-full text-right`}
                                                />
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {/* Two values in one field: the net
                                                    rate charged, and the original
                                                    struck through beside it. A plain
                                                    input cannot style two values
                                                    differently, so this is a box
                                                    built to match readonlyInputCls.
                                                    Without a discount it stays an
                                                    ordinary editable input. */}
                                                {p.dis > 0 ? (
                                                    <div
                                                        className={`${readonlyInputCls} w-full flex items-center justify-end gap-1.5`}
                                                        title={`Original ${p.salesRate}, net rate ${netRate}`}
                                                    >
                                                        {/* Net rate hidden per request — keep for easy re-enable.
                                                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                                                            {netRate}
                                                        </span>
                                                        */}
                                                        <span className="text-[11px]">
                                                            {p.salesRate}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        value={p.salesRate}
                                                        onChange={(e) => updateRow(p.id, "salesRate", parseFloat(e.target.value) || 0)}
                                                        className={`${readonlyInputCls} w-full text-right`}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                {/* The discount taka amount sits
                                                    beside the rate that produced it,
                                                    so a 5% discount shows both "5%"
                                                    and the taka it takes off. */}
                                                <div className="flex items-center justify-end gap-1">
                                                    <div className="relative flex items-center flex-1">
                                                        <input
                                                            type="number"
                                                            value={p.dis}
                                                            readOnly={p.isDiscountReadOnly}
                                                            onChange={(e) => updateRow(p.id, "dis", parseFloat(e.target.value) || 0)}
                                                            className={`${p.isDiscountReadOnly ? readonlyInputCls : inputCls} w-full text-right pr-5`}
                                                        />
                                                        <span className="absolute right-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 pointer-events-none">
                                                            {isAmountDis ? "৳" : "%"}
                                                        </span>
                                                    </div>
                                                    {/* Discount taka amount hidden per request — keep the markup for easy re-enable.
                                                    {p.dis > 0 && !isAmountDis && (
                                                        <span className="text-[11px] font-bold text-red-500 whitespace-nowrap">
                                                            ৳{disAmount}
                                                        </span>
                                                    )}
                                                    */}
                                                </div>
                                            </td>
                                            <td className="px-1 py-1 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        value={rowTotal}
                                                        readOnly
                                                        className={`${readonlyInputCls} w-full text-right font-bold`}
                                                    />
                                                    <button
                                                        onClick={() => removeRow(p.id)}
                                                        title="Remove item"
                                                        className="bg-red-500 hover:bg-red-600 active:scale-90 text-white rounded w-5 h-5 cursor-pointer text-xs flex-shrink-0 transition-all flex items-center justify-center"
                                                    >
                                                        <MdDelete className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {tableProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="h-full p-0">
                                            <SalesEmptyState />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Bar */}
                    <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-52 flex-[2]">
                                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    <FaUserTie className="size-2.5 text-teal-600 dark:text-teal-400" />
                                    Sales Man
                                </label>
                                <PickerSelect
                                    searchable
                                    options={employeeList.map((e) => ({
                                        value: e._id,
                                        label: e.fullName,
                                        sublabel: e?.designation?.name,
                                        badge: e.employeeId,
                                        icon: FaUserTie,
                                    }))}
                                    value={salesman}
                                    onChange={setSalesman}
                                    placeholder="Select Salesman"
                                />
                            </div>

                            <div className="min-w-40 flex-1">
                                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    <FaFileInvoiceDollar className="size-2.5 text-teal-600 dark:text-teal-400" />
                                    Invoice Status
                                </label>
                                <PickerSelect
                                    options={invoiceStatuses.map((st) => ({
                                        value: st,
                                        label: st,
                                        icon: invoiceStatusMeta[st]?.icon,
                                        tone: invoiceStatusMeta[st]?.tone,
                                    }))}
                                    value={invoiceStatus}
                                    onChange={setInvoiceStatus}
                                    placeholder="Select Status"
                                />
                            </div>

                            <div className="min-w-52 flex-[2]">
                                <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    <MdOutlineStickyNote2 className="size-3 text-teal-600 dark:text-teal-400" />
                                    Remarks
                                </label>
                                <input
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Optional note for this invoice"
                                    className="h-7 w-full rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                            </div>

                            {/* Send SMS reads as an on/off pill so its state is
                                obvious at a glance from across the counter. */}
                            <button
                                type="button"
                                onClick={() => setSendSms(!sendSms)}
                                aria-pressed={sendSms}
                                className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-colors cursor-pointer ${
                                    sendSms
                                        ? "border-teal-600 bg-teal-600 text-white"
                                        : "border-gray-300 bg-white text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                            >
                                <MdSms className="size-3.5" />
                                Send SMS
                                <span
                                    className={`ml-0.5 rounded-full px-1.5 text-[9px] font-bold ${
                                        sendSms
                                            ? "bg-white/20 text-white"
                                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                                    }`}
                                >
                                    {sendSms ? "ON" : "OFF"}
                                </span>
                            </button>
                        </div>
                    </div>
                    </div>
                </div>

                {/* ── Right Panel ── */}
                <div className="w-full md:w-64 rounded-2xl md:rounded-none border border-gray-200 dark:border-gray-700 md:border-0 md:border-t-0 md:border-l shadow-sm md:shadow-[-1px_0_3px_rgba(0,0,0,0.03)] bg-white dark:bg-gray-800 dark:bg-gray-200 dark:text-white p-3 md:p-2.5 flex flex-col gap-0 flex-shrink-0 min-h-0 overflow-y-visible md:overflow-y-auto">

                    <RightRow label="TOTAL">
                        <input value={total.toFixed(2)} readOnly className={`${readonlyInputCls} flex-1 text-right`} />
                    </RightRow>

                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-bold uppercase w-28 flex-shrink-0 tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap flex items-center gap-1">
                            DISCOUNT %
                            <span className="text-[9px] font-semibold normal-case text-teal-600 dark:text-teal-400">
                                (max {discountLimit}%)
                            </span>
                        </span>
                        <input
                            type="number"
                            min={0}
                            max={discountLimit > 0 ? discountLimit : undefined}
                            value={discount}
                            onChange={(e) => handleDiscountChange(e.target.value)}
                            disabled={discountLocked}
                            title={
                                hasItemDiscount
                                    ? "An item already has a product discount — extra invoice discount is disabled to prevent double discount."
                                    : (parseFloat(lessTaka) || 0) > 0
                                        ? "Less-taka is set — clear it to give a discount % instead."
                                        : discountLimit > 0
                                            ? `Max ${discountLimit}% allowed`
                                            : undefined
                            }
                            className={`${inputCls} flex-1 text-right ${
                                discountLocked ? "opacity-50 cursor-not-allowed" : ""
                            } ${isDiscountLimitExceeded ? "!border-red-500 !text-red-600" : ""}`}
                        />
                    </div>

                    {isDiscountLimitExceeded && (
                        <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mb-1.5 text-right">
                            Discount limit exceeded — {discountLimit}% allowed, {effectiveDiscountPercent.toFixed(1)}% applied.
                        </p>
                    )}

                    <RightRow label="VAT %">
                        <input
                            type="number"
                            value={vat}
                            onChange={(e) => setVat(e.target.value)}
                            className={`${inputCls} flex-1 text-right`}
                        />
                    </RightRow>

                    <RightRow label="DELIVERY">
                        <input
                            type="number"
                            value={delivery}
                            onChange={(e) => setDelivery(e.target.value)}
                            className={`${inputCls} flex-1 text-right`}
                        />
                    </RightRow>

                    <RightRow label="LABOUR">
                        <input
                            type="number"
                            value={labour}
                            onChange={(e) => setLabour(e.target.value)}
                            className={`${inputCls} flex-1 text-right`}
                        />
                    </RightRow>

                    <RightRow label="LESS TAKA">
                        <input
                            type="number"
                            value={lessTaka}
                            onChange={(e) => setLessTaka(e.target.value)}
                            disabled={lessTakaLocked}
                            title={
                                hasItemDiscount
                                    ? "An item already has a product discount — less-taka is disabled to prevent double discount."
                                    : (parseFloat(discount) || 0) > 0
                                        ? "A discount % is set — clear it to give less-taka instead."
                                        : undefined
                            }
                            className={`${inputCls} flex-1 text-right ${
                                lessTakaLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                        />
                    </RightRow>

                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase w-28 flex-shrink-0 tracking-wide flex items-center gap-1">
                            CAA Taka
                            <input
                                type="checkbox"
                                checked={customerAdvance}
                                onChange={(e) => handleCustomerAdvanceToggle(e.target.checked)}
                                className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
                            />
                        </span>
                        <input
                            value={customerAdvance ? customerAdvanceAmount : ""}
                            readOnly
                            className={`${readonlyInputCls} flex-1 text-right`}
                        />
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700 my-2" />

                    <RightRow label="PAYABLE" emphasis>
                        <input value={payable.toFixed(2)} readOnly className={`${readonlyInputCls} flex-1 !bg-teal-50 dark:bg-teal-900 !text-teal-800 !border-teal-200 text-sm text-right`} />
                    </RightRow>

                    <RightRow label="PAID">
                        <input
                            type="number"
                            value={paid}
                            onChange={(e) => setPaid(e.target.value)}
                            className={`${inputCls} flex-1 text-right font-semibold`}
                        />
                    </RightRow>

                    <RightRow label="CHANGE">
                        <input value={change.toFixed(2)} readOnly className={`${readonlyInputCls} flex-1 text-right`} />
                    </RightRow>

                    <RightRow label="PRES. DUES">
                        <input value={presDues.toFixed(2)} readOnly className={`${readonlyInputCls} flex-1 text-right ${presDues > 0 ? "!text-red-600" : ""}`} />
                    </RightRow>

                    <RightRow label="PREV. DUES">
                        <input value={prevDues.toFixed(2)} readOnly className={`${readonlyInputCls} flex-1 text-right ${prevDues > 0 ? "!text-red-600" : ""}`} />
                    </RightRow>

                    <hr className="border-gray-200 dark:border-gray-700 my-2" />

                    <RightRow label="BALANCE" emphasis>
                        <input
                            value={balance.toFixed(2)}
                            readOnly
                            className={`${readonlyInputCls} flex-1 text-sm text-right ${isDueLimitExceeded
                                ? "!bg-red-600 !text-white !border-red-700"
                                : "!bg-gray-800 dark:bg-gray-200 !text-white !border-gray-800"
                                }`}
                        />
                    </RightRow>

                    {isDueLimitExceeded && (
                        <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mb-1.5 text-right">
                            Due limit exceeded — ৳{dueLimit.toFixed(2)} allowed, ৳{(balance - dueLimit).toFixed(2)} over.
                        </p>
                    )}

                    {/* Single Pay / Multiple Pay Toggle */}
                    <div className="flex gap-2 mt-2.5">
                        <button
                            onClick={() => setPaymentType("single")}
                            className={`flex-1 text-xs font-bold py-2 rounded-md border-none cursor-pointer transition-colors ${paymentType === "single"
                                ? "bg-teal-700 text-white shadow-sm"
                                : "bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                        >
                            Single Pay
                        </button>
                        <button
                            onClick={() => {
                                setPaymentType("multiple");
                                setTempMultiplePayments(multiplePayments);
                                setShowMultiplePayModal(true);
                            }}
                            className={`flex-1 text-xs font-bold py-2 rounded-md border-none cursor-pointer transition-colors ${paymentType === "multiple"
                                ? "bg-teal-700 text-white shadow-sm"
                                : "bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
                                }`}
                        >
                            Multiple Pay
                        </button>
                    </div>

                    {/* Single Payment Fields */}
                    {paymentType === "single" && (
                        <div className="mt-2 flex flex-col gap-1">
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={singlePayment.amount}
                                    readOnly
                                    className={`${readonlyInputCls} flex-1 pr-16 hidden`}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-teal-600 font-bold bg-teal-50 dark:bg-teal-900 px-1 rounded hidden">AUTO</span>
                            </div>
                            <AccountSelect
                                accounts={accountList}
                                value={singlePayment.paymentTo}
                                onChange={(val) => setSinglePayment((p) => ({ ...p, paymentTo: val }))}
                                placeholder="Payment To"
                            />
                            {/* <input
                placeholder="Remark"
                value={singlePayment.remark}
                onChange={(e) => setSinglePayment((p) => ({ ...p, remark: e.target.value }))}
                className={inputCls}
              /> */}
                        </div>
                    )}

                    {paymentType === "multiple" && (
                        <div className="mt-2">
                            <button
                                onClick={() => {
                                    setTempMultiplePayments(multiplePayments);
                                    setShowMultiplePayModal(true);
                                }}
                                  className="w-full text-xs font-bold py-2 rounded-md text-[#1D4ED8] bg-[#DCE8FF] hover:bg-[#C7DAFF] transition-colors cursor-pointer"
                            >
                                {multiplePayments.length} Payment(s) — Click to Edit
                            </button>
                        </div>
                    )}

                    {/* Save Buttons — sit right under the payment fields, not
                        pinned to the bottom of the column. */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isDueLimitExceeded || isSaving}
                            title={
                                isDueLimitExceeded
                                    ? "Due limit exceeded"
                                    : isSaving
                                        ? "Saving..."
                                        : undefined
                            }
                              className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-[0.98] text-[#1D4ED8] text-xs font-bold py-2.5 rounded-md cursor-pointer transition-all shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            {isSaving ? (isEdit ? "UPDATING..." : "SAVING...") : (isEdit ? "UPDATE" : "SAVE")}
                        </button>
                        <button
                            onClick={() => handleSave(true)}
                            disabled={isDueLimitExceeded || isSaving}
                            title={
                                isDueLimitExceeded
                                    ? "Due limit exceeded"
                                    : isSaving
                                        ? "Saving..."
                                        : undefined
                            }
                              className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-[0.98] text-[#1D4ED8] text-xs font-bold py-2.5 rounded-md cursor-pointer transition-all shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            {isSaving ? (isEdit ? "UPDATING..." : "SAVING...") : (isEdit ? "UPDATE & PRINT" : "SAVE & PRINT")}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Create Customer Modal */}
            <QuickCreateCustomerModal
                isOpen={showCreateCustomerModal}
                onClose={() => setShowCreateCustomerModal(false)}
                initialName={customerName}
                initialMobile={mobile}
                defaultTypeName="Wholesale"
                onCreated={(customer) => {
                    setCustomerList((prev) => [...prev, customer as Customer]);
                    handleCustomerSelect(customer as Customer);
                }}
            />

            {/* Multiple Pay Modal */}
            <Modal
                isOpen={showMultiplePayModal}
                onClose={() => setShowMultiplePayModal(false)}
                className="p-6"
            >
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4">Multiple Payments</h2>
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1 py-5">
                    {tempMultiplePayments.map((mp, idx) => (
                        <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 transition-colors hover:border-gray-300 dark:border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Payment #{idx + 1}</span>
                                {tempMultiplePayments.length > 1 && (
                                    <button
                                        onClick={() => setTempMultiplePayments((prev) => prev.filter((_, i) => i !== idx))}
                                        className="text-red-500 text-xs font-bold hover:text-red-700 transition-colors cursor-pointer"
                                    >
                                        ✕ Remove
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount</label>
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        value={mp.amount}
                                        onChange={(e) =>
                                            setTempMultiplePayments((prev) =>
                                                prev.map((item, i) => i === idx ? { ...item, amount: e.target.value } : item)
                                            )
                                        }
                                        className={`${inputCls} text-right`}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Payment To</label>
                                    <AccountSelect
                                        accounts={accountList}
                                        value={mp.paymentTo}
                                        onChange={(val) =>
                                            setTempMultiplePayments((prev) =>
                                                prev.map((item, i) => i === idx ? { ...item, paymentTo: val } : item)
                                            )
                                        }
                                        placeholder="Select Account"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Remark</label>
                                    <input
                                        placeholder="Remark"
                                        value={mp.remark}
                                        onChange={(e) =>
                                            setTempMultiplePayments((prev) =>
                                                prev.map((item, i) => i === idx ? { ...item, remark: e.target.value } : item)
                                            )
                                        }
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => setTempMultiplePayments((prev) => [...prev, { amount: "", paymentTo: "", remark: "" }])}
                      className="w-full mt-3 text-xs font-bold py-2 rounded-md border-dashed text-[#1D4ED8] bg-[#DCE8FF] hover:bg-[#C7DAFF] transition-colors cursor-pointer"
                >
                    + Add More Payment
                </button>
                {/* Running total vs paid */}
                {(() => {
                    const totalEntered = tempMultiplePayments.reduce((s, mp) => s + (parseFloat(mp.amount) || 0), 0);
                    const paidNum = parseFloat(paid) || 0;
                    const isOver = totalEntered > paidNum;
                    return (
                        <div className={`flex items-center justify-between mt-3 px-1 py-1.5 rounded text-xs font-semibold ${isOver ? "bg-red-50 text-red-600" : "bg-teal-50 dark:bg-teal-900 text-teal-700"
                            }`}>
                            <span>Total entered: <strong>৳{totalEntered.toFixed(2)}</strong></span>
                            <span>Paid: <strong>৳{paidNum.toFixed(2)}</strong></span>
                            {isOver && <span className="text-red-500">⚠ Exceeds paid!</span>}
                        </div>
                    );
                })()}
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => {
                            const totalEntered = tempMultiplePayments.reduce((s, mp) => s + (parseFloat(mp.amount) || 0), 0);
                            const paidNum = parseFloat(paid) || 0;
                            if (totalEntered > paidNum) {
                                setMultiPayError(`Total amount (৳${totalEntered.toFixed(2)}) cannot exceed Paid amount (৳${paidNum.toFixed(2)}).`);
                                return;
                            }
                            setMultiPayError("");
                            setMultiplePayments(tempMultiplePayments);
                            setShowMultiplePayModal(false);
                        }}
                          className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-[0.98] text-[#1D4ED8] text-xs font-bold py-2 rounded-md transition-all cursor-pointer"
                    >
                        Confirm
                    </button>
                    <button
                        onClick={() => { setShowMultiplePayModal(false); setMultiPayError(""); }}
                          className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-[0.98] text-[#1D4ED8] text-xs font-bold py-2 rounded-md transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
                {multiPayError && (
                    <p className="text-red-500 text-xs mt-2 text-center font-semibold">{multiPayError}</p>
                )}
            </Modal>
        </>
    );
}
