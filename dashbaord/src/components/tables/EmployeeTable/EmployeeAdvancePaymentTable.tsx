import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import Input from "../../form/input/InputField";
import { MdDelete } from "react-icons/md";
import { FaEdit } from "react-icons/fa";
import { useState, useEffect } from "react";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { toast } from "react-hot-toast";
import { Modal } from "../../ui/modal";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface EmployeeInfo {
  _id: string;
  fullName: string;
  designation: string;
  employeeId: string;
  image: string;
}

interface AdvancePayment {
  id: string;
  date: string;
  month: string;
  amount: number;
  paymentMode: string;
  remarks: string;
  employeeId: EmployeeInfo;
}

const EmployeeAdvancePaymentTable = () => {
  const [advancePaymentList, setAdvancePaymentList] = useState<AdvancePayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  const handleDeleteModal = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedPaymentId(null);
  };

  const fetchAdvancePayments = async () => {
    setIsLoading(true);
    try {
      const res = await axiosSecure.get("/employee/get-employee-advance-payment");
      console.log(res.data.data);
      setAdvancePaymentList(res.data.data || []);
    } catch (err) {
      console.error("Error fetching advance payments:", err);
      showApiError(err, "Failed to load advance payments.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvancePayments();
  }, []);

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;
    if (!selectedPaymentId) return;
    setIsDeleting(true);

    try {
      await axiosSecure.delete(
        `/employee/delete-employee-advance-payment/${selectedPaymentId}`
      );
      
      // Immediately update the UI by filtering out the deleted item
      setAdvancePaymentList(prevList => 
        prevList.filter(item => item.id !== selectedPaymentId)
      );
      
      toast.success("Advance payment deleted successfully.");
      closeModal();
      
      // Optionally refetch to ensure sync with backend
      // fetchAdvancePayments();
    } catch (error) {
      console.error("Error deleting advance payment:", error);
      showApiError(error, "Failed to delete.");
      closeModal();
    } finally {
      setIsDeleting(false);
    }
  };

  // const filteredData = advancePaymentList.filter((item) =>
  //   item.employeeId.employeeId
  //     ?.toLowerCase()
  //     .includes(searchTerm.toLowerCase())
  // );

  return (
    <div>
      <div className="w-175">
        <Input 
          placeholder="Search by Employee ID" 
          className="mb-5" 
          // value={searchTerm}
          // onChange={(e: any) => setSearchTerm(e.target.value)}
        />
      </div>

      {isMobile ? (
        <MobileCardList
          items={advancePaymentList}
          getKey={(item) => item.id}
          emptyMessage={isLoading ? "Loading..." : "No advance payments found"}
          renderCard={(item) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                {item.employeeId?.image ? (
                  <img
                    src={item.employeeId.image}
                    alt="employee"
                    className="w-12 h-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 shrink-0 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm">
                    {item.employeeId?.fullName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">
                    {item.employeeId?.fullName}
                  </p>
                  <p className="text-xs text-gray-400">{item.employeeId?.employeeId}</p>
                </div>
              </div>
              <MobileCardRow label="Designation">{item.employeeId?.designation || "N/A"}</MobileCardRow>
              <MobileCardRow label="Date">{new Date(item.date).toLocaleDateString()}</MobileCardRow>
              <MobileCardRow label="Month">{item.month}</MobileCardRow>
              <MobileCardRow label="Amount">৳ {item.amount}</MobileCardRow>
              <MobileCardRow label="Pay Mode">{item.paymentMode}</MobileCardRow>
              <MobileCardRow label="Remarks">{item.remarks || "N/A"}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Button size="sm" className="max-md:size-11 max-md:min-h-11 max-md:min-w-11">
                  <FaEdit />
                </Button>
                <Button
                  size="sm"
                  className="bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF] max-md:size-11 max-md:min-h-11 max-md:min-w-11"
                  onClick={() => handleDeleteModal(item.id)}
                >
                  <MdDelete />
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/5">
              <TableRow className="uppercase">
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Photo
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Employee ID
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Employee Name
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Designation
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Date
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Month
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Amount
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Pay Mode
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Remarks
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : advancePaymentList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    No advance payments found
                  </TableCell>
                </TableRow>
              ) : (
                advancePaymentList.map((item) => (
                  <TableRow key={item.id} className="dark:text-gray-400">
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.employeeId?.image ? (
                        <img
                          src={item.employeeId.image}
                          alt="employee"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        "No Image"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.employeeId?.employeeId}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.employeeId?.fullName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.employeeId?.designation}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {new Date(item.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.month}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      ৳ {item.amount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm capitalize">
                      {item.paymentMode}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {item.remarks}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      <div className="flex items-center space-x-2">
                        <Button size="sm">
                          <FaEdit />
                        </Button>
                        <Button
                          size="sm"
                            className="bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF]"
                          onClick={() => handleDeleteModal(item.id)}
                        >
                          <MdDelete />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete this advance payment?
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

export default EmployeeAdvancePaymentTable;