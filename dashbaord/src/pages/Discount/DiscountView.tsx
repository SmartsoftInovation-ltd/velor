import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Loader from "../../components/common/Loader";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import toast from "react-hot-toast";
import {
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaArrowLeft,
  FaIdCard,
  FaLink,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaPercentage,
  FaMoneyBillWave,
  FaTags
} from "react-icons/fa";
import moment from "moment";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip — renders into document.body to escape overflow/z-index constraints
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setVisible(true);
    }
  };

  return (
    <div ref={tooltipRef} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}
        >
          <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const DiscountView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const {
    data: discount,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["discount-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/discount/${slug}`);
      return data?.data || data;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!discount) return;
    setIsToggling(true);
    try {
      const endpoint = discount.isActive ? `/discount/deactive?slug=${discount.slug}` : `/discount/active?slug=${discount.slug}`;
      await axiosSecure.post(endpoint);
      toast.success(
        `Discount ${discount.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <>
      <PageMeta
        title={`View Discount - ${discount?.discountName ?? "Loading..."}`}
        description="Discount details view"
      />
      <PageBreadcrumb pageTitle="Discount Details" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <h2 className="text-md font-medium text-gray-800 dark:text-white/90">
                Discount Details
              </h2>
              <div className="flex items-center gap-2">
                <Tooltip text="Go back">
                  <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-lg px-4"
                  >
                    <FaArrowLeft className="size-3.5" />
                    Back
                  </Button>
                </Tooltip>

                {discount && (
                  <>
                    <Tooltip text="Edit discount">
                      <Link to={`/update-discount/${discount.slug}`}>
                        <Button
                          size="sm"
                            className="flex items-center gap-2 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-lg px-4 shadow-md"
                        >
                          <FaEdit className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </Tooltip>

                    {/* Show Deactivate when active, Activate when inactive */}
                    {discount.isActive ? (
                      <Tooltip text="Deactivate this discount">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-lg px-4 shadow-md border-none bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                        >
                          <FaToggleOn className="size-4" />
                          Deactivate
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip text="Activate this discount">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-lg px-4 shadow-md border-none bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                        >
                          <FaToggleOff className="size-4" />
                          Activate
                        </Button>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
            </div>
          }
        >
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <Loader />
            </div>
          ) : isError || !discount ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-semibold mb-4">
                Discount not found!
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {/* Name */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 col-span-1 md:col-span-2 lg:col-span-1">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Discount Name
                  </p>
                  <p className="text-xl font-black text-brand-600 dark:text-brand-400 tracking-wider">
                    {discount.discountName}
                  </p>
                </div>

                {/* Slug */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FaLink className="text-brand-500 size-3" />
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Slug
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 font-mono">
                    {discount.slug}
                  </p>
                </div>
                
                {/* ID */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FaIdCard className="text-blue-500 size-3" />
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Discount ID
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                    {discount._id}
                  </p>
                </div>

                {/* Discount Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {discount.discountType === "percent" || discount.discountType === "percentage" || discount.discountValueByPercentance > 0 ? (
                      <FaPercentage className="text-purple-500 size-3" />
                    ) : (
                      <FaMoneyBillWave className="text-green-500 size-3" />
                    )}
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Discount Value
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {discount.discountValueByAmount > 0 ? `${discount.discountValueByAmount} TK` : `${discount.discountValueByPercentance} %`}
                    </p>
                    <Badge color="primary" variant="light" size="sm" className="text-[10px] uppercase">
                      {discount.discountType === "tk" ? "Fixed Amount" : "Percentage"}
                    </Badge>
                  </div>
                </div>

                {/* Plan Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FaTags className="text-orange-500 size-3" />
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Discount Plan
                    </p>
                  </div>
                  <div className="mt-1">
                    <Badge 
                      color={
                        discount.discountPlan === "category"
                          ? "warning"
                          : discount.discountPlan === "flat"
                          ? "info"
                          : "success"
                      }
                    >
                      {discount.discountPlan ? discount.discountPlan.charAt(0).toUpperCase() + discount.discountPlan.slice(1) : "N/A"}
                    </Badge>
                  </div>
                </div>

                {/* Visibility */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Status
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {discount.isActive ? (
                      <FaCheckCircle className="text-green-500 size-4" />
                    ) : (
                      <FaTimesCircle className="text-red-500 size-4" />
                    )}
                    <p
                      className={`text-sm font-medium ${
                        discount.isActive ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {discount.isActive ? "Active (Can be applied)" : "Inactive (Cannot be applied)"}
                    </p>
                  </div>
                </div>

                {/* Dates Section */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 md:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-2 mb-4">
                    <FaCalendarAlt className="text-brand-500 size-4" />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Schedule & Dates
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                        Valid From
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {discount.discountValidFrom ? moment(discount.discountValidFrom).format("MMMM DD, YYYY") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                        Valid To
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {discount.discountValidTo ? moment(discount.discountValidTo).format("MMMM DD, YYYY") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                        Created On
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {discount.createdAt ? moment(discount.createdAt).format("MMMM DD, YYYY") : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </ComponentCard>
      </div>

      {/* Status Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <div className="p-8">
          {/* Icon */}
          <div
            className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
              discount?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {discount?.isActive ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {discount?.isActive ? "Deactivate Discount?" : "Activate Discount?"}
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${
                discount?.isActive ? "text-red-500" : "text-green-500"
              }`}
            >
              {discount?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            discount{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              "{discount?.discountName}"
            </span>
            ?
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => setShowConfirmModal(false)}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                discount?.isActive
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Updating...
                </span>
              ) : (
                discount?.isActive ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DiscountView;
