import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import ImageWithFallback from "../../components/common/ImageWithFallback";
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
  FaImage,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import moment from "moment";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip component
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

const BrandView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const {
    data: brand,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["brand-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/brand/${slug}`);
      return data.data.brand;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!brand) return;
    setIsToggling(true);
    try {
      const endpoint = brand.isActive
        ? `/brand/${brand.slug}/deactivate`
        : `/brand/${brand.slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Brand ${brand.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["brands"] });
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
        title={`View Brand - ${brand?.name ?? "Loading..."}`}
        description="Brand details view"
      />
      <PageBreadcrumb pageTitle="Brand Details" />

      <div className="space-y-6 mt-10">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">
                Brand Information
              </h2>
              <div className="flex items-center gap-2">
                <Tooltip text="Go back">
                  <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-xl px-4 py-2 border-gray-200 dark:border-gray-700 transition-all active:scale-90"
                  >
                    <FaArrowLeft className="size-3.5" />
                    Back
                  </Button>
                </Tooltip>

                {brand && (
                  <>
                    <Tooltip text="Edit brand">
                      <Link to={`/update-brand/${brand.slug}`}>
                        <Button
                          size="sm"
                            className="flex items-center gap-2 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-xl px-4 py-2 shadow-lg font-bold"
                        >
                          <FaEdit className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </Tooltip>

                    {brand.isActive ? (
                      <Tooltip text="Deactivate this brand">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg border-none bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 font-bold"
                        >
                          <FaToggleOn className="size-4" />
                          Deactivate
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip text="Activate this brand">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg border-none bg-green-500 hover:bg-green-600 text-white shadow-green-500/20 font-bold"
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
          ) : isError || !brand ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">
                Brand not found!
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500 p-2">
              {/* Top Section: Image + Basic Info */}
              <div className="flex flex-col md:flex-row gap-10 items-start">
                {/* Brand Image */}
                <div className="flex-shrink-0 w-full md:w-auto flex flex-col items-center">
                  <div className="w-50 h-52 rounded-[32px] overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-2">
                    <ImageWithFallback
                      src={brand.image?.url}
                      alt={brand.name}
                      className="max-w-full max-h-full bg-gray-50 dark:bg-gray-800 rounded-lg object-contain transition-transform duration-500 hover:scale-110"
                    />
                  </div>
                  <div className="mt-4">
                    <Badge
                      variant="solid"
                      size="sm"
                      color={brand.isActive ? "success" : "error"}
                      className="uppercase font-black tracking-widest text-[10px] px-5 py-1.5 rounded-full shadow-lg"
                    >
                      {brand.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                {/* Basic Info Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 group hover:border-brand-500/30 transition-all">
                    <p className="text-[10px] uppercase font-medium  text-gray-400 mb-2">
                      Brand Name
                    </p>
                    <p className="text-2xl font-medium text-gray-800 dark:text-white uppercase tracking-tight">
                      {brand.name}
                    </p>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 group hover:border-brand-500/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FaLink className="text-brand-500 size-3" />
                      <p className="text-[10px] uppercase font-medium  text-gray-400">
                        Brand Slug
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg inline-block border border-gray-100 dark:border-gray-800">
                      /{brand.slug}
                    </p>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 sm:col-span-2 group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FaIdCard className="text-blue-500 size-3" />
                      <p className="text-[10px] uppercase font-medium  text-gray-400">
                        Brand System ID
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all selection:bg-blue-100 dark:selection:bg-blue-900/30">
                      {brand._id}
                    </p>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 group hover:border-brand-500/30 transition-all">
                    <p className="text-[10px] uppercase font-medium  text-gray-400 mb-2">
                      Registration Date
                    </p>
                    <p className="text-md font-bold text-gray-700 dark:text-gray-300">
                      {moment(brand.createdAt).format("MMMM DD, YYYY")}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium italic">
                      {moment(brand.createdAt).fromNow()}
                    </p>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 group hover:border-brand-500/30 transition-all">
                    <p className="text-[10px] uppercase font-medium  text-gray-400 mb-2">
                      Market Visibility
                    </p>
                    <div className="flex items-center gap-2">
                      {brand.isActive ? (
                        <FaCheckCircle className="text-green-500 size-4" />
                      ) : (
                        <FaTimesCircle className="text-red-500 size-4" />
                      )}
                      <p
                        className={`text-sm font-medium uppercase tracking-wide ${
                          brand.isActive ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {brand.isActive ? "Publicly Visible" : "Hidden from Shop"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Info Section */}
              <div className="bg-gray-900/5 dark:bg-gray-900/40 rounded-[28px] p-8 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                    <FaImage className="text-brand-500 size-5" />
                  </div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-[3px]">
                    Technical Asset Data
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">
                      Storage ID
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all bg-white dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                      {brand.image?.publicId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">
                      Cloud Status
                    </p>
                    <Badge
                      size="sm"
                      color={
                        brand.image?.status === "uploaded"
                          ? "success"
                          : "warning"
                      }
                      variant="light"
                      className="text-[10px] uppercase font-black px-3"
                    >
                      {brand.image?.status ?? "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">
                      Sync Attempts
                    </p>
                    <p className="text-lg font-black text-gray-800 dark:text-gray-200">
                      {brand.image?.tries ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">
                      Last Response
                    </p>
                    <p className="text-xs text-gray-500 font-medium italic bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                      {brand.image?.lastError || "Success (Stable)"}
                    </p>
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
          <div
            className={`flex items-center justify-center size-20 rounded-[28px] mb-6 mx-auto ${
              brand?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {brand?.isActive ? (
              <FaToggleOn className="size-10 text-red-500" />
            ) : (
              <FaToggleOff className="size-10 text-green-500" />
            )}
          </div>

          <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center tracking-tight">
            {brand?.isActive ? "Deactivate Brand?" : "Activate Brand?"}
          </h2>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-black uppercase tracking-wide ${
                brand?.isActive ? "text-red-500" : "text-green-500"
              }`}
            >
              {brand?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-bold text-gray-800 dark:text-gray-200">
              "{brand?.name}"
            </span>
            ? This will affect its visibility on the storefront.
          </p>

          <div className="flex gap-4 mt-10">
            <Button
              onClick={() => setShowConfirmModal(false)}
              variant="outline"
              className="flex-1 rounded-2xl py-3 text-sm font-bold border-gray-200 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={`flex-1 rounded-2xl py-3 text-sm font-black uppercase tracking-widest border-none active:scale-95 transition-all ${
                brand?.isActive
 ?"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-xl"
 :"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-xl"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Updating...
                </span>
              ) : (
                brand?.isActive ? "Confirm Deactivation" : "Confirm Activation"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BrandView;
