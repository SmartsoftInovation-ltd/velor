/**
 * Footer-only icons — contact details and social links. Split from icons.tsx
 * to stay under the 150-line file cap.
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

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.5 20.5l1.3-4.4a8.2 8.2 0 1 1 3.1 3.1z" />
      <path
        d="M9 9.2c0 3 2.4 5.3 5.2 5.3.4 0 .8-.4.8-.8v-.9l-1.7-.7-.8.9a4.6 4.6 0 0 1-2-2l.9-.8-.7-1.7h-.9c-.4 0-.8.3-.8.7z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M14 8.5h2.5V5h-2.5C11.7 5 10 6.7 10 9v2H8v3.5h2V21h3.5v-6.5H16l.5-3.5h-3V9c0-.5.4-1 1-1z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TwitterIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M21 5.5c-.7.4-1.5.6-2.3.8a3.4 3.4 0 0 0-5.8 3.1A9.6 9.6 0 0 1 6 5.9a3.4 3.4 0 0 0 1 4.6 3.3 3.3 0 0 1-1.5-.4v.1a3.4 3.4 0 0 0 2.7 3.4c-.5.1-1 .1-1.5.1a3.4 3.4 0 0 0 3.2 2.4A6.9 6.9 0 0 1 3 17.6a9.7 9.7 0 0 0 5.3 1.6c6.3 0 9.8-5.3 9.8-9.8v-.4c.7-.5 1.3-1.1 1.8-1.8z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
