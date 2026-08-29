import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { IoIosPrint, IoIosArrowBack } from "react-icons/io";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../../components/ui/button/Button";
import type { Employee } from "../../components/tables/EmployeeTable/EmployeeTable";

// ---------- Types ----------
interface EmployeeFull extends Employee {
  secondaryMobile: string;
  dateOfBirth: string;
  religion: string;
  bloodGroup: string;
  nationality: string;
  fathersName: string;
  mothersName: string;
  permanentAddress: string;
  educationalQualification: string;
  referencePersonName: string;
  referencePersonDetails: string;
  referenceMobile: string;
  nidNumber: string;
  comments: string;
  section: { _id: string; name: string } | null;
  deapartment: { _id: string; name: string } | null;
  salary: {
    basicSalary: number;
    houseRent: number;
    medicalAllowance: number;
    othersAllowance: number;
    specialAllowance: number;
    providentFund: number;
    grossSalary: number;
    netSalary: number;
  };
  createdAt: string;
}

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

// ---------- Helpers ----------
function getImageUrl(image: EmployeeFull["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.url || "";
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(val?: number | null): string {
  if (val == null) return "0";
  return val.toLocaleString("en-BD");
}

const Field = ({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
    <p className={`text-sm text-gray-800 ${mono ? "font-mono" : "font-semibold"}`}>
      {value != null && value !== "" ? value : "—"}
    </p>
  </div>
);

const EmployeeInvoicePrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: employee, isLoading, isError } = useQuery<EmployeeFull>({
    queryKey: ["employee-view", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/employee/get-employee");
      const list: EmployeeFull[] = data.data.employees || [];
      const found = list.find((e) => e._id === id);
      if (!found) throw new Error("Not found");
      return found;
    },
    enabled: !!id,
  });

  const { data: storeInfo } = useQuery<StoreInformation | null>({
    queryKey: ["store-information"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/storeinformation/store-information");
        return data.data.stores?.[0] || null;
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isError || !employee)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">Failed to load employee!</p>
        <Button onClick={() => navigate(-1)} className="px-6 py-2 bg-brand-500 text-white rounded-xl">
          Go Back
        </Button>
      </div>
    );

  const photoUrl = getImageUrl(employee.image);

  return (
    <div
      id="print-page-wrap"
      className="min-h-screen bg-gray-100 dark:bg-gray-950 py-6 print:bg-gray-100 print:py-0"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          #print-page-wrap {
            min-height: 0 !important;
            height: auto !important;
          }
          body * { visibility: hidden; }
          #printable-employee, #printable-employee * {
            visibility: visible;
          }
          #printable-employee {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            font-size: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="px-6">
        {/* Toolbar — hidden on print */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm"
          >
            <IoIosArrowBack className="size-4" />
            Back
          </Button>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg"
          >
            <IoIosPrint className="size-4" />
            Print Employee
          </Button>
        </div>

        {/* Employee card */}
        <div
          id="printable-employee"
          className="w-full bg-white dark:bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 print:py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              {storeInfo?.image?.url && (
                <img
                  src={storeInfo.image.url}
                  alt="logo"
                  className="size-14 rounded-xl object-cover border border-gray-200"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">{storeInfo?.storeName || "Store"}</h1>
                {storeInfo?.propiterSlogan && (
                  <p className="text-xs italic text-gray-500 mt-0.5">{storeInfo.propiterSlogan}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{storeInfo?.adress || ""}</p>
                <p className="text-xs text-gray-500">
                  {storeInfo?.phone ? `Phone: ${storeInfo.phone}` : ""}
                  {storeInfo?.email ? ` | Email: ${storeInfo.email}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-gray-800 tracking-wide">EMPLOYEE PROFILE</h2>
              <p className="text-xs text-gray-500 mt-1">
                Employee ID: <span className="font-bold text-gray-700">{employee.employeeId || "—"}</span>
              </p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  employee.isActive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                }`}
              >
                {employee.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="px-8 py-6 print:py-3">
            {/* Profile summary */}
            <div className="flex items-center gap-4 mb-6 print:mb-3 border border-gray-200 rounded-xl p-4 print:p-2 bg-gray-50">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={employee.fullName}
                  className="size-16 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <div className="size-16 rounded-xl bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl">
                  {employee.fullName?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <p className="text-base font-bold text-gray-900">{employee.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {employee.designation?.name || "—"}
                  {employee.section?.name ? ` · ${employee.section.name}` : ""}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {employee.mobile || ""}
                  {employee.email ? ` | ${employee.email}` : ""}
                </p>
              </div>
            </div>

            {/* Personal Information */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3 print:mb-1.5">Personal Information</p>
            <div className="grid grid-cols-3 gap-4 mb-6 print:mb-3 print:gap-2">
              <Field label="NID Number" value={employee.nidNumber} mono />
              <Field label="Gender" value={employee.gender} />
              <Field label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
              <Field label="Religion" value={employee.religion} />
              <Field label="Blood Group" value={employee.bloodGroup} />
              <Field label="Nationality" value={employee.nationality} />
              <Field label="Father's Name" value={employee.fathersName} />
              <Field label="Mother's Name" value={employee.mothersName} />
              <Field label="Joining Date" value={formatDate(employee.joiningDate)} />
            </div>

            {/* Contact */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3 print:mb-1.5">Contact</p>
            <div className="grid grid-cols-3 gap-4 mb-6 print:mb-3 print:gap-2">
              <Field label="Primary Mobile" value={employee.mobile} mono />
              <Field label="Secondary Mobile" value={employee.secondaryMobile} mono />
              <Field label="Email" value={employee.email} />
              <div className="col-span-3">
                <Field label="Present Address" value={employee.presentAddress} />
              </div>
              <div className="col-span-3">
                <Field label="Permanent Address" value={employee.permanentAddress} />
              </div>
            </div>

            {/* Work Details */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3 print:mb-1.5">Work Details</p>
            <div className="grid grid-cols-3 gap-4 mb-6 print:mb-3 print:gap-2">
              <Field label="Employee ID" value={employee.employeeId} mono />
              <Field label="Designation" value={employee.designation?.name} />
              <Field label="Department" value={employee.deapartment?.name} />
            </div>

            {/* Salary Summary */}
            {employee.salary != null && (
              <div className="mt-6 print:mt-3 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 print:py-1.5 border-b border-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Salary Breakdown</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 p-4 print:p-2 print:gap-2">
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Basic</p>
                    <p className="text-sm font-bold text-gray-800">৳{formatCurrency(employee.salary.basicSalary)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">House Rent</p>
                    <p className="text-sm font-bold text-gray-800">৳{formatCurrency(employee.salary.houseRent)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Medical</p>
                    <p className="text-sm font-bold text-gray-800">৳{formatCurrency(employee.salary.medicalAllowance)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Others</p>
                    <p className="text-sm font-bold text-gray-800">৳{formatCurrency(employee.salary.othersAllowance)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-blue-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-1">Gross Salary</p>
                    <p className="text-sm font-bold text-blue-600">৳{formatCurrency(employee.salary.grossSalary)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-red-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">Provident Fund</p>
                    <p className="text-sm font-bold text-red-600">−৳{formatCurrency(employee.salary.providentFund)}</p>
                  </div>
                  <div className="px-4 py-4 print:py-2 rounded-xl bg-green-50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">Net Salary</p>
                    <p className="text-sm font-bold text-green-700">৳{formatCurrency(employee.salary.netSalary)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="flex justify-between mt-16 print:mt-6 text-xs text-gray-500">
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">Employee Signature</div>
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">Authorized Signature</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 pb-6 print:pb-2 px-8">
            {storeInfo?.footer && <p className="text-gray-500 mb-1">{storeInfo.footer}</p>}
            <p>This is a computer-generated document. No signature required unless specified.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeInvoicePrint;
