import { FaArrowLeft, FaSync } from "react-icons/fa";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import RoleTable from "../../components/tables/RolePermissionTable/RoleTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import Loader from "../../components/common/Loader";
import { assignableRoles } from "../../lib/roles";
import { usePermission } from "../../hooks/usePermission";

export interface Role {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

const RoleList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("create-role", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: allRoles,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/all-role");
      return assignableRoles(data?.data);
    },
    staleTime: 2 * 60 * 1000,
  });

  const roles = searchTerm.trim()
    ? (allRoles ?? []).filter((r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : [...(allRoles ?? [])].reverse();

  const fetchRoles = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Role List - Baig Ecommerce"
        description="Manage roles"
      />
      {/* Header row is just the trail and the page actions */}
      <PageBreadcrumb
        pageTitle="Role List"
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
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh Roles"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-role" className="inline-flex h-9 items-center rounded bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600">
                Create Role
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading && !isFetching ? (
            <div className="flex justify-center py-20 min-h-[300px]">
              <Loader />
            </div>
          ) : isError ? (
            <div className="text-center py-16 min-h-[300px] flex flex-col items-center justify-center">
              <p className="text-red-500 font-bold mb-4">
                Error fetching roles!
              </p>
              <button
                onClick={() => refetch()}
                className="shine px-6 py-2 bg-accent-500 text-white rounded-xl font-bold hover:bg-accent-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <RoleTable
              roles={roles}
              fetchRoles={fetchRoles}
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

export default RoleList;
