import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { MdDelete } from "react-icons/md";
import {
  FaEdit,
  FaEye,
  FaSearch,
  FaSync,
  FaTimes,
} from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import { usePermission } from "../../../hooks/usePermission";
import { Modal } from "../../ui/modal";
import StatusPill from "../../common/StatusPill";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// ---------- Types ----------
export interface EmployeeDesignation {
  _id: string;
  name: string;
  slug: string;
}

export interface Employee {
  _id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobile: string;
  nidNumber: string;
  gender: string;
  dateOfBirth: string;
  joiningDate: string;
  religion: string;
  designation: EmployeeDesignation | null;
  presentAddress: string;
  permanentAddress: string;
  image: { url: string; status: string } | string;
  isActive: boolean;
}

interface EmployeeTableProps {
  employees: Employee[];
  fetchEmployees: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFetching: boolean;
}

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

const gridTemplateColumns = "150px 72px 1fr 1fr 1fr 1fr 120px 200px";
const COLUMNS = ["Serial ID", "Photo", "Name", "Designation", "Contact", "Joining Date", "Status", "Actions"];

function getImageUrl(image: Employee["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.url || "";
}

export default function EmployeeTable({
  employees,
  fetchEmployees,
  searchTerm,
  setSearchTerm,
  isFetching,
}: EmployeeTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit   = usePermission("employee", "edit");
  const canDelete = usePermission("employee", "delete");
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: employees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/employee/delete-employee/${selectedEmployee.employeeId}`);
      toast.success("Employee deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      fetchEmployees();
    } catch (error) {
      showApiError(error, "Failed to delete employee.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedEmployee(null);
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
            placeholder="Search by serial, name, mobile..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
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
            onClick={fetchEmployees}
            disabled={isFetching}
            aria-label="Refresh"
            className="shine size-9 flex items-center justify-center rounded-md border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-all active:scale-90 disabled:opacity-50"
          >
            <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>

        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {employees.length} employee{employees.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={employees}
          getKey={(emp) => emp._id}
          emptyMessage="No employees found"
          renderCard={(emp, index) => {
            const photoUrl = getImageUrl(emp.image);
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={emp.fullName}
                      className="size-12 shrink-0 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded-full bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold text-sm">
                      {emp.fullName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{emp.fullName}</p>
                    <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">
                      {emp.employeeId || `#${index + 1}`}
                    </p>
                  </div>
                </div>
                <MobileCardRow label="Designation">
                  {emp.designation?.name || "N/A"}
                </MobileCardRow>
                <MobileCardRow label="Mobile">{emp.mobile || "N/A"}</MobileCardRow>
                <MobileCardRow label="Email">{emp.email || "N/A"}</MobileCardRow>
                <MobileCardRow label="Joining Date">
                  {emp.joiningDate
                    ? new Date(emp.joiningDate).toLocaleDateString("en-GB")
                    : "N/A"}
                </MobileCardRow>
                <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => navigate(`/employee-view/${emp._id}`)}
                    className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                    aria-label="View employee"
                  >
                    <FaEye className="size-4" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => navigate(`/employee-edit/${emp._id}`)}
                      className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                      aria-label="Edit employee"
                    >
                      <FaEdit className="size-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setShowDeleteModal(true);
                      }}
                      className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                      aria-label="Delete employee"
                    >
                      <MdDelete className="size-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          }}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
        {/* Header — outside scroll container */}
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
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px] text-gray-400 dark:text-gray-500">
              <FaSearch className="size-8 mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">No employees found</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-2 text-xs text-accent-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const emp = employees[virtualRow.index];
                const photoUrl = getImageUrl(emp.image);
                return (
                  <div
                    key={emp._id}
                    className="absolute top-0 left-0 w-full grid items-center border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Employee ID */}
                    <div className="px-4 flex items-center justify-center">
                      {emp.employeeId ? (
                        <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{emp.employeeId}</span>
                      ) : (
                        <span className="font-medium text-gray-500 dark:text-gray-400">#{virtualRow.index + 1}</span>
                      )}
                    </div>

                    {/* Photo */}
                    <div className="px-2 flex items-center justify-center">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={emp.fullName}
                          className="size-10 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                        />
                      ) : (
                        <div className="size-10 rounded-full bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold text-sm">
                          {emp.fullName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="px-4 flex items-center justify-center">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate text-center">
                        {emp.fullName}
                      </p>
                    </div>

                    {/* Designation */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {emp.designation?.name || (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </span>
                    </div>

                    {/* Contact */}
                    <div className="px-4 flex flex-col items-center justify-center min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-200 font-mono truncate text-center">
                        {emp.mobile || <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate text-center">
                        {emp.email || ""}
                      </p>
                    </div>

                    {/* Joining date */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {emp.joiningDate
                          ? new Date(emp.joiningDate).toLocaleDateString("en-GB")
                          : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-4 flex items-center justify-center">
                      <StatusPill isActive={emp.isActive !== false} />
                    </div>

                    {/* Actions: View → Edit → Delete */}
                    <div className="px-4 flex items-center justify-center gap-2">
                      <Tooltip text="View">
                        <button
                          type="button"
                          onClick={() => navigate(`/employee-view/${emp._id}`)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                          aria-label="View employee"
                        >
                          <FaEye className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Print">
                        <button
                          type="button"
                          onClick={() => navigate(`/employee-invoice-print/${emp._id}`)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                          aria-label="Print employee"
                        >
                          <IoIosPrint className="size-4" />
                        </button>
                      </Tooltip>
                      {canEdit && (
                      <Tooltip text="Edit">
                        <button
                          type="button"
                          onClick={() => navigate(`/employee-edit/${emp._id}`)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                          aria-label="Edit employee"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>
                      )}
                      {canDelete && (
                      <Tooltip text="Delete">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowDeleteModal(true);
                          }}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                          aria-label="Delete employee"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedEmployee(null);
        }}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Employee?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">
              {selectedEmployee?.fullName}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedEmployee(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
