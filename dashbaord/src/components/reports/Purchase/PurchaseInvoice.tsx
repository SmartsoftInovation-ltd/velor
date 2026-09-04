import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Button from "../../ui/button/Button";
import DatePicker from "../../form/date-picker";
import Label from "../../form/Label";
import Select from "../../form/Select";
import ComponentCard from "../../common/ComponentCard";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import PageMeta from "../../common/PageMeta";
import MobileActionBar from "../../common/MobileActionBar";
import axiosSecure from "../../../hooks/useAxiosSecure";

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
};

const PurchaseInvoice = () => {
  const navigate = useNavigate();
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierOptions, setSupplierOptions] = useState([
    { value: "", label: "All Suppliers" },
  ]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ startDate: "", endDate: "" });

  useEffect(() => {
    axiosSecure
      .get("/invoice/purchase-supplier")
      .then((res) => {
        const options = (res.data.data || []).map((s: { supplierName: string }) => ({
          value: s.supplierName,
          label: s.supplierName,
        }));
        setSupplierOptions([{ value: "", label: "All Suppliers" }, ...options]);
      })
      .catch(() => {});
  }, []);

  const validate = () => {
    const newErrors = { startDate: "", endDate: "" };
    let valid = true;
    if (!startDate) { newErrors.startDate = "Start date is required"; valid = false; }
    if (!endDate) { newErrors.endDate = "End date is required"; valid = false; }
    setErrors(newErrors);
    return valid;
  };

  const handleGenerateReport = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      navigate("/purchase-invoice/view", {
        state: {
          filters: {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            supplierName: selectedSupplier || undefined,
          },
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <PageMeta title="Purchase Invoice Report - Baig Ecommerce" description="Purchase invoice report" />
      <PageBreadcrumb pageTitle="Purchase Invoice" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Purchase Invoice Report</h2>
            </div>
          }
        >
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
            <div className="flex-1 md:min-w-[160px]">
              <DatePicker
                id="pi-start"
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
                id="pi-end"
                label="End Date"
                placeholder="Select end date"
                //@ts-ignore
                value={endDate}
                //@ts-ignore
                onChange={(d) => { setEndDate(d); setErrors((e) => ({ ...e, endDate: "" })); }}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
            <div className="flex-1 md:min-w-[160px]">
              <Label>Supplier</Label>
              <Select
                options={supplierOptions}
                value={selectedSupplier}
                onChange={(v) => setSelectedSupplier(v)}
              />
            </div>
          </div>
          <div className="mt-6">
            <MobileActionBar>
              <Button onClick={handleGenerateReport} disabled={isLoading}>
              {isLoading ? "Loading..." : "Generate Report"}
            </Button>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
};

export default PurchaseInvoice;
