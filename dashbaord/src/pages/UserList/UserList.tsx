import { FaArrowLeft, FaSync } from "react-icons/fa";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import UserTable, { User } from "../../components/tables/UserTable/UserTable";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import Loader from "../../components/common/Loader";

const UserList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("create-user", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allUsers, isLoading, isFetching, isError, refetch } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/auth/get-user-added-by-admin");
      return data?.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const sorted = [...(allUsers ?? [])].reverse();

  const users = searchTerm.trim()
    ? sorted.filter((u) => {
        const q = searchTerm.toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q)
        );
      })
    : sorted;

  const fetchUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="User Management - Baig Ecommerce"
        description="Manage users in the admin dashboard"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="User List"
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
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/add-user">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Add User
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading && !isFetching ? (
            <div className="flex justify-center py-20 min-h-[400px]">
              <Loader />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px] flex flex-col items-center justify-center">
              <p className="text-red-500 font-bold mb-4">Error fetching users!</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <UserTable
              users={users}
              fetchUsers={fetchUsers}
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

export default UserList;
