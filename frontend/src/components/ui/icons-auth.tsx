/**
 * Icons the auth screens need. Google's mark is a brand asset with its own
 * fixed colours, so unlike every other icon here it does not take
 * `currentColor`.
 */
type IconProps = { className?: string };

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.06-1.36-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.6-2.4l-3.2-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.8-1.76-5.6-4.13H3.1v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.84-2.84C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.74 9.4 5.98 12 5.98z"
      />
    </svg>
  );
}

export function ShieldLockIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l7.5 3v5.4c0 4.3-3 8.2-7.5 9.6-4.5-1.4-7.5-5.3-7.5-9.6V6L12 3z" />
      <rect x="9.2" y="10.8" width="5.6" height="4.6" rx="1.2" />
      <path d="M10.4 10.8V9.6a1.6 1.6 0 0 1 3.2 0v1.2" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85-.7 0-1.85-.83-3.05-.8-1.55.02-3 .9-3.8 2.3-1.63 2.8-.42 7 1.16 9.3.78 1.13 1.7 2.4 2.9 2.35 1.17-.05 1.6-.75 3-.75s1.8.75 3.05.73c1.26-.02 2.05-1.15 2.8-2.3.9-1.3 1.26-2.57 1.28-2.64-.03-.01-2.45-.94-2.45-3.74z" />
      <path d="M14.2 5.9c.63-.78 1.06-1.85.94-2.9-.9.04-2 .6-2.66 1.37-.58.68-1.1 1.78-.96 2.83 1 .08 2.03-.5 2.68-1.3z" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 12h14" />
      <path d="M13 6.5l5.5 5.5-5.5 5.5" />
    </svg>
  );
}
