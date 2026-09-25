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
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] p-4">
        <MobileCardList
          items={deliveryChargeList}
          getKey={(charge) => charge._id}
          emptyMessage="No delivery charges found"
          renderCard={(charge, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <p className="text-sm font-bold text-gray-800 dark:text-white/90">{charge?.name}</p>
                <p className="text-xs text-gray-400">#{index + 1}</p>
              </div>
              <MobileCardRow label="Charge Amount">{charge?.deliveryCharge}TK</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/update-delivery-charge/${charge._id}`}>
                  <Button size="sm" className="max-md:size-11">
                    <FaEdit />
                  </Button>
                </Link>
                <Button
                  onClick={() => handleDeleteModal(charge._id)}
                  size="sm"
                  className="max-md:size-11 bg-red-500 text-white hover:bg-red-600"
                >
                  <MdDelete />
                </Button>
              </div>
            </div>
          )}
        />
        <Modal isOpen={showDeleteModal} onClose={closeModal}>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-bold">Confirm Deletion</h2>
            <p className="mt-2 text-gray-600">
              Are you sure you want to delete this delivery charge?
            </p>
            <div className="flex justify-end mt-4 gap-x-2">
              <Button onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                    Deleting...
                  </span>
                ) : (
                  "Yes"
                )}
              </Button>
              <Button
                onClick={closeModal}
                className="bg-[#D5F0E3] text-[#0A6B43] hover:bg-[#B8E4CF]"
              >
                No
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="no-scrollbar max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow className="uppercase">
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Sr No
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Delivery Charge Name
              </TableCell>
              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Delivery Charge Amount
              </TableCell>

              <TableCell
                isHeader
                className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {deliveryChargeList.map((charge, index) => (
              <TableRow key={charge._id} className="dark:text-gray-400">
                <TableCell className="px-4 py-3 text-theme-sm">
                  {index + 1}.
                </TableCell>
                <TableCell className="px-4 py-3 text-theme-sm">
                  {charge?.name}
                </TableCell>
                <TableCell className="px-4 py-3 text-theme-sm">
                  {charge?.deliveryCharge}TK
                </TableCell>

                <TableCell className="px-4 py-3 text-theme-sm">
                  <div className="flex items-center space-x-2">
                    <Link to={`/update-delivery-charge/${charge._id}`}>
                      <Button size="sm">
                        <FaEdit />
                      </Button>
                    </Link>

                    <Button
                      onClick={() => handleDeleteModal(charge._id)}
                      size="sm"
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      <MdDelete />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete this delivery charge?
          </p>
          <div className="flex justify-end mt-4 gap-x-2">
            <Button onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Deleting...
                </span>
              ) : (
                "Yes"
              )}
            </Button>
            <Button
              onClick={closeModal}
                className="bg-[#D5F0E3] text-[#0A6B43] hover:bg-[#B8E4CF]"
            >
              No
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveryChargeTable;
