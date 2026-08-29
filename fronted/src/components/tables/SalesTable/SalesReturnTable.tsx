import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FaSync, FaSearch, FaTimes, FaEye } from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import { MdDelete } from "react-icons/md";
import { Link } from "react-router";
import toast from "react-hot-toast";
import moment from "moment";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";

import { Modal } from "../../ui/modal";

// ---------- Types ----------
interface InvoiceRef {
  _id: string;
  invoiceNumber?: string;
  customerType?: {
    type: "walking" | "listed";
    walking?: { customerName?: string };
    customerId?: { fullName?: string };
  };
}

interface SalesReturn {
  _id: string;
  invoiceNumber?: InvoiceRef | null;
  refundMethod?: { _id: string; name: string } | null;
  returnReason: string;
  totalReturnAmount: number;
  remarks?: string;
  date?: string;
  createdAt: string;
}

const getCustomerLabel = (invoice?: InvoiceRef | null) => {
  if (!invoice?.customerType) return "Walk-in";
  return invoice.customerType.type === "listed"
    ? invoice.customerType.customerId?.fullName || "Listed customer"
    : invoice.customerType.walking?.customerName || "Walk-in";
};

const SalesReturnTable = () => {
  const queryClient = useQueryClient();

  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading, isFetching, isError } = useQuery<SalesReturn[]>({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/sales-return/allsalesreturn");
        return data?.data?.salesReturns || [];
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const allData = data || [];
  const q = searchTerm.trim().toLowerCase();
  const tableData = q
    ? allData.filter(
        (r) =>
          r.invoiceNumber?.invoiceNumber?.toLowerCase().includes(q) ||
          getCustomerLabel(r.invoiceNumber).toLowerCase().includes(q),
      )
    : allData;

  const fetchReturns = () => {
    queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
  };

  const handleDeleteModal = (id: string) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleteLoading(true);
    try {
      await axiosSecure.delete(`/sales-return/delete-salesreturn/${selectedId}`);
      toast.success("Sales return deleted successfully.");
      fetchReturns();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to delete sales return.");
      }
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setSelectedId(null);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en-BD", { minimumFractionDigits: 2 });

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice or customer…"
            className="w-full pl-11 pr-10 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={fetchReturns}
          disabled={isFetching}
          className="size-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          <FaSync className={`size-4 ${isFetching ? "animate-spin text-brand-500" : ""}`} />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-red-500 font-bold mb-4">Error fetching sales returns!</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["sales-returns"] })}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      ) : tableData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 min-h-[300px] gap-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <FaSearch className="size-6 text-gray-300 dark:text-gray-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              {searchTerm ? `No results for "${searchTerm}"` : "No sales returns found"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {searchTerm ? "Try a different search term" : "Sales returns will appear here"}
            </p>
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors"
            >
              <FaTimes className="size-3" />
              Clear search
            </button>
          )}
        </div>
      ) : (
        isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(sr) => sr._id}
          emptyMessage="No sales returns found"
          renderCard={(sr, idx) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-start justify-between gap-3 border-b border-gray-100 pb-2 dark:border-gray-800">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-white">
                    RET-{String(tableData.length - idx).padStart(4, "0")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {moment(sr.date || sr.createdAt).format("DD-MM-YYYY")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/sales-return-invoice-print/${sr._id}`}>
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    >
                      <FaEye className="size-3.5" />
                    </button>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteModal(sr._id)}
                    className="flex size-11 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  >
                    <MdDelete className="size-5" />
                  </button>
                </div>
              </div>
              <MobileCardRow label="Invoice">
                {sr.invoiceNumber?.invoiceNumber || "—"}
              </MobileCardRow>
              <MobileCardRow label="Customer">
                {getCustomerLabel(sr.invoiceNumber)}
              </MobileCardRow>
              <MobileCardRow label="Return Value">
                <span className="font-bold text-red-500">৳{fmt(sr.totalReturnAmount)}</span>
              </MobileCardRow>
            </div>
          )}
        />
        ) : (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  {[
                    "Return #",
                    "Original Invoice",
                    "Customer",
                    "Return Value",
                    "Refund",
                    "Date",
                    "Action",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                        i === 6 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {tableData.map((sr, idx) => (
                  <tr
                    key={sr._id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                  >
                    {/* Return # */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-sm font-bold text-gray-800 dark:text-white">
                        RET-{String(tableData.length - idx).padStart(4, "0")}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {moment(sr.createdAt).format("HH:mm:ss")}
                      </p>
                    </td>

                    {/* Original Invoice */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                        {sr.invoiceNumber?.invoiceNumber || "—"}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {getCustomerLabel(sr.invoiceNumber)}
                      </span>
                    </td>

                    {/* Return Value */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-red-500 tabular-nums">
                        ৳{fmt(sr.totalReturnAmount)}
                      </span>
                    </td>

                    {/* Refund */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                        ৳{fmt(sr.totalReturnAmount)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {moment(sr.date || sr.createdAt).format("DD-MM-YYYY")}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/sales-return-invoice-print/${sr._id}`}>
                          <button
                            type="button"
                            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-all"
                          >
                            <FaEye className="size-3.5" />
                          </button>
                        </Link>
                        <Link to={`/sales-return-invoice-print/${sr._id}`}>
                          <button
                            type="button"
                            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                          >
                            <IoIosPrint className="size-4" />
                          </button>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteModal(sr._id)}
                          className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {/* Result count */}
      {tableData.length > 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-right">
          {tableData.length} return{tableData.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Delete modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">
            Confirm Deletion
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete this sales return? This will roll back the
            restocked quantities and refund amount.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] disabled:opacity-60 transition-colors"
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesReturnTable;
