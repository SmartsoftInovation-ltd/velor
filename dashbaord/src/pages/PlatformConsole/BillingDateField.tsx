import DatePicker from "../../components/form/date-picker";
import { inputClass } from "./ui";

// A billing date (YYYY-MM-DD) picked from the app's calendar. The picker is
// uncontrolled, so a new `value` (e.g. the renewal moved by a new start date)
// re-creates it showing that date. Read-only or disabled shows a plain field.
const BillingDateField = ({
  id,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  placeholder = "Select date",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) => {
  if (readOnly || disabled) {
    return <input id={id} className={inputClass} value={value} placeholder={disabled ? "—" : placeholder} readOnly disabled={disabled} />;
  }
  return (
    <DatePicker
      key={value || "empty"}
      id={id}
      defaultDate={value || undefined}
      placeholder={placeholder}
      inputClassName={`${inputClass} pr-11`}
      onChange={(_dates, dateStr) => onChange(dateStr)}
    />
  );
};

export default BillingDateField;
