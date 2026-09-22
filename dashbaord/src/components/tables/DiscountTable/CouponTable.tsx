import { useState, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { FaEdit, FaSearch, FaTimes, FaToggleOn, FaToggleOff, FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { Link, useNavigate } from "react-router";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// Portal-based Tooltip
const Tooltip = ({ text, children }: { text: string; children: ReactNode }) => {
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

interface Coupon {
  _id: string;
  code: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  expireAt: string;
  usageLimit: number;
  isActive: boolean;
  slug: string;
}

interface CouponTableProps {
  coupons: Coupon[];
  fetchCoupons: () => void;
}

const CouponTable = ({ coupons, fetchCoupons }: CouponTableProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedCouponSlug, setSelectedCouponSlug] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toggle Status State
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Client side search filtering
  const tableData: Coupon[] = Array.isArray(coupons) 
    ? coupons.filter(c => c.code.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const virtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus ? `/coupon/${slug}/deactivate` : `/coupon/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(`Coupon ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      fetchCoupons();
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleDeleteModal = (slug: string) => {
    setSelectedCouponSlug(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => setShowDeleteModal(false);

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/coupon/delete-coupon/${selectedCouponSlug}`);
      toast.success("Coupon deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      fetchCoupons();
    } catch (error) {
      showApiError(error, "Failed to delete the coupon. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedCouponSlug(null);
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="w-full max-w-md relative group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search coupons by code..."
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 group-focus-within:text-brand-500 transition-colors" />
          
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Clear search"
            >
              <FaTimes className="size-4" />
            </button>
          )}
        </div>
      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(coupon) => coupon._id}
          emptyMessage={searchTerm ? `No coupons found matching "${searchTerm}"` : "No coupons available"}
          renderCard={(coupon, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{coupon.code}</p>
                  <p className="text-xs text-gray-400">#{index + 1}</p>
                </div>
                <Badge size="sm" color={coupon.isActive ? "success" : "error"} className="shrink-0">
                  {coupon.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Usage Limit">{coupon.usageLimit}</MobileCardRow>
              <MobileCardRow label="Expires">{new Date(coupon.expireAt).toLocaleDateString()}</MobileCardRow>
              <MobileCardRow label="Value">
                {coupon.discountType === "fixed" ? `${coupon.discountValue} Tk` : `${coupon.discountValue}%`}
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/coupon-view/${coupon.slug}`}>
                  <Button size="sm" variant="outline" className="max-md:size-11 size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-90">
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                <Button
                  onClick={() => handleToggleModal(coupon.slug, coupon.isActive)}
                  size="sm"
                  variant="outline"
                  className={`max-md:size-11 size-9 p-0 rounded-xl transition-all active:scale-90 border-none ${
                    coupon.isActive
                      ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                      : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  }`}
                >
                  {coupon.isActive ? <FaToggleOn className="size-6" /> : <FaToggleOff className="size-6" />}
                </Button>
                <Link to={`/update-coupon/${coupon.slug}`}>
                  <Button size="sm" variant="outline" className="max-md:size-11 size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90">
                    <FaEdit className="size-4" />
                  </Button>
                </Link>
                <Button onClick={() => handleDeleteModal(coupon.slug)} size="sm" className="max-md:size-11 size-9 p-0 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-md transition-all active:scale-90">
                  <MdDelete className="size-4" />
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div
          ref={parentRef}
          className="no-scrollbar max-w-full overflow-auto max-h-[600px]"
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase">
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Sr No.</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Coupon Code</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Usage Limit</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Expired Date</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Value (Tk)</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Value (%)</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Status</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody 
              className="relative w-full divide-y divide-gray-100 dark:divide-white/[0.05]"
              style={{ height: tableData.length === 0 ? "400px" : "auto" }}
            >
              {tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0 border-none">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-white dark:bg-gray-900 rounded-b-xl">
                      <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                        <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {searchTerm ? "No Coupons Found" : "No Coupons Available"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
                        {searchTerm ? (
                          <>
                            We couldn't find any coupons matching <span className="font-bold text-brand-500">"{searchTerm}"</span>.
                          </>
                        ) : (
                          "You haven't added any coupons yet. Create one to get started!"
                        )}
                      </p>
                      {searchTerm ? (
                        <Button 
                          onClick={() => setSearchTerm("")} 
                          variant="outline" 
                          className="rounded-xl px-6 py-2.5 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 font-semibold text-sm"
                        >
                          Go Back to All Coupons
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => navigate(-1)} 
                          variant="outline" 
                          className="rounded-xl px-6 py-2.5 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 font-semibold text-sm"
                        >
                          Go Back
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <TableRow>
                      <TableCell colSpan={8} style={{ height: paddingTop }}>{null}</TableCell>
                    </TableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const coupon = tableData[virtualRow.index];
                    return (
                      <TableRow key={coupon._id} className="dark:text-gray-400">
                        <TableCell className="px-4 py-3 text-theme-sm text-start">
                          {virtualRow.index + 1}.
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm font-medium text-gray-800 dark:text-gray-200 text-start">
                          {coupon.code}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {coupon.usageLimit}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {new Date(coupon.expireAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {coupon.discountType === "fixed" ? `${coupon.discountValue} Tk` : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {coupon.discountType === "percentage" ? `${coupon.discountValue}%` : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          <div className="flex justify-center">
                            <Badge
                              size="sm"
                              color={coupon.isActive ? "success" : "error"}
                            >
                              {coupon.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm">
                          <div className="flex items-center gap-2 justify-center">
                            {/* View Action */}
                            <Tooltip text="View Coupon">
                              <Link to={`/coupon-view/${coupon.slug}`}>
                                <Button size="sm" variant="outline" className="size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-90">
                                  <FaEye className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>

                            {/* Status Toggle Action */}
                            <Tooltip text={coupon.isActive ? "Deactivate" : "Activate"}>
                              <Button
                                onClick={() => handleToggleModal(coupon.slug, coupon.isActive)}
                                size="sm"
                                variant="outline"
                                className={`size-9 p-0 rounded-xl transition-all active:scale-90 border-none ${
                                  coupon.isActive
                                    ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                                    : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                }`}
                              >
                                {coupon.isActive ? <FaToggleOn className="size-6" /> : <FaToggleOff className="size-6" />}
                              </Button>
                            </Tooltip>

                            {/* Edit Action */}
                            <Tooltip text="Edit Coupon">
                              <Link to={`/update-coupon/${coupon.slug}`}>
                                <Button size="sm" variant="outline" className="size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90">
                                  <FaEdit className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>

                            <Tooltip text="Delete Coupon">
                              <Button onClick={() => handleDeleteModal(coupon.slug)} size="sm" className="size-9 p-0 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-md transition-all active:scale-90">
                                <MdDelete className="size-4" />
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <TableRow>
                      <TableCell colSpan={8} style={{ height: paddingBottom }}>{null}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeModal} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className="flex items-center justify-center size-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 mb-5 mx-auto">
            <MdDelete className="text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">Delete Coupon?</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to <span className="font-bold text-red-500">delete</span> this coupon? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5">Cancel</Button>
            <Button onClick={handleDelete} disabled={isDeleting} className="bg-red-500 text-white hover:bg-red-600 flex-1 rounded-xl py-2.5 shadow-lg shadow-red-500/20 disabled:active:scale-100">
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Status Confirmation Modal */}
      <Modal 
        isOpen={showToggleModal} 
        onClose={() => { setShowToggleModal(false); setPendingToggle(null); }}
        className="!w-full !max-w-sm"
      >
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
            pendingToggle?.currentStatus ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"
          }`}>
            {pendingToggle?.currentStatus
              ? <FaToggleOn className="size-8 text-red-500" />
              : <FaToggleOff className="size-8 text-green-500" />
            }
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">
            {pendingToggle?.currentStatus ? "Deactivate Coupon?" : "Activate Coupon?"}
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-bold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this coupon?
          </p>
          <div className="flex gap-3 mt-8">
            <Button
              onClick={() => { setShowToggleModal(false); setPendingToggle(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
                className={`flex-1 rounded-xl py-2.5 font-semibold text-[#1D4ED8] transition-all shadow-lg ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Updating...
                </span>
              ) : (
                pendingToggle?.currentStatus ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CouponTable;
