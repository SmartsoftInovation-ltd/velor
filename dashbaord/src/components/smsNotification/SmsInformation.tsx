import { useEffect, useState } from "react";
import { MdSms, MdOutlineRefresh } from "react-icons/md";
import {
  FaCoins,
  FaRegPaperPlane,
  FaExclamationTriangle,
  FaCircle,
} from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";

const SMS_COST_PER_SMS = 0.7; // Cost per SMS in Taka
const LOW_BALANCE_THRESHOLD = 50;

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}

const StatCard = ({ label, value, hint, icon }: StatCardProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-[#DCE8FF] text-[#1D4ED8] dark:bg-blue-500/10 dark:text-blue-300">
        {icon}
      </span>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-gray-800 dark:text-white">
      {value}
    </p>
    {hint && (
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
    )}
  </div>
);

const InfoRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800">
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
      {children}
    </span>
  </div>
);

const SmsInformation = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSmsBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosSecure.get(`/sms/sms-blance`);
      setBalance(res.data?.data.balance || 0);
    } catch {
      setError("Failed to load SMS balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmsBalance();
  }, []);

  // How many messages the remaining balance still covers.
  const smsQuantity =
    balance !== null ? Math.floor(balance / SMS_COST_PER_SMS) : 0;
  const isActive = balance !== null && balance > 0;
  const isLow = balance !== null && balance < LOW_BALANCE_THRESHOLD;

  if (loading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-[#DCE8FF] border-t-[#1D4ED8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-red-200 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10">
          <FaExclamationTriangle className="size-5" />
        </span>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          {error}
        </p>
        <button
          onClick={fetchSmsBalance}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-[#DCE8FF] px-4 py-2 text-sm text-[#1D4ED8] transition-colors hover:bg-[#C7DAFF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
              Loading...
            </>
          ) : (
            <>
              <MdOutlineRefresh className="size-4" />
              Try Again
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#DCE8FF] text-[#1D4ED8] dark:bg-blue-500/10 dark:text-blue-300">
            <MdSms className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">
              SMS Information
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Sending capacity for the current balance
            </p>
          </div>
        </div>

        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            isActive
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
          }`}
        >
          <FaCircle className="size-1.5" />
          {isActive ? "Active" : "Low Balance"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Cost Per SMS"
          value={`৳${SMS_COST_PER_SMS.toFixed(2)}`}
          hint="Flat rate per message"
          icon={<FaCoins className="size-3.5" />}
        />
        <StatCard
          label="Available SMS"
          value={smsQuantity.toLocaleString()}
          hint="Messages that can be sent"
          icon={<FaRegPaperPlane className="size-3.5" />}
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Quick Info
          </p>
        </div>
        <div className="px-4 py-1">
          <InfoRow label="Rate">৳{SMS_COST_PER_SMS.toFixed(2)} per SMS</InfoRow>
          <InfoRow label="Available SMS">
            {smsQuantity.toLocaleString()} messages
          </InfoRow>
          <InfoRow label="Status">
            <span
              className={
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {isActive ? "Active" : "Low Balance"}
            </span>
          </InfoRow>
        </div>
      </div>

      {isLow && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <FaExclamationTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold">Low balance.</span> Recharge to keep
            sending messages without interruption.
          </p>
        </div>
      )}
    </div>
  );
};

export default SmsInformation;
