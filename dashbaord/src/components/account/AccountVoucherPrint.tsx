import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import axiosSecure from "../../hooks/useAxiosSecure";
import { Amount, Line, PrintPage, Section, Signatures } from "../print/PrintSheet";
import { taka, takaInWords } from "../print/printUtils";

type Named = { name?: string } | null | undefined;

interface TransactionDoc {
  transactionSerialId?: string;
  date?: string;
  transactionCategory?: Named;
  account?: Named;
  transactionDescription?: string;
  voucherNumber?: string;
  transactionType?: "cash recived" | "cash payment";
  amount: number;
  balanceAfter?: number;
}

interface TransferDoc {
  transferSerialId?: string;
  Date?: string;
  fromAccount?: Named;
  toAccount?: Named;
  transactionDesction?: string;
  voucherNumber?: string;
  amount: number;
}

interface HandoverDoc {
  handoverSerialId?: string;
  date?: string;
  name?: string;
  fundPaymentMode?: Named;
  transactionDescription?: string;
  voucherNumber?: string;
  amount: number;
}

export type VoucherKind = "transaction" | "transfer" | "handover";

const SOURCES: Record<VoucherKind, { url: (id: string) => string; list: string; listLabel: string; noun: string }> = {
  transaction: { url: (id) => `/transaction/single-transaction/${id}`, list: "/transaction-list", listLabel: "Back to transactions", noun: "transaction" },
  transfer: { url: (id) => `/moneytransfer/single-moneytransfer/${id}`, list: "/money-transfer-list", listLabel: "Back to money transfers", noun: "money transfer" },
  handover: { url: (id) => `/fundhandover/single-fundhandover/${id}`, list: "/money-handover-list", listLabel: "Back to money handovers", noun: "money handover" },
};

// Everything a voucher shows, worked out from whichever record it is
type Voucher = {
  title: string;
  number?: string;
  date?: string;
  headline: string;
  subline?: string;
  amount: number;
  tone: "ink" | "due" | "green";
  lines: { label: string; value?: string | null }[];
  description?: string;
  signatures: string[];
};

function toVoucher(kind: VoucherKind, doc: TransactionDoc | TransferDoc | HandoverDoc): Voucher {
  if (kind === "transaction") {
    const t = doc as TransactionDoc;
    const received = t.transactionType === "cash recived";
    return {
      title: received ? "Credit voucher" : "Debit voucher",
      number: t.transactionSerialId,
      date: t.date,
      headline: received ? `Received into ${t.account?.name ?? "account"}` : `Paid from ${t.account?.name ?? "account"}`,
      subline: t.transactionCategory?.name,
      amount: t.amount,
      tone: received ? "green" : "due",
      lines: [
        { label: "Type", value: received ? "Cash received" : "Cash payment" },
        { label: "Category", value: t.transactionCategory?.name },
        { label: "Account", value: t.account?.name },
        { label: "Voucher number", value: t.voucherNumber },
        { label: "Balance after", value: t.balanceAfter != null ? taka(t.balanceAfter) : null },
      ],
      description: t.transactionDescription,
      signatures: received ? ["Prepared by", "Checked by", "Approved by"] : ["Received by", "Prepared by", "Approved by"],
    };
  }
  if (kind === "transfer") {
    const t = doc as TransferDoc;
    return {
      title: "Transfer voucher",
      number: t.transferSerialId,
      date: t.Date,
      headline: `${t.fromAccount?.name ?? "Account"} to ${t.toAccount?.name ?? "account"}`,
      subline: "Money moved between the store's own accounts",
      amount: t.amount,
      tone: "ink",
      lines: [
        { label: "From account", value: t.fromAccount?.name },
        { label: "To account", value: t.toAccount?.name },
        { label: "Voucher number", value: t.voucherNumber },
      ],
      description: t.transactionDesction,
      signatures: ["Prepared by", "Checked by", "Approved by"],
    };
  }
  const h = doc as HandoverDoc;
  return {
    title: "Handover voucher",
    number: h.handoverSerialId,
    date: h.date,
    headline: `Handed over to ${h.name || "—"}`,
    subline: h.fundPaymentMode?.name ? `By ${h.fundPaymentMode.name}` : undefined,
    amount: h.amount,
    tone: "ink",
    lines: [
      { label: "Received by", value: h.name },
      { label: "Payment mode", value: h.fundPaymentMode?.name },
      { label: "Voucher number", value: h.voucherNumber },
    ],
    description: h.transactionDescription,
    signatures: ["Handed over by", "Received by", "Approved by"],
  };
}

// A printable voucher for one transaction, money transfer or money handover,
// opened from the print button on its list
const AccountVoucherPrint = ({ kind }: { kind: VoucherKind }) => {
  const { id } = useParams<{ id: string }>();
  const source = SOURCES[kind];

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ["voucher-print", kind, id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(source.url(encodeURIComponent(id ?? "")));
      return (data?.data ?? null) as TransactionDoc | TransferDoc | HandoverDoc | null;
    },
    enabled: !!id,
  });

  const v = doc ? toVoucher(kind, doc) : null;

  return (
    <PrintPage
      docTitle={v?.title ?? "Voucher"}
      docMeta={
        v && (
          <>
            {v.number && <p>No. {v.number}</p>}
            <p>{v.date ? moment(v.date).format("D MMM YYYY") : "—"}</p>
          </>
        )
      }
      printLabel="Print voucher"
      loading={isLoading}
      error={isError || !v ? `This ${source.noun} could not be loaded.` : null}
      backTo={source.list}
      backLabel={source.listLabel}
    >
      {v && (
        <>
          {/* What happened, and for how much */}
          <section className="flex items-end justify-between gap-6 pt-6 pb-5">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">{v.headline}</h1>
              {v.subline && <p className="mt-1 text-[13px] text-gray-500">{v.subline}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-1 text-[12px] text-gray-500">Amount</p>
              <Amount value={v.amount} tone={v.tone} />
            </div>
          </section>

          <p className="mb-7 border-y border-gray-200 bg-gray-50 px-4 py-2.5 text-[13px] print:bg-gray-50">
            <span className="text-gray-500">In words: </span>
            <span className="font-medium">{takaInWords(v.amount)}</span>
          </p>

          <div className="grid grid-cols-2 gap-x-10 gap-y-7">
            <Section title="Details">
              <dl>
                {v.lines.map((l) => (
                  <Line key={l.label} label={l.label} value={l.value} />
                ))}
              </dl>
            </Section>
            <Section title="Description">
              <p className="pt-2 text-[13px] leading-relaxed">{v.description || "—"}</p>
            </Section>
          </div>

          <Signatures labels={v.signatures} />
        </>
      )}
    </PrintPage>
  );
};

export default AccountVoucherPrint;
