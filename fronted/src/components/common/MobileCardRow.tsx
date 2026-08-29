interface MobileCardRowProps {
  label: string;
  children: React.ReactNode;
}

// One label/value line inside a MobileCardList card.
const MobileCardRow: React.FC<MobileCardRowProps> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-1">
    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </span>
    <span className="text-right text-sm text-gray-800 dark:text-white/90">
      {children}
    </span>
  </div>
);

export default MobileCardRow;
