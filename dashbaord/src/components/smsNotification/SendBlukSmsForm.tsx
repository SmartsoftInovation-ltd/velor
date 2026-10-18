import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import axios from "axios";
import toast from "react-hot-toast";
import { FaUsers, FaShoppingCart, FaStore, FaWalking, FaPaperPlane, FaHistory, FaArrowLeft } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";
import { smsLength, nextSmsText } from "../../utils/smsLength";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "send-bulk-sms";

// ---------- Types ----------
type RecipientType = "logged" | "order" | "sales_walking" | "sales_listed";

interface RecipientCounts {
  logged: number;
  order: number;
  sales_walking: number;
  sales_listed: number;
}

interface GroupMeta {
  key: RecipientType;
  label: string;
  icon: React.ReactNode;
  accent: string; // tailwind ring/border accent
  iconBg: string;
}

const GROUPS: GroupMeta[] = [
  {
    key: "logged",
    label: "Logged Customers",
    icon: <FaUsers className="size-5" />,
    accent: "peer-checked:border-brand-500 peer-checked:ring-brand-500/30",
    iconBg: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  },
  {
    key: "order",
    label: "Order Customers",
    icon: <FaShoppingCart className="size-5" />,
    accent: "peer-checked:border-amber-500 peer-checked:ring-amber-500/30",
    iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    key: "sales_walking",
    label: "Walking Customers",
    icon: <FaWalking className="size-5" />,
    accent: "peer-checked:border-emerald-500 peer-checked:ring-emerald-500/30",
    iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    key: "sales_listed",
    label: "Listed Customers",
    icon: <FaStore className="size-5" />,
    accent: "peer-checked:border-teal-500 peer-checked:ring-teal-500/30",
    iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  },
];

const formatCount = (n?: number) =>
  typeof n === "number" ? n.toLocaleString() : "…";

const SendBulkSmsForm = () => {
  const [selectedType, setSelectedType] = useState<RecipientType | "">(() => draftValue<RecipientType | "">(DRAFT_KEY, "selectedType", ""));
  const [message, setMessage] = useState(() => draftValue(DRAFT_KEY, "message", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedType, message }), [selectedType, message]),
  );
  const [errors, setErrors] = useState<{ type?: string; message?: string }>({});
  const [sending, setSending] = useState(false);

  // Dynamic recipient counts
  const {
    data: counts,
    isLoading: countsLoading,
    isError: countsError,
    refetch: refetchCounts,
  } = useQuery<RecipientCounts>({
    queryKey: ["sms-recipient-counts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/sms/recipient-counts");
      return data.data.counts as RecipientCounts;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (errors.message && message.trim()) {
      setErrors((prev) => ({ ...prev, message: undefined }));
    }
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCount = useMemo(() => {
    if (!selectedType || !counts) return 0;
    return counts[selectedType] ?? 0;
  }, [selectedType, counts]);

  const sms = smsLength(message);

  const validate = () => {
    const next: { type?: string; message?: string } = {};
    if (!selectedType) next.type = "Please select a recipient group.";
    if (!message.trim()) next.message = "Message is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSend = async () => {
    if (!validate()) return;

    if (selectedType && selectedCount === 0) {
      toast.error("No recipients available in this group.");
      return;
    }

    setSending(true);
    try {
      const { data } = await axiosSecure.post("/sms/bulk-sms/send", {
        recipientType: selectedType,
        message: message.trim(),
      });

      const queued = data?.data?.totalCount ?? selectedCount;
      toast.success(
        `✅ Bulk SMS queued for ${queued.toLocaleString()} recipients. They will be delivered shortly.`,
        { duration: 5000 },
      );

      setSelectedType("");
      clearDraft(DRAFT_KEY);
      setMessage("");
      setErrors({});
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to queue bulk SMS. Please try again."
        : "Failed to queue bulk SMS. Please try again.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
{/* back button */}
      <Link to="/dashboard">
        <Button size="sm" variant="outline" startIcon={<FaArrowLeft />}>
          Back
        </Button>
      </Link>
        </div>
        <div className="flex gap-2">
          <Link to="/sms-history">
            <Button size="sm" variant="outline" startIcon={<FaHistory />}>
              History
            </Button>
          </Link>
          <Link to="/sms-status">
            <Button size="sm" variant="outline">
              Status
            </Button>
          </Link>
        </div>
      </div>

      {/* Recipient group cards */}
      <div className="mb-6">
        <Label>Recipient Group</Label>
        {countsError ? (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10">
            <span>Failed to load recipient counts.</span>
            <button
              onClick={() => refetchCounts()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((g) => (
              <label key={g.key} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  value={g.key}
                  checked={selectedType === g.key}
                  onChange={() => {
                    setSelectedType(g.key);
                    setErrors((p) => ({ ...p, type: undefined }));
                  }}
                  className="peer sr-only"
                />
                <div
                  className={`flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 ring-2 ring-transparent transition-all hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 ${g.accent}`}
                >
                  <span className={`inline-flex size-10 items-center justify-center rounded-xl ${g.iconBg}`}>
                    {g.icon}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {g.label}
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {countsLoading ? (
                      <span className="inline-block h-6 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    ) : (
                      formatCount(counts?.[g.key])
                    )}
                    <span className="ml-1 text-xs font-medium text-gray-400">
                      recipients
                    </span>
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
        {errors.type && (
          <p className="mt-2 text-sm text-red-500">{errors.type}</p>
        )}
      </div>

      {/* Message box */}
      <div className="mb-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          placeholder="Type your message here…"
          value={message}
          onChange={(e) => {
            const next = e.target.value;
            setMessage((prev) => nextSmsText(prev, next));
          }}
          rows={6}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:ring-2 dark:bg-gray-900 dark:text-white/90 ${
            errors.message
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:border-accent-500 focus:ring-accent-500/20 dark:border-gray-700"
          }`}
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          {errors.message ? (
            <span className="text-red-500">{errors.message}</span>
          ) : (
            <span className="text-gray-400">
              1 SMS max{sms.unicode ? " · Bangla/emoji: 70 characters" : ""}
            </span>
          )}
          <span className={sms.length >= sms.limit ? "font-semibold text-error-500" : "text-gray-400"}>
            {sms.length}/{sms.limit}
          </span>
        </div>
      </div>

      {/* Summary + send */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {selectedType ? (
            <>
              Sending to{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {selectedCount.toLocaleString()}
              </span>{" "}
              {GROUPS.find((g) => g.key === selectedType)?.label}
            </>
          ) : (
            "Select a recipient group to continue."
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || countsLoading}
          startIcon={sending ? undefined : <FaPaperPlane />}
          className="min-w-[180px] !bg-accent-500 hover:!bg-accent-600 !text-white font-semibold"
        >
          {sending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Queuing…
            </span>
          ) : (
            "Send Bulk SMS"
          )}
        </Button>
      </div>
    </div>
  );
};

export default SendBulkSmsForm;
