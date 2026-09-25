import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Select from "../form/Select";
import Button from "../ui/button/Button";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";

interface Account {
  _id: string;
  name: string;
}

const MoneyHandoverUpdate = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    date: "",
    fundPaymentMode: "",
    name: "",
    amount: "",
    voucherNumber: "",
    transactionDescription: "",
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const fundPaymentModeOptions = accounts.map((a) => ({ value: a._id, label: a.name }));

  useEffect(() => {
    axiosSecure
      .get("/account/all-account")
      .then((res) => setAccounts(res.data.data.accounts || []))
      .catch((error) => showApiError(error, "Failed to load payment modes."));

    const fetchData = async () => {
      try {
        const res = await axiosSecure.get(
          `/fundhandover/single-fundhandover/${id}`
        );
        const data = res.data?.data;
        if (data) {
          setFormData({
            date: data.date
              ? new Date(data.date).toISOString().split("T")[0]
              : "",
            fundPaymentMode: data.fundPaymentMode?._id || data.fundPaymentMode || "",
            name: data.name || "",
            amount: data.amount?.toString() || "",
            voucherNumber: data.voucherNumber || "",
            transactionDescription: data.transactionDescription || "",
          });
        }
      } catch (error) {
        showApiError(error, "Failed to load handover details.");
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev: any) => ({ ...prev, [key]: "" }));
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.date) newErrors.date = "Please select a date.";
    if (!formData.fundPaymentMode)
      newErrors.fundPaymentMode = "Please select a payment mode.";
    if (!formData.name) newErrors.name = "Name is required.";
    if (!formData.amount) newErrors.amount = "Amount is required.";
    if (!formData.voucherNumber)
      newErrors.voucherNumber = "Voucher number is required.";
    if (!formData.transactionDescription)
      newErrors.transactionDescription = "Description is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await axiosSecure.put(`/fundhandover/update-fundhandover/${id}`, {
        date: formData.date,
        transactionDescription: formData.transactionDescription,
        name: formData.name,
        voucherNumber: formData.voucherNumber,
        fundPaymentMode: formData.fundPaymentMode,
        amount: Number(formData.amount),
      });

      toast.success("Money handover updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["fund-handovers"] });
      navigate("/money-handover-list");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update handover");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Update Money Handover"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/money-handover-list">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
              Handover List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div>
                <DatePicker
                  id="date-picker-from"
                  label="Date"
                  placeholder="Select a date"
                  //@ts-ignore
                  value={formData.date}
                  //@ts-ignore
                  onChange={(value) => handleChange("date", value)}
                />
                {errors.date && (
                  <p className="text-red-500 text-sm mt-1">{errors.date}</p>
                )}
              </div>

              {/* Fund Payment Mode */}
              <div className="flex flex-col">
                <Label>Fund Payment Mode</Label>
                <Select
                  options={fundPaymentModeOptions}
                  placeholder="Select Fund Payment Mode"
                  value={formData.fundPaymentMode}
                  onChange={(value) => handleChange("fundPaymentMode", value)}
                />
                {errors.fundPaymentMode && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.fundPaymentMode}
                  </p>
                )}
              </div>

              {/* Name */}
              <div className="flex flex-col">
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  id="name"
                  placeholder="Enter Name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Amount */}
              <div className="flex flex-col">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  type="number"
                  id="amount"
                  placeholder="Enter Amount"
                  value={formData.amount}
                  onChange={(e) => handleChange("amount", e.target.value)}
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
                )}
              </div>

              {/* Voucher Number */}
              <div className="flex flex-col">
                <Label htmlFor="voucher">Voucher Number</Label>
                <Input
                  type="text"
                  id="voucher"
                  placeholder="Enter Voucher Number"
                  value={formData.voucherNumber}
                  onChange={(e) =>
                    handleChange("voucherNumber", e.target.value)
                  }
                />
                {errors.voucherNumber && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.voucherNumber}
                  </p>
                )}
              </div>

              {/* Transaction Description */}
              <div className="flex flex-col">
                <Label htmlFor="desc">Transaction Description</Label>
                <Input
                  type="text"
                  id="desc"
                  placeholder="Enter Description"
                  value={formData.transactionDescription}
                  onChange={(e) =>
                    handleChange("transactionDescription", e.target.value)
                  }
                />
                {errors.transactionDescription && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.transactionDescription}
                  </p>
                )}
              </div>
            </div>

            <MobileActionBar>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className={`${
   loading ?"bg-gray-400" :"bg-[#D5F0E3] hover:bg-[#B8E4CF]"
   } text-[#0A6B43] px-4 py-2 rounded`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                    Updating...
                  </span>
                ) : (
                  "Update Money Handover"
                )}
              </Button>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default MoneyHandoverUpdate;
