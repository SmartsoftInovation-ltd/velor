import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import moment from "moment";
import toast from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaToggleOn, FaToggleOff, FaSearch, FaTimes, FaEye } from "react-icons/fa";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { Modal } from "../../ui/modal";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import Input from "../../form/input/InputField";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";

// ---------- Types ----------
interface Role {
  _id: string;
  name: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  roles?: Role[];
  image?: { url: string };
  createdAt?: string;
  discountLimit?: number;
}

interface UserTableProps {
  users: User[] | null;
  fetchUsers: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFetching?: boolean;
}

// ---------- Portal Tooltip ----------
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setVisible(true);
    }
  };

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}
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

// ---------- Component ----------
export default function UserTable({
  users,
  fetchUsers,
  searchTerm,
  setSearchTerm,
}: UserTableProps) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ id: string; currentStatus: boolean; name: string } | null>(null);
  const [showToggleModal, setShowToggleModal] = useState(false);

  const tableData = users || [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const gridTemplateColumns = "56px 1fr 1fr 1fr 1fr 110px 110px 180px";

  // ---------- Handlers ----------
  const handleDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await axiosSecure.delete(`/auth/delete-user/${selectedUser._id}`);
      toast.success("User deleted successfully.");
      fetchUsers();
    } catch (error) {
      showApiError(error, "Failed to delete user. Please try again.");
    } finally {
      setShowDeleteModal(false);
      setSelectedUser(null);
    }
  };

  const handleToggleModal = (user: User) => {
    setPendingToggle({ id: user._id, currentStatus: user.isActive, name: user.name });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    if (!pendingToggle) return;
    try {
      const endpoint = pendingToggle.currentStatus
        ? `/auth/deactivate-user/${pendingToggle.id}`
        : `/auth/activate-user/${pendingToggle.id}`;
      await axiosSecure.put(endpoint);
      toast.success(`User ${pendingToggle.currentStatus ? "deactivated" : "activated"} successfully.`);
      fetchUsers();
    } catch (error) {
      showApiError(error, "Failed to update user status.");
    } finally {
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md relative group">
          <Input
            placeholder="Search by name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg pl-9 pr-9 transition-colors"
          />
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-[#1D4ED8]" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-red-500"
            >
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>

      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(user) => user._id}
          emptyMessage="No users found"
          renderCard={(user) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-center gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {user.image?.url ? (
                    <img src={user.image.url} alt={user.name} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm font-bold text-gray-400">
                      {user.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-800 dark:text-white/90">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-gray-400">{user.email}</p>
                </div>
                <Badge size="sm" color={user.isActive ? "success" : "error"}>
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Phone">{user.phone || "—"}</MobileCardRow>
              <MobileCardRow label="Roles">
                {user.roles?.map((r) => r.name).join(", ") || "—"}
              </MobileCardRow>
              <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate(`/user-view/${user._id}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  <FaEye className="size-4" />
                </button>
                <button
                  onClick={() => handleToggleModal(user)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  {user.isActive ? <FaToggleOn className="size-4" /> : <FaToggleOff className="size-4" />}
                </button>
                <button
                  onClick={() => navigate(`/user-edit/${user._id}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  onClick={() => handleDeleteModal(user)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-500 text-white"
                >
                  <MdDelete className="size-4" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
        {/* Sticky Header */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-white/[0.05]"
          style={{ gridTemplateColumns }}
        >
          {["S/N", "Name", "Email", "Phone", "Role", "Created", "Status", "Actions"].map((h) => (
            <div
              key={h}
              className="px-4 py-4 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-center"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Scroll Body */}
        <div
          ref={parentRef}
          className="no-scrollbar overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: 600, minHeight: 400 }}
        >
          {tableData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-5">
                <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">No Users Found</h3>
              {searchTerm ? (
                <>
                  <p className="text-sm text-gray-400 mb-5">
                    No results for <span className="font-semibold text-brand-500">"{searchTerm}"</span>
                  </p>
                  <Button onClick={() => setSearchTerm("")} variant="outline" className="rounded-xl px-6 text-sm">
                    Clear Search
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-400">No users have been added yet.</p>
              )}
            </div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const user = tableData[virtualRow.index];
                if (!user) return null;
                return (
                  <div
                    key={user._id}
                    className="absolute top-0 left-0 w-full grid items-center border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* S/N */}
                    <div className="px-4 text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center">
                      #{virtualRow.index + 1}
                    </div>

                    {/* Name + avatar */}
                    <div className="px-4 flex items-center gap-3 min-w-0">
                      {user.image?.url ? (
                        <img
                          src={user.image.url}
                          alt={user.name}
                          className="size-9 rounded-xl object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="size-9 rounded-xl bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                            {user.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {user.name}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{user.email}</span>
                    </div>

                    {/* Phone */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {user.phone || <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </span>
                    </div>

                    {/* Role */}
                    <div className="px-4 flex items-center justify-center">
                      {user.roles && user.roles.length > 0 ? (
                        <Badge size="sm" variant="light" color="primary" className="font-semibold text-[11px]">
                          {user.roles[0].name}
                        </Badge>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      )}
                    </div>

                    {/* Created */}
                    <div className="px-4 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                        {user.createdAt ? moment(user.createdAt).format("MMM DD, YYYY") : "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-4 flex items-center justify-center">
                      <Badge
                        size="sm"
                        variant="solid"
                        color={user.isActive ? "success" : "error"}
                        className="min-w-[70px] font-black text-[10px] uppercase shadow-sm"
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Actions: View → Toggle → Edit → Delete */}
                    <div className="px-4 flex items-center justify-center gap-2">
                      <Tooltip text="View">
                        <button
                          onClick={() => navigate(`/user-view/${user._id}`)}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-blue-400 hover:text-blue-500 hover:border-blue-400 dark:hover:border-blue-500 dark:bg-blue-500/5 transition-all active:scale-90"
                        >
                          <FaEye className="size-4" />
                        </button>
                      </Tooltip>

                      <Tooltip text={user.isActive ? "Deactivate" : "Activate"}>
                        <button
                          onClick={() => handleToggleModal(user)}
                          className={`size-10 p-0 flex items-center justify-center rounded-2xl border-none transition-all active:scale-90 ${
                            user.isActive
                              ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/15"
                              : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                          }`}
                        >
                          {user.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                        </button>
                      </Tooltip>

                      <Tooltip text="Edit">
                        <button
                          onClick={() => navigate(`/user-edit/${user._id}`)}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 dark:hover:border-brand-500 dark:bg-brand-500/5 transition-all active:scale-90"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>

                      <Tooltip text="Delete">
                        <button
                          onClick={() => handleDeleteModal(user)}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
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

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete User?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">{selectedUser?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
                className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Status Modal */}
      <Modal
        isOpen={showToggleModal}
        onClose={() => { setShowToggleModal(false); setPendingToggle(null); }}
      >
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
            pendingToggle?.currentStatus
              ? "bg-red-50 dark:bg-red-500/10"
              : "bg-green-50 dark:bg-green-500/10"
          }`}>
            {pendingToggle?.currentStatus
              ? <FaToggleOn className="size-8 text-red-500" />
              : <FaToggleOff className="size-8 text-green-500" />
            }
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {pendingToggle?.currentStatus ? "Deactivate User?" : "Activate User?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-semibold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">{pendingToggle?.name}</span>?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowToggleModal(false); setPendingToggle(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {pendingToggle?.currentStatus ? "Yes, Deactivate" : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
