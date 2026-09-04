import React from "react";
import { FaTimes } from "react-icons/fa";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string;
  onClear?: () => void;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  value,
  onClear,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative group">
      <select
        className={`h-11 w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white transition-all ${
          value ? "text-gray-800 dark:text-white" : "text-gray-400"
        } ${disabled ? "cursor-not-allowed opacity-60 bg-gray-50 dark:bg-gray-800" : ""} ${className}`}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="text-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            {option.label}
          </option>
        ))}
      </select>
      
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2 pointer-events-none">
        {onClear && value && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="pointer-events-auto text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
          >
            <FaTimes className="size-3" />
          </button>
        )}
        <div className="pointer-events-none text-gray-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;
