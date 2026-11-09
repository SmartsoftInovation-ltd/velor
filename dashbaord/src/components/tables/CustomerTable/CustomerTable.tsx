import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import StatusPill from "../../common/StatusPill";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import {
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaSearch,
  FaTimes,
  FaEye,
  FaSync,
} from "react-icons/fa";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setCoords({ x: r.left + r.width / 2, y: r.top - 10 });
    setVisible(true);
  };

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface Customer {
  _id?: string;
  id: string;
  customSerialId?: string;
  customerId: string;
  fullName: string;
  mobileNumber: string;
  customerType?: { _id: string; customerType: string; slug: string };
  presentAddress?: string;
  permanentAddress?: string;
  regularDiscountPercent?: number;
  openingDues?: number;
  initialDue?: number;
  dueLimit?: number;
  isActive: boolean;
  image?: { url: string; publicId: string; status: string };
  createdAt: string;
}

interface CustomerTableProps {
  customers: Customer[] | null;
  fetchCustomers: () => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  // Typed but the list not filtered yet
  searching?: boolean;
}

// Money in the list: at most 2 decimals (dues can carry long fractions from % discounts)
const amount = (n?: number | null) => (n != null ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "N/A");

const CustomerTable = ({
  customers,
  fetchCustomers,
  searchTerm,
  setSearchTerm,
  searching = false,
}: CustomerTableProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    customerId: string;
    currentStatus: boolean;
    name: string;
  } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const canAdd    = usePermission("customer", "add");
  const canEdit   = usePermission("customer", "edit");
  const canDelete = usePermission("customer", "delete");
  const canToggle = usePermission("customer", "toggle");

  const tableData = customers || [];

  // New results start from the top instead of a scrolled-away blank area
  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [customers]);

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  // Header and rows are separate grids; a plain "1fr" track grows to fit its
  // content, so one long value widened that row's column and the headings slid
  // sideways while scrolling. minmax(0, …) plus min-w-0 on each cell keeps
  // every grid on the same widths; long values are cut instead.
  const gridTemplateColumns =
    "minmax(0,1fr) 60px minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,0.9fr) 250px";

  const handleDeleteModal = (customerId: string) => {
    setSelectedCustomer(customerId);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    // Closing mid-request would hide a delete that is still running
    if (isDeleting) return;
    setShowDeleteModal(false);
    setSelectedCustomer(null);
  };

  const handleDelete = async () => {
    const deletingId = selectedCustomer;
    // Guard against a second click while the first request is still running.
    if (!deletingId || isDeleting) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/customer/delete-customer/${deletingId}`);
      // Dropped from the caches only once the API confirmed it, so a failed
      // delete never blinks the row out and back in.
      queryClient.setQueriesData({ queryKey: ["customers"] }, (old: any) =>
        Array.isArray(old)
          ? old.filter((c: Customer) => c.customerId !== deletingId)
          : old,
      );
      toast.success("Customer deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setShowDeleteModal(false);
      setSelectedCustomer(null);
    } catch (error) {
      // The modal stays open on failure, so the row is still there to retry.
      showApiError(error, "Failed to delete customer. Please try again.");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchCustomers();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleModal = (
    customerId: string,
    currentStatus: boolean,
    name: string,
  ) => {
    setPendingToggle({ customerId, currentStatus, name });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const { customerId, currentStatus } = pendingToggle;
      const endpoint = currentStatus
        ? `/customer/deactivate-customer/${customerId}`
        : `/customer/activate-customer/${customerId}`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Customer ${currentStatus ? "deactivated" : "activated"} successfully.`,
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchCustomers();
    } catch (error) {
      showApiError(error, "Failed to update customer status.");
    } finally {
      setIsToggling(false);
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    navigate(`/customer-view/${customer.customerId}`);
  };

  const handleClearSearch = () => setSearchTerm("");

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Tooltip text="Go Back">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Button>
          </Tooltip>

          <div className="relative w-full md:w-80 group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search by serial, name, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-12 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all text-sm font-medium h-12"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searching && (
                <span
                  role="status"
                  aria-label="Searching"
                  className="size-4 animate-spin rounded-full border-2 border-accent-500/25 border-t-accent-500"
                />
              )}
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="p-1 text-gray-400 transition-colors hover:text-red-500"
                >
                  <FaTimes className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <Tooltip text="Refresh Data">
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["customers"] });
                queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
                queryClient.invalidateQueries({ queryKey: ["customer-advance-payments"] });
                // Refresh every dashboard widget (Accounts Balance included) so the
                // change shows without a reload.
                queryClient.invalidateQueries({
                  predicate: (query) =>
                    typeof query.queryKey[0] === "string" &&
                    query.queryKey[0].startsWith("dashboard-"),
                });
                fetchCustomers();
              }}
              size="sm"
              variant="outline"
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <FaSync className="size-5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      {/* Rows dim while the filter is pending, so nothing flashes per keystroke */}
      <div
        aria-busy={searching}
        className={`transition-opacity duration-200 ${searching ? "pointer-events-none opacity-50" : "opacity-100"}`}
      >
      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(customer, index) => customer._id || customer.customerId || index}
          emptyMessage={
            searchTerm
              ? `No customers match "${searchTerm}"`
              : "No customers yet"
          }
          renderCard={(customer, index) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                {customer.image?.url ? (
                  <img
                    src={customer.image.url}
                    className="w-12 h-12 shrink-0 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow"
                    alt={customer.fullName}
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full bg-accent-100 dark:bg-accent-500/15 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold text-sm">
                    {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{customer.fullName || "—"}</p>
                  <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400 inline-block mt-1">
                    {customer.customSerialId || `#${index + 1}`}
                  </span>
                </div>
                <StatusPill isActive={customer.isActive} />
              </div>
              <MobileCardRow label="Customer ID">{customer.customerId || "N/A"}</MobileCardRow>
              <MobileCardRow label="Type">{customer.customerType?.customerType || "N/A"}</MobileCardRow>
              <MobileCardRow label="Mobile">{customer.mobileNumber || "N/A"}</MobileCardRow>
              <MobileCardRow label="Dues (৳)">
                <span className={(customer.openingDues || 0) > 0 ? "text-red-500 font-semibold" : ""}>
                  {amount(customer.openingDues)}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Initial Due (৳)">
                {amount(customer.initialDue)}
              </MobileCardRow>
              <MobileCardRow label="Discount">
                {customer.regularDiscountPercent != null ? `${customer.regularDiscountPercent}%` : "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Due Limit">{amount(customer.dueLimit)}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => navigate(`/customer-profile-print/${customer.customerId}`)}
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                  aria-label="Print customer"
                >
                  <IoIosPrint className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewCustomer(customer)}
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                  aria-label="View customer"
                >
                  <FaEye className="size-4" />
                </button>
                {canToggle && (
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleModal(customer.customerId, customer.isActive, customer.fullName)
                    }
                    className={`shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 ${customer.isActive ? "bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25" : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10"}`}
                    aria-label={customer.isActive ? "Deactivate customer" : "Activate customer"}
                  >
                    {customer.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => navigate(`/customer-edit/${customer.customerId}`)}
                    className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                    aria-label="Edit customer"
                  >
                    <FaEdit className="size-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteModal(customer.customerId)}
                    className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                    aria-label="Delete customer"
                  >
                    <MdDelete className="size-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
        {/* Sticky header */}
        <div
          className="grid *:min-w-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-white/5 px-3 py-3"
          style={{ gridTemplateColumns }}
        >
          {[
            "Serial ID",
            "Photo",
            "Name",
            "Customer ID",
            "Type",
            "Mobile",
            "Dues (৳)",
            "Initial Due (৳)",
            "Discount",
            "Due Limit",
            "Date",
            "Status",
            "Actions",
          ].map((h) => (
            <div
              key={h}
              title={h}
              className="flex items-center justify-center text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wide"
            >
              <span className="truncate">{h}</span>
            </div>
          ))}
        </div>

        {tableData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="size-20 rounded-2xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mb-5 shadow-inner">
              {searchTerm ? (
                <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
              ) : (
                <svg
                  className="size-9 text-gray-300 dark:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">
              {searchTerm ? "No Results Found" : "No Customers Yet"}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed mb-6">
              {searchTerm
                ? `No customers match "${searchTerm}". Try a different name, mobile number, or ID.`
                : "You haven't added any customers yet. Create your first customer to get started."}
            </p>
            {searchTerm ? (
              <button
                onClick={handleClearSearch}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
              >
                Clear Search
              </button>
            ) : (
              canAdd ? (
              <button
                onClick={() => navigate("/create-customer")}
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                + Add Customer
              </button>
              ) : null
            )}
          </div>
        ) : (
          <div
            ref={parentRef}
            className="no-scrollbar overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: 600 }}
          >
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const customer = tableData[virtualRow.index];
                if (!customer) return null;
                return (
                  <div
                    key={customer._id || customer.customerId || virtualRow.index}
                    className="absolute top-0 left-0 w-full grid *:min-w-0 items-center px-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Serial ID */}
                    <div className="flex items-center justify-center px-1">
                      <span className="max-w-full truncate rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400 whitespace-nowrap" title={customer.customSerialId || undefined}>
                        {customer.customSerialId || `#${virtualRow.index + 1}`}
                      </span>
                    </div>

                    {/* Photo */}
                    <div className="flex items-center justify-center">
                      {customer.image?.url ? (
                        <img
                          src={customer.image.url}
                          className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow"
                          alt={customer.fullName}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-accent-100 dark:bg-accent-500/15 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold text-sm">
                          {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate" title={customer.fullName || undefined}>
                        {customer.fullName || "—"}
                      </span>
                    </div>

                    {/* Customer ID */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate" title={customer.customerId || undefined}>
                        {customer.customerId || "—"}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={customer.customerType?.customerType || undefined}>
                        {customer.customerType?.customerType || "—"}
                      </span>
                    </div>

                    {/* Mobile */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={customer.mobileNumber || undefined}>
                        {customer.mobileNumber || "—"}
                      </span>
                    </div>

                    {/* Dues */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`text-sm font-semibold ${(customer.openingDues || 0) > 0 ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {amount(customer.openingDues)}
                      </span>
                    </div>

                    {/* Initial Due — the figure carried in at creation, not
                        moved by transactions. */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {amount(customer.initialDue)}
                      </span>
                    </div>

                    {/* Discount % */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {customer.regularDiscountPercent != null
                          ? `${customer.regularDiscountPercent}%`
                          : "N/A"}
                      </span>
                    </div>

                    {/* Due Limit */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {amount(customer.dueLimit)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center justify-center px-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-center">
                      <StatusPill isActive={customer.isActive} />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-nowrap items-center justify-center gap-2">
                      <Tooltip text="Print">
                        <button
                          type="button"
                          onClick={() => navigate(`/customer-profile-print/${customer.customerId}`)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                          aria-label="Print customer"
                        >
                          <IoIosPrint className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="View">
                        <button
                          type="button"
                          onClick={() => handleViewCustomer(customer)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                          aria-label="View customer"
                        >
                          <FaEye className="size-4" />
                        </button>
                      </Tooltip>

                      {canToggle && <Tooltip
                        text={customer.isActive ? "Deactivate" : "Activate"}
                      >
                        <button
                          onClick={() =>
                            handleToggleModal(
                              customer.customerId,
                              customer.isActive,
                              customer.fullName,
                            )
                          }
                          type="button"
                          aria-label={customer.isActive ? "Deactivate customer" : "Activate customer"}
                          className={`shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 ${
                            customer.isActive
                              ? "bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10"
                          }`}
                        >
                          {customer.isActive ? (
                            <FaToggleOn className="size-7" />
                          ) : (
                            <FaToggleOff className="size-7" />
                          )}
                        </button>
                      </Tooltip>}

                      {canEdit && <Tooltip text="Edit">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/customer-edit/${customer.customerId}`)
                          }
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                          aria-label="Edit customer"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>}

                      {canDelete && <Tooltip text="Delete">
                        <button
                          type="button"
                          onClick={() => handleDeleteModal(customer.customerId)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                          aria-label="Delete customer"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </Tooltip>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Customer?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className="font-semibold text-red-500">delete</span> this
            customer? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={closeDeleteModal}
              disabled={isDeleting}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
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

      {/* Toggle Status Modal */}
      <Modal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setPendingToggle(null);
        }}
      >
        <div className="p-8">
          <div
            className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
              pendingToggle?.currentStatus
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {pendingToggle?.currentStatus ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {pendingToggle?.currentStatus
              ? "Deactivate Customer?"
              : "Activate Customer?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${
                pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"
              }`}
            >
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-semibold text-gray-800 dark:text-white">
              {pendingToggle?.name}
            </span>
            ?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowToggleModal(false);
                setPendingToggle(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all !bg-accent-500 hover:!bg-accent-600 !text-white shadow-lg"
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : pendingToggle?.currentStatus ? (
                "Yes, Deactivate"
              ) : (
                "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerTable;
