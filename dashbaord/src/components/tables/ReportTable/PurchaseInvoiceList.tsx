import { useLocation } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

const PurchaseInvoiceList = () => {
  const location = useLocation();
  const data = location.state.reportData.data;
  console.log(data);

  const totals = {
    total: 23000,
    commission: 1000,
    shipping: 900,
    payable: 22900,
    paid: 15000,
    due: 7900,
  };

  return (
    <div>
      {/* Supplier Name Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 mb-0 rounded-t-xl border border-b-0 border-gray-200 dark:border-white/[0.05]">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          Supplier Name : Color Mens
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
                  SL#
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  INVOICE#
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  DATE
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[12%]"
                >
                  SUPPLIER NAME
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  TOTAL
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  COMMISSION
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  SHIPPING
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  PAYABLE
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  PAID
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-semibold text-gray-700 text-center text-sm dark:text-gray-300 border border-gray-300 dark:border-gray-600 w-[10%]"
                >
                  DUE
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.allPurchases.map((item: any, index: any) => (
                <TableRow
                  key={item._id}
                  className="dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[8%]">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.invoiceNumber}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.date}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[12%]">
                    {item.supplierName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {/* {invoice.total} */}9000
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.commission}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.shipping}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.payable}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.paid}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-700 w-[10%]">
                    {item.dueAmount || 0}
                  </TableCell>
                </TableRow>
              ))}

              {/* Total Row */}
              <TableRow className="bg-gray-100 dark:bg-gray-800 font-bold">
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[8%]">
                  {""}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {""}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {""}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[12%]">
                  Total:
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.total}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.commission}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.shipping}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.payable}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.paid}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-center border border-gray-300 dark:border-gray-600 w-[10%]">
                  {totals.due}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseInvoiceList;
