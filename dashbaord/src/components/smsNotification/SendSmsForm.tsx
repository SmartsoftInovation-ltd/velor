import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { FaPaperPlane } from "react-icons/fa";
import Label from "../form/Label";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";
import { showApiError } from "../../utils/apiError";
import { BD_MOBILE_PATTERN, cleanPhone } from "../../lib/bdPhone";
import SmsMessageBox from "./SmsMessageBox";
import SmsPreview from "./SmsPreview";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "send-sms";

// The numbers typed, split on commas or new lines
const parsePhones = (value: string) =>
  value
    .split(/[,\n]/)
    .map((p) => cleanPhone(p.trim()))
    .filter(Boolean);

const SendSmsForm = () => {
  const [phoneNumber, setPhoneNumber] = useState(() => draftValue(DRAFT_KEY, "phoneNumber", ""));
  const [message, setMessage] = useState(() => draftValue(DRAFT_KEY, "message", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ phoneNumber, message }), [phoneNumber, message]),
  );
  const [errors, setErrors] = useState<{ phoneNumber?: string; message?: string }>({});
  const [loading, setLoading] = useState(false);

  const phones = parsePhones(phoneNumber);
  const invalid = phones.filter((p) => !BD_MOBILE_PATTERN.test(p));
  // Checked as you type once the field has been left (or a send tried), so a
  // half-typed number is not flagged mid-way
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = (() => {
    if (!phones.length) return "Phone number is required.";
    if (invalid.length) {
      return `${invalid.length > 1 ? "Not valid Bangladeshi numbers" : "Not a valid Bangladeshi number"}: ${invalid.join(", ")} — use 01XXXXXXXXX (e.g. 01712345678).`;
    }
    const dup = phones.find((p, i) => phones.indexOf(p) !== i);
    if (dup) return `${dup} is entered more than once.`;
    return undefined;
  })();
  const shownPhoneError = phoneTouched ? phoneError : errors.phoneNumber;
  const phoneValid = phones.length > 0 && !phoneError;

  const validate = () => {
    const next: { phoneNumber?: string; message?: string } = {};
    setPhoneTouched(true);
    if (phoneError) next.phoneNumber = phoneError;
    if (!message.trim()) next.message = "Message is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      await axiosSecure.post(`/sms/send-sms`, {
        phoneNumber: phones.join(","),
        message,
      });
      toast.success(phones.length > 1 ? `SMS sent to ${phones.length} numbers.` : "SMS sent successfully.");
      setPhoneNumber("");
      setPhoneTouched(false);
      setMessage("");
      clearDraft(DRAFT_KEY);
      setErrors({});
    } catch (error) {
      showApiError(error, "Failed to send SMS.");
    } finally {
      setLoading(false);
    }
  };

  const ready = phoneValid && !!message.trim();

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div>
          <Label htmlFor="phoneNumber">
            Phone Number <span className="text-error-500">*</span>
          </Label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="01712345678 — separate several with commas"
            value={phoneNumber}
            onChange={(e) => {
              // Only what a phone number list can hold: digits, +, separators
              setPhoneNumber(e.target.value.replace(/[^\d+,\s-]/g, ""));
              if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
            }}
            onBlur={() => phoneNumber.trim() && setPhoneTouched(true)}
            aria-invalid={!!shownPhoneError}
            aria-describedby="phoneNumber-help"
            className={`h-11 w-full rounded-xl border bg-white px-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-2 dark:bg-gray-900 dark:text-white/90 ${
              shownPhoneError
                ? "border-error-400 focus:ring-error-500/20"
                : phoneValid
                  ? "border-accent-400 focus:border-accent-500 focus:ring-accent-500/20"
                  : "border-gray-300 focus:border-accent-500 focus:ring-accent-500/20 dark:border-gray-700"
            }`}
          />
          <p id="phoneNumber-help" className="mt-1 text-xs">
            {shownPhoneError ? (
              <span className="text-error-500">{shownPhoneError}</span>
            ) : phoneValid ? (
              <span className="text-accent-600 dark:text-accent-400">
                ✓ {phones.length > 1 ? `${phones.length} valid numbers` : "Valid number"}
              </span>
            ) : (
              <span className="text-gray-400">Bangladeshi mobile, e.g. 01712345678 or +8801712345678</span>
            )}
          </p>
        </div>

        <div>
          <Label htmlFor="message">
            Message <span className="text-error-500">*</span>
          </Label>
          <SmsMessageBox
            id="message"
            value={message}
            onChange={(next) => {
              setMessage(next);
              if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
            }}
            error={errors.message}
            rows={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`shine inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-70 ${
            ready ? "bg-accent-500 hover:bg-accent-600" : "bg-accent-500/70 hover:bg-accent-500"
          }`}
        >
          {loading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Sending…
            </>
          ) : (
            <>
              <FaPaperPlane className="size-3.5" />
              Send SMS
            </>
          )}
        </button>
      </div>

      <SmsPreview
        message={message}
        recipientLabel={phones.length > 1 ? `${phones.length} numbers` : phones[0]}
        recipientCount={Math.max(phones.length, 1)}
      />
    </form>
  );
};

export default SendSmsForm;
