import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import toast from "react-hot-toast";
import {
  FaEdit,
  FaLayerGroup,
  FaToggleOn,
  FaToggleOff,
  FaArrowLeft,
  FaIdCard,
  FaLink,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaTags
} from "react-icons/fa";
import moment from "moment";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip
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

const SubCategoryView = () => {
  const [isToggling, setIsToggling] = useState(false);
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    data: subcategory,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["subcategory-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/subcategories/${slug}`);
      return data.data.subCategories;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!subcategory) return;
    setIsToggling(true);
    try {
      const endpoint = subcategory.isActive
        ? `/subcategories/${slug}/deactive`
        : `/subcategories/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Subcategory ${subcategory.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["subcategories"] });
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
        title={`View Subcategory - ${subcategory?.name ?? "Loading..."}`}
        description="Subcategory details view"
      />
      <PageBreadcrumb pageTitle="Subcategory Details" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate(-1)}
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-brand-500 border border-gray-100 dark:border-gray-700 transition-all active:scale-90"
                >
                  <FaArrowLeft className="size-4" />
                </button>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">
                  Subcategory Information
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {subcategory && (
                  <>
                    <Tooltip text="Edit subcategory">
                      <Link to={`/update-subcategory/${subcategory.slug}`}>
                        <Button
                          size="sm"
                            className="flex items-center gap-2 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-lg px-4 shadow-md"
                        >
                          <FaEdit className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </Tooltip>

                    {subcategory.isActive ? (
                      <Tooltip text="Deactivate this subcategory">
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
                      <Tooltip text="Activate this subcategory">
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
            <div className="py-20 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <div className="size-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-gray-500 font-medium animate-pulse">Loading data...</p>
            </div>
          ) : isError || !subcategory ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-semibold mb-4">
                Subcategory not found!
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold uppercase tracking-wider rounded">
                      Subcategory
                    </span>
                    <Badge
                      variant="solid"
                      size="sm"
                      color={subcategory.isActive ? "success" : "error"}
                      className="uppercase font-bold tracking-wider text-[9px] px-2"
                    >
                      {subcategory.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-bold capitalize mt-3 text-gray-900 dark:text-white">
                    {subcategory.name}
                  </h1>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 sm:justify-end">
                    <FaCalendarAlt className="text-gray-400 size-3.5" />
                    {moment(subcategory.createdAt).format("MMMM DD, YYYY")}
                  </p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Parent Category */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-theme-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                      <FaLayerGroup className="text-blue-500 size-5" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Parent Category</h3>
                  </div>
                  <p className="text-lg font-bold capitalize text-gray-900 dark:text-white mb-1">
                    {subcategory.category?.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    ID: {subcategory.category?._id}
                  </p>
                  <p className="text-xs text-gray-500 capitalize mt-2 dark:text-gray-400 font-mono">
                    Category Slug: {subcategory.category?.slug}
                  </p>
                  <div className="mt-4">
                    <Link to={`/category-view/${subcategory.category?.slug}`}>
                      <Button variant="outline" size="sm" className="w-full text-[11px] font-bold rounded-lg border-gray-200 dark:border-gray-700">
                        View Parent Details
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Subcategory Slug */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-theme-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                      <FaLink className="text-purple-500 size-5" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Slug (URL Path)</h3>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-mono text-brand-600 dark:text-brand-400 break-all font-bold">
                      /{subcategory.slug}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                    Used for search engine optimization and direct linking.
                  </p>
                </div>

                {/* Database ID */}
                <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-theme-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-xl">
                      <FaIdCard className="text-orange-500 size-5" />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white">System ID</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all leading-relaxed">
                    {subcategory._id}
                  </p>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                    Unique Identifier
                  </p>
                </div>
              </div>

              {/* Status Section */}
              <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${subcategory.isActive ? "bg-green-50 dark:bg-green-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                      {subcategory.isActive ? (
                        <FaCheckCircle className="text-green-500 size-6" />
                      ) : (
                        <FaTimesCircle className="text-red-500 size-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">Visibility Status</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {subcategory.isActive 
                          ? "This subcategory is visible to customers on the storefront." 
                          : "This subcategory is hidden and cannot be accessed by customers."}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowConfirmModal(true)}
                    variant="outline" 
                    className={`rounded-xl px-6 font-bold ${subcategory.isActive ? "text-red-500 border-red-200 hover:bg-red-50 dark:border-red-500/20" : "text-green-500 border-green-200 hover:bg-green-50 dark:border-green-500/20"}`}
                  >
                    {subcategory.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>

              {/* Stats/Extra (Optional/Placeholder) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-theme-sm flex items-center gap-4">
                    <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-xl">
                      <FaTags className="text-brand-500 size-5" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Updated At</p>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {moment(subcategory.updatedAt).fromNow()}
                      </p>
                    </div>
                 </div>
                 <div className="bg-white dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-theme-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                      <FaLayerGroup className="text-blue-500 size-5" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Category Status</p>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Parent is {subcategory.category?.isActive ? "Active" : "Inactive"}
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
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${subcategory?.isActive ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"}`}>
            {subcategory?.isActive ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {subcategory?.isActive ? "Deactivate Subcategory?" : "Activate Subcategory?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className={`font-semibold ${subcategory?.isActive ? "text-red-500" : "text-green-500"}`}>{subcategory?.isActive ? "deactivate" : "activate"}</span> <span className="font-semibold text-gray-700 dark:text-gray-200">"{subcategory?.name}"</span>?
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button onClick={handleToggleStatus} disabled={isToggling} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${subcategory?.isActive ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25" : "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25"}`}>
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Updating...
                </span>
              ) : subcategory?.isActive ? (
                "Yes, Deactivate"
              ) : (
                "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SubCategoryView;
