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
