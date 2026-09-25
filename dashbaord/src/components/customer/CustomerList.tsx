import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import axios from "axios";
import ComponentCard from "../common/ComponentCard";
import PageBreadcrumb from "../common/PageBreadCrumb";
import PageMeta from "../common/PageMeta";
import Loader from "../common/Loader";
import Button from "../ui/button/Button";
import CustomerTable from "../tables/CustomerTable/CustomerTable";
import axiosSecure from "../../hooks/useAxiosSecure";

const CustomerList = () => {
  const canAdd = usePermission("customer", "add");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: customers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/customer/get-customers");
        return data?.data?.customers || [];
      } catch (err) {
        // Backend returns 404 when no customers exist — treat as empty list
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
  });

  const filtered = (customers ?? []).filter((c: any) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.mobileNumber?.includes(q) ||
      c.customerId?.toLowerCase().includes(q) ||
      c.customSerialId?.toLowerCase().includes(q)
    );
  });
  // jsx start

  return (
    <>
      <PageMeta
        title="Customer List - Baig Ecommerce"
        description="Manage and view all customers in Baig Digital admin dashboard"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Customer List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-customer">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Customer
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center py-20 min-h-100">
              <Loader />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-100 flex flex-col items-center justify-center">
              <p className="text-red-500 font-bold mb-4 text-lg">
                Failed to load customers!
              </p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <CustomerTable
              customers={filtered ?? null}
              fetchCustomers={() => {
                queryClient.invalidateQueries({ queryKey: ["customers"] });
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

export default CustomerList;
