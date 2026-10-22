import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaEdit, FaPlus, FaTrashAlt } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { type FlashSaleSummary, STATUS_STYLE } from "../../components/flashSale/types";
import axiosSecure from "../../hooks/useAxiosSecure";
import { usePermission } from "../../hooks/usePermission";
import { getApiErrorMessage } from "../../utils/apiError";

const formatDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const formatTime = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
    : "";
};

const DateCell = ({ value }: { value: string }) => (
  <div>
    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{formatDate(value)}</p>
    <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatTime(value)}</p>
  </div>
);

// Two columns on a phone, the full row from md up
const GRID = "grid grid-cols-2 gap-3 md:grid-cols-[1.6fr_1fr_1fr_110px_70px_100px] md:items-center md:gap-4";

// Website Management → Flash Sale: every sale of the store, newest first
const FlashSaleList = () => {
  const queryClient = useQueryClient();
  const canAdd = usePermission("flash-sale", "add");
  const canEdit = usePermission("flash-sale", "edit");
  const canDelete = usePermission("flash-sale", "delete");

  const { data: sales = [], isLoading } = useQuery<FlashSaleSummary[]>({
    queryKey: ["flash-sales"],
    queryFn: async () => (await axiosSecure.get("/flash-sale")).data?.data?.sales ?? [],
  });

  const remove = useMutation({
    mutationFn: (id: string) => axiosSecure.delete(`/flash-sale/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
      toast.success("Flash sale deleted");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not delete it")),
  });

  return (
    <>
      <PageMeta title="Flash Sale | Website Management" description="Time-limited sale prices on the website" />
      <PageBreadcrumb pageTitle="Flash Sale" />

      <section className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Flash sales</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              While a sale runs, the website shows its prices and checkout charges them.
            </p>
          </div>
          {canAdd && (
            <Link
              to="/flash-sale/new"
              className="shine inline-flex h-10 items-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-semibold text-white transition hover:bg-accent-600"
            >
              <FaPlus className="size-3.5" /> Create flash sale
            </Link>
          )}
        </div>

        <div className={`${GRID} hidden px-6 py-3 text-xs font-semibold text-gray-500 md:grid dark:text-gray-400`}>
          <span>Title</span>
          <span>Starts</span>
          <span>Ends</span>
          <span>Status</span>
          <span>Items</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 px-6 pb-6" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />)}
          </div>
        ) : sales.length ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sales.map((sale) => {
              const status = STATUS_STYLE[sale.status];
              return (
                <li key={sale._id} className={`${GRID} px-6 py-4`}>
                    <p className="col-span-2 truncate text-sm font-semibold text-gray-900 md:col-span-1 dark:text-white/90">{sale.title}</p>
                    <DateCell value={sale.startsAt} />
                    <DateCell value={sale.endsAt} />
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.pill}`}>
                      <span className={`size-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{sale.itemCount}</span>
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <Link
                          to={`/flash-sale/${sale._id}`}
                          aria-label={`Edit ${sale.title}`}
                          className="inline-flex size-9 items-center justify-center rounded bg-warning-50 text-warning-600 transition-all hover:bg-warning-100 active:scale-90 dark:bg-warning-500/15 dark:text-warning-400"
                        >
                          <FaEdit className="size-3.5" />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete ${sale.title}`}
                          disabled={remove.isPending}
                          onClick={() => window.confirm(`Delete "${sale.title}"?`) && remove.mutate(sale._id)}
                          className="inline-flex size-9 items-center justify-center rounded bg-error-50 text-error-600 transition-all hover:bg-error-100 active:scale-90 dark:bg-error-500/15 dark:text-error-400"
                        >
                          <FaTrashAlt className="size-3.5" />
                        </button>
                      )}
                    </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-14 text-center text-sm text-gray-500 dark:text-gray-400">
            No flash sales yet. The Flash sale section stays hidden on the website until one is running.
          </p>
        )}
      </section>
    </>
  );
};

export default FlashSaleList;
