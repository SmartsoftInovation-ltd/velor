import { ReactNode } from "react";

interface SectionCardProps {
  id?: string;
  icon: ReactNode;
  title: ReactNode;
  // Optional control on the right of the header (e.g. an "Add" button).
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Titled form section: accent icon chip + uppercase heading over a padded
// body. Same look as the section cards in CreateProductForm.
const SectionCard = ({ id, icon, title, action, children, className = "" }: SectionCardProps) => (
  <section
    id={id}
    aria-labelledby={id ? `${id}-title` : undefined}
    className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm overflow-hidden ${className}`}
  >
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-center justify-center size-8 rounded-xl bg-accent-50 dark:bg-accent-500/10 text-accent-500">
        {icon}
      </div>
      <h3
        id={id ? `${id}-title` : undefined}
        className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider"
      >
        {title}
      </h3>
      {action && <div className="ml-auto">{action}</div>}
    </div>
    <div className="p-6">{children}</div>
  </section>
);

export default SectionCard;
