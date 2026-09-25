import { FaEdit } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import Button from "../../ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "../../ui/modal";
import { Link } from "react-router";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";
import { usePermission } from "../../../hooks/usePermission";

interface DeliveryCharge {
  _id: string;
  name: string;
  deliveryCharge: number;
}
const DeliveryChargeTable = () => {
  const [deliveryChargeList, setDeliveryChargeList] = useState<
    DeliveryCharge[]
  >([]);
  const [selectedDeliveryCharge, setSelectedDeliveryCharge] = useState<
    string | null
  >(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();
  const canEdit = usePermission("delivery-charge", "edit");
  const canDelete = usePermission("delivery-charge", "delete");

  const fetchDeliveryChargeList = async () => {
    try {
      const { data } = await axiosSecure.get(
        `/delivery-charge/get-delivery-charge`
      );
      setDeliveryChargeList(data.data);
    } catch (error) {
      showApiError(error, "Error fetching delivery charge list");
    }
  };

  useEffect(() => {
    fetchDeliveryChargeList();
  }, []);

  const handleDeleteModal = (id: string) => {
    setSelectedDeliveryCharge(id);
    setShowDeleteModal(true);
  };

  const closeModal = () => setShowDeleteModal(false);
  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(
        `/delivery-charge/delete-delivery-charge/${selectedDeliveryCharge}`
      );
      toast.success("Delivery charge deleted successfully.");
      fetchDeliveryChargeList();
    } catch (error) {
      showApiError(error, "Failed to delete the delivery charge.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedDeliveryCharge(null);
    }
  };
  if (isMobile) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm p-4">
        <MobileCardList
          items={deliveryChargeList}
          getKey={(charge) => charge._id}
          emptyMessage="No delivery charges found"
          renderCard={(charge, index) => (
            <div className="space-y-1">
              <div className="pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <p className="text-sm font-bold text-gray-800 dark:text-white/90">{charge?.name}</p>
                <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">#{index + 1}</p>
              </div>
              <MobileCardRow label="Charge Amount">৳{charge?.deliveryCharge}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                {canEdit && (
                  <Link to={`/update-delivery-charge/${charge._id}`} aria-label="Edit delivery charge" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25 max-md:size-11">
                    <FaEdit className="size-4" />
                  </Link>
                )}
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(charge._id)}
                    size="sm"
                    aria-label="Delete delivery charge"
                    className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                  >
                    <MdDelete className="size-5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        />
        <Modal isOpen={showDeleteModal} onClose={closeModal}>
          <div className="p-8">
            <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
              <MdDelete className="size-8 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Delivery Charge?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              Are you sure you want to <span className="font-semibold text-red-500">delete</span> this delivery charge? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-7">
              <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white !rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
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
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
      <div className="no-scrollbar max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow className="uppercase">
              <TableCell
                isHeader
                className="px-4 py-4 font-bold text-gray-500 text-start text-[11px] uppercase dark:text-gray-400"
              >
                Serial ID
              </TableCell>
              <TableCell
                isHeader
                className="px-4 py-4 font-bold text-gray-500 text-start text-[11px] uppercase dark:text-gray-400"
              >
                Delivery Charge Name
              </TableCell>
              <TableCell
                isHeader
                className="px-4 py-4 font-bold text-gray-500 text-start text-[11px] uppercase dark:text-gray-400"
              >
                Delivery Charge Amount
              </TableCell>

              <TableCell
                isHeader
                className="px-4 py-4 font-bold text-gray-500 text-start text-[11px] uppercase dark:text-gray-400"
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {deliveryChargeList.map((charge, index) => (
              <TableRow key={charge._id} className="dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <TableCell className="px-4 py-3 text-theme-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                </TableCell>
                <TableCell className="px-4 py-3 text-theme-sm">
                  {charge?.name}
                </TableCell>
                <TableCell className="px-4 py-3 text-theme-sm">
                  <span className="font-semibold tabular-nums">৳{charge?.deliveryCharge}</span>
                </TableCell>

                <TableCell className="px-4 py-3 text-theme-sm">
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Link to={`/update-delivery-charge/${charge._id}`} aria-label="Edit delivery charge" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25">
                        <FaEdit className="size-4" />
                      </Link>
                    )}
                    {canDelete && (
                    <Button
                      onClick={() => handleDeleteModal(charge._id)}
                      size="sm"
                      aria-label="Delete delivery charge"
                      className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    >
                      <MdDelete className="size-5" />
                    </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Delivery Charge?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this delivery charge? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white !rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
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
    </div>
  );
};

export default DeliveryChargeTable;
