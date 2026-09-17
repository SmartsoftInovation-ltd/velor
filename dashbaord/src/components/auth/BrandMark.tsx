// Green rounded tile with the three-bar chart mark used on the auth screens
const BrandMark = ({ className = "size-10" }: { className?: string }) => (
  <span className={`inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white ${className}`}>
    <svg viewBox="0 0 20 20" aria-hidden className="size-1/2">
      <rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="8.5" y="6.5" width="3" height="10.5" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor" />
    </svg>
  </span>
);

export default BrandMark;
