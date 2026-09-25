import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { FaEye, FaArrowLeft, FaSync } from "react-icons/fa";
import { FiEdit2 } from "react-icons/fi";
// import { MdDelete } from "react-icons/md";
import { Link, useNavigate } from "react-router";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../components/ui/table";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { usePermission } from "../../../hooks/usePermission";
import { showApiError } from "../../../utils/apiError";

interface StoreInfo {
  _id: string;
  slug: string;
  storeName: string;
  adress: string;
  phone: string;
  email: string;
  image: { url: string; status: string };
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT = 10;

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap pointer-events-none" style={{ zIndex: 9999 }}>
          {text}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
        </div>
      )}
    </div>
  );
};

const StoreInfoList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("site-information", "add");
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  // const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchStores = useCallback(async (page: number, searchTerm: string) => {
    try {
      setLoading(true);
      const res = await axiosSecure.get("/storeinformation/store-information", {
        params: { page, limit: LIMIT, search: searchTerm },
      });
      const d = res.data?.data;
      setStores(d?.stores || []);
      setMeta({
        total: d?.total || 0,
        page: d?.page || page,
        limit: d?.limit || LIMIT,
        totalPages: d?.totalPages || 0,
      });
    } catch (error) {
      showApiError(error, "Failed to load store information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(1, debouncedSearch); }, [debouncedSearch, fetchStores]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const handlePageChange = (page: number) => { fetchStores(page, debouncedSearch); };

  // const confirmDelete = async () => {
  //   if (!deleteSlug) return;
  //   try {
  //     setDeleteLoading(true);
  //     await axiosSecure.delete(`/storeinformation/store-information/${deleteSlug}`);
  //     toast.success("Store information deleted successfully.");
  //     setDeleteSlug(null);
  //     fetchStores(meta.page, debouncedSearch);
  //   } catch (err: any) {
  //     toast.error(err.response?.data?.message || "Failed to delete.");
  //   } finally {
  //     setDeleteLoading(false);
  //   }
  // };

  return (
    <>
      <PageMeta title="Store Information | Admin Dashboard" description="Manage all store information records" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Store Information"
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
              onClick={() => fetchStores(1, debouncedSearch)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-store-info">
                <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                  Add Store Info
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-end">
              <Input
                type="text"
                placeholder="Search by name, phone, email..."
                value={search}
                onChange={handleSearchChange}
                className="!w-64"
              />
            </div>
          }
        >
          {loading && <div className="py-10 text-center text-sm text-gray-500">Loading...</div>}

          {!loading && stores.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">
              No store information found.{" "}
              {canAdd && (
                <Link to="/add-store-info" className="text-blue-500 hover:underline">Create one</Link>
              )}
            </div>
          )}

          {!loading && stores.length > 0 && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div className="w-full">
                  <Table>
                    <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                      <TableRow className="uppercase">
                        {["#", "Logo", "Store Name", "Phone", "Email", "Address", "Actions"].map((h) => (
                          <TableCell key={h} isHeader className="px-3 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 truncate">
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {stores.map((store, idx) => (
                        <TableRow key={store._id}>
                          <TableCell className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {(meta.page - 1) * meta.limit + idx + 1}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            {store.image?.url ? (
                              <img src={store.image.url} alt={store.storeName} className="w-9 h-9 object-contain rounded border" />
                            ) : (
                              <div className="w-9 h-9 rounded border bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">N/A</div>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm font-medium text-gray-800 dark:text-white max-w-[120px] truncate">
                            {store.storeName}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[100px] truncate">
                            {store.phone}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                            {store.email || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[140px] truncate">
                            {store.adress}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Tooltip text="View">
                                <button
                                  onClick={() => navigate(`/store-info-view/${store.slug}`)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 bg-white dark:bg-gray-800 transition-colors"
                                >
                                  <FaEye className="text-base" />
                                </button>
                              </Tooltip>
                              <Tooltip text="Edit">
                                <button
                                  onClick={() => navigate(`/update-store-info/${store.slug}`)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-yellow-400 hover:text-yellow-500 bg-white dark:bg-gray-800 transition-colors"
                                >
                                  <FiEdit2 className="text-base" />
                                </button>
                              </Tooltip>
                              {/* <Tooltip text="Delete">
                                <button
                                  onClick={() => setDeleteSlug(store.slug)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                                >
                                  <MdDelete className="text-base" />
                                </button>
                              </Tooltip> */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-500">
                    Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page === 1}
                      className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">
                      Prev
                    </button>
                    {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                      .reduce<(number | "...")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "..." ? (
                          <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
                        ) : (
                          <button key={p} onClick={() => handlePageChange(p as number)}
                            className={`px-3 py-1.5 rounded border text-sm ${meta.page === p ? "bg-brand-500 text-white border-brand-500" : "hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"}`}>
                            {p}
                          </button>
                        )
                      )}
                    <button onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page === meta.totalPages}
                      className="px-3 py-1.5 rounded border text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </ComponentCard>
      </div>

      {/* Delete Modal — commented out, delete not allowed from list */}
      {/* {deleteSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Delete Store Information</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteSlug(null)} className="px-4 py-2 rounded border text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleteLoading} className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm disabled:opacity-50">
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )} */}

    </>
  );
};

export default StoreInfoList;
