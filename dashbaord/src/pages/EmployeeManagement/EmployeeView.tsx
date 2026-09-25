import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FaArrowLeft, FaEdit, FaPhone, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import axiosSecure from "../../hooks/useAxiosSecure";
import type { Employee } from "../../components/tables/EmployeeTable/EmployeeTable";
import StatusPill from "../../components/common/StatusPill";
import { usePermission } from "../../hooks/usePermission";

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
  certifications: Array<{
    title: string;
    institute: string;
    year: string;
    details: string;
    image: { url: string; status: string } | string;
  }>;
  createdAt: string;
}

// ---------- Helpers ----------
const Field = ({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  span?: boolean;
}) => (
  <div className={span ? "md:col-span-2 lg:col-span-3" : ""}>
    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
      {label}
    </p>
    <p className={`text-sm ${mono ? "font-mono" : "font-medium"} text-gray-900 dark:text-gray-100`}>
      {value != null && value !== "" && value !== 0 ? (
        value
      ) : (
        <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>
      )}
    </p>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
    {children}
  </h2>
);

function getImageUrl(image: EmployeeFull["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.url || "";
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
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

// ---------- Component ----------
const EmployeeView = () => {
  const { id } = useParams<{ id: string }>();
  const canEdit = usePermission("employee", "edit");
  const navigate = useNavigate();

  const {
    data: employee,
    isLoading,
    isError,
  } = useQuery<EmployeeFull>({
    queryKey: ["employee-view", id],
    queryFn: async () => {
      // Fetch fresh list (no staleTime) and find by _id
      const { data } = await axiosSecure.get("/employee/get-employee");
      const list: EmployeeFull[] = data.data.employees || [];
      const found = list.find((e) => e._id === id);
      if (!found) throw new Error("Not found");
      return found;
    },
    enabled: !!id,
    staleTime: 0, // always fresh — salary/cert images update async via worker
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="text-center py-20 min-h-[400px]">
        <p className="text-red-500 font-bold mb-4">Employee not found.</p>
        <button
          onClick={() => navigate("/employee-list")}
          className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold"
        >
          Back to List
        </button>
      </div>
    );
  }

  const photoUrl = getImageUrl(employee.image);

  return (
    <>
      <PageMeta
        title={`${employee.fullName} — Employee`}
        description="Employee detail view"
      />
      <PageBreadcrumb pageTitle="Employee Details" />

      <div className="w-full space-y-5 pb-10">
        {/* Action bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/employee-list")}
            className="shine flex items-center gap-2 h-10 px-4 rounded-xl border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-sm font-semibold transition-all active:scale-95"
          >
            <FaArrowLeft className="size-3.5" />
            Back to List
          </button>
          {canEdit && (
          <div className="ml-auto">
            <button
              onClick={() => navigate(`/employee-edit/${employee._id}`)}
              className="shine flex items-center gap-2 h-10 px-4 text-sm font-semibold bg-accent-500 hover:bg-accent-600 text-white rounded-xl transition active:scale-95 shadow-md"
            >
              <FaEdit className="size-3.5" />
              Edit Employee
            </button>
          </div>
          )}
        </div>

        {/* Hero profile card — minimal */}
        <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={employee.fullName}
                className="size-16 rounded-2xl object-cover border border-gray-100 dark:border-gray-700 shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="size-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-2xl flex-shrink-0">
                {employee.fullName?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {employee.fullName}
                </h1>
                <StatusPill isActive={employee.isActive} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {employee.designation?.name || "—"}
                {employee.section?.name && (
                  <span className="text-gray-400 dark:text-gray-500"> · {employee.section.name}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                  {employee.employeeId || "—"}
                </span>
                {employee.mobile && (
                  <span className="flex items-center gap-1.5">
                    <FaPhone className="size-3 text-gray-400" />
                    {employee.mobile}
                  </span>
                )}
                {employee.email && (
                  <span className="flex items-center gap-1.5">
                    <FaEnvelope className="size-3 text-gray-400" />
                    {employee.email}
                  </span>
                )}
                {employee.presentAddress && (
                  <span className="flex items-center gap-1.5">
                    <FaMapMarkerAlt className="size-3 text-gray-400" />
                    {employee.presentAddress}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout below the hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column (2/3 width) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
              <SectionTitle>Personal Information</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Full Name" value={employee.fullName} />
                <Field label="NID Number" value={employee.nidNumber} mono />
                <Field label="Gender" value={employee.gender} />
                <Field label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                <Field label="Religion" value={employee.religion} />
                <Field label="Blood Group" value={employee.bloodGroup} />
                <Field label="Nationality" value={employee.nationality} />
                <Field label="Father's Name" value={employee.fathersName} />
                <Field label="Mother's Name" value={employee.mothersName} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Educational Qualification" value={employee.educationalQualification} />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
              <SectionTitle>Contact</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Primary Mobile" value={employee.mobile} mono />
                <Field label="Secondary Mobile" value={employee.secondaryMobile} mono />
                <Field label="Email" value={employee.email} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Present Address" value={employee.presentAddress} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Permanent Address" value={employee.permanentAddress} />
                </div>
              </div>
            </div>

            {/* Reference */}
            {(employee.referencePersonName || employee.referenceMobile) && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
                <SectionTitle>Reference</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <Field label="Reference Person" value={employee.referencePersonName} />
                  <Field label="Reference Mobile" value={employee.referenceMobile} mono />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Field label="Reference Details" value={employee.referencePersonDetails} />
                  </div>
                </div>
              </div>
            )}

            {/* Certifications */}
            {employee.certifications && employee.certifications.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
                <SectionTitle>Certifications ({employee.certifications.length})</SectionTitle>
                <div className="space-y-4">
                  {employee.certifications.map((cert, i) => {
                    const certImgUrl =
                      cert.image && typeof cert.image === "object"
                        ? cert.image.url || ""
                        : typeof cert.image === "string"
                          ? cert.image
                          : "";
                    return (
                      <div
                        key={i}
                        className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700"
                      >
                        {certImgUrl ? (
                          <img
                            src={certImgUrl}
                            alt={cert.title}
                            className="size-20 rounded-xl object-cover border border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm"
                          />
                        ) : cert.image && typeof cert.image === "object" && cert.image.status === "pending" ? (
                          <div className="size-20 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-gray-800">
                            <span className="text-[10px] text-gray-400 font-medium text-center px-1">Uploading…</span>
                          </div>
                        ) : null}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Certificate" value={cert.title} />
                          <Field label="Institute" value={cert.institute} />
                          <Field label="Year" value={cert.year} />
                          <Field label="Details" value={cert.details} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments */}
            {employee.comments && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
                <SectionTitle>Comments</SectionTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {employee.comments}
                </p>
              </div>
            )}
          </div>

          {/* Right column (1/3 width) */}
          <div className="space-y-5">
            {/* Work Details */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
              <SectionTitle>Work Details</SectionTitle>
              <div className="space-y-5">
                <Field label="Employee ID" value={employee.employeeId} mono />
                <Field label="Designation" value={employee.designation?.name} />
                <Field label="Section" value={employee.section?.name} />
                <Field label="Department" value={employee.deapartment?.name} />
                <Field label="Joining Date" value={formatDate(employee.joiningDate)} />
              </div>
            </div>

            {/* Salary */}
            {employee.salary != null && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm p-6">
                <SectionTitle>Salary Breakdown</SectionTitle>
                <div className="space-y-3">
                  {[
                    { label: "Basic Salary", value: employee.salary.basicSalary },
                    { label: "House Rent", value: employee.salary.houseRent },
                    { label: "Medical", value: employee.salary.medicalAllowance },
                    { label: "Others", value: employee.salary.othersAllowance },
                    { label: "Special", value: employee.salary.specialAllowance },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{label}</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        ৳ {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-300">Gross Salary</span>
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                      ৳ {formatCurrency(employee.salary.grossSalary)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500 dark:text-red-400">Provident Fund (−)</span>
                    <span className="font-mono font-medium text-red-500 dark:text-red-400">৳ {formatCurrency(employee.salary.providentFund)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Net Salary</span>
                    <span className="text-base font-bold font-mono text-accent-600 dark:text-accent-400">
                      ৳ {formatCurrency(employee.salary.netSalary)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeView;
