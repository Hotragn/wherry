// Doggett, the Wherry mascot (v3): a soft plush ferryman who holds the product, an emerald ferry ticket,
// and wears an amber paper-boat hat. Made only from the three brand colours (mocha, champagne, amber). Hand-built SVG with a fur filter.
// Reads at 32 px: cream blob, two eyes, red hat, green ticket. One Doggett per screen; only the waiting dots move.

export type Pose = "welcome" | "waiting" | "success" | "error";

const TITLES: Record<Pose, string> = {
  welcome: "Doggett, a plush ferryman in a paper-boat hat, holding a ferry ticket and smiling",
  waiting: "Doggett holding a ferry ticket, looking up and waiting",
  success: "Doggett with eyes closed and a big smile, holding a stamped ferry ticket",
  error: "Doggett looking worried, holding a crumpled ferry ticket",
};

const ink = "var(--w-mocha)";
const face = "var(--w-champagne)";
const red = "var(--w-amber)";

/** Shared defs. Identical in every instance, so repeated ids resolve to the same paint. */
const Defs = () => (
  <defs>
    <radialGradient id="dg3-fur" cx="40%" cy="28%" r="80%">
      <stop offset="0" stopColor="var(--w-fur)" />
      <stop offset="1" stopColor="var(--w-fur-shade)" />
    </radialGradient>
    <filter id="dg3-fuzz" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="4" />
      <feDisplacementMap in="SourceGraphic" scale="2.4" />
    </filter>
  </defs>
);

const Body = () => (
  <>
    <ellipse cx="45" cy="134" rx="10" ry="5" fill="url(#dg3-fur)" filter="url(#dg3-fuzz)" />
    <ellipse cx="75" cy="134" rx="10" ry="5" fill="url(#dg3-fur)" filter="url(#dg3-fuzz)" />
    <path
      d="M60 22 C87 22 98 42 98 66 L99 104 C99 124 84 134 60 134 C36 134 21 124 21 104 L22 66 C22 42 33 22 60 22 Z"
      fill="url(#dg3-fur)"
      filter="url(#dg3-fuzz)"
    />
  </>
);
const FacePatch = () => <rect x="36" y="42" width="48" height="36" rx="18" fill={face} stroke="var(--w-fur-shade)" strokeWidth=".8" />;
const Cheeks = () => (
  <>
    <ellipse cx="43" cy="66" rx="5" ry="3" fill={red} opacity=".22" />
    <ellipse cx="77" cy="66" rx="5" ry="3" fill={red} opacity=".22" />
  </>
);
const Eyes = ({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) => (
  <>
    <circle cx={51 + dx} cy={58 + dy} r="3.6" fill={ink} />
    <circle cx={69 + dx} cy={58 + dy} r="3.6" fill={ink} />
    <circle cx={50 + dx} cy={56.8 + dy} r="1.2" fill={face} />
    <circle cx={68 + dx} cy={56.8 + dy} r="1.2" fill={face} />
  </>
);
/** A folded paper boat worn as a hat. */
const Hat = ({ tilt = 0 }: { tilt?: number }) => (
  <g transform={`rotate(${tilt} 60 26)`}>
    <path d="M60 2 L76 26 L44 26 Z" fill={red} opacity=".85" />
    <path d="M28 24 L92 24 L82 36 L38 36 Z" fill={red} />
    <path d="M60 2 L60 26" stroke={ink} strokeWidth="1.2" opacity=".35" />
  </g>
);
/** The product: an emerald ferry ticket with a dashed stub and a mono fare. */
const TicketCard = ({ stamped = false, crumpled = false }: { stamped?: boolean; crumpled?: boolean }) => (
  <g transform={crumpled ? "rotate(9 60 98)" : "rotate(-5 60 98)"}>
    <rect x="30" y="84" width="60" height="30" rx="5" fill={face} stroke={ink} strokeWidth="1.6" />
    <circle cx="78" cy="84" r="3" fill="url(#dg3-fur)" />
    <circle cx="78" cy="114" r="3" fill="url(#dg3-fur)" />
    <line x1="78" y1="88" x2="78" y2="110" stroke={ink} strokeWidth="1.2" strokeDasharray="2 2" opacity=".6" />
    <text x="35" y="95" fontSize="6" fill={ink} opacity=".8" fontFamily="var(--w-font-mono)">
      No.7
    </text>
    <text x="35" y="108" fontSize="11" fill={ink} fontFamily="var(--w-font-mono)" fontWeight="600">
      $3.50
    </text>
    {stamped && (
      <g transform="rotate(-14 62 98)">
        <rect x="46" y="90" width="30" height="14" rx="2" fill={face} stroke={red} strokeWidth="1.6" />
        <path d="M54 97 L58 101 L66 93" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )}
    {crumpled && <path d="M30 96 L40 92 L48 99 L58 93" fill="none" stroke={ink} strokeWidth="1" opacity=".5" />}
  </g>
);
const Paws = () => (
  <>
    <ellipse cx="30" cy="100" rx="9" ry="8" fill="url(#dg3-fur)" filter="url(#dg3-fuzz)" />
    <ellipse cx="90" cy="100" rx="9" ry="8" fill="url(#dg3-fur)" filter="url(#dg3-fuzz)" />
  </>
);

function PoseArt({ pose }: { pose: Pose }) {
  switch (pose) {
    case "welcome":
      return (
        <>
          <Body />
          <FacePatch />
          <Cheeks />
          <Eyes />
          <path d="M54 67 Q60 72 66 67" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
          <Hat tilt={-6} />
          <TicketCard />
          <Paws />
        </>
      );
    case "waiting":
      return (
        <>
          <Body />
          <FacePatch />
          <Cheeks />
          <Eyes dy={-3} />
          <circle cx="60" cy="69" r="2.4" fill={ink} />
          <Hat />
          <circle className="w-dot w-dot-1" cx="98" cy="10" r="3.4" fill={ink} />
          <circle className="w-dot w-dot-2" cx="108" cy="18" r="3.4" fill={ink} />
          <circle className="w-dot w-dot-3" cx="116" cy="28" r="3.4" fill={ink} />
          <TicketCard />
          <Paws />
        </>
      );
    case "success":
      return (
        <>
          <Body />
          <FacePatch />
          <Cheeks />
          <path d="M46.5 59 Q51 54 55.5 59" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M64.5 59 Q69 54 73.5 59" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M53 65 Q60 74 67 65 Z" fill={ink} />
          <Hat tilt={8} />
          <TicketCard stamped />
          <Paws />
        </>
      );
    case "error":
      return (
        <>
          <path d="M108 40 Q114 50 108 56 Q102 50 108 40 Z" fill={red} opacity=".8" />
          <Body />
          <FacePatch />
          <Cheeks />
          <Eyes dy={1.5} />
          <path d="M45 53 L55 50" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M75 53 L65 50" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M54 70 Q57 67 60 70 T66 70" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <Hat tilt={-16} />
          <TicketCard crumpled />
          <Paws />
        </>
      );
  }
}

export function Doggett({ pose, size = 72, className = "", decorative = false }: { pose: Pose; size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 142"
      width={(size * 120) / 142}
      height={size}
      className={`shrink-0 overflow-visible ${className}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLES[pose]}
    >
      <Defs />
      <PoseArt pose={pose} />
    </svg>
  );
}
