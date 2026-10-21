import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  hasError?: boolean;
  // When given, the typed search is reported here (debounce in the parent) so
  // the options can be fetched from the server rather than filtered from a
  // full list held in the browser
  onSearchChange?: (search: string) => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  hasError = false,
  onSearchChange,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearchState] = useState("");
  // Latest callback in a ref, so the outside-click listener need not re-bind
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    onSearchChangeRef.current?.(value);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) =>
    (o.label ?? "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setSearch]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl border transition-all duration-200 ${
          open
            ? "border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-gray-900"
            : hasError
            ? "border-red-500 focus:border-red-500 shadow-sm shadow-red-500/5 bg-white dark:bg-gray-900"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-400"
        }`}
      >
        <span className={selected ? "text-gray-800 dark:text-white font-medium" : "text-gray-400 dark:text-gray-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5">
          {value && (
            <span
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
            >
              <FaTimes className="size-3" />
            </span>
          )}
          <FaChevronDown
            className={`size-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-brand-500" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-theme-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-gray-400 dark:text-white"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FaTimes className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">No results found</p>
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 flex items-center justify-between group ${
                    opt.value === value
                      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <span className="size-1.5 rounded-full bg-brand-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {filtered.length} of {options.length} results
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
