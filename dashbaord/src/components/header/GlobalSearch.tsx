import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FiCornerDownLeft, FiFileText, FiSearch } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useSidebarSections } from "../../layout/sidebarNav";
import { allowedReportCategories } from "../reports/reportCategories";
import { buildSearchEntries, searchEntries } from "./globalSearch";

const LIST_ID = "global-search-results";

// Marks the first place the typed words appear in a page's name
const Highlighted = ({ text, query }: { text: string; query: string }) => {
  const term = query.trim().toLowerCase();
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-accent-100 text-inherit dark:bg-accent-500/30">{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
};

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 font-sans text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
    {children}
  </kbd>
);

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { can, isSuperAdmin, isLoading } = useAuth();
  const sections = useSidebarSections();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = searchEntries(
    buildSearchEntries(sections, isLoading ? [] : allowedReportCategories(can, isSuperAdmin)),
    query,
  );
  const showList = open && query.trim().length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const openPage = (path: string) => {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    navigate(path);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showList || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    }
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const target = results[activeIndex];
        if (showList && target) openPage(target.path);
      }}
    >
      <div className="relative">
        <span className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2">
          <svg
            className="fill-gray-500 dark:fill-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
              fill=""
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search pages"
          aria-expanded={showList}
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[activeIndex] ? `${LIST_ID}-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type command..."
          className="dark:bg-dark-900 h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
        />

        <button
          type="button"
          aria-label="Focus search"
          onClick={() => inputRef.current?.focus()}
          className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
        >
          <span> ⌘ </span>
          <span> K </span>
        </button>

        {showList && (
          <div className="absolute left-0 right-0 z-99999 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
                  <FiSearch className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">No page found for "{query.trim()}"</p>
              </div>
            ) : (
              <>
                <p className="border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  {results.length} {results.length === 1 ? "page" : "pages"}
                </p>
                {/* No scrollbar to look at, so the fade is what says more waits below */}
                <ul
                  ref={listRef}
                  id={LIST_ID}
                  role="listbox"
                  className={`no-scrollbar max-h-80 overflow-y-auto p-1.5 ${
                    results.length > 6 ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]" : ""
                  }`}
                >
                  {results.map((entry, index) => {
                    const active = index === activeIndex;
                    return (
                      <li
                        key={entry.path}
                        id={`${LIST_ID}-${index}`}
                        role="option"
                        aria-selected={active}
                        // Keeps focus in the input, whose blur would close the list before the click lands
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => openPage(entry.path)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${
                          active ? "bg-accent-50 dark:bg-accent-500/15" : ""
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-accent-500 text-white"
                              : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                          }`}
                        >
                          <FiFileText className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm font-medium ${
                              active ? "text-accent-700 dark:text-accent-300" : "text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            <Highlighted text={entry.name} query={query} />
                          </span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{entry.trail}</span>
                        </span>
                        {active && <FiCornerDownLeft className="size-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  <span className="flex items-center gap-1"><Key>↑</Key><Key>↓</Key><span>navigate</span></span>
                  <span className="flex items-center gap-1"><Key>↵</Key><span>open</span></span>
                  <span className="flex items-center gap-1"><Key>esc</Key><span>close</span></span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
