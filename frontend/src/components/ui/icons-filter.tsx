/**
 * One icon per shop facet, so the sidebar's groups are distinguishable at a
 * glance rather than repeating a single generic mark.
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

export function CurrencyIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.2a2.8 2.8 0 0 0-5 1.7c0 2.6 5 1.7 5 4.2a2.8 2.8 0 0 1-5 1.7" />
      <path d="M12 6.5v11" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3.8l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9L12 3.8z" />
    </svg>
  );
}

export function PaletteIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 2-.8 2-1.8 0-1.5-1.2-1.7-1.2-2.9 0-.9.8-1.6 1.8-1.6h1.6a4.3 4.3 0 0 0 4.3-4.3c0-3.6-3.8-6.4-8.5-6.4z" />
      <circle cx="8" cy="10.5" r="1.2" />
      <circle cx="12" cy="7.8" r="1.2" />
      <circle cx="16" cy="10" r="1.2" />
    </svg>
  );
}

export function RulerIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="2.5" y="8" width="19" height="8" rx="1.8" />
      <path d="M7 8v3" />
      <path d="M12 8v4" />
      <path d="M17 8v3" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
    </svg>
  );
}

export function SortIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M7 4.5v15" />
      <path d="M3.8 16.3L7 19.5l3.2-3.2" />
      <path d="M14 7.5h6.5" />
      <path d="M14 12h4.5" />
      <path d="M14 16.5h2.5" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1" />
      <path d="M8.2 13.2l7.6 4.1" />
    </svg>
  );
}

export function ZoomIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M9.5 4.5h-5v5" />
      <path d="M4.5 4.5l5 5" />
      <path d="M14.5 19.5h5v-5" />
      <path d="M19.5 19.5l-5-5" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M10.6 6.3A9.6 9.6 0 0 1 12 6.2c5 0 8.5 5.8 8.5 5.8a16 16 0 0 1-2.5 3.2" />
      <path d="M6.4 8A16 16 0 0 0 3.5 12s3.5 5.8 8.5 5.8c1.4 0 2.7-.4 3.8-1.1" />
      <path d="M10.3 10.3a2.4 2.4 0 0 0 3.4 3.4" />
      <path d="M4 4l16 16" />
    </svg>
  );
}
