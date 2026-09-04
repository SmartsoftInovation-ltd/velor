import { useState } from "react";
import {
  FaUsers,
  FaShoppingCart,
  FaStore,
  FaWalking,
  FaDownload,
  FaChevronDown,
} from "react-icons/fa";
import SmsCampaignTable from "./SmsCampaignTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../utils/apiError";

// ---------- Types ----------
type RecipientType = "logged" | "order" | "sales_walking" | "sales_listed" | "due" | "";

interface Tab {
  key: RecipientType;
  label: string;
  icon: React.ReactNode;
  accent: string;
  activeClasses: string;
}

const TABS: Tab[] = [
  {
    key: "",
    label: "All Campaigns",
    icon: null,
    accent: "",
    activeClasses: "border-brand-500 text-brand-600 dark:text-brand-400",
  },
  {
    key: "logged",
    label: "Logged Customers",
    icon: <FaUsers className="text-sm" />,
    accent: "",
    activeClasses: "border-brand-500 text-brand-600 dark:text-brand-400",
  },
  {
    key: "order",
    label: "Order Customers",
    icon: <FaShoppingCart className="text-sm" />,
    accent: "",
    activeClasses: "border-amber-500 text-amber-600 dark:text-amber-400",
  },
  {
    key: "sales_walking",
    label: "Walking Customers",
    icon: <FaWalking className="text-sm" />,
    accent: "",
    activeClasses: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "sales_listed",
    label: "Listed Customers",
    icon: <FaStore className="text-sm" />,
    accent: "",
    activeClasses: "border-teal-500 text-teal-600 dark:text-teal-400",
  },
];

// ---------- Component ----------
export default function SmsHistoryPanel() {
  const [activeTab, setActiveTab] = useState<RecipientType>("");
  const [downloading, setDownloading] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  const handleDownload = async (format: "csv" | "xlsx") => {
    setShowFormatMenu(false);
    setDownloading(true);
    try {
      const params: Record<string, string> = { format };
      if (activeTab) params.recipientType = activeTab;

      const response = await axiosSecure.get("/sms/report/download", {
        params,
        responseType: "blob",
      });

      const ext = format === "xlsx" ? "xls" : "csv";
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `sms-report-${activeTab || "all"}-${new Date().toISOString().slice(0, 10)}.${ext}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Report downloaded as .${ext}`);
    } catch (error) {
      showApiError(error, "Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const activeTabMeta = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="space-y-5">
      {/* ---- Header Row ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            SMS Campaign History
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Browse all previously sent bulk SMS campaigns.
          </p>
        </div>

        {/* Download button */}
        <div className="relative">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              onClick={() => handleDownload("csv")}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {downloading ? (
                <span className="size-3.5 rounded-full border-2 border-gray-400 border-t-gray-800 animate-spin" />
              ) : (
                <FaDownload className="text-gray-500" />
              )}
              <span>Download CSV</span>
            </button>
            <div className="w-px bg-gray-200 dark:bg-gray-700" />
            <button
              onClick={() => setShowFormatMenu((p) => !p)}
              className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="More formats"
            >
              <FaChevronDown className={`text-xs transition-transform ${showFormatMenu ? "rotate-180" : ""}`} />
            </button>
          </div>
          {showFormatMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => handleDownload("csv")}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                CSV (.csv)
              </button>
              <button
                onClick={() => handleDownload("xlsx")}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Excel (.xls)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <div className="border-b border-gray-100 dark:border-gray-800 -mx-1">
        <div className="flex overflow-x-auto scrollbar-hide gap-1 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? `${activeTabMeta.key === tab.key ? tab.activeClasses : "border-brand-500 text-brand-600 dark:text-brand-400"}`
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Table ---- */}
      <SmsCampaignTable
        key={activeTab}
        defaultFilter={activeTab}
        showFilters={true}
      />
    </div>
  );
}
