/**
 * Header-only icons. Split from icons.tsx to stay under the 150-line file cap.
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

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function BagIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9L12 3z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}

export function CrownIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 18h16" />
      <path d="M3.5 7.5l3.8 3L12 4.5l4.7 6 3.8-3L19 15.5H5L3.5 7.5z" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.5 11.2V4.8a1.3 1.3 0 0 1 1.3-1.3h6.4a1.3 1.3 0 0 1 .9.4l8 8a1.3 1.3 0 0 1 0 1.8l-6.3 6.3a1.3 1.3 0 0 1-1.8 0l-8-8a1.3 1.3 0 0 1-.5-.8z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function BoxIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M21 8.5v7a1.5 1.5 0 0 1-.8 1.3l-7.5 4a1.5 1.5 0 0 1-1.4 0l-7.5-4A1.5 1.5 0 0 1 3 15.5v-7" />
      <path d="M3.4 7.7l8.1-4.3a1 1 0 0 1 1 0l8.1 4.3a.5.5 0 0 1 0 .9l-8.1 4.3a1 1 0 0 1-1 0L3.4 8.6a.5.5 0 0 1 0-.9z" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}
