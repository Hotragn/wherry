// Doggett, the Wherry mascot: a soft plush ferryman sitting in a little emerald wherry with a vermilion pennant.
// Hand-built SVG. The fur is a turbulence filter on a cream body; colours come from the tokens.
// Reads at 32 px: cream blob, face patch, two eyes, green boat. One Doggett per screen; only waiting dots move.

export type Pose = "welcome" | "waiting" | "success" | "error";

const TITLES: Record<Pose, string> = {
  welcome: "Doggett, a plush ferryman in a little green boat, waving hello",
  waiting: "Doggett looking up and waiting",
  success: "Doggett smiling with eyes closed, payment landed",
  error: "Doggett looking worried, something went wrong",
};

const ink = "var(--w-ink)";
const face = "var(--w-ivory-50)";

/** Shared defs. Identical in every instance, so repeated ids resolve to the same paint. */
const Defs = () => (
  <defs>
    <radialGradient id="dg-fur" cx="38%" cy="30%" r="75%">
      <stop offset="0" stopColor="var(--w-ivory-50)" />
      <stop offset=".55" stopColor="var(--w-ivory)" />
      <stop offset="1" stopColor="var(--w-ivory-300)" />
    </radialGradient>
    <linearGradient id="dg-hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="var(--w-emerald)" />
      <stop offset="1" stopColor="var(--w-emerald-700)" />
    </linearGradient>
    <filter id="dg-fuzz" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" />
      <feDisplacementMap in="SourceGraphic" scale="2.6" />
    </filter>
  </defs>
);

const Body = () => (
  <path
    d="M60 18 C84 18 93 38 93 60 C93 84 81 96 60 96 C39 96 27 84 27 60 C27 38 36 18 60 18 Z"
    fill="url(#dg-fur)"
    stroke="var(--w-ivory-300)"
    strokeWidth="1"
    filter="url(#dg-fuzz)"
  />
);
const FacePatch = () => <ellipse cx="60" cy="49" rx="23" ry="18" fill={face} />;
const Cheeks = () => (
  <>
    <ellipse cx="44" cy="56" rx="5" ry="3.2" fill="var(--w-spark)" opacity=".28" />
    <ellipse cx="76" cy="56" rx="5" ry="3.2" fill="var(--w-spark)" opacity=".28" />
  </>
);
const Eyes = ({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) => (
  <>
    <circle cx={51 + dx} cy={48 + dy} r="3.6" fill={ink} />
    <circle cx={69 + dx} cy={48 + dy} r="3.6" fill={ink} />
    <circle cx={50 + dx} cy={46.8 + dy} r="1.2" fill={face} />
    <circle cx={68 + dx} cy={46.8 + dy} r="1.2" fill={face} />
  </>
);
const Boat = () => (
  <>
    <line x1="99" y1="80" x2="99" y2="34" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M100 36 L114 42 L100 48 Z" fill="var(--w-spark)" />
    <path d="M14 78 Q60 88 106 76 Q100 104 60 106 Q22 104 14 78 Z" fill="url(#dg-hull)" />
    <path d="M17 80.5 Q60 90 103 78.5" fill="none" stroke="var(--w-ivory)" strokeWidth="2" strokeLinecap="round" opacity=".7" />
  </>
);
const Water = () => (
  <path d="M6 110 q9 -5 18 0 t18 0 t18 0 t18 0 t18 0 t18 0" fill="none" stroke="var(--w-brand)" strokeWidth="2.2" strokeLinecap="round" opacity=".45" />
);
const Paw = ({ x, y, r = 0 }: { x: number; y: number; r?: number }) => (
  <ellipse cx={x} cy={y} rx="8" ry="6.5" transform={`rotate(${r} ${x} ${y})`} fill="url(#dg-fur)" filter="url(#dg-fuzz)" />
);

function Pose({ pose }: { pose: Pose }) {
  switch (pose) {
    case "welcome":
      return (
        <>
          <Water />
          <Body />
          <Paw x={92} y={52} r={-35} />
          <FacePatch />
          <Cheeks />
          <Eyes />
          <path d="M55 57 Q60 61.5 65 57" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <Boat />
          <Paw x={36} y={80} />
        </>
      );
    case "waiting":
      return (
        <>
          <Water />
          <circle className="w-dot w-dot-1" cx="46" cy="8" r="3.4" fill="var(--w-brand)" />
          <circle className="w-dot w-dot-2" cx="60" cy="8" r="3.4" fill="var(--w-brand)" />
          <circle className="w-dot w-dot-3" cx="74" cy="8" r="3.4" fill="var(--w-brand)" />
          <Body />
          <FacePatch />
          <Cheeks />
          <Eyes dy={-2.5} />
          <circle cx="60" cy="58.5" r="2.4" fill={ink} />
          <Boat />
          <Paw x={36} y={80} />
          <Paw x={84} y={80} />
        </>
      );
    case "success":
      return (
        <>
          <Water />
          <Body />
          <FacePatch />
          <Cheeks />
          <path d="M46.5 49 Q51 44 55.5 49" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M64.5 49 Q69 44 73.5 49" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M53 55.5 Q60 63 67 55.5 Z" fill={ink} />
          <Boat />
          <Paw x={30} y={66} r={30} />
          <Paw x={90} y={66} r={-30} />
          <circle cx="20" cy="22" r="10" fill="var(--w-brand)" />
          <path d="M15 22.5 L19 26.5 L26 18.5" fill="none" stroke={face} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "error":
      return (
        <>
          <Water />
          <path d="M22 26 Q28 36 22 42 Q16 36 22 26 Z" fill="var(--w-err)" opacity=".85" />
          <g transform="rotate(-8 60 70)">
            <Body />
            <FacePatch />
            <Cheeks />
            <Eyes dy={1.5} />
            <path d="M45 44 L55 40.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            <path d="M75 44 L65 40.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            <path d="M55 59.5 Q57.5 57 60 59.5 T65 59.5" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            <Boat />
            <Paw x={36} y={80} />
            <Paw x={84} y={80} />
          </g>
        </>
      );
  }
}

export function Doggett({ pose, size = 72, className = "", decorative = false }: { pose: Pose; size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 116"
      width={size}
      height={(size * 116) / 120}
      className={`shrink-0 overflow-visible ${className}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLES[pose]}
    >
      <Defs />
      <Pose pose={pose} />
    </svg>
  );
}
