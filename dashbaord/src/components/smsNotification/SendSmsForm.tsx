import { useState, useMemo } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "send-sms";

const SendSmsForm = () => {
  const [phoneNumber, setPhoneNumber] = useState(() => draftValue(DRAFT_KEY, "phoneNumber", ""));
  const [message, setMessage] = useState(() => draftValue(DRAFT_KEY, "message", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ phoneNumber, message }), [phoneNumber, message]),
  );
  const [errors, setErrors] = useState<{
    phoneNumber?: string;
    message?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors: { phoneNumber?: string; message?: string } = {};
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required.";
    }
    if (!message.trim()) {
      newErrors.message = "Message is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      await axiosSecure.post(`/sms/send-sms`, {
        phoneNumber,
        message,
      });
      setPhoneNumber("");
      clearDraft(DRAFT_KEY);
      setMessage("");
      setErrors({});
    } catch (error) {
      console.error("Error sending SMS:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Phone Number */}
        <div>
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="text"
            placeholder="e.g. +1234567890"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              if (errors.phoneNumber) {
                setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              }
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
          />
          {errors.phoneNumber && (
            <p className="text-sm text-red-500 mt-1">{errors.phoneNumber}</p>
          )}
        </div>

        {/* Message */}
        <div>
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            name="message"
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (errors.message) {
                setErrors((prev) => ({ ...prev, message: undefined }));
              }
            }}
            rows={5}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
          />
          {errors.message && (
            <p className="text-sm text-red-500 mt-1">{errors.message}</p>
          )}
        </div>

        {/* Button */}

        <Button disabled={loading}>
          {loading ? "Sending..." : "Send SMS"}
        </Button>
      </form>
    </div>
  );
};

export default SendSmsForm;
