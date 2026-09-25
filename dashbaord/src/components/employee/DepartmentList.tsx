import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import DepartmentTable from "../tables/EmployeeTable/DepartmentTable";
import axiosSecure from "../../hooks/useAxiosSecure";

export interface Department {
  _id: string;
  name: string;
  slug: string;
}

const DepartmentList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("department", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allDepartments, isLoading, isFetching, isError, refetch } =
    useQuery<Department[]>({
      queryKey: ["departments"],
      queryFn: async () => {
        try {
          const { data } = await axiosSecure.get("/employee/get-employee-department");
          return data.data.departments || [];
        } catch (err: any) {
          if (err?.response?.status === 404) return [];
          throw err;
        }
      },
      staleTime: 2 * 60 * 1000,
    });

  const departments = (
    searchTerm.trim()
      ? (allDepartments ?? []).filter((d) =>
          d.name?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : (allDepartments ?? [])
  )
    .slice()
    .reverse();

  const fetchDepartments = () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Department List - Baig Ecommerce"
        description="Manage employee departments"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Department List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-department">
                <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                  Create Department
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
              <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">Failed to load departments!</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <DepartmentTable
              departments={departments}
              fetchDepartments={fetchDepartments}
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

export default DepartmentList;
