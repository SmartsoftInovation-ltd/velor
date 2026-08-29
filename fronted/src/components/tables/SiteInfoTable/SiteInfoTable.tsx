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

interface SiteInfo {
  _id: string;
  slug: string;
  storeName: string;
  adress: string;
  phone: string;
  email: string;
  image: { url: string; status: string } | null;
}

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
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

const SiteInfoTable = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const canAdd = usePermission("site-information", "add");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [siteInfos, setSiteInfos] = useState<SiteInfo[]>([]);
  const [filtered, setFiltered] = useState<SiteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSiteInfos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosSecure.get("/siteinformation/get-siteinformation");
      const data: SiteInfo[] = res.data?.data || [];
      setSiteInfos(data);
      setFiltered(data);
    } catch {
      toast.error("Failed to load site information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSiteInfos(); }, [fetchSiteInfos]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = search.toLowerCase();
      if (!q) { setFiltered(siteInfos); return; }
      setFiltered(siteInfos.filter((s) =>
        s.storeName?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.adress?.toLowerCase().includes(q)
      ));
    }, 300);
  }, [search, siteInfos]);

  const confirmDelete = async () => {
    if (!deleteSlug) return;
    try {
      setDeleteLoading(true);
      await axiosSecure.delete(`/siteinformation/delete-siteinformation/${deleteSlug}`);
      toast.success("Deleted successfully.");
      setDeleteSlug(null);
      fetchSiteInfos();
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
          placeholder="Search by name, phone, email, address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-72"
        />
      </div>

      {loading && <p className="py-10 text-center text-sm text-gray-500">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500">
          {search ? `No results for "${search}".` : "No site information found. "}
          {!search && canAdd && <Link to="/add-site-info" className="text-blue-500 hover:underline">Create one</Link>}
        </div>
      )}

      {!loading && filtered.length > 0 && isMobile ? (
        <MobileCardList
          items={filtered}
          getKey={(info) => info._id}
          emptyMessage="No site information found"
          renderCard={(info) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-center gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                {info.image?.url && (
                  <img
                    src={info.image.url}
                    alt={info.storeName}
                    className="size-12 shrink-0 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
                  />
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800 dark:text-white/90">
                  {info.storeName}
                </p>
              </div>
              <MobileCardRow label="Phone">{info.phone || "—"}</MobileCardRow>
              <MobileCardRow label="Email">{info.email || "—"}</MobileCardRow>
              <MobileCardRow label="Address">{info.adress || "—"}</MobileCardRow>
              <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate(`/view-site-info/${info.slug}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                >
                  <FaEye className="text-base" />
                </button>
                <button
                  onClick={() => navigate(`/update-site-info/${info.slug}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                >
                  <FiEdit2 className="text-base" />
                </button>
                <button
                  onClick={() => setDeleteSlug(info.slug)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-red-500 text-white"
                >
                  <MdDelete className="text-base" />
                </button>
              </div>
            </div>
          )}
        />
      ) : !loading && filtered.length > 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.03]">
          <div className="no-scrollbar w-full overflow-y-auto max-h-[560px]">
            <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "56px" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "124px" }} />
              </colgroup>
              <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                  {["#", "Logo", "Store Name", "Phone", "Email", "Address", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((info, idx) => (
                  <tr key={info._id} className="border-b border-gray-100 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-3">
                      {info.image?.url ? (
                        <img src={info.image.url} alt={info.storeName} className="w-9 h-9 object-contain rounded border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-9 h-9 rounded border bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">N/A</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-800 dark:text-white">
                      <span className="block truncate">{info.storeName}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{info.phone}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{info.email || "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate">{info.adress}</span>
                    </td>
                    <td className="px-3 py-3" style={{ overflow: "visible" }}>
                      <div className="flex items-center gap-2" style={{ overflow: "visible" }}>
                        <Tooltip text="View">
                          <button
                            onClick={() => navigate(`/view-site-info/${info.slug}`)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 bg-white dark:bg-gray-800 transition-colors"
                          >
                            <FaEye className="text-base" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Edit">
                          <button
                            onClick={() => navigate(`/update-site-info/${info.slug}`)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-yellow-400 hover:text-yellow-500 bg-white dark:bg-gray-800 transition-colors"
                          >
                            <FiEdit2 className="text-base" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Delete">
                          <button
                            onClick={() => setDeleteSlug(info.slug)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                          >
                            <MdDelete className="text-base" />
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
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Delete Site Information</h3>
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
      )}
    </div>
  );
};

export default SiteInfoTable;
