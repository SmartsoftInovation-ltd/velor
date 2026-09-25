import { FaArrowLeft, FaSync } from "react-icons/fa";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CreateRoleForm from "../../components/rolepermission/CreateRoleForm";
import RoleTable from "../../components/tables/RolePermissionTable/RoleTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import Loader from "../../components/common/Loader";
import { assignableRoles } from "../../lib/roles";

export interface Role {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

const CreateRole = () => {
  const navigate = useNavigate();
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
        title="Role Management - Baig Ecommerce"
        description="Create and manage roles"
      />
      {/* Header row is just the trail and the page actions — the create card
          carries no heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Role"
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
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Refresh Roles"
            >
              <FaSync className="size-3.5" />
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        {/* Create form */}
        <ComponentCard>
          <CreateRoleForm onCreated={fetchRoles} />
        </ComponentCard>

        {/* Role list */}
        <ComponentCard title="Role List">
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
                className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors"
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

export default CreateRole;
