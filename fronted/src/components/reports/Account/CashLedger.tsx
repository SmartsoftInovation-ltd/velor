import { useState } from "react";
import { useNavigate } from "react-router";
import Button from "../../ui/button/Button";
import DatePicker from "../../form/date-picker";
import ComponentCard from "../../common/ComponentCard";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import PageMeta from "../../common/PageMeta";
import MobileActionBar from "../../common/MobileActionBar";

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
};

const CashLedger = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState({ startDate: "", endDate: "" });

  const validate = () => {
    const newErrors = { startDate: "", endDate: "" };
    let valid = true;
    if (!startDate) { newErrors.startDate = "Start date is required"; valid = false; }
    if (!endDate) { newErrors.endDate = "End date is required"; valid = false; }
    setErrors(newErrors);
    return valid;
  };

  const handleGenerateReport = () => {
    if (!validate()) return;
    navigate("/cash-ledger/view", {
      state: {
        filters: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      },
    });
  };

  return (
    <div>
      <PageMeta title="Cash Ledger Report - Baig Ecommerce" description="Cash ledger report" />
      <PageBreadcrumb pageTitle="Cash Ledger" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Cash Ledger Report</h2>
            </div>
          }
        >
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
            <div className="flex-1 md:min-w-[160px]">
              <DatePicker
                id="cl-start"
                label="Start Date"
                placeholder="Select start date"
                //@ts-ignore
                value={startDate}
                //@ts-ignore
                onChange={(d) => { setStartDate(d); setErrors((e) => ({ ...e, startDate: "" })); }}
              />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
            </div>
            <div className="flex-1 md:min-w-[160px]">
              <DatePicker
                id="cl-end"
                label="End Date"
                placeholder="Select end date"
                //@ts-ignore
                value={endDate}
                //@ts-ignore
                onChange={(d) => { setEndDate(d); setErrors((e) => ({ ...e, endDate: "" })); }}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
          </div>
          <div className="mt-6">
            <MobileActionBar>
              <Button onClick={handleGenerateReport}>Generate Report</Button>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
};

export default CashLedger;
