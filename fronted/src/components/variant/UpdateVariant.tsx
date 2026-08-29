import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router"; // make sure you're using react-router-dom v6
import PageMeta from "../common/PageMeta";
import ComponentCard from "../common/ComponentCard";
import toast from "react-hot-toast";
import CreateVariantForm from "./CreateVariantForm";
import axiosSecure from "../../hooks/useAxiosSecure";
import { FaArrowLeft } from "react-icons/fa";
import Button from "../ui/button/Button";
import { Link } from "react-router";

const UpdateVariant = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [variantData, setVariantData] = useState(null);

  useEffect(() => {
    const fetchVariant = async () => {
      try {
        const res = await axiosSecure.get(`/variant/${slug}`);
        setVariantData(res.data.data);
      } catch (error) {
        toast.error("Failed to fetch variant");
        console.error(error);
      }
    };

    if (slug) fetchVariant();
  }, [slug]);

  return (
    <>
      <PageMeta
        title="Update Variant | Admin Dashboard"
        description="Update a product variant"
      />
      
      {/* Premium Header Row containing Back Button and Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-brand-500 hover:border-brand-300 transition-all shadow-sm rounded-xl px-4 py-2"
        >
          <FaArrowLeft className="size-4" />
          <span className="font-semibold text-sm">Back</span>
        </Button>

        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/"
              >
                Home
                <svg
                  className="stroke-current"
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                    stroke=""
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
            <li className="text-sm text-gray-800 dark:text-white/90">
              Update Variant
            </li>
          </ol>
        </nav>
      </div>

      <div className="space-y-6">
        <ComponentCard title="Variant Update">
          {variantData && (
            <CreateVariantForm isUpdate={true} initialData={variantData} />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default UpdateVariant;

