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
  FaUsers
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

const CouponView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const {
    data: coupon,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["coupon-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/coupon/getallcoupon`);
      const allCoupons = data.data?.coupons || data.data || [];
      return allCoupons.find((c: any) => c.slug === slug);
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!coupon) return;
    setIsToggling(true);
    try {
      const endpoint = coupon.isActive ? `/coupon/${coupon.slug}/deactivate` : `/coupon/${coupon.slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Coupon ${coupon.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
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
        title={`View Coupon - ${coupon?.code ?? "Loading..."}`}
        description="Coupon details view"
      />
      <PageBreadcrumb pageTitle="Coupon Details" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <h2 className="text-md font-medium text-gray-800 dark:text-white/90">
                Coupon Details
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

                {coupon && (
                  <>
                    <Tooltip text="Edit coupon">
                      <Link to={`/update-coupon/${coupon.slug}`}>
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
                    {coupon.isActive ? (
                      <Tooltip text="Deactivate this coupon">
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
                      <Tooltip text="Activate this coupon">
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
          ) : isError || !coupon ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-semibold mb-4">
                Coupon not found!
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {/* Code */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 col-span-1 md:col-span-2 lg:col-span-1">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Coupon Code
                  </p>
                  <p className="text-2xl font-black text-brand-600 dark:text-brand-400 tracking-wider">
                    {coupon.code}
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
                    {coupon.slug}
                  </p>
                </div>
                
                {/* ID */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FaIdCard className="text-blue-500 size-3" />
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Coupon ID
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                    {coupon._id}
                  </p>
                </div>

                {/* Discount Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {coupon.discountType === "percentage" ? (
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
                      {coupon.discountValue} {coupon.discountType === "percentage" ? "%" : "TK"}
                    </p>
                    <Badge color="primary" variant="light" size="sm" className="text-[10px] uppercase">
                      {coupon.discountType}
                    </Badge>
                  </div>
                </div>

                {/* Usage Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FaUsers className="text-orange-500 size-3" />
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Usage Stats
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Used</p>
                      <p className="text-lg font-bold text-gray-800 dark:text-white">{coupon.usedCount}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Limit</p>
                      <p className="text-lg font-bold text-gray-800 dark:text-white">{coupon.usageLimit}</p>
                    </div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Status
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {coupon.isActive ? (
                      <FaCheckCircle className="text-green-500 size-4" />
                    ) : (
                      <FaTimesCircle className="text-red-500 size-4" />
                    )}
                    <p
                      className={`text-sm font-medium ${
                        coupon.isActive ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {coupon.isActive ? "Active (Can be used)" : "Inactive (Cannot be used)"}
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
                        Start Date
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {coupon.couponStartAt ? moment(coupon.couponStartAt).format("MMMM DD, YYYY") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                        Expire Date
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {coupon.expireAt ? moment(coupon.expireAt).format("MMMM DD, YYYY") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                        Created On
                      </p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {moment(coupon.createdAt).format("MMMM DD, YYYY")}
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
              coupon?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {coupon?.isActive ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {coupon?.isActive ? "Deactivate Coupon?" : "Activate Coupon?"}
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${
                coupon?.isActive ? "text-red-500" : "text-green-500"
              }`}
            >
              {coupon?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            coupon{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              "{coupon?.code}"
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
                coupon?.isActive
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
                coupon?.isActive ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CouponView;
