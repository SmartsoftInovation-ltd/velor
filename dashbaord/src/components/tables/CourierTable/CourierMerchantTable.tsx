import { useEffect, useState } from "react";
import { FaEdit } from "react-icons/fa";
import Button from "../../ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { MdDelete } from "react-icons/md";
import Badge from "../../ui/badge/Badge";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { Modal } from "../../ui/modal";
import { Link } from "react-router";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";
interface Merchant {
  _id: string;
  merchantID: string;
  merchantSecret: string;
  baseURL: string;
  serviceProvider: string;
  store_id: number | string;
  webhookSecret: string;
  isActive: boolean;
}
const CourierMerchantTable = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchantList, setSelectedMerchantList] = useState<
    string | null
  >(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const fetchMerchants = async () => {
    try {
      const res = await axiosSecure.get(`/merchant/get-all-merchants`);
      setMerchants(res.data.data);
    } catch (error) {
      showApiError(error, "Error fetching merchants");
    }
  };
  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleDeleteModal = (id: string) => {
    setSelectedMerchantList(id);
    setShowDeleteModal(true);
  };
  const closeModal = () => {
    setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(
        `/merchant/delete-merchant/${selectedMerchantList}`
      );
      toast.success("Merchant list deleted successfully.");
      fetchMerchants();
    } catch (error) {
      console.error("Error deleting merchant list:", error);
      showApiError(error, "Failed to delete the merchant list. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedMerchantList(null);
    }
  };

  return (
    <div>
      {isMobile ? (
        <MobileCardList
          items={merchants}
          getKey={(merchant) => merchant._id}
          emptyMessage="No merchants found"
          renderCard={(merchant) => (
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-sm text-gray-800 dark:text-white/90 truncate">
                  {merchant.merchantID}
                </h3>
                <Badge size="sm" color={merchant.isActive ? "success" : "error"}>
                  {merchant.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Provider">
                <Badge
                  size="sm"
                  color={
                    merchant.serviceProvider === "pathao"
                      ? "info"
                      : merchant.serviceProvider === "ecourier"
                      ? "warning"
                      : merchant.serviceProvider === "paperfly"
                      ? "orange"
                      : merchant.serviceProvider === "steadfast"
                      ? "success"
                      : "error"
                  }
                >
                  {merchant.serviceProvider}
                </Badge>
              </MobileCardRow>
              <MobileCardRow label="Store ID">{merchant.store_id}</MobileCardRow>
              <MobileCardRow label="Webhook Secret">
                <span className="truncate max-w-40 inline-block align-bottom">{merchant.webhookSecret}</span>
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <Link to={`/update-merchant/${merchant._id}`}>
                  <Button size="sm" className="max-md:size-11 p-0">
                    <FaEdit />
                  </Button>
                </Link>
                <Button
                  onClick={() => handleDeleteModal(merchant._id)}
                  size="sm"
                  className="max-md:size-11 p-0 bg-red-500 text-white hover:bg-red-600"
                >
                  <MdDelete />
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase">
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Merchant ID
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  merchant Secret
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  service Provider
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  store Id
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  webhook Secret
                </TableCell>

                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500  text-start text-theme-xs dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {merchants.map((merchant) => (
                <TableRow className="dark:text-gray-400">
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {" "}
                    {merchant.merchantID}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {merchant.merchantSecret}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {" "}
                    <Badge
                      size="sm"
                      color={
                        merchant.serviceProvider === "pathao"
                          ? "info"
                          : merchant.serviceProvider === "ecourier"
                          ? "warning"
                          : merchant.serviceProvider === "paperfly"
                          ? "orange"
                          : merchant.serviceProvider === "steadfast"
                          ? "success"
                          : "error"
                      }
                    >
                      {merchant.serviceProvider}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {merchant.store_id}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {" "}
                    {merchant.webhookSecret}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm">
                    <Badge
                      size="sm"
                      color={merchant.isActive ? "success" : "error"}
                    >
                      {merchant.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <div className="flex items-center space-x-2">
                      <Button size="sm">
                        <Link to={`/update-merchant/${merchant._id}`}>
                          <FaEdit />
                        </Link>
                      </Button>
                      <Button
                        onClick={() => handleDeleteModal(merchant._id)}
                        size="sm"
                        className="bg-red-500 text-white hover:bg-red-600"
                      >
                        <MdDelete />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody> */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {merchants.map((merchant) => (
                <TableRow key={merchant._id} className="dark:text-gray-400">
                  <TableCell className="px-4 py-3 text-theme-sm max-w-[150px] truncate">
                    {merchant.merchantID}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm max-w-[180px] truncate">
                    {merchant.merchantSecret}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm max-w-[120px] break-words">
                    <Badge
                      size="sm"
                      color={
                        merchant.serviceProvider === "pathao"
                          ? "info"
                          : merchant.serviceProvider === "ecourier"
                          ? "warning"
                          : merchant.serviceProvider === "paperfly"
                          ? "orange"
                          : merchant.serviceProvider === "steadfast"
                          ? "success"
                          : "error"
                      }
                    >
                      {merchant.serviceProvider}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm max-w-[150px] truncate">
                    {merchant.store_id}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm max-w-[200px] break-words">
                    {merchant.webhookSecret}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm">
                    <Badge
                      size="sm"
                      color={merchant.isActive ? "success" : "error"}
                    >
                      {merchant.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm">
                    <div className="flex items-center space-x-2">
                      <Button size="sm">
                        <Link to={`/update-merchant/${merchant._id}`}>
                          <FaEdit />
                        </Link>
                      </Button>
                      <Button
                        onClick={() => handleDeleteModal(merchant._id)}
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
      </div>
      )}

      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete this merchant list?
          </p>
          <div className="flex justify-end mt-4 gap-x-2">
            <Button onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Deleting...
                </span>
              ) : (
                "Yes"
              )}
            </Button>
            <Button
              onClick={closeModal}
                className="bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF]"
            >
              No
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CourierMerchantTable;
