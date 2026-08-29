import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import ComponentCard from "../common/ComponentCard";
import PageBreadcrumb from "../common/PageBreadCrumb";
import PageMeta from "../common/PageMeta";
import Loader from "../common/Loader";
import Button from "../ui/button/Button";
import CustomerPaymentReceiveTable from "../tables/CustomerTable/CustomerPaymentReceiveList";
import axiosSecure from "../../hooks/useAxiosSecure";

const CustomerPaymentReceiveList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: payments,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customer-payments"],
    queryFn: async () => {
      try {
        const res = await axiosSecure.get("/customer/get-customer-payment-recived");
        return res?.data?.data?.customerPayments ?? [];
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <PageMeta
        title="Customer Payment Receive List - Baig Ecommerce"
        description="View all customer payment receive records"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Customer Payment Receive List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Link to="/customer-payment-receive">
              <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                Receive Payment
              </Button>
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center py-20 min-h-[400px]">
              <Loader />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px] flex flex-col items-center justify-center">
              <p className="text-red-500 font-bold mb-4 text-lg">Failed to load payments!</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <CustomerPaymentReceiveTable
              payments={payments ?? []}
              fetchPayments={() => {
                queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
                refetch();
              }}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default CustomerPaymentReceiveList;
