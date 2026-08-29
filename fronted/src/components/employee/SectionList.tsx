import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import SectionTable from "../tables/EmployeeTable/SectionTable";
import axiosSecure from "../../hooks/useAxiosSecure";

export interface Section {
  _id: string;
  name: string;
  slug: string;
}

const SectionList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("section", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allSections, isLoading, isFetching, isError, refetch } =
    useQuery<Section[]>({
      queryKey: ["sections"],
      queryFn: async () => {
        try {
          const { data } = await axiosSecure.get("/employee/get-employee-section");
          return data.data.sections || [];
        } catch (err: any) {
          if (err?.response?.status === 404) return [];
          throw err;
        }
      },
      staleTime: 2 * 60 * 1000,
    });

  const sections = (
    searchTerm.trim()
      ? (allSections ?? []).filter((s) =>
          s.name?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : (allSections ?? [])
  )
    .slice()
    .reverse();

  const fetchSections = () => {
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Section List - Baig Ecommerce"
        description="Manage employee sections"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Section List"
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
            {canAdd && (
              <Link to="/create-section">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Create Section
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
              <p className="text-red-500 font-bold mb-4">Failed to load sections!</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <SectionTable
              sections={sections}
              fetchSections={fetchSections}
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

export default SectionList;
