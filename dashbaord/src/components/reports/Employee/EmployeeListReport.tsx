import { useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { IoIosPrint } from "react-icons/io";
import moment from "moment";
import axiosSecure from "../../../hooks/useAxiosSecure";
import Button from "../../ui/button/Button";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import ComponentCard from "../../common/ComponentCard";

interface EmployeeRow {
  _id: string;
  employeeId: string;
  fullName: string;
  mobile: string;
  email: string;
  gender: string;
  nidNumber: string;
  dateOfBirth: string;
  religion: string;
  designation: { name: string } | null;
  joiningDate: string;
  referenceMobile: string;
  bloodGroup: string;
  deapartment: { name: string } | null;
  section: { name: string } | null;
  salary: { netSalary: number } | null;
  isActive: boolean;
}

const gridTemplateColumns = "50px 1fr 1fr 1fr 1fr 1fr 1fr 1fr 110px 90px";
const cols = [
  "SL",
  "Employee Name/ID",
  "Phone/Email",
  "Gender/NID",
  "DOB/Religion",
  "Designation/DOJ",
  "Emergency Contact/Blood Group",
  "Department/Section",
  "Salary",
  "Status",
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return moment(dateStr).format("DD-MM-YYYY");
}

const EmployeeListReport = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<EmployeeRow[]>({
    queryKey: ["employee-list-report"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/employee/get-employee");
      return data.data.employees || [];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);
  const totalSalary = useMemo(
    () => rows.reduce((sum, r) => sum + (r.salary?.netSalary ?? 0), 0),
    [rows],
  );

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "", "height=700,width=1200");
    if (!win) return;
    win.document.write(`<html><head><title>Employee List</title><style>
      body{font-family:Arial,sans-serif;padding:10px}
      .header{text-align:center;margin-bottom:20px}
      .company{font-size:22px;font-weight:bold}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:7px;text-align:center;font-size:12px}
      th{background:#4ade80;font-weight:bold}
    </style></head><body>
    <div class="header">
      <div class="company">Baig's Digital</div>
      <div>Employee List Report · ${moment().format("DD-MM-YYYY")}</div>
    </div>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Employee List Report" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Employee List Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {rows.length} employee{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={handlePrint}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1"
            >
              <IoIosPrint /> Print
            </Button>
          </div>
        }
      >
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-red-500 font-medium">
            Failed to load report.{" "}
            <button onClick={() => navigate(-1)} className="underline ml-1">
              Go Back
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <div ref={printRef} className="overflow-x-auto">
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] overflow-hidden min-w-[1100px]">
              <div
                className="bg-green-100 dark:bg-green-900/20 grid border-b border-gray-300 dark:border-gray-600"
                style={{ gridTemplateColumns }}
              >
                {cols.map((c) => (
                  <div
                    key={c}
                    className="px-2 py-3 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0"
                  >
                    {c}
                  </div>
                ))}
              </div>

              {rows.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                  No employees found.
                </div>
              ) : (
                <div className="bg-white dark:bg-white/[0.03]">
                  {rows.map((emp, i) => (
                    <div
                      key={emp._id}
                      className={`grid border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
                        i % 2 === 1 ? "bg-gray-50/50" : ""
                      }`}
                      style={{ gridTemplateColumns }}
                    >
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span className="font-semibold">{emp.fullName || "—"}</span>
                        <span className="text-gray-400">{emp.employeeId || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{emp.mobile || "—"}</span>
                        <span className="text-gray-400 truncate">{emp.email || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{emp.gender || "—"}</span>
                        <span className="text-gray-400">{emp.nidNumber || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{formatDate(emp.dateOfBirth)}</span>
                        <span className="text-gray-400">{emp.religion || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{emp.designation?.name || "—"}</span>
                        <span className="text-gray-400">{formatDate(emp.joiningDate)}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{emp.referenceMobile || "—"}</span>
                        <span className="text-gray-400">{emp.bloodGroup || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                        <span>{emp.deapartment?.name || "—"}</span>
                        <span className="text-gray-400">{emp.section?.name || "—"}</span>
                      </div>
                      <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        {(emp.salary?.netSalary ?? 0).toLocaleString()}
                      </div>
                      <div className="px-2 py-3 text-xs text-center flex items-center justify-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            emp.isActive
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Total row */}
                  <div className="grid bg-gray-50 dark:bg-gray-800 font-semibold" style={{ gridTemplateColumns }}>
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 border-r border-gray-200 dark:border-gray-700" />
                    <div className="px-2 py-3 text-xs text-right text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 flex items-center justify-end pr-3">
                      TOTAL
                    </div>
                    <div className="px-2 py-3 text-xs text-center text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      {totalSalary.toLocaleString()}
                    </div>
                    <div className="px-2 py-3" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ComponentCard>
    </div>
  );
};

export default EmployeeListReport;
