import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import DesignationTable from "../tables/EmployeeTable/DesignationTable";
import axiosSecure from "../../hooks/useAxiosSecure";

export interface Designation {
  _id: string;
  name: string;
  slug: string;
}

const DesignationList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("designation", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allDesignations, isLoading, isFetching, isError, refetch } =
    useQuery<Designation[]>({
      queryKey: ["designations"],
      queryFn: async () => {
        try {
          const { data } = await axiosSecure.get("/employee/get-employee-designation");
          return data.data.designations || [];
        } catch (err: any) {
          if (err?.response?.status === 404) return [];
          throw err;
        }
      },
      staleTime: 2 * 60 * 1000,
    });

  const designations = (
    searchTerm.trim()
      ? (allDesignations ?? []).filter((d) =>
          d.name?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : (allDesignations ?? [])
  )
    .slice()
    .reverse();

  const fetchDesignations = () => {
    queryClient.invalidateQueries({ queryKey: ["designations"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Designation List - Baig Ecommerce"
        description="Manage employee designations"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Designation List"
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
              <Link to="/create-designation">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Designation
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">Failed to load designations!</p>
              <button
                onClick={() => refetch()}
                className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <DesignationTable
              designations={designations}
              fetchDesignations={fetchDesignations}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isFetching={isFetching}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default DesignationList;
