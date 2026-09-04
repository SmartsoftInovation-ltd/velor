interface ComponentCardProps {
  title?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string; // Additional custom classes for styling
  desc?: string; // Description text
  bodyClassName?: string; // Extra classes for the card body wrapper
  // Lets the card body fill the card's height instead of growing with its
  // content — used by pages that must fit inside the viewport.
  fillBody?: boolean;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  title,
  children,
  className = "",
  desc = "",
  bodyClassName = "",
  fillBody = false,
}) => {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      {/* Card Header — omitted entirely when the page supplies no title, so the
          card doesn't reserve empty vertical space. */}
      {(title || desc) && (
        <div className="px-6 py-5">
          {title && (
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              {title}
            </h3>
          )}
          {desc && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {desc}
            </p>
          )}
        </div>
      )}

      {/* Card Body */}
      <div
        className={`p-4 sm:p-6 ${
          title || desc ? "border-t border-gray-100 dark:border-gray-800" : ""
        } ${fillBody ? "flex-1 min-h-0 flex flex-col" : ""} ${bodyClassName}`}
      >
        <div className={fillBody ? "flex-1 min-h-0 flex flex-col" : "space-y-6"}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default ComponentCard;
