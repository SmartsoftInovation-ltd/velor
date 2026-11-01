import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEye, FaSearch, FaTimes, FaUsers } from "react-icons/fa";
import { MdSend } from "react-icons/md";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import Label from "../form/Label";
import { DUE_NAME_TOKEN, DUE_SMS_TEMPLATE, DUE_TOKEN, hasDueTokens, renderDueSms } from "../../utils/dueSmsTemplate";
import SmsMessageBox from "./SmsMessageBox";
import SmsPreview from "./SmsPreview";

// ---------- Types ----------
interface CustomerType {
  customerType: string;
  slug: string;
}

interface Customer {
  id: string;
  customerId: string;
  fullName: string;
  mobileNumber: string;
  secondaryMobileNumber?: string;
  openingDues: number;
  customerType: CustomerType;
  isActive: boolean;
  createdAt: string;
}

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default function DueSmsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSingleSmsModal, setShowSingleSmsModal] = useState(false);
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: customers, isLoading, isError, refetch } = useQuery({
    queryKey: ["due-sms-customers", debouncedSearch],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/customer/get-customers");
      const list: Customer[] = data.data.customers || [];
      if (!debouncedSearch) return list;
      const q = debouncedSearch.toLowerCase();
      return list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.mobileNumber.includes(q) ||
          c.customerId.includes(q),
      );
    },
    staleTime: 2 * 60 * 1000,
  });

  const tableData = customers || [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const gridTemplateColumns = "50px 1fr 1fr 1fr 1fr 1fr 120px";

  const handleView = (customer: Customer) => {
    setViewCustomer(customer);
    setShowViewModal(true);
  };

  const closeView = () => {
    setShowViewModal(false);
    setViewCustomer(null);
  };
  const closeSingle = () => {
    if (sendingId) return;
    setShowSingleSmsModal(false);
    setSmsMessage("");
    setSelectedCustomer(null);
  };
  const closeBulk = () => {
    if (sendingBulk) return;
    setShowBulkSmsModal(false);
    setBulkMessage("");
  };

  // The due reminder: one customer gets their real name and due filled in;
  // "Send to all" keeps #name# / #due#, which the server fills in per customer
  const dueReminderFor = (c: Customer) => renderDueSms(DUE_SMS_TEMPLATE, c);
  // Customers a "Send to all" reaches: only those who owe, once #due# is in it
  const bulkRecipients = bulkMessage.includes(DUE_TOKEN)
    ? tableData.filter((c) => c.isActive && c.openingDues > 0)
    : tableData.filter((c) => c.isActive);
  const sampleCustomer = bulkRecipients[0];
  const bulkPreview = hasDueTokens(bulkMessage) && sampleCustomer ? renderDueSms(bulkMessage, sampleCustomer) : bulkMessage;

  const handleSingleSms = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSmsMessage(dueReminderFor(customer));
    setShowSingleSmsModal(true);
  };

  const handleSendSingle = async () => {
    if (!smsMessage.trim()) {
      toast.error("Message is required");
      return;
    }
    if (!selectedCustomer) return;
    setSendingId(selectedCustomer.id);
    try {
      await axiosSecure.post(`/sms/due-sms/send/${selectedCustomer.id}`, {
        message: smsMessage,
      });
      toast.success(`SMS sent to ${selectedCustomer.fullName}`);
      setShowSingleSmsModal(false);
      setSmsMessage("");
      setSelectedCustomer(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send SMS");
    } finally {
      setSendingId(null);
    }
  };

  const handleSendAll = async () => {
    if (!bulkMessage.trim()) {
      toast.error("Message is required");
      return;
    }
    setSendingBulk(true);
    try {
      const { data } = await axiosSecure.post("/sms/due-sms/send-all", {
        message: bulkMessage,
      });
      toast.success(
        `Bulk SMS queued for ${data.data.totalCount} customers. You will be notified when complete.`,
      );
      setShowBulkSmsModal(false);
      setBulkMessage("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to queue bulk SMS");
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <div className="relative w-full">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search by name, mobile, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-transparent pl-9 pr-9 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#0A6B43] dark:border-gray-700 dark:text-gray-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>
        </div>

        <Button
          onClick={() => { setBulkMessage(DUE_SMS_TEMPLATE); setShowBulkSmsModal(true); }}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <MdSend className="text-base" />
          Send All ({tableData.length})
        </Button>
      </div>

      {/* ---------- Table ---------- */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-red-500 font-bold mb-4">Error fetching customers!</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      ) : tableData.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          No customers found.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div
            className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
            style={{ gridTemplateColumns }}
          >
            <div>#</div>
            <div>Customer</div>
            <div>Mobile</div>
            <div>Type</div>
            <div>Dues (৳)</div>
            <div>Status</div>
            <div className="text-center">Actions</div>
          </div>

          {/* Virtualized rows */}
          <div
            ref={parentRef}
            className="no-scrollbar overflow-y-auto"
            style={{ maxHeight: 600 }}
          >
            <div
              style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const customer = tableData[virtualRow.index];
                return (
                  <div
                    key={customer.id}
                    className="absolute top-0 left-0 w-full grid items-center px-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {virtualRow.index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {customer.fullName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {customer.customerId}
                      </p>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {customer.mobileNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {customer.customerType?.customerType || "—"}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        customer.openingDues > 0
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {customer.openingDues.toLocaleString()}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          customer.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Tooltip text="View">
                        <button
                          type="button"
                          onClick={() => handleView(customer)}
                          aria-label={`View ${customer.fullName}`}
                          className="shine flex size-10 items-center justify-center rounded bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 hover:text-gray-900 active:scale-90 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                        >
                          <FaEye className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Send SMS">
                        <button
                          onClick={() => handleSingleSms(customer)}
                          disabled={sendingId === customer.id || !customer.isActive}
                          aria-label={`Send SMS to ${customer.fullName}`}
                          className="shine flex size-10 items-center justify-center rounded bg-accent-50 text-accent-600 transition-all hover:bg-accent-100 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25"
                        >
                          {sendingId === customer.id ? (
                            <div className="size-3.5 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-500" />
                          ) : (
                            <MdSend className="size-4" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
            Total {tableData.length} customers
          </div>
        </div>
      )}

      {/* ---------- View Customer Modal ---------- */}
      <Modal
        isOpen={showViewModal}
        onClose={closeView}
        className="w-[calc(100%-2rem)] max-w-3xl"
        showCloseButton={false}
      >
        {viewCustomer && (
          <div className="space-y-6 p-6 sm:p-8">
            {/* Who */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-accent-400 to-accent-600 text-xl font-bold uppercase text-white shadow-sm">
                  {viewCustomer.fullName?.charAt(0) || "?"}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-gray-800 dark:text-white">{viewCustomer.fullName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{viewCustomer.mobileNumber}</p>
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      viewCustomer.isActive
                        ? "bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-500/15 dark:text-accent-400 dark:ring-accent-500/30"
                        : "bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/30"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${viewCustomer.isActive ? "animate-pulse bg-accent-500" : "bg-error-500"}`} />
                    {viewCustomer.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeView}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <FaTimes className="size-3" />
              </button>
            </div>

            {/* What they owe */}
            <div
              className={`flex items-center justify-between rounded-2xl p-5 ${
                viewCustomer.openingDues > 0
                  ? "bg-error-50 dark:bg-error-500/10"
                  : "bg-accent-50 dark:bg-accent-500/10"
              }`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Due balance</p>
                <p
                  className={`mt-1 text-3xl font-bold tabular-nums ${
                    viewCustomer.openingDues > 0 ? "text-error-600 dark:text-error-400" : "text-accent-600 dark:text-accent-400"
                  }`}
                >
                  ৳ {viewCustomer.openingDues.toLocaleString()}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {viewCustomer.openingDues > 0 ? "Payment pending" : "Nothing due"}
              </span>
            </div>

            {/* Details */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="Customer ID" value={viewCustomer.customerId} mono />
              <DetailItem label="Customer type" value={viewCustomer.customerType?.customerType || "—"} />
              <DetailItem label="Mobile" value={viewCustomer.mobileNumber} />
              {viewCustomer.secondaryMobileNumber && (
                <DetailItem label="Secondary mobile" value={viewCustomer.secondaryMobileNumber} />
              )}
              <DetailItem
                label="Customer since"
                value={new Date(viewCustomer.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              />
            </dl>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!viewCustomer.isActive}
                onClick={() => {
                  const customer = viewCustomer;
                  closeView();
                  handleSingleSms(customer);
                }}
                className="shine flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                title={viewCustomer.isActive ? undefined : "Inactive customers cannot be messaged"}
              >
                <MdSend className="size-4" />
                Send SMS
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Single SMS Modal ---------- */}
      <Modal
        isOpen={showSingleSmsModal}
        onClose={closeSingle}
        className="w-[calc(100%-2rem)] max-w-6xl"
        showCloseButton={false}
      >
        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                <MdSend className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Send SMS</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">One message to this customer, previewed as they will see it.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeSingle}
              aria-label="Close"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <FaTimes className="size-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {selectedCustomer && (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 font-semibold uppercase text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                    {selectedCustomer.fullName?.charAt(0) || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-800 dark:text-white">{selectedCustomer.fullName}</p>
                    <p className="text-gray-500 dark:text-gray-400">{selectedCustomer.mobileNumber}</p>
                  </div>
                  {selectedCustomer.openingDues > 0 && (
                    <span className="shrink-0 rounded-full bg-error-50 px-2.5 py-1 text-xs font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-400">
                      Due ৳{selectedCustomer.openingDues.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label htmlFor="sms-message">Message</Label>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => setSmsMessage(dueReminderFor(selectedCustomer))}
                      className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 transition-colors hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400"
                    >
                      Use due reminder
                    </button>
                  )}
                </div>
                <SmsMessageBox id="sms-message" value={smsMessage} onChange={setSmsMessage} rows={9} autoFocus />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeSingle}
                  disabled={!!sendingId}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendSingle}
                  disabled={!!sendingId || !smsMessage.trim()}
                  className="shine flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
                >
                  {sendingId ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <MdSend className="size-4" />
                      Send SMS
                    </>
                  )}
                </button>
              </div>
            </div>
            <SmsPreview message={smsMessage} recipientLabel={selectedCustomer?.fullName} recipientCount={1} />
          </div>
        </div>
      </Modal>

      {/* ---------- Bulk SMS Modal ---------- */}
      <Modal
        isOpen={showBulkSmsModal}
        onClose={closeBulk}
        className="w-[calc(100%-2rem)] max-w-6xl"
        showCloseButton={false}
      >
        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                <FaUsers className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Send SMS to all customers</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">The same message to everyone, sent in the background.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeBulk}
              aria-label="Close"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <FaTimes className="size-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-xl bg-accent-50 p-3 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-300">
                Goes to <strong>{bulkRecipients.length.toLocaleString()}</strong>{" "}
                {bulkMessage.includes(DUE_TOKEN) ? "customers with a due balance" : "active customers"} in the
                background. Each one gets their own name and due in place of <code>#name#</code> and{" "}
                <code>#due#</code>. The SMS history shows when it is done.
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label htmlFor="bulk-sms-message">Message</Label>
                  <button
                    type="button"
                    onClick={() => setBulkMessage(DUE_SMS_TEMPLATE)}
                    className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 transition-colors hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400"
                  >
                    Use due reminder
                  </button>
                </div>
                <SmsMessageBox
                  id="bulk-sms-message"
                  value={bulkMessage}
                  onChange={setBulkMessage}
                  rows={9}
                  autoFocus
                  placeholder="Everyone gets this text, with #name# and #due# filled in per customer…"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-gray-400">Insert:</span>
                  {[DUE_NAME_TOKEN, DUE_TOKEN].map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setBulkMessage((m) => `${m}${m && !m.endsWith(" ") ? " " : ""}${token}`)}
                      className="rounded-md border border-gray-200 px-2 py-0.5 font-mono text-gray-600 transition-colors hover:border-accent-400 hover:text-accent-700 dark:border-gray-700 dark:text-gray-300"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeBulk}
                  disabled={sendingBulk}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendAll}
                  disabled={sendingBulk || !bulkMessage.trim() || bulkRecipients.length === 0}
                  className="shine flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
                >
                  {sendingBulk ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Queuing…
                    </>
                  ) : (
                    <>
                      <MdSend className="size-4" />
                      Send to {bulkRecipients.length.toLocaleString()}
                    </>
                  )}
                </button>
              </div>
            </div>
            <SmsPreview
              message={bulkPreview}
              recipientLabel={sampleCustomer && hasDueTokens(bulkMessage) ? `${sampleCustomer.fullName} (example)` : "All customers"}
              recipientCount={bulkRecipients.length}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Helper ----------
function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm font-semibold text-gray-800 dark:text-white/90 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
