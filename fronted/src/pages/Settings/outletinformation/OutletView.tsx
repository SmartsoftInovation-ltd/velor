import Button from "../../../components/ui/button/Button";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdEmail, MdPhone, MdPlace } from "react-icons/md";
import { Link, useParams } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import axiosSecure from "../../../hooks/useAxiosSecure";

interface OutletInfo {
  _id: string;
  slug: string;
  locationName: string;
  address: string;
  managerName: string;
  managerMobile: string;
  email: string;
  businessHour: string;
  offDay: string;
  image: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const OutletView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [outlet, setOutlet] = useState<OutletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axiosSecure.get(`/outletinformation/get-outletinformation/${slug}`);
        setOutlet(res.data?.data || null);
      } catch {
        toast.error("Failed to load outlet information.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="size-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!outlet) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500 text-sm">Outlet information not found.</p>
        <Link to="/outlet-list" className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm">
          Back to List
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`${outlet.locationName} | Outlet Information`} description={`View details for ${outlet.locationName}`} />
      {/* Header row is just the trail and the record actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Outlet Details"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/update-outlet-info/${outlet.slug}`}>
              <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                Edit
              </Button>
            </Link>
            <Link to="/outlet-list">
              <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                Outlet List
              </Button>
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex-shrink-0">
              {outlet.image ? (
                <img
                  src={outlet.image}
                  alt={outlet.locationName}
                  className="w-32 h-32 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
                  No Image
                </div>
              )}
              <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                outlet.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
              }`}>
                {outlet.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{outlet.locationName}</h1>
              <div className="mt-4 space-y-2">
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPlace className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{outlet.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MdPhone className="flex-shrink-0 text-gray-400" />
                  <span>{outlet.managerMobile}</span>
                </div>
                {outlet.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <MdEmail className="flex-shrink-0 text-gray-400" />
                    <span>{outlet.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Outlet Details">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["Manager Name", outlet.managerName],
              ["Manager Mobile", outlet.managerMobile],
              ["Email", outlet.email],
              ["Business Hour", outlet.businessHour],
              ["Weekly Off Day", outlet.offDay],
              ["Address", outlet.address],
              ["Created At", new Date(outlet.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })],
              ["Updated At", new Date(outlet.updatedAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</dt>
                  <dd className="text-sm text-gray-700 dark:text-gray-200">{value}</dd>
                </div>
              ))}
          </dl>
        </ComponentCard>
      </div>
    </>
  );
};

export default OutletView;
