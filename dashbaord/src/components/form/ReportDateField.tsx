import { useEffect, useLayoutEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { MdCalendarToday } from "react-icons/md";

type Props = {
  label?: string;
  // "YYYY-MM-DD", or "" for no date.
  value: string;
  min?: string;
  max?: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

// Date field for the report settings drawers, backed by flatpickr rather than
// the native <input type="date">: the browser's own calendar popup cannot be
// positioned, and next to the right-edge drawer it opened off-screen.
// flatpickr renders into <body>, opens to the left of the field and stays
// inside the viewport.
const ReportDateField = ({ label, value, min, max, placeholder = "Select date", onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Layout effect so flatpickr's teardown runs inside React's commit (see
  // form/date-picker.tsx for the removeChild race this avoids).
  useLayoutEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      dateFormat: "Y-m-d",
      position: "auto right",
      monthSelectorType: "static",
      disableMobile: true,
      onReady: (_d, _s, instance) => {
        // Above the settings drawers (z-[100001]).
        instance.calendarContainer.style.zIndex = "100002";
      },
      onChange: (_dates, dateStr) => {
        if (dateStr) onChangeRef.current(dateStr);
      },
    });
    fpRef.current = fp;
    return () => {
      try {
        fp.destroy();
      } catch {
        // element already gone
      }
      fpRef.current = null;
    };
  }, []);

  // Keep the picker in step with the value and bounds (presets and "clear"
  // buttons change them from outside).
  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    fp.set("minDate", min || undefined);
    fp.set("maxDate", max || undefined);
    if (value) fp.setDate(value, false);
    else fp.clear(false);
  }, [value, min, max]);

  return (
    <div className="min-w-0">
      {label && (
        <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</label>
      )}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white py-1 pl-2.5 pr-1 focus-within:border-brand-400 dark:border-gray-700 dark:bg-gray-800">
        <input
          ref={inputRef}
          type="text"
          readOnly
          defaultValue={value}
          placeholder={placeholder}
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={() => fpRef.current?.open()}
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600"
          tabIndex={-1}
          aria-label={label ? `Pick ${label.toLowerCase()} date` : "Pick date"}
        >
          <MdCalendarToday className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ReportDateField;
