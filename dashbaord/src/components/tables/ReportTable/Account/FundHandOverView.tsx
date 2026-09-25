import { useLocation, useNavigate } from "react-router";
import Button from "../../../ui/button/Button";
import PageBreadcrumb from "../../../common/PageBreadCrumb";
import ComponentCard from "../../../common/ComponentCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../ui/table";
import { IoIosPrint } from "react-icons/io";
import { useRef } from "react";

interface Transaction {
  date?: string;
  fundHandoverId?: string;
  description?: string;
  voucherNumber?: string;
  giverReceiver?: string;
  paymentMode?: string;
  amount?: number;
}

interface TransactionData {
  details: Transaction[];
  totalAmount?: number;
}

interface ReportData {
  data?: TransactionData;
}

const FundHandOverView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const reportData = location.state as ReportData | undefined;

  if (!reportData || !reportData.data) {
    return (
      <div className="text-center mt-20">
        <p className="text-lg">No report data found.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const transactions = reportData.data;
  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "", "height=600,width=800");
      if (printWindow) {
        printWindow.document.write("<html><head><title>Print</title>");
        printWindow.document.write("<style>");
        printWindow.document.write(`
        body { font-family: Arial, sans-serif; padding: 10px; }
        .print-header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .company-info { font-size: 14px; color: #666; margin-bottom: 3px; }
        .report-title { font-size: 18px; font-weight: bold; margin-top: 15px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #4ade80; font-weight: bold; }
        .total-row { background-color: #f3f4f6; font-weight: bold; }
      `);
        printWindow.document.write("</style></head><body>");

        // Header section
        printWindow.document.write(`
        <div class="print-header">
          <div class="company-name">Baig's Digital</div>
          <div class="company-info">Mirpur 12, Dhaka, Bangladesh</div>
          <div class="company-info">Phone: +880-XXX-XXXXXX | Email: baigdigital@company.com</div>
          <div class="report-title">Transaction Report</div>
        </div>
      `);

        printWindow.document.write(printRef.current.innerHTML);
        printWindow.document.write("</body></html>");
        printWindow.document.close();
        printWindow.print();
      }
    }
  };
  return (
    <div>
      <PageBreadcrumb pageTitle="Fund HandOver View" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <h2 className="text-md font-medium">Fund HandOver View</h2>

            <Button
              onClick={handlePrint}
                className="bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] px-4 py-2 rounded"
            >
              <IoIosPrint />
            </Button>
          </div>
        }
      >
        <div ref={printRef}>
          <div className="bg-white dark:bg-gray-800 px-4 py-3 mb-0 rounded-t-xl border border-b-0 border-gray-200 dark:border-white/[0.05]">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Transaction Category: All Categories
            </h2>
          </div>

          <div className="overflow-hidden border-x border-b border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] rounded-b-xl">
            <div className="max-w-full overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader className="bg-green-100 dark:bg-green-900/20">
                  <TableRow className="uppercase">
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[8%]"
                    >
                      Date
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[8%]"
                    >
                      Fund handover ID
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[8%]"
                    >
                      Description
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                    >
                      Voucher
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                    >
                      Giver/ Receiver
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                    >
                      Payment Mode
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                    >
                      Amount
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {(transactions.details || []).map((item, index: number) => (
                    <TableRow
                      key={index}
                      className="dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    >
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[8%]">
                        {item.date || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[8%]">
                        {item.fundHandoverId || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[8%]">
                        {item.description || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                        {item.voucherNumber || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                        {item.giverReceiver || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                        {item.paymentMode || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                        {item.amount ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total Row */}
                  <TableRow className="bg-gray-100 dark:bg-gray-800 font-bold">
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[8%]">
                      {""}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                      {" "}
                      {""}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                      {""}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[12%]">
                      {""}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[12%]">
                      {""}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[12%]">
                      Total:
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600">
                      {transactions.totalAmount ?? 0}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
};

export default FundHandOverView;
