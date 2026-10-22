/**
 * Sign up, drawn: a new account card being filled in — avatar, name and
 * contact lines, password dots, the button — with a check that says it worked
 * and the shop's bag it is for. Colours come from the brand tokens, so it
 * follows the theme; the card stays white like paper in both.
 */
export function VisualSignUp({ storeName }: { storeName: string }) {
  return (
    <figure className="w-full max-w-md">
      <svg viewBox="0 0 360 300" role="img" aria-labelledby="sign-up-art-title" className="w-full">
        <title id="sign-up-art-title">{`A new ${storeName} account being created`}</title>

        {/* Soft shadow under the card */}
        <ellipse cx="180" cy="272" rx="118" ry="10" fill="var(--color-brand-200)" opacity="0.6" />

        {/* The account card */}
        <g>
          <rect x="70" y="40" width="220" height="220" rx="22" fill="#fff" />
          <rect x="70.5" y="40.5" width="219" height="219" rx="21.5" fill="none" stroke="var(--color-brand-200)" />

          {/* Avatar */}
          <circle cx="180" cy="86" r="24" fill="var(--color-brand-100)" />
          <circle cx="180" cy="80" r="8" fill="var(--color-brand-500)" />
          <path d="M166 101c3-8 9-11 14-11s11 3 14 11" fill="none" stroke="var(--color-brand-500)" strokeWidth="5" strokeLinecap="round" />

          {/* Name and contact fields */}
          <rect x="98" y="126" width="164" height="18" rx="6" fill="#f6f2ee" />
          <rect x="108" y="133" width="62" height="4" rx="2" fill="#d8cfc6" />
          <rect x="98" y="152" width="164" height="18" rx="6" fill="#f6f2ee" />
          <rect x="108" y="159" width="90" height="4" rx="2" fill="#d8cfc6" />

          {/* Password: dots, and a strength bar already full */}
          <rect x="98" y="178" width="164" height="18" rx="6" fill="#f6f2ee" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={112 + i * 10} cy="187" r="2.6" fill="#8b8378" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={98 + i * 42} y="201" width="38" height="3" rx="1.5" fill="var(--color-brand-500)" opacity={0.4 + i * 0.2} />
          ))}

          {/* The button */}
          <rect x="98" y="214" width="164" height="26" rx="8" fill="var(--color-brand-500)" />
          <rect x="152" y="225" width="44" height="4" rx="2" fill="#fff" opacity="0.9" />
          <path d="M204 223l4 4-4 4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Done: a check badge over the card's corner */}
        <g className="animate-float-y [animation-duration:5s]">
          <circle cx="282" cy="52" r="22" fill="var(--color-success-solid)" />
          <circle cx="282" cy="52" r="22" fill="none" stroke="#fff" strokeWidth="4" />
          <path d="M272 52l7 7 13-14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
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
