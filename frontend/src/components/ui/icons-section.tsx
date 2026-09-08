/**
 * Icons used by home section headings. A third icon file rather than a bigger
 * one: icons.tsx is already at the 150-line cap.
 */
type IconProps = { className?: string };

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function BoltIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M13.5 2.5L4.5 13.5h6l-1 8 9-11h-6l1-8z" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3c.5 3-1.5 4.2-2.8 5.6A6.4 6.4 0 0 0 7.4 13a4.6 4.6 0 0 0 9.2 0c0-2-.9-3.4-2-4.7-1.4-1.7-2.6-3-2.6-5.3z" />
      <path d="M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.7 2.6-3.4 2.6-3.4s2.6 1.7 2.6 3.4A2.6 2.6 0 0 1 12 21z" />
    </svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 7h9" />
      <path d="M18 7h2" />
      <path d="M4 17h3" />
      <path d="M12 17h8" />
      <circle cx="15.5" cy="7" r="2.2" />
      <circle cx="9.5" cy="17" r="2.2" />
    </svg>
  );
}

export function GridViewIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export function ListViewIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}
