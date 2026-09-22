import { useState } from "react";
import Button from "../../ui/button/Button";
import DatePicker from "../../form/date-picker";

import ComponentCard from "../../common/ComponentCard";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import PageMeta from "../../common/PageMeta";
import MobileActionBar from "../../common/MobileActionBar";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { showApiError } from "../../../utils/apiError";

const FundHandOver = () => {
    const navigate = useNavigate();
  const [startDate, setStartDate] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [endDate, setEndDate] = useState(null);

  // Error state
  const [errors, setErrors] = useState({
    startDate: "",
    endDate: "",
  });

  const validate = () => {
    let valid = true;
    const newErrors = { startDate: "", endDate: "", supplier: "" };

    if (!startDate) {
      newErrors.startDate = "Start date is required";
      valid = false;
    }

    if (!endDate) {
      newErrors.endDate = "End date is required";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleGenerateReport = async () => {
    // Guard against a second click while the first request is still running.
    if (isGenerating) return;
    if (!validate()) return;

    setIsGenerating(true);

    try {
      //@ts-ignore
      const formatDate = (date) => {
        if (date instanceof Date) return date.toISOString().split("T")[0];
        return new Date(date).toISOString().split("T")[0];
      };

      const payload = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      };

      const response = await axiosSecure.post(
        "/invoice/getFundHandoverReport",
        payload
      );
      console.log("Fund Handover Response:", response.data);
      toast.success("Report generated successfully!");
        navigate("/fund-handover/view", { state: response.data });
    } catch (error) {
      console.error("Error generating fund handover:", error);
      showApiError(error, "Error generating report. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Fund Handover" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Fund Handover</h2>
            </div>
          }
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <DatePicker
                id="date-picker-to"
                label="Start Date"
                placeholder="Select start date"
                //@ts-ignore
                value={startDate}
                //@ts-ignore
                onChange={(date) => setStartDate(date)}
              />
              {errors.startDate && (
                <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
              )}
            </div>

            <div className="flex-1">
              <DatePicker
                id="date-picker-from"
                label="End Date"
                placeholder="Select end date"
                //@ts-ignore
                value={endDate}
                //@ts-ignore
                onChange={(date) => setEndDate(date)}
              />
              {errors.endDate && (
                <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div className="mt-10">
            <MobileActionBar>
              <Button onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                    Generating...
                  </span>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
};

export default FundHandOver;
