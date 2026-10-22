import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaExternalLinkAlt, FaImage, FaTrashAlt } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import { usePermission } from "../../hooks/usePermission";
import { getApiErrorMessage } from "../../utils/apiError";
import { type LimitedOfferItem, variantLabel } from "./types";

const iconButton = "inline-flex size-9 items-center justify-center rounded transition-all active:scale-90";

const Row = ({ item, onChange, onRemove, busy }: {
  item: LimitedOfferItem;
  onChange: (patch: { priority?: number; isActive?: boolean }) => void;
  onRemove: () => void;
  busy: boolean;
}) => {
  const canEdit = usePermission("limited-offer", "edit");
  const canDelete = usePermission("limited-offer", "delete");
  const [priority, setPriority] = useState(String(item.priority));
  // A deactivated product or variant is skipped by the website even if the entry is on
  const hidden = !item.product?.isActive || item.variant?.isActive === false;

  return (
    <li className={`flex items-center gap-4 py-4 first:pt-0 last:pb-0 ${item.isActive ? "" : "opacity-60"}`}>
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/5">
        {item.image ? (
          <img src={item.image} alt="" className="size-full object-cover" />
        ) : (
          <FaImage className="size-5 text-gray-300 dark:text-gray-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
          {item.product?.name ?? "Deleted product"}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {item.variant ? variantLabel(item.variant) : "Whole product"}
          <span className="tabular-nums"> · ৳{item.price.toLocaleString()} · {item.stock} in stock</span>
        </p>
        {hidden && (
          <p className="mt-1 text-xs font-medium text-warning-600 dark:text-warning-400">
            Not shown: the {item.variant?.isActive === false ? "variant" : "product"} is inactive
          </p>
        )}
      </div>

      <input
        type="number"
        min={0}
        aria-label="Priority"
        title="Priority: lower shows first"
        value={priority}
        disabled={!canEdit}
        onChange={(e) => setPriority(e.target.value)}
        onBlur={() => Number(priority) !== item.priority && onChange({ priority: Number(priority) || 0 })}
        className="h-9 w-16 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm tabular-nums text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />

      <button
        type="button"
        role="switch"
        aria-checked={item.isActive}
        aria-label={item.isActive ? "Shown on website, click to hide" : "Hidden, click to show"}
        disabled={!canEdit || busy}
        onClick={() => onChange({ isActive: !item.isActive })}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${item.isActive ? "bg-accent-500" : "bg-gray-300 dark:bg-gray-700"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${item.isActive ? "left-[22px]" : "left-0.5"}`} />
      </button>

      {item.storefrontUrl ? (
        <a
          href={item.storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View on website"
          aria-label="View on website"
          className={`${iconButton} bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10`}
        >
          <FaExternalLinkAlt className="size-3.5" />
        </a>
      ) : (
        <span
          title="Add a domain for this store to open it on the website"
          className={`${iconButton} cursor-not-allowed bg-gray-50 text-gray-300 dark:bg-white/[0.02] dark:text-gray-600`}
        >
          <FaExternalLinkAlt className="size-3.5" />
        </span>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="Remove from Limited Offer"
          className={`${iconButton} bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25`}
        >
          <FaTrashAlt className="size-3.5" />
        </button>
      )}
    </li>
  );
};

const LimitedOfferList = ({ items, isLoading }: { items: LimitedOfferItem[]; isLoading: boolean }) => {
  const queryClient = useQueryClient();
  const save = (items: LimitedOfferItem[]) => queryClient.setQueryData(["limited-offer"], items);

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { priority?: number; isActive?: boolean } }) =>
      axiosSecure.patch(`/limited-offer/${id}`, patch),
    onSuccess: ({ data }) => save(data?.data?.items ?? []),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update it")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => axiosSecure.delete(`/limited-offer/${id}`),
    onSuccess: ({ data }) => {
      save(data?.data?.items ?? []);
      toast.success("Removed from Limited Offer");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not remove it")),
  });

  const live = items.filter((i) => i.isActive).length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">On the website</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">In the order shoppers see them.</p>
        </div>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
          {live} shown
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      ) : items.length ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item) => (
            <Row
              key={`${item._id}:${item.priority}`}
              item={item}
              busy={update.isPending || remove.isPending}
              onChange={(patch) => update.mutate({ id: item._id, patch })}
              onRemove={() => remove.mutate(item._id)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Nothing picked yet. The Limited offers section stays hidden on the website until you add some.
        </p>
      )}
    </section>
  );
};

export default LimitedOfferList;
