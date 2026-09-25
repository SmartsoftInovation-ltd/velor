import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEye, FaSearch, FaTimes } from "react-icons/fa";
import { MdSend } from "react-icons/md";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import Label from "../form/Label";

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

  const handleSingleSms = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSmsMessage("");
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
          onClick={() => { setBulkMessage(""); setShowBulkSmsModal(true); }}
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
                          onClick={() => handleView(customer)}
                          className="size-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-colors"
                        >
                          <FaEye className="text-sm" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Send SMS">
                        <button
                          onClick={() => handleSingleSms(customer)}
                          disabled={sendingId === customer.id || !customer.isActive}
                          className="size-8 flex items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-500 hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {sendingId === customer.id ? (
                            <div className="size-3.5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                          ) : (
                            <MdSend className="text-sm" />
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
        onClose={() => { setShowViewModal(false); setViewCustomer(null); }}
        className="max-w-md w-full"
        showCloseButton={false}
      >
        {viewCustomer && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                Customer Details
              </h3>
              <button
                onClick={() => { setShowViewModal(false); setViewCustomer(null); }}
                className="size-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <Row label="Name" value={viewCustomer.fullName} />
              <Row label="Mobile" value={viewCustomer.mobileNumber} />
              <Row label="Customer ID" value={viewCustomer.customerId} />
              <Row
                label="Type"
                value={viewCustomer.customerType?.customerType || "—"}
              />
              <Row
                label="Opening Dues"
                value={`৳ ${viewCustomer.openingDues.toLocaleString()}`}
                highlight={viewCustomer.openingDues > 0}
              />
              <Row
                label="Status"
                value={viewCustomer.isActive ? "Active" : "Inactive"}
              />
              <Row
                label="Joined"
                value={new Date(viewCustomer.createdAt).toLocaleDateString("en-BD")}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  handleSingleSms(viewCustomer);
                }}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
              >
                Send SMS
              </Button>
              <Button
                onClick={() => { setShowViewModal(false); setViewCustomer(null); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Single SMS Modal ---------- */}
      <Modal
        isOpen={showSingleSmsModal}
        onClose={() => { setShowSingleSmsModal(false); setSmsMessage(""); setSelectedCustomer(null); }}
        className="max-w-md w-full"
        showCloseButton={false}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Send SMS
            </h3>
            <button
              onClick={() => { setShowSingleSmsModal(false); setSmsMessage(""); setSelectedCustomer(null); }}
              className="size-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
          {selectedCustomer && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm space-y-1">
              <p className="font-semibold text-gray-800 dark:text-white">
                {selectedCustomer.fullName}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                {selectedCustomer.mobileNumber}
              </p>
              {selectedCustomer.openingDues > 0 && (
                <p className="text-red-500 font-medium">
                  Due: ৳ {selectedCustomer.openingDues.toLocaleString()}
                </p>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="sms-message">Message</Label>
            <textarea
              id="sms-message"
              rows={4}
              placeholder="Type your SMS message..."
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">{smsMessage.length} characters</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSendSingle}
              disabled={!!sendingId || !smsMessage.trim()}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43]"
            >
              {sendingId ? "Sending..." : "Send SMS"}
            </Button>
            <Button
              onClick={() => { setShowSingleSmsModal(false); setSmsMessage(""); setSelectedCustomer(null); }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------- Bulk SMS Modal ---------- */}
      <Modal
        isOpen={showBulkSmsModal}
        onClose={() => { setShowBulkSmsModal(false); setBulkMessage(""); }}
        className="max-w-md w-full"
        showCloseButton={false}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Send SMS to All Customers
            </h3>
            <button
              onClick={() => { setShowBulkSmsModal(false); setBulkMessage(""); }}
              className="size-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
            This will send SMS to <strong>{tableData.length}</strong> customers in the background. You will be notified when complete.
          </div>
          <div>
            <Label htmlFor="bulk-sms-message">Message</Label>
            <textarea
              id="bulk-sms-message"
              rows={4}
              placeholder="Type your SMS message..."
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">{bulkMessage.length} characters</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSendAll}
              disabled={sendingBulk || !bulkMessage.trim()}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43]"
            >
              {sendingBulk ? "Queuing..." : `Send to All (${tableData.length})`}
            </Button>
            <Button
              onClick={() => { setShowBulkSmsModal(false); setBulkMessage(""); }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Helper ----------
function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span
        className={`font-medium text-right ${
          highlight
            ? "text-red-500"
            : "text-gray-800 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
