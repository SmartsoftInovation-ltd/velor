import { Link } from "react-router";

interface BreadcrumbProps {
  pageTitle: string;
  // Page-level action buttons, rendered beside the breadcrumb trail so a page
  // doesn't need a second header row of its own.
  actions?: React.ReactNode;
  className?: string;
  // Drops the big page heading, leaving just the breadcrumb trail (and any
  // actions). The trail still names the page, so the heading is redundant on
  // dense screens that need the vertical space.
  hideTitle?: boolean;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  actions,
  className = "mb-6",
  hideTitle = false,
}) => {
  return (
    <div
      className={`flex flex-row flex-nowrap items-center justify-between gap-2 sm:gap-3 ${className}`}
    >
      {!hideTitle && (
        <h2
          className="text-xl font-semibold text-gray-800 dark:text-white/90"
          x-text="pageName"
        >
          {pageTitle}
        </h2>
      )}
      {/* Title hidden: the trail takes the left slot and actions the right.
          Title shown: both sit together on the right of the heading. */}
      {hideTitle ? (
        <>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
            <ol className="flex items-center gap-1 min-w-0">
              <li className="shrink-0">
                <Link
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:bg-[#C7DAFF] hover:text-[#1D4ED8] dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  to="/"
                >
                  <svg
                    className="size-4 shrink-0"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3.5 8.2 10 3l6.5 5.2" />
                    <path d="M5 7.8V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.8" />
                    <path d="M8.2 17v-4.2h3.6V17" />
                  </svg>
                  <span className="hidden sm:inline">Home</span>
                </Link>
              </li>
              <li aria-hidden="true" className="shrink-0 text-gray-300 dark:text-gray-600">
                <svg
                  className="size-4"
                  viewBox="0 0 17 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366" />
                </svg>
              </li>
              <li
                aria-current="page"
                className="min-w-0 truncate px-1 text-sm font-semibold text-gray-800 dark:text-white/90"
                title={pageTitle}
              >
                {pageTitle}
              </li>
            </ol>
          </nav>
          <div className="shrink-0">{actions}</div>
        </>
      ) : (
      <div className="flex flex-row flex-wrap items-center gap-3">
      {actions}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:bg-[#C7DAFF] hover:text-[#1D4ED8] dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              to="/"
            >
              <svg
                className="size-4 shrink-0"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 8.2 10 3l6.5 5.2" />
                <path d="M5 7.8V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.8" />
                <path d="M8.2 17v-4.2h3.6V17" />
              </svg>
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            <svg
              className="size-4"
              viewBox="0 0 17 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366" />
            </svg>
          </li>
          <li
            aria-current="page"
            className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90"
          >
            {pageTitle}
          </li>
        </ol>
      </nav>
      </div>
      )}
    </div>
  );
};

export default PageBreadcrumb;
