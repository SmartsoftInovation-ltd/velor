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
  FaLayerGroup,
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

const CategoryView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const {
    data: category,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["category-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/categories/${slug}`);
      return data.data.category;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!category) return;
    setIsToggling(true);
    try {
      const endpoint = category.isActive
        ? `/categories/${category.slug}/deactivate`
        : `/categories/${category.slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Category ${category.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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
        title={`View Category - ${category?.name ?? "Loading..."}`}
        description="Category details view"
      />
      <PageBreadcrumb pageTitle="Category Details" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <h2 className="text-md font-medium text-gray-800 dark:text-white/90">
                Category Details
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

                {category && (
                  <>
                    <Tooltip text="Edit category">
                      <Link to={`/update-category/${category.slug}`}>
                        <Button
                          size="sm"
                            className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg px-4 shadow-md"
                        >
                          <FaEdit className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </Tooltip>

                    {/* Show Deactivate when active, Activate when inactive */}
                    {category.isActive ? (
                      <Tooltip text="Deactivate this category">
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
                      <Tooltip text="Activate this category">
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
          ) : isError || !category ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-semibold mb-4">
                Category not found!
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Top Section: Image + Basic Info */}
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Category Image */}
                <div className="flex-shrink-0">
                  <div className="w-44 h-44 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg bg-gray-100 dark:bg-gray-800">
                    <img
                      src={category.image?.url}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex justify-center">
                    <Badge
                      variant="solid"
                      size="sm"
                      color={category.isActive ? "success" : "error"}
                      className="uppercase font-semibold tracking-wide text-[10px] px-3"
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                {/* Basic Info Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Category Name
                    </p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white">
                      {category.name}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FaLink className="text-brand-500 size-3" />
                      <p className="text-[11px] uppercase tracking-wider text-gray-400">
                        Slug
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 font-mono">
                      {category.slug}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 sm:col-span-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FaIdCard className="text-blue-500 size-3" />
                      <p className="text-[11px] uppercase tracking-wider text-gray-400">
                        Category ID
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
                      {category._id}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Created At
                    </p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {moment(category.createdAt).format("MMMM DD, YYYY")}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Visibility
                    </p>
                    <div className="flex items-center gap-2">
                      {category.isActive ? (
                        <FaCheckCircle className="text-green-500 size-4" />
                      ) : (
                        <FaTimesCircle className="text-red-500 size-4" />
                      )}
                      <p
                        className={`text-sm font-medium ${
                          category.isActive ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {category.isActive ? "Publicly Visible" : "Hidden"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Info Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <FaImage className="text-brand-500 size-4" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Image Info
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                      Public ID
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                      {category.image?.publicId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                      Upload Status
                    </p>
                    <Badge
                      size="sm"
                      color={
                        category.image?.status === "uploaded"
                          ? "success"
                          : "warning"
                      }
                      variant="light"
                      className="text-[10px] uppercase font-medium"
                    >
                      {category.image?.status ?? "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                      Upload Tries
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {category.image?.tries ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                      Last Error
                    </p>
                    <p className="text-xs text-gray-500 italic">
                      {category.image?.lastError || "None"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subcategories Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FaLayerGroup className="text-brand-500 size-4" />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Subcategories
                    </h3>
                  </div>
                  <Badge
                    size="sm"
                    color="primary"
                    variant="light"
                    className="text-xs"
                  >
                    {category.subcategories?.length} Total
                  </Badge>
                </div>

                {category.subcategories?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.subcategories.map((sub: any) => (
                      <div
                        key={sub._id}
                        className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`size-2 flex-shrink-0 rounded-full ${
                              sub.isActive ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {sub.name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              /{sub.slug}
                            </p>
                          </div>
                        </div>
                        <Badge
                          size="sm"
                          color={sub.isActive ? "success" : "error"}
                          variant="light"
                          className="text-[9px] uppercase flex-shrink-0 ml-2"
                        >
                          {sub.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <FaLayerGroup className="mx-auto size-7 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">
                      No subcategories linked yet.
                    </p>
                  </div>
                )}
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
              category?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {category?.isActive ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {category?.isActive ? "Deactivate Category?" : "Activate Category?"}
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${
                category?.isActive ? "text-red-500" : "text-green-500"
              }`}
            >
              {category?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              "{category?.name}"
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
                category?.isActive
 ?"bg-accent-500 hover:bg-accent-600 text-white shadow-lg"
 :"bg-accent-500 hover:bg-accent-600 text-white shadow-lg"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : (
                category?.isActive ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CategoryView;
