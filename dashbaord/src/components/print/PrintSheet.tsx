import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import moment from "moment";
import { IoIosPrint, IoIosArrowBack } from "react-icons/io";
import Button from "../ui/button/Button";
import Loader from "../common/Loader";
import { taka, useStoreInfo } from "./printUtils";

// Shared look for one-record print pages (customer account, transaction,
// transfer and handover vouchers): store letterhead, labelled lines, a
// double-ruled amount like the closing figure in an account book, signature
// lines. Only the sheet prints, on A4.

// One labelled line; an empty value prints a dash so the form reads complete
export const Line = ({ label, value }: { label: string; value?: ReactNode }) => (
  <div className="ps-line">
    <dt>{label}</dt>
    <dd>{value != null && value !== "" ? value : "—"}</dd>
  </div>
);

export const Section = ({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) => (
  <section className={className}>
    <h2 className="ps-section">{title}</h2>
    {children}
  </section>
);

// The amount, double-ruled as a closing figure
export const Amount = ({ value, tone = "ink" }: { value: number; tone?: "ink" | "due" | "green" }) => (
  <span
    className={`ps-amount ${tone === "due" ? "text-error-700" : tone === "green" ? "text-accent-600" : "text-gray-900"}`}
  >
    {taka(value)}
  </span>
);

export const Signatures = ({ labels }: { labels: string[] }) => (
  <div className="mt-20 grid gap-12 text-[12px] text-gray-500" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
    {labels.map((l, i) => (
      <p
        key={l}
        className={`border-t border-gray-900 pt-2 ${i === 0 ? "" : i === labels.length - 1 ? "text-right" : "text-center"}`}
      >
        {l}
      </p>
    ))}
  </div>
);

type PrintPageProps = {
  // What the sheet is, shown at the top right ("Customer account", "Debit voucher")
  docTitle: string;
  // Lines under the title: number, date
  docMeta?: ReactNode;
  printLabel: string;
  loading?: boolean;
  error?: string | null;
  backTo: string;
  backLabel: string;
  note?: string;
  children?: ReactNode;
};

export function PrintPage({ docTitle, docMeta, printLabel, loading, error, backTo, backLabel, note, children }: PrintPageProps) {
  const navigate = useNavigate();
  const { data: storeInfo } = useStoreInfo();

  if (loading)
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <Loader />
      </div>
    );

  if (error)
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-red-500">{error}</p>
        <Button onClick={() => navigate(backTo)} className="!rounded !bg-accent-500 px-6 py-2 font-semibold text-white hover:!bg-accent-600">
          {backLabel}
        </Button>
      </div>
    );

  return (
    <div id="print-sheet-wrap" className="min-h-screen bg-gray-100 py-6 dark:bg-gray-950 print:bg-white print:py-0">
      <style>{`
        #print-sheet {
          color: var(--color-gray-900);
          font-variant-numeric: tabular-nums;
        }
        #print-sheet .ps-line {
          display: grid;
          grid-template-columns: 9.5rem 1fr;
          gap: 0.75rem;
          padding: 0.45rem 0;
          border-bottom: 1px solid var(--color-gray-200);
          font-size: 13px;
          line-height: 1.45;
        }
        #print-sheet .ps-line dt { color: var(--color-gray-500); }
        #print-sheet .ps-line dd { margin: 0; font-weight: 500; overflow-wrap: anywhere; }
        #print-sheet .ps-section {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-accent-500);
          padding-bottom: 0.35rem;
          border-bottom: 2px solid var(--color-accent-500);
        }
        /* A closing figure is double-ruled, as in an account book */
        #print-sheet .ps-amount {
          display: inline-block;
          font-size: 30px;
          font-weight: 600;
          line-height: 1;
          padding-bottom: 3px;
          border-bottom: 4px double currentColor;
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          #print-sheet-wrap { min-height: 0 !important; }
          body * { visibility: hidden; }
          #print-sheet, #print-sheet * { visibility: visible; }
          #print-sheet {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="w-full px-4 sm:px-6">
        {/* Toolbar, left out of the print */}
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Button onClick={() => navigate(-1)} variant="outline" size="sm" className="flex items-center gap-2 !rounded font-semibold text-gray-600 dark:text-gray-300">
            <IoIosArrowBack className="size-4" />
            Back
          </Button>
          <Button onClick={() => window.print()} size="sm" className="flex items-center gap-2 !rounded !bg-accent-500 font-semibold text-white hover:!bg-accent-600">
            <IoIosPrint className="size-4" />
            {printLabel}
          </Button>
        </div>

        <article id="print-sheet" className="bg-white px-[14mm] py-[12mm] shadow-sm ring-1 ring-gray-200 print:p-0 print:shadow-none print:ring-0">
          {/* Letterhead */}
          <header className="flex items-start justify-between gap-6 border-b-[3px] border-accent-500 pb-5">
            <div className="flex items-center gap-3.5">
              {storeInfo?.image?.url && (
                <img src={storeInfo.image.url} alt="" crossOrigin="anonymous" className="size-12 rounded-full object-contain ring-1 ring-gray-200" />
              )}
              <div className="text-[12px] leading-relaxed text-gray-500">
                <p className="text-[17px] font-semibold leading-tight text-gray-900">{storeInfo?.storeName || "Store"}</p>
                {storeInfo?.adress && <p>{storeInfo.adress}</p>}
                {(storeInfo?.phone || storeInfo?.email) && <p>{[storeInfo?.phone, storeInfo?.email].filter(Boolean).join(", ")}</p>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold">{docTitle}</p>
              <div className="mt-0.5 text-[12px] leading-relaxed text-gray-500">{docMeta}</div>
            </div>
          </header>

          {children}

          <footer className="mt-10 border-t border-gray-200 pt-3 text-center text-[11px] text-gray-500">
            {storeInfo?.footer && <p className="mb-0.5">{storeInfo.footer}</p>}
            <p>{note ?? `Printed ${moment().format("D MMM YYYY, h:mm A")}`}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
