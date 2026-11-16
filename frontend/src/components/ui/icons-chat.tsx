/** Chat button icons. Split from icons.tsx to stay under the 150-line file cap. */
type IconProps = { className?: string };

export function ChatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.5 3C5.4 3 2 5.7 2 9.1c0 1.6.8 3.1 2 4.2l-.7 2.9 3.1-1.5c1 .3 2 .5 3.1.5 4.1 0 7.5-2.7 7.5-6.1S13.6 3 9.5 3z" />
      <path d="M18.9 10.3c0 .2 0 .3 0 .5 0 3.8-3.6 6.4-8 6.8 1.2 1.5 3.3 2.4 5.6 2.4.9 0 1.7-.1 2.5-.4l2.7 1.3-.6-2.5c1.2-.9 1.9-2.2 1.9-3.6 0-1.9-1.7-3.7-4.1-4.5z" />
    </svg>
  );
}

export function MessengerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2C6.4 2 2 6.1 2 11.5c0 2.9 1.3 5.4 3.3 7.1V22l3.1-1.7c1.1.3 2.3.5 3.6.5 5.6 0 10-4.1 10-9.3S17.6 2 12 2zm1 12.5-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3V9.75zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-4.97c0-1.19-.02-2.71-1.65-2.71-1.65 0-1.9 1.29-1.9 2.62V21h-4V9.75z" />
    </svg>
  );
}
