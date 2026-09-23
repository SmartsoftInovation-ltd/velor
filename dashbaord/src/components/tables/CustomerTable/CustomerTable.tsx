import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
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
}

const CustomerTable = ({
  customers,
  fetchCustomers,
  searchTerm,
  setSearchTerm,
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

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const gridTemplateColumns =
    "1fr 60px 1.4fr 1.2fr 1.1fr 1.2fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 0.9fr 148px";

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
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
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
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search by serial, name, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-12 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm font-medium h-12"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              >
                <FaTimes className="size-4" />
              </button>
            )}
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
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <FaSync className="size-5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(customer, index) => customer.customerId || index}
          emptyMessage={
            searchTerm
              ? `No customers match "${searchTerm}"`
              : "No customers yet"
          }
          renderCard={(customer) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                {customer.image?.url ? (
                  <img
                    src={customer.image.url}
                    className="w-12 h-12 shrink-0 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow"
                    alt={customer.fullName}
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm">
                    {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{customer.fullName || "—"}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-semibold mt-1">
                    {customer.customSerialId || "—"}
                  </span>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={customer.isActive ? "success" : "error"}
                  className="text-[10px] font-bold uppercase shrink-0"
                >
                  {customer.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Customer ID">{customer.customerId || "N/A"}</MobileCardRow>
              <MobileCardRow label="Type">{customer.customerType?.customerType || "N/A"}</MobileCardRow>
              <MobileCardRow label="Mobile">{customer.mobileNumber || "N/A"}</MobileCardRow>
              <MobileCardRow label="Dues (৳)">
                <span className={(customer.openingDues || 0) > 0 ? "text-red-500 font-semibold" : ""}>
                  {customer.openingDues != null ? customer.openingDues : "N/A"}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Initial Due (৳)">
                {customer.initialDue != null ? customer.initialDue : "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Discount">
                {customer.regularDiscountPercent != null ? `${customer.regularDiscountPercent}%` : "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Due Limit">{customer.dueLimit != null ? customer.dueLimit : "N/A"}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={() => handleViewCustomer(customer)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                >
                  <FaEye className="size-4" />
                </button>
                {canToggle && (
                  <button
                    onClick={() =>
                      handleToggleModal(customer.customerId, customer.isActive, customer.fullName)
                    }
                    className={`max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl transition-colors ${
                      customer.isActive
                        ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                        : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    }`}
                  >
                    {customer.isActive ? <FaToggleOn className="size-6" /> : <FaToggleOff className="size-6" />}
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => navigate(`/customer-edit/${customer.customerId}`)}
                    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                  >
                    <FaEdit className="size-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteModal(customer.customerId)}
                    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    <MdDelete className="size-4" />
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
          className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-white/5 px-3 py-3"
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
              className="flex items-center justify-center text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wide"
            >
              {h}
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
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
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
                    key={customer.customerId || virtualRow.index}
                    className="absolute top-0 left-0 w-full grid items-center px-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Serial ID */}
                    <div className="flex items-center justify-center px-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-semibold whitespace-nowrap">
                        {customer.customSerialId || "—"}
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
                        <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm">
                          {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {customer.fullName || "—"}
                      </span>
                    </div>

                    {/* Customer ID */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                        {customer.customerId || "—"}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {customer.customerType?.customerType || "—"}
                      </span>
                    </div>

                    {/* Mobile */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {customer.mobileNumber || "—"}
                      </span>
                    </div>

                    {/* Dues */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`text-sm font-semibold ${(customer.openingDues || 0) > 0 ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {customer.openingDues != null
                          ? customer.openingDues
                          : "N/A"}
                      </span>
                    </div>

                    {/* Initial Due — the figure carried in at creation, not
                        moved by transactions. */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {customer.initialDue != null ? customer.initialDue : "N/A"}
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
                        {customer.dueLimit != null ? customer.dueLimit : "N/A"}
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
                      <Badge
                        size="sm"
                        variant="solid"
                        color={customer.isActive ? "success" : "error"}
                        className="text-[10px] font-bold uppercase"
                      >
                        {customer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip text="View">
                        <button
                          onClick={() => handleViewCustomer(customer)}
                          className="size-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                        >
                          <FaEye className="size-3.5" />
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
                          className={`size-8 flex items-center justify-center rounded-xl transition-colors ${
                            customer.isActive
                              ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                              : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          }`}
                        >
                          {customer.isActive ? (
                            <FaToggleOn className="size-5" />
                          ) : (
                            <FaToggleOff className="size-5" />
                          )}
                        </button>
                      </Tooltip>}

                      {canEdit && <Tooltip text="Edit">
                        <button
                          onClick={() =>
                            navigate(`/customer-edit/${customer.customerId}`)
                          }
                          className="size-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        >
                          <FaEdit className="size-3.5" />
                        </button>
                      </Tooltip>}

                      {canDelete && <Tooltip text="Delete">
                        <button
                          onClick={() => handleDeleteModal(customer.customerId)}
                          className="size-8 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          <MdDelete className="size-4" />
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
                className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
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
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
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
