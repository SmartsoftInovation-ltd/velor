import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import EmployeeTable, {
  type Employee,
} from "../tables/EmployeeTable/EmployeeTable";
import axiosSecure from "../../hooks/useAxiosSecure";

const EmployeeList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("employee", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: allEmployees,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/employee/get-employee");
        return data.data.employees || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const employees = searchTerm.trim()
    ? (allEmployees ?? []).filter((e) => {
        const q = searchTerm.toLowerCase();
        return (
          e.fullName?.toLowerCase().includes(q) ||
          e.employeeId?.toLowerCase().includes(q) ||
          e.mobile?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q)
        );
      })
    : (allEmployees ?? []);

  const fetchEmployees = () => {
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Employee List - Baig Ecommerce"
        description="Manage employees"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Employee List"
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
              <Link to="/create-employee">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Employee
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
              <p className="text-red-500 font-bold mb-4">
                Failed to load employees!
              </p>
              <button
                onClick={() => refetch()}
                className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <EmployeeTable
              employees={employees}
              fetchEmployees={fetchEmployees}
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

export default EmployeeList;
