import { useEffect, useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiEye, FiPause, FiPlay, FiPlus, FiSearch, FiSettings } from "react-icons/fi";
import { HiOutlineBuildingStorefront } from "react-icons/hi2";
import PageMeta from "../../components/common/PageMeta";
import { tenantsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { Tenant, TenantStatus } from "../../platform/types";
import CreateSellerForm from "./CreateSellerForm";
import SellerStatusBadge from "./SellerStatusBadge";
import SellerStatusDialog, { canSuspend } from "./SellerStatusDialog";
import {
  Avatar,
  cardClass,
  ConsoleHeader,
  EmptyState,
  FilterPills,
  formatDate,
  IconAction,
  Modal,
  Pagination,
  primaryButtonClass,
  RefreshButton,
  type PillOption,
} from "./ui";

const LIMIT = 10;
type StatusFilter = TenantStatus | "all";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
        <td colSpan={6} className="px-5 py-3.5">
          <div className="flex animate-pulse items-center gap-3">
            <div className="size-10 rounded-xl bg-gray-100 dark:bg-white/5" />
            <div className="space-y-2">
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-white/5" />
              <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-white/5" />
            </div>
          </div>
        </td>
      </tr>
    ))}
  </>
);

const SellersPage = () => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Tenant | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["platform", "tenants", { search, status, page }],
    queryFn: () => tenantsApi.list({ search, status: status === "all" ? "" : status, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });

  const counts = data?.counts;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pills: PillOption<StatusFilter>[] = [
    { value: "all", label: "All", count: counts?.all ?? 0 },
    { value: "active", label: "Active", count: counts?.active ?? 0 },
    { value: "suspended", label: "Suspended", count: counts?.suspended ?? 0 },
    ...(["provisioning", "cancelled"] as const)
      .filter((key) => (counts?.[key] ?? 0) > 0 || status === key)
      .map((key) => ({ value: key, label: key[0].toUpperCase() + key.slice(1), count: counts?.[key] ?? 0 })),
  ];

  const subtitle = counts
    ? [plural(counts.all, "seller"), `${counts.active} active`, counts.suspended ? `${counts.suspended} suspended` : ""].filter(Boolean).join(" · ")
    : "Loading sellers…";

  const createButton = isSuperadmin && (
    <button type="button" onClick={() => setCreating(true)} className={primaryButtonClass}>
      <FiPlus className="size-4" />
      Create seller
    </button>
  );

  return (
    <>
      <PageMeta title="Sellers · Platform Console" description="Create and manage sellers" />

      <ConsoleHeader
        crumbs={[{ label: "Platform Console" }, { label: "Sellers" }]}
        title="Seller List"
        subtitle={subtitle}
        actions={
          <>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
            {createButton}
          </>
        }
      />

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-800">
          <div className="relative w-full lg:max-w-xs">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              aria-label="Search sellers"
              placeholder="Search name or workspace…"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-3 focus:ring-accent-500/15 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <FilterPills
            options={pills}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="w-16 px-5 py-3">S/N</th>
                <th className="px-5 py-3">Seller</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows />}
              {isError && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-error-600">Could not load sellers. Try refreshing.</td></tr>
              )}
              {data?.items.map((seller, index) => (
                <tr key={seller._id} className="group border-t border-gray-100 transition hover:bg-accent-25/60 dark:border-gray-800 dark:hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">#{(page - 1) * LIMIT + index + 1}</td>
                  <td className="px-5 py-3.5">
                    <Link to={`/platform/sellers/${seller._id}`} className="flex items-center gap-3">
                      <Avatar name={seller.name} src={seller.logoUrl} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900 transition group-hover:text-accent-700 dark:text-white/90">{seller.name}</span>
                        <span className="block truncate font-mono text-xs text-gray-500 dark:text-gray-400">{seller.slug}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[240px] px-5 py-3.5">
                    {seller.owner ? (
                      <>
                        <span className="block truncate text-gray-800 dark:text-gray-200" title={seller.owner.name}>{seller.owner.name}</span>
                        <a
                          href={`mailto:${seller.owner.email}`}
                          className="block truncate text-xs text-gray-500 hover:text-accent-600 dark:text-gray-400"
                          title={seller.owner.email}
                        >
                          {seller.owner.email}
                        </a>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-gray-600 dark:text-gray-400">{formatDate(seller.createdAt)}</td>
                  <td className="px-5 py-3.5"><SellerStatusBadge status={seller.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <IconAction label={`View ${seller.name}`} icon={<FiEye />} to={`/platform/sellers/${seller._id}`} />
                      <IconAction label={`Configure ${seller.name}`} icon={<FiSettings />} tone="green" to={`/platform/sellers/${seller._id}?tab=integrations`} />
                      {isSuperadmin && seller.status !== "cancelled" && (
                        canSuspend(seller) ? (
                          <IconAction label={`Suspend ${seller.name}`} icon={<FiPause />} tone="red" onClick={() => setStatusTarget(seller)} />
                        ) : (
                          <IconAction label={`Activate ${seller.name}`} icon={<FiPlay />} tone="green" onClick={() => setStatusTarget(seller)} />
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && !data.items.length && (
          search || status !== "all" ? (
            <EmptyState icon={<FiSearch />} title="No sellers match" text="Try another name or workspace, or clear the status filter." />
          ) : (
            <EmptyState
              icon={<HiOutlineBuildingStorefront />}
              title="No sellers yet"
              text="Create the first seller — they get a workspace, an owner account and default settings."
              action={createButton}
            />
          )
        )}

        {data && data.items.length > 0 && (
          <Pagination page={page} pages={pages} shown={data.items.length} total={data.total} noun={data.total === 1 ? "seller" : "sellers"} onChange={setPage} />
        )}
      </section>

      {creating && (
        <Modal
          title="Create seller"
          description="Sets up the workspace, owner account and default settings in one step."
          icon={<HiOutlineBuildingStorefront />}
          onClose={() => setCreating(false)}
          width="max-w-2xl"
        >
          <CreateSellerForm onCreated={invalidate} onClose={() => setCreating(false)} />
        </Modal>
      )}

      {statusTarget && <SellerStatusDialog seller={statusTarget} onClose={() => setStatusTarget(null)} onDone={invalidate} />}
    </>
  );
};

export default SellersPage;
