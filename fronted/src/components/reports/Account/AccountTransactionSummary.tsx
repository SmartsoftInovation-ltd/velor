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

const AccountTransactionSummary = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(null);
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
    if (!validate()) return;

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
        "/invoice/transaction-accountnamewisesummary",
        payload
      );
      console.log("Account Transaction Summary Response:", response.data);
      toast.success("Report generated successfully!");
      navigate("/account-transaction-summary/view", { state: response.data });
    } catch (error) {
      console.error("Error generating account transaction summary:", error);
      toast.error("Error generating report. Check console.");
    }
  };

  return (
    <div>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Account Transaction Summary" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Account Transaction Summary
              </h2>
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
              <Button onClick={handleGenerateReport}>Generate Report</Button>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
};

export default AccountTransactionSummary;
