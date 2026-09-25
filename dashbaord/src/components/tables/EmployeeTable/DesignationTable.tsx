import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaSearch, FaSync, FaTimes } from "react-icons/fa";
import { Modal } from "../../ui/modal";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import type { Designation } from "../../employee/DesignationList";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import { showApiError } from "../../../utils/apiError";

// ---------- Tooltip ----------
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
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    }
  };

  return (
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{
              left: coords.x,
              top: coords.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

interface DesignationTableProps {
  designations: Designation[];
  fetchDesignations: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFetching: boolean;
}

const gridTemplateColumns = "1fr 1fr 1fr";
const COLUMNS = ["Serial No", "Designation Name", "Actions"];

export default function DesignationTable({
  designations,
  fetchDesignations,
  searchTerm,
  setSearchTerm,
  isFetching,
}: DesignationTableProps) {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [selected, setSelected] = useState<Designation | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: designations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const handleEdit = async () => {
    if (!editName.trim()) {
      setEditError("Name is required.");
      return;
    }
    if (!selected) return;
    setIsSaving(true);
    try {
      await axiosSecure.put(
        `/employee/update-employee-designation/${selected.slug}`,
        { name: editName.trim() },
      );
      toast.success("Designation updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      fetchDesignations();
      setShowEditModal(false);
      setSelected(null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update designation.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(
        `/employee/delete-employee-designation/${selected.slug}`,
      );
      toast.success("Designation deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      fetchDesignations();
    } catch (error) {
      showApiError(error, "Failed to delete designation.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelected(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by designation name..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="size-3" />
            </button>
          )}
        </div>

        <Tooltip text="Refresh">
          <button
            onClick={fetchDesignations}
            disabled={isFetching}
            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:border-brand-500 transition disabled:opacity-50"
          >
            <FaSync
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </Tooltip>

        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {designations.length} designation
          {designations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={designations}
          getKey={(item) => item._id}
          emptyMessage="No designations found"
          renderCard={(item, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">#{index + 1}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={() => {
                    setSelected(item);
                    setEditName(item.name);
                    setEditError("");
                    setShowEditModal(true);
                  }}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  onClick={() => {
                    setSelected(item);
                    setShowDeleteModal(true);
                  }}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-90"
                >
                  <MdDelete className="size-5" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
        {/* Header */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
          style={{ gridTemplateColumns }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-center"
            >
              {col}
            </div>
          ))}
        </div>

        {/* Body */}
        <div
          key={searchTerm}
          ref={parentRef}
          className="no-scrollbar overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: 650 }}
        >
          {designations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px] text-gray-400 dark:text-gray-500">
              <FaSearch className="size-8 mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">No designations found</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-2 text-xs text-brand-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = designations[virtualRow.index];
                return (
                  <div
                    key={item._id}
                    className="absolute top-0 left-0 w-full grid items-center border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* # */}
                    <div className="px-4 flex items-center justify-center text-xs font-mono text-gray-400 dark:text-gray-500">
                      {virtualRow.index + 1}
                    </div>

                    {/* Name */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {item.name}
                      </span>
                    </div>

                    {/* Actions: Edit → Delete */}
                    <div className="px-4 flex items-center justify-center gap-2">
                      <Tooltip text="Edit">
                        <button
                          onClick={() => {
                            setSelected(item);
                            setEditName(item.name);
                            setEditError("");
                            setShowEditModal(true);
                          }}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Delete">
                        <button
                          onClick={() => {
                            setSelected(item);
                            setShowDeleteModal(true);
                          }}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-90"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelected(null);
        }}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-brand-50 dark:bg-brand-500/10 rounded-full mb-5 mx-auto">
            <FaEdit className="size-7 text-brand-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-6">
            Edit Designation
          </h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Designation Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setEditError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition ${editError ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}
              placeholder="Enter designation name"
              autoFocus
            />
            {editError && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {editError}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowEditModal(false);
                setSelected(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSaving}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelected(null);
        }}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Designation?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">{selected?.name}</span>
            ? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowDeleteModal(false);
                setSelected(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
