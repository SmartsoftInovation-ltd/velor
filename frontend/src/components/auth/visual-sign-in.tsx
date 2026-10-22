/**
 * Sign in, drawn: the account waiting behind the form — avatar, an order on
 * its way, saved items — unlocked by a key badge. Drawn in the same hand as
 * the sign-up art so the two pages read as one flow. Colours come from the
 * brand tokens; the card stays white like paper in both themes.
 */
export function VisualSignIn({ storeName }: { storeName: string }) {
  return (
    <figure className="w-full max-w-md">
      <svg viewBox="0 0 360 300" role="img" aria-labelledby="sign-in-art-title" className="w-full">
        <title id="sign-in-art-title">{`Your ${storeName} account, unlocked`}</title>

        {/* Soft shadow under the card */}
        <ellipse cx="180" cy="272" rx="118" ry="10" fill="var(--color-brand-200)" opacity="0.6" />

        {/* The account card */}
        <g>
          <rect x="70" y="40" width="220" height="220" rx="22" fill="#fff" />
          <rect x="70.5" y="40.5" width="219" height="219" rx="21.5" fill="none" stroke="var(--color-brand-200)" />

          {/* Avatar with name lines beside it */}
          <circle cx="112" cy="82" r="20" fill="var(--color-brand-100)" />
          <circle cx="112" cy="77" r="7" fill="var(--color-brand-500)" />
          <path d="M100 95c2.5-6.5 7.5-9 12-9s9.5 2.5 12 9" fill="none" stroke="var(--color-brand-500)" strokeWidth="4.5" strokeLinecap="round" />
          <rect x="142" y="72" width="82" height="7" rx="3.5" fill="#d8cfc6" />
          <rect x="142" y="86" width="54" height="5" rx="2.5" fill="#e8e5e1" />

          {/* An order on its way: box, label, live dot */}
          <rect x="94" y="120" width="172" height="40" rx="10" fill="#f6f2ee" />
          <rect x="104" y="128" width="24" height="24" rx="7" fill="#fff" />
          <path d="M110 136l6-3 6 3v8l-6 3-6-3z" fill="none" stroke="var(--color-brand-500)" strokeWidth="2" strokeLinejoin="round" />
          <rect x="138" y="133" width="70" height="5" rx="2.5" fill="#d8cfc6" />
          <rect x="138" y="143" width="46" height="4" rx="2" fill="#e8e5e1" />
          <circle cx="252" cy="140" r="4" fill="var(--color-success-solid)" className="animate-glow-pulse" />

          {/* Saved items: a heart row */}
          <rect x="94" y="168" width="172" height="40" rx="10" fill="#f6f2ee" />
          <rect x="104" y="176" width="24" height="24" rx="7" fill="#fff" />
          <path d="M116 194s-7-4.2-7-9a3.8 3.8 0 0 1 7-2.1 3.8 3.8 0 0 1 7 2.1c0 4.8-7 9-7 9z" fill="var(--color-brand-500)" />
          <rect x="138" y="181" width="56" height="5" rx="2.5" fill="#d8cfc6" />
          <rect x="138" y="191" width="34" height="4" rx="2" fill="#e8e5e1" />

          {/* The button */}
          <rect x="94" y="220" width="172" height="26" rx="8" fill="var(--color-brand-500)" />
          <rect x="156" y="231" width="40" height="4" rx="2" fill="#fff" opacity="0.9" />
          <path d="M204 229l4 4-4 4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Unlocked: an open padlock badge over the card's corner */}
        <g className="animate-float-y [animation-duration:5s]">
          <circle cx="282" cy="52" r="22" fill="var(--color-success-solid)" />
          <circle cx="282" cy="52" r="22" fill="none" stroke="#fff" strokeWidth="4" />
          <rect x="273" y="51" width="18" height="13" rx="3" fill="#fff" />
          <path d="M277 51v-5a5 5 0 0 1 9.6-2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </g>

        {/* The shop it is for */}
        <g className="animate-float-y [animation-delay:-2s] [animation-duration:6s]">
          <rect x="34" y="176" width="58" height="58" rx="16" fill="#fff" stroke="var(--color-brand-200)" />
          <path d="M50 196h26l-2 24H52z" fill="var(--color-brand-100)" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M56 200v-5a7 7 0 0 1 14 0v5" fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Two small sparkles, the only decoration */}
        <path d="M318 150v12M312 156h12" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 92v8M40 96h8" stroke="var(--color-brand-500)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </svg>
    </figure>
  );
}
