import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaSync } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/common/Loader";
import useIsMobile from "../../hooks/useIsMobile";
import MobileCardList from "../../components/common/MobileCardList";
import MobileCardRow from "../../components/common/MobileCardRow";

interface Account {
  _id: string;
  name: string;
  slug: string;
  balance: number;
}

interface TransactionCategory {
  _id: string;
  name: string;
}

interface Transaction {
  _id: string;
  transactionSerialId: string;
  date: string;
  transactionCategory?: TransactionCategory;
  transactionDescription: string;
  voucherNumber?: string;
  transactionType: "cash recived" | "cash payment";
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

interface HistoryData {
  account: Account | null;
  transactions: Transaction[];
}

const BackIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const AccountTransactionHistory = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data, isLoading, isFetching, isError, refetch } = useQuery<HistoryData>({
    queryKey: ["account-transaction-history", accountId],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/transaction/account-transaction/${accountId}`);
      return data.data as HistoryData;
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  const fetchHistory = () => {
    queryClient.invalidateQueries({ queryKey: ["account-transaction-history", accountId] });
    refetch();
  };

  const account = data?.account ?? null;
  const transactions = data?.transactions ?? [];

  const gridTemplateColumns = "48px 1fr 1fr 1fr 1fr 1fr 1fr";

  return (
    <>
      <PageMeta title="Account Transaction History - Baig Ecommerce" description="Account balance audit trail" />
      {/* Header row is just the trail and the page actions — the account name
          rides in the trail so the card needs no heading of its own. */}
      <PageBreadcrumb
        pageTitle={
          account ? `${account.name} — Transaction History` : "Transaction History"
        }
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/account-list")}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <BackIcon />
            </Button>
            <Button
              onClick={fetchHistory}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh"
              aria-label="Refresh"
            >
              <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center py-20 min-h-[400px]"><Loader /></div>
          ) : isError ? (
            <div className="text-center py-20">
              <p className="text-red-500 font-bold mb-4">Error fetching transaction history!</p>
              <button onClick={() => refetch()} className="px-6 py-2 bg-accent-500 text-white rounded-xl font-bold">
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current balance summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Account</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{account?.name ?? "—"}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Current Balance</p>
                  <p className={`text-lg font-bold ${(account?.balance ?? 0) < 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                    ৳{(account?.balance ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Total Transactions</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{transactions.length}</p>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center min-h-[250px]">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No transactions found for this account yet.</p>
                  </div>
                ) : isMobile ? (
                  <div className="p-4">
                    <MobileCardList
                      items={transactions}
                      getKey={(t) => t._id}
                      emptyMessage="No transactions found for this account yet."
                      renderCard={(t, index) => {
                        const isReceived = t.transactionType === "cash recived";
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                              <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                                {t.transactionSerialId}
                              </span>
                              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">#{index + 1}</span>
                            </div>
                            <MobileCardRow label="Date">
                              {new Date(t.date).toLocaleDateString()} · {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </MobileCardRow>
                            <MobileCardRow label="Category">{t.transactionCategory?.name ?? "—"}</MobileCardRow>
                            {t.transactionDescription && (
                              <MobileCardRow label="Description">{t.transactionDescription}</MobileCardRow>
                            )}
                            <MobileCardRow label="Type">
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                  isReceived
                                    ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                                    : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                                }`}
                              >
                                {isReceived ? "Cash Received" : "Cash Payment"}
                              </span>
                            </MobileCardRow>
                            <MobileCardRow label="Amount">
                              <span className={`font-bold ${isReceived ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                {isReceived ? "+" : "-"}৳{(t.amount ?? 0).toLocaleString()}
                              </span>
                            </MobileCardRow>
                            <MobileCardRow label="Balance">৳{(t.balanceAfter ?? 0).toLocaleString()}</MobileCardRow>
                          </div>
                        );
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className="grid border-b border-gray-200 dark:border-white/5 bg-gray-50/95 dark:bg-gray-800/95"
                      style={{ gridTemplateColumns }}
                    >
                      {["#", "Serial", "Date", "Category", "Description", "Type", "Amount / Balance"].map((h) => (
                        <div key={h} className="px-4 py-4 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 text-center">
                          {h}
                        </div>
                      ))}
                    </div>
                    <div className="max-h-[600px] overflow-y-auto overflow-x-hidden">
                      {transactions.map((t, index) => {
                        const isReceived = t.transactionType === "cash recived";
                        return (
                          <div
                            key={t._id}
                            className="grid border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors"
                            style={{ gridTemplateColumns }}
                          >
                            <div className="px-4 py-4 flex items-center justify-center text-[10px] font-black text-gray-400 dark:text-gray-500">
                              #{index + 1}
                            </div>
                            <div className="px-4 py-4 flex items-center justify-center">
                              <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                                {t.transactionSerialId}
                              </span>
                            </div>
                            <div className="px-4 py-4 flex flex-col items-center justify-center gap-0.5">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date(t.date).toLocaleDateString()}
                              </span>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="px-4 py-4 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300">
                              {t.transactionCategory?.name ?? "—"}
                            </div>
                            <div className="px-4 py-4 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300 text-center">
                              {t.transactionDescription}
                            </div>
                            <div className="px-4 py-4 flex items-center justify-center">
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                  isReceived
                                    ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                                    : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                                }`}
                              >
                                {isReceived ? "Cash Received" : "Cash Payment"}
                              </span>
                            </div>
                            <div className="px-4 py-4 flex flex-col items-center justify-center gap-0.5">
                              <span className={`text-sm font-bold ${isReceived ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                {isReceived ? "+" : "-"}৳{(t.amount ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                Balance: ৳{(t.balanceAfter ?? 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default AccountTransactionHistory;
