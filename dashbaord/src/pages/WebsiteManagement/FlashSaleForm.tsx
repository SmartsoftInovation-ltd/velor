import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaArrowLeft, FaBolt, FaSearch } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import FlashSaleItems from "../../components/flashSale/FlashSaleItems";
import SaleWindowPicker from "../../components/flashSale/SaleWindowPicker";
import { toLocalValue } from "../../components/flashSale/saleWindow";
import type { SaleItem } from "../../components/flashSale/types";
import ProductPickList from "../../components/productPicker/ProductPickList";
import {
  type LookupProduct,
  pickKey,
  variantLabel,
} from "../../components/productPicker/types";
import axiosSecure from "../../hooks/useAxiosSecure";
import { clearDraft, draftValue, useFormDraft } from "../../hooks/useFormDraft";
import { useRemoteLookup } from "../../hooks/useRemoteLookup";
import { getApiErrorMessage } from "../../utils/apiError";

const card =
  "rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]";
const label =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

// A new item starts at 20% off; the price can be changed in the list
const DEFAULT_OFF = 0.2;
// A half-built new sale survives a reload; editing a saved sale keeps no draft
const DRAFT_KEY = "flash-sale-new";

/** What still stops the sale from being saved, in plain words */
const missingFor = (
  title: string,
  items: SaleItem[],
  startsAt: string,
  endsAt: string,
) => {
  const missing: string[] = [];
  if (!title.trim()) missing.push("a title");
  if (new Date(endsAt) <= new Date(startsAt))
    missing.push("an end time after the start");
  if (!items.length) missing.push("at least one product");
  const bad = items.filter(
    (i) => i.salePrice <= 0 || i.salePrice >= i.retailPrice,
  ).length;
  if (bad)
    missing.push(
      `a sale price below the price for ${bad} item${bad === 1 ? "" : "s"}`,
    );
  return missing;
};

const FlashSaleForm = () => {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // A new sale starts from its draft, if one was left; an edit starts empty and loads below
  const draft = <T,>(field: string, fallback: T) =>
    editing ? fallback : draftValue(DRAFT_KEY, field, fallback);
  const [title, setTitle] = useState(() => draft("title", ""));
  const [startsAt, setStartsAt] = useState(() =>
    draft("startsAt", toLocalValue(new Date())),
  );
  const [endsAt, setEndsAt] = useState(() =>
    draft("endsAt", toLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000))),
  );
  const [isActive, setIsActive] = useState(() => draft("isActive", true));
  const [items, setItems] = useState<SaleItem[]>(() =>
    draft("items", [] as SaleItem[]),
  );
  useFormDraft(
    DRAFT_KEY,
    { title, startsAt, endsAt, isActive, items },
    !editing,
  );
  const [search, setSearch] = useState("");

  const products = useRemoteLookup<LookupProduct>(
    "flash-sale-products",
    "/product/getproduct",
    (d) => d?.data?.products as LookupProduct[] | undefined,
  );

  const existing = useQuery({
    queryKey: ["flash-sale", id],
    queryFn: async () =>
      (await axiosSecure.get(`/flash-sale/${id}`)).data?.data?.sale,
    enabled: editing,
  });
  useEffect(() => {
    const sale = existing.data;
    if (!sale) return;
    setTitle(sale.title);
    setStartsAt(toLocalValue(new Date(sale.startsAt)));
    setEndsAt(toLocalValue(new Date(sale.endsAt)));
    setIsActive(sale.isActive);
    setItems(
      sale.items.map(
        (
          i: SaleItem & { variantName: string; size: string; color: string },
        ) => ({
          ...i,
          variantLabel: i.variant
            ? variantLabel({
                variantName: i.variantName,
                size: i.size,
                color: i.color,
              })
            : "",
        }),
      ),
    );
  }, [existing.data]);

  const keys = new Set(items.map((i) => pickKey(i.product, i.variant)));

  const toggle = (product: LookupProduct, variantId: string | null) => {
    const key = pickKey(product._id, variantId);
    if (keys.has(key)) {
      setItems((current) =>
        current.filter((i) => pickKey(i.product, i.variant) !== key),
      );
      return;
    }
    const variant = product.variant?.find((v) => v._id === variantId);
    const retail = (variant ? variant.retailPrice : product.retailPrice) ?? 0;
    setItems((current) => [
      ...current,
      {
        product: product._id,
        variant: variantId,
        salePrice: Math.round(retail * (1 - DEFAULT_OFF)),
        productName: product.name,
        variantLabel: variant ? variantLabel(variant) : "",
        image: product.thumbnail?.url ?? "",
        retailPrice: retail,
        stock: (variant ? variant.stockVariant : product.stock) ?? 0,
      },
    ]);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        isActive,
        items: items.map(({ product, variant, salePrice }) => ({
          product,
          variant,
          salePrice,
        })),
      };
      return editing
        ? axiosSecure.put(`/flash-sale/${id}`, body)
        : axiosSecure.post("/flash-sale", body);
    },
    onSuccess: () => {
      if (!editing) clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
      queryClient.invalidateQueries({ queryKey: ["flash-sale", id] });
      toast.success(editing ? "Flash sale saved" : "Flash sale created");
      navigate("/flash-sale");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not save the flash sale")),
  });

  const pageTitle = editing ? "Edit Flash Sale" : "Create Flash Sale";
  const missing = missingFor(title, items, startsAt, endsAt);

  return (
    <>
      <PageMeta
        title={`${pageTitle} | Website Management`}
        description="Set sale prices for a limited time"
      />
      <PageBreadcrumb pageTitle={pageTitle} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Say what is missing instead of a button that silently does nothing
          if (missing.length) {
            toast.error(`Add ${missing.join(", ")} to save the flash sale`);
            return;
          }
          save.mutate();
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/flash-sale")}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent-600 dark:text-gray-400"
          >
            <FaArrowLeft className="size-3.5" /> Back to flash sales
          </button>
          <div className="flex items-center gap-3">
            {!editing && (title || items.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  clearDraft(DRAFT_KEY);
                  setTitle("");
                  setItems([]);
                  setIsActive(true);
                  setStartsAt(toLocalValue(new Date()));
                  setEndsAt(
                    toLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                  );
                }}
                className="text-sm font-medium text-gray-500 hover:text-error-600 dark:text-gray-400"
              >
                Start over
              </button>
            )}
            <button
              type="submit"
              disabled={save.isPending}
              className="shine inline-flex h-11 items-center gap-2 rounded-xl bg-accent-500 px-5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {save.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <FaBolt className="size-3.5" />
              )}
              {editing ? "Save flash sale" : "Create flash sale"}
            </button>
          </div>
        </div>

        {missing.length > 0 && (
          <p className="-mt-2 mb-5 text-right text-xs text-gray-500 dark:text-gray-400">
            To save, add {missing.join(", ")}.
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-2">
            <section className={`${card} space-y-4`}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                Sale details
              </h2>
              <div>
                <label htmlFor="fs-title" className={label}>
                  Title
                </label>
                <input
                  id="fs-title"
                  className={input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Eid weekend sale"
                  maxLength={80}
                />
              </div>
              <div>
                <p className={label}>When it runs</p>
                <SaleWindowPicker
                  startsAt={startsAt}
                  endsAt={endsAt}
                  onChange={(start, end) => {
                    setStartsAt(start);
                    setEndsAt(end);
                  }}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                <span>
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                    Sale is on
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Turn off to pause it without deleting.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isActive ? "bg-accent-500" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${isActive ? "left-[22px]" : "left-0.5"}`}
                  />
                </button>
              </label>
            </section>

            <section className={`${card} space-y-2`}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                Pick products
              </h2>
              <div className="group relative">
                <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    products.onSearchChange(e.target.value);
                  }}
                  placeholder="Search by name, SKU or barcode"
                  className={`${input} pl-10`}
                />
              </div>
              <ProductPickList
                products={products.items}
                isSelected={(key) => keys.has(key)}
                onToggle={toggle}
                variantsOnly
              />
            </section>
          </div>

          <div className="lg:col-span-3">
            <FlashSaleItems items={items} onChange={setItems} />
          </div>
        </div>
      </form>
    </>
  );
};

export default FlashSaleForm;
