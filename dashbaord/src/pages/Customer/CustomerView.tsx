import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaEnvelope, FaIdCard } from "react-icons/fa";
import { MdEdit } from "react-icons/md";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Badge from "../../components/ui/badge/Badge";
import Loader from "../../components/common/Loader";
import axiosSecure from "../../hooks/useAxiosSecure";

const Field = ({ label, value, highlight }: { label: string; value: string | number | undefined | null; highlight?: boolean }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    <p className={`text-sm font-medium ${highlight ? "text-red-500 font-bold" : "text-gray-800 dark:text-gray-200"}`}>
      {value != null && value !== "" ? value : "N/A"}
    </p>
  </div>
);

const CustomerView = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/customer/get-customers?customerId=${customerId}`);
      const list = data?.data?.customers || [];
      return list[0] || null;
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <p className="text-red-500 font-bold text-lg">Customer not found.</p>
        <button
          onClick={() => navigate("/customer-list")}
          className="px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-semibold transition-colors"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`${customer.fullName} - Customer Details`} description="Customer details page" />
      <PageBreadcrumb pageTitle="Customer Details" />

      <div className="mt-6 space-y-4">
        {/* Top action bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/customer-list")}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <FaArrowLeft className="size-3.5" />
            Back to list
          </button>
          <button
            onClick={() => navigate(`/customer-edit/${customer.customerId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <MdEdit className="size-4" />
            Edit Customer
          </button>
        </div>

        {/* Profile header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center gap-5">
          {customer.image?.url ? (
            <img
              src={customer.image.url}
              alt={customer.fullName}
              className="w-16 h-16 rounded-xl object-cover border border-gray-100 dark:border-gray-700 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-2xl shrink-0">
              {customer.fullName?.charAt(0)?.toUpperCase() || "C"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{customer.fullName}</h1>
              <Badge size="sm" variant="solid" color={customer.isActive ? "success" : "error"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{customer.customerId}</p>
            {customer.customerType?.customerType && (
              <span className="mt-1.5 inline-block text-xs px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                {customer.customerType.customerType}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Info */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 pb-2">
              Contact Info
            </p>
            <div className="flex items-start gap-3">
              <FaPhone className="size-3.5 text-gray-400 mt-0.5 shrink-0" />
              <Field label="Mobile Number" value={customer.mobileNumber} />
            </div>
            <div className="flex items-start gap-3">
              <FaEnvelope className="size-3.5 text-gray-400 mt-0.5 shrink-0" />
              <Field label="Email Address" value={customer.emailAddress} />
            </div>
            <div className="flex items-start gap-3">
              <FaMapMarkerAlt className="size-3.5 text-gray-400 mt-0.5 shrink-0" />
              <Field label="Present Address" value={customer.presentAddress} />
            </div>
            <div className="flex items-start gap-3">
              <FaMapMarkerAlt className="size-3.5 text-gray-400 mt-0.5 shrink-0" />
              <Field label="Permanent Address" value={customer.permanentAddress} />
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 pb-2">
              Account Info
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Opening Dues (৳)" value={customer.openingDues} highlight={(customer.openingDues || 0) > 0} />
              <Field label="Due Limit (৳)" value={customer.dueLimit} />
              <Field label="Discount %" value={customer.regularDiscountPercent != null ? `${customer.regularDiscountPercent}%` : null} />
              <div className="flex items-start gap-3">
                <FaIdCard className="size-3.5 text-gray-400 mt-0.5 shrink-0" />
                <Field label="NID Number" value={customer.nidNumber} />
              </div>
              <Field label="Occupation" value={customer.occupation} />
              <Field label="Remarks" value={customer.remarks} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerView;
