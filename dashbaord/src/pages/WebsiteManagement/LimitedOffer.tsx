import { useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import AddLimitedOfferForm from "../../components/limitedOffer/AddLimitedOfferForm";
import LimitedOfferList from "../../components/limitedOffer/LimitedOfferList";
import type { LimitedOfferItem } from "../../components/limitedOffer/types";
import axiosSecure from "../../hooks/useAxiosSecure";
import { usePermission } from "../../hooks/usePermission";

// Website Management → Limited Offer: what the storefront's "Limited offers" section shows
const LimitedOffer = () => {
  const canAdd = usePermission("limited-offer", "add");
  const { data = [], isLoading } = useQuery<LimitedOfferItem[]>({
    queryKey: ["limited-offer"],
    queryFn: async () => (await axiosSecure.get("/limited-offer")).data?.data?.items ?? [],
  });

  return (
    <>
      <PageMeta title="Limited Offer | Website Management" description="Choose the products shown as limited offers on the website" />
      <PageBreadcrumb pageTitle="Limited Offer" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {canAdd && (
          <div className="min-w-0 lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <AddLimitedOfferForm />
            </div>
          </div>
        )}
        <div className={`min-w-0 ${canAdd ? "lg:col-span-3" : "lg:col-span-5"}`}>
          <LimitedOfferList items={data} isLoading={isLoading} />
        </div>
      </div>
    </>
  );
};

export default LimitedOffer;
