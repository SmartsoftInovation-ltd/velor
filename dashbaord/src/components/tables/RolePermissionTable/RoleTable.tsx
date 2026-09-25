import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaSearch, FaTimes, FaShieldAlt } from "react-icons/fa";
import { Modal } from "../../ui/modal";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import type { Role } from "../../../pages/RolePermission/CreateRole";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import { showApiError } from "../../../utils/apiError";

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

// ---------- Props ----------
interface RoleTableProps {
  roles: Role[];
  fetchRoles: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFetching?: boolean;
}

const gridTemplateColumns = "1fr 1fr 1fr 1fr";

export default function RoleTable({ roles, fetchRoles, searchTerm, setSearchTerm }: RoleTableProps) {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // ---------- Delete state ----------
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---------- Edit state ----------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: roles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  // ---------- Handlers ----------
  const handleDelete = async () => {
    if (!selectedRole) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/deleterole/${selectedRole.slug}`);
      toast.success("Role deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      fetchRoles();
    } catch (error) {
      showApiError(error, "Failed to delete role. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedRole(null);
    }
  };

  const handleEdit = async () => {
    if (!editName.trim()) { setEditError("Role name is required."); return; }
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      await axiosSecure.put(`/updaterole/${selectedRole.slug}`, { name: editName.trim() });
      toast.success("Role updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      fetchRoles();
      setShowEditModal(false);
      setSelectedRole(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update role.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md relative group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-[#0A6B43]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-transparent pl-9 pr-9 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#0A6B43] dark:border-gray-700 dark:text-gray-200"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-red-500"
            >
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>


        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">
          {roles.length} role{roles.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
        {/* Sticky Header */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-white/[0.05]"
          style={{ gridTemplateColumns }}
        >
          {["#", "Role Name", "Status", "Actions"].map((h, i) => (
            <div key={h} className={`px-4 py-4 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center ${i === 1 ? "justify-start" : "justify-center"}`}>
              {h}
            </div>
          ))}
        </div>

        {/* Body */}
        {isMobile ? (
          <div className="p-4">
            <MobileCardList
              items={roles}
              getKey={(role) => role._id}
              emptyMessage={searchTerm ? `No results for "${searchTerm}"` : "No roles created yet"}
              renderCard={(role, index) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
                        <FaShieldAlt className="size-3.5 text-brand-500" />
                      </div>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{role.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">#{index + 1}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</span>
                    <Badge
                      size="sm"
                      variant="solid"
                      color={role.isActive ? "success" : "error"}
                      className="font-black text-[10px] uppercase min-w-[70px] text-center"
                    >
                      {role.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/5">
                    <button
                      onClick={() => {
                        setSelectedRole(role);
                        setEditName(role.name);
                        setEditError("");
                        setShowEditModal(true);
                      }}
                      className="size-11 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 dark:hover:border-brand-500 dark:bg-brand-500/5"
                    >
                      <FaEdit className="size-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedRole(role); setShowDeleteModal(true); }}
                      className="size-11 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none"
                    >
                      <MdDelete className="size-5" />
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
        <div ref={parentRef} className="no-scrollbar overflow-y-auto overflow-x-hidden" style={{ maxHeight: 520 }}>
          {roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-4">
                <FaShieldAlt className="size-7 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {searchTerm ? `No results for "${searchTerm}"` : "No roles created yet"}
              </p>
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="mt-2 text-xs text-brand-500 hover:underline font-medium">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const role = roles[virtualRow.index];
                if (!role) return null;
                return (
                  <div
                    key={role._id}
                    className="absolute top-0 left-0 w-full grid items-center border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    style={{ gridTemplateColumns, height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {/* # */}
                    <div className="px-4 flex items-center justify-center text-xs font-mono text-gray-400 dark:text-gray-500">
                      {virtualRow.index + 1}
                    </div>

                    {/* Name */}
                    <div className="px-4 flex items-center gap-2.5">
                      <div className="size-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
                        <FaShieldAlt className="size-3.5 text-brand-500" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {role.name}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-4 flex items-center justify-center">
                      <Badge
                        size="sm"
                        variant="solid"
                        color={role.isActive ? "success" : "error"}
                        className="font-black text-[10px] uppercase min-w-[70px] text-center"
                      >
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Actions: Edit → Delete */}
                    <div className="px-4 flex items-center justify-center gap-2">
                      <Tooltip text="Edit">
                        <button
                          onClick={() => {
                            setSelectedRole(role);
                            setEditName(role.name);
                            setEditError("");
                            setShowEditModal(true);
                          }}
                          className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 dark:hover:border-brand-500 dark:bg-brand-500/5 transition-all active:scale-90"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>

                      <Tooltip text="Delete">
                        <button
                          onClick={() => { setSelectedRole(role); setShowDeleteModal(true); }}
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
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedRole(null); }}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-brand-50 dark:bg-brand-500/10 rounded-full mb-5 mx-auto">
            <FaEdit className="size-7 text-brand-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-5">Edit Role</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              autoFocus
              placeholder="Enter role name"
              className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition ${editError ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}
            />
            {editError && <p className="text-red-500 text-xs mt-1">{editError}</p>}
          </div>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowEditModal(false); setSelectedRole(null); }}
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
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedRole(null); }}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Role?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">{selectedRole?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowDeleteModal(false); setSelectedRole(null); }}
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
