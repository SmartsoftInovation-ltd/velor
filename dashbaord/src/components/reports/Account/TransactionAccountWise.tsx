import { useState, useEffect } from "react";
import Button from "../../ui/button/Button";
import DatePicker from "../../form/date-picker";
import Label from "../../form/Label";
import Select from "../../form/Select";
import ComponentCard from "../../common/ComponentCard";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import PageMeta from "../../common/PageMeta";
import MobileActionBar from "../../common/MobileActionBar";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { showApiError } from "../../../utils/apiError";

const TransactionAccountWise = () => {
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [accountOptions, setAccountOptions] = useState([
    { value: "", label: "Select Account" },
  ]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Error state
  const [errors, setErrors] = useState({
    startDate: "",
    endDate: "",
    account: "",
  });

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosSecure.get(`/invoice/getallaccounts`);
        console.log(response.data.data);

        const options = response?.data?.data.map((acc: any) => ({
          value: acc?._id,
          label: acc?.name,
        }));
        setAccountOptions([{ value: "", label: "Select Account" }, ...options]);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };
    fetchCategories();
  }, []);

  const validate = () => {
    let valid = true;
    const newErrors = { startDate: "", endDate: "", account: "" };

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
        account: selectedAccount,
      };

      const response = await axiosSecure.post(
        "/invoice/transaction-accountwise",
        payload
      );
      console.log("Transaction Account wise Response:", response.data);
      toast.success("Report generated successfully!");
      navigate("/transaction-account-wise/view", { state: response.data });
    } catch (error) {
      console.error("Error generating transaction report:", error);
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
      <PageBreadcrumb pageTitle="Transaction Account Wise" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Transaction Account Wise
              </h2>
            </div>
          }
        >
          <div className="flex flex-col gap-4 md:flex-row">
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

            <div className="flex-1">
              <Label>Transaction Account</Label>
              <Select
                options={accountOptions}
                value={selectedAccount}
                onChange={(value) => setSelectedAccount(value)} // <-- fix here
              />
              {errors.account && (
                <p className="text-red-500 text-sm mt-1">{errors.account}</p>
              )}
            </div>
          </div>

          <div className="mt-10">
            <MobileActionBar>
              <Button onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
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

export default TransactionAccountWise;
