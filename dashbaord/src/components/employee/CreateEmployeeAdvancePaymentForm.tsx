
import { useEffect, useState } from "react";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Select from "../form/Select";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

const CreateEmployeeAdvancePaymentForm = () => {
  const [employees, setEmployees] = useState<
    { label: string; value: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: "",
    month: "",
    employeeId: "",
    amount: "",
    paymentMode: "",
    remarks: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosSecure.get(`/employee/get-employee`);

        const options = res.data.data.employees.map((emp: any) => ({
          label: `${emp.employeeId} - ${emp.fullName}`,
          value: emp._id,
        }));

        setEmployees(options);
      } catch (error) {
        console.error("Failed to fetch employees", error);
      }
    };

    fetchEmployees();
  }, []);

  const handleSubmit = async () => {
    // Guard against a second click while the first request is still running.
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        month: formData.month,
        employeeId: formData.employeeId,
        amount: Number(formData.amount) || 0,
        balanceAmount: Number(formData.amount) || 0,
        paymentMode: formData.paymentMode,
        remarks: formData.remarks,
      };

      console.log("Payload:", payload);

      await axiosSecure.post(
        `/employee/employee-advance-payment`,
        payload
      );

      toast.success("Advance payment created successfully");
    } catch (error) {
       toast.success("Failed to create advance payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentmode = [
    { label: "Cash", value: "cash" },
    { label: "Bank", value: "bank" },
    { label: "Bkash", value: "bkash" },
    { label: "Nagad", value: "nagad" },
    { label: "Rocket", value: "rocket" },
    { label: "Cheque", value: "cheque" },
    { label: "Other", value: "other" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="flex flex-col">
          <DatePicker
            id="date"
            label="Date"
            placeholder="Select a date"
           onChange={(dates: Date[]) =>
  handleChange(
    "date",
    dates && dates.length > 0
      ? dates[0].toISOString().split("T")[0]
      : ""
  )
}
          />
        </div>

        <div className="flex flex-col">
          <DatePicker
            id="month"
            label="Month"
            placeholder="Select a date"
            onChange={(dates: Date[]) =>
  handleChange(
    "month",
    dates && dates.length > 0
      ? dates[0].toISOString().slice(0, 7)
      : ""
  )
}
          />
        </div>

        <div className="flex flex-col">
          <Label>
            Employee Id <span className="text-red-500">*</span>
          </Label>
          <Select
            options={employees}
            onChange={(value) => handleChange("employeeId", value)}
          />
        </div>

        <div className="flex flex-col">
          <Label>Amount:</Label>
          <Input
            type="text"
            placeholder="Enter Amount"
            onChange={(e) =>
              handleChange("amount", e.target.value)
            }
          />
        </div>

        <div className="flex flex-col">
          <Label>
            Payment Mode <span className="text-red-500">*</span>
          </Label>
          <Select
            options={paymentmode}
            onChange={(value) =>
              handleChange("paymentMode", value)
            }
          />
        </div>

        <div className="flex flex-col">
          <Label>Remarks</Label>
          <Input
            type="text"
            placeholder="Enter Comments"
            onChange={(e) =>
              handleChange("remarks", e.target.value)
            }
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
          className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-4 py-2 rounded disabled:active:scale-100"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
            Saving...
          </span>
        ) : (
          "Create Employee Advance Payment"
        )}
      </Button>
    </div>
  );
};

export default CreateEmployeeAdvancePaymentForm;