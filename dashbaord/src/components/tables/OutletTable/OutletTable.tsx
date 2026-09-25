import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FaEye } from "react-icons/fa";
import { FiEdit2 } from "react-icons/fi";
import { MdDelete } from "react-icons/md";
import { Link, useNavigate } from "react-router";
import Input from "../../form/input/InputField";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface OutletInfo {
  _id: string;
  slug: string;
  locationName: string;
  address: string;
  managerName: string;
  managerMobile: string;
  email: string;
  businessHour: string;
  offDay: string;
  image: string;
  isActive: boolean;
}

const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative inline-flex"
      style={{ overflow: "visible" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap pointer-events-none"
          style={{ zIndex: 99999 }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

const OutletInfoTable = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const canAdd = usePermission("outlet-information", "add");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [outletInfos, setOutletInfos] = useState<OutletInfo[]>([]);
  const [filtered, setFiltered] = useState<OutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchOutletInfos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosSecure.get(
        "/outletinformation/get-all-outletinformation",
      );
      const data: OutletInfo[] = res.data?.data || [];
      setOutletInfos(data);
      setFiltered(data);
    } catch (error) {
      showApiError(error, "Failed to load outlet information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutletInfos();
  }, [fetchOutletInfos]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = search.toLowerCase();
      if (!q) {
        setFiltered(outletInfos);
        return;
      }
      setFiltered(
        outletInfos.filter(
          (o) =>
            o.locationName?.toLowerCase().includes(q) ||
            o.managerName?.toLowerCase().includes(q) ||
            o.managerMobile?.toLowerCase().includes(q) ||
            o.email?.toLowerCase().includes(q) ||
            o.address?.toLowerCase().includes(q),
        ),
      );
    }, 300);
  }, [search, outletInfos]);

  const confirmDelete = async () => {
    if (!deleteSlug) return;
    try {
      setDeleteLoading(true);
      await axiosSecure.delete(
        `/outletinformation/delete-outletinformation/${deleteSlug}`,
      );
      toast.success("Outlet deleted successfully.");
      setDeleteSlug(null);
      fetchOutletInfos();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <Input
          type="text"
          placeholder="Search by location, manager, email, address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-72"
        />
      </div>

      {loading && (
        <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500">
          {search
            ? `No results for "${search}".`
            : "No outlet information found. "}
          {!search && canAdd && (
            <Link to="/add-outlet" className="text-accent-600 hover:underline">
              Create one
            </Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && isMobile ? (
        <MobileCardList
          items={filtered}
          getKey={(outlet) => outlet._id}
          emptyMessage="No outlets found"
          renderCard={(outlet) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-center gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                {outlet.image && (
                  <img
                    src={outlet.image}
                    alt={outlet.locationName}
                    className="size-12 shrink-0 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
                  />
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800 dark:text-white/90">
                  {outlet.locationName}
                </p>
              </div>
              <MobileCardRow label="Manager">{outlet.managerName || "—"}</MobileCardRow>
              <MobileCardRow label="Mobile">{outlet.managerMobile || "—"}</MobileCardRow>
              <MobileCardRow label="Email">{outlet.email || "—"}</MobileCardRow>
              <MobileCardRow label="Hours">{outlet.businessHour || "—"}</MobileCardRow>
              <MobileCardRow label="Off Day">{outlet.offDay || "—"}</MobileCardRow>
              <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => navigate(`/view-outlet-info/${outlet.slug}`)}
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                  aria-label="View outlet"
                >
                  <FaEye className="size-4" />
                </button>
                <button
                  onClick={() => navigate(`/update-outlet-info/${outlet.slug}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                >
                  <FiEdit2 className="text-base" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteSlug(outlet.slug)}
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                  aria-label="Delete outlet"
                >
                  <MdDelete className="size-5" />
                </button>
              </div>
            </div>
          )}
        />
      ) : !loading && filtered.length > 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.03]">
          <div className="no-scrollbar w-full overflow-y-auto max-h-[560px]">
            <table
              className="w-full"
              style={{ tableLayout: "fixed", borderCollapse: "collapse" }}
            >
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "124px" }} />
              </colgroup>
              <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                  {[
                    "Serial ID",
                    "Image",
                    "Location",
                    "Manager",
                    "Mobile",
                    "Email",
                    "Hours",
                    "Off Day",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((outlet, idx) => (
                  <tr
                    key={outlet._id}
                    className="border-b border-gray-100 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                    </td>
                    <td className="px-3 py-3">
                      {outlet.image ? (
                        <img
                          src={outlet.image}
                          alt={outlet.locationName}
                          className="w-9 h-9 object-contain rounded border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded border bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-800 dark:text-white">
                      <span className="block truncate">
                        {outlet.locationName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">
                        {outlet.managerName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">
                        {outlet.managerMobile}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{outlet.email}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">
                        {outlet.businessHour}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{outlet.offDay}</span>
                    </td>
                    <td className="px-3 py-3" style={{ overflow: "visible" }}>
                      <div className="flex items-center gap-2" style={{ overflow: "visible" }}>
                        <Tooltip text="View">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/view-outlet-info/${outlet.slug}`)
                            }
                            className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                            aria-label="View outlet"
                          >
                            <FaEye className="size-4" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Edit">
                          <button
                            onClick={() =>
                              navigate(`/update-outlet-info/${outlet.slug}`)
                            }
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-yellow-400 hover:text-yellow-500 bg-white dark:bg-gray-800 transition-colors"
                          >
                            <FiEdit2 className="text-base" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Delete">
                          <button
                            type="button"
                            onClick={() => setDeleteSlug(outlet.slug)}
                            className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                            aria-label="Delete outlet"
                          >
                            <MdDelete className="size-5" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-white/[0.05]">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      ) : null}

      {/* Delete Modal */}
      {deleteSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Delete Outlet Information
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteSlug(null)}
                className="shine px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                  className="shine px-4 py-2 rounded-xl bg-error-500 hover:bg-error-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletInfoTable;
