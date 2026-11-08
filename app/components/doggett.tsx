// Doggett, the Wherry mascot: a chubby little Thames wherry with a saffron sail, big eyes and a blush.
// Hand-built SVG, colours from the tokens. Reads at 32 px: bean hull, triangle sail, two eyes.
// Never more than one on screen; only the waiting dots move, and not under reduced motion.

export type Pose = "welcome" | "waiting" | "success" | "error";

const TITLES: Record<Pose, string> = {
  welcome: "Doggett the wherry, sail up, smiling",
  waiting: "Doggett the wherry, sail furled, rowing and waiting",
  success: "Doggett the wherry, sail full, payment landed",
  error: "Doggett the wherry, listing to one side, something went wrong",
};

const ink = "var(--w-ink)";
const fog = "var(--w-surface)";
const sail = "var(--w-accent)";

const Water = () => (
  <>
    <path d="M4 86 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M22 92 q5 -3 10 0 t10 0" fill="none" stroke="var(--w-muted)" strokeWidth="2" strokeLinecap="round" />
    <path d="M60 92 q5 -3 10 0 t10 0" fill="none" stroke="var(--w-muted)" strokeWidth="2" strokeLinecap="round" />
  </>
);
const Hull = () => (
  <>
    <path d="M8 55 C30 60 66 59 90 51 C88 72 72 84 49 84 C26 84 11 73 8 55 Z" fill={ink} />
    <path d="M13 58.5 C36 62.5 64 61.5 85 55.5" fill="none" stroke={sail} strokeWidth="3" strokeLinecap="round" />
  </>
);
const Cheeks = () => (
  <>
    <ellipse cx="27" cy="74" rx="4" ry="2.4" fill={sail} opacity=".75" />
    <ellipse cx="67" cy="72.5" rx="4" ry="2.4" fill={sail} opacity=".75" />
  </>
);
const Eyes = ({ look = 0, drop = 0 }: { look?: number; drop?: number }) => (
  <>
    <ellipse cx="38" cy="69" rx="6.2" ry="7" fill={fog} />
    <ellipse cx="57" cy="68" rx="6.2" ry="7" fill={fog} />
    <circle cx={38.6 + look} cy={70 + drop} r="3.6" fill={ink} />
    <circle cx={57.6 + look} cy={69 + drop} r="3.6" fill={ink} />
    <circle cx={37.4 + look} cy={68.4 + drop} r="1.3" fill={fog} />
    <circle cx={56.4 + look} cy={67.4 + drop} r="1.3" fill={fog} />
  </>
);
const Mast = ({ top = 12 }: { top?: number }) => (
  <line x1="49" y1="56" x2="49" y2={top} stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
);
const Pennant = () => <path d="M49 12 L61 15.5 L49 19 Z" fill={ink} />;

function Body({ pose }: { pose: Pose }) {
  switch (pose) {
    case "welcome":
      return (
        <>
          <Water />
          <Mast />
          <Pennant />
          <path d="M52.5 18 Q74 30 78 50.5 L52.5 52.5 Z" fill={sail} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M56 46 L72 44.6" stroke={ink} strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
          <Hull />
          <Cheeks />
          <Eyes look={0.6} drop={0.4} />
          <path d="M42.5 76.5 Q47.5 81 52.5 76.5" fill="none" stroke={fog} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    case "waiting":
      return (
        <>
          <Water />
          <circle className="w-dot w-dot-1" cx="36" cy="26" r="3.6" fill={ink} />
          <circle className="w-dot w-dot-2" cx="48" cy="26" r="3.6" fill={ink} />
          <circle className="w-dot w-dot-3" cx="60" cy="26" r="3.6" fill={ink} />
          <Mast top={38} />
          <rect x="49" y="44" width="30" height="8" rx="4" fill={sail} stroke={ink} strokeWidth="2.4" />
          <line x1="22" y1="62" x2="8" y2="86" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="7" cy="88" rx="5.5" ry="2.6" transform="rotate(-58 7 88)" fill={ink} />
          <Hull />
          <Cheeks />
          <Eyes look={-1.6} drop={-1.2} />
          <path d="M44 77.5 L51 77.5" fill="none" stroke={fog} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    case "success":
      return (
        <>
          <Water />
          <Mast />
          <Pennant />
          <path d="M52.5 16 Q84 24 82 51 L52.5 52.5 Z" fill={sail} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx="80" cy="14" r="10.5" fill="var(--w-ok)" stroke={ink} strokeWidth="2" />
          <path d="M75 14.5 L79 18.5 L86 10.5" fill="none" stroke={fog} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <Hull />
          <Cheeks />
          <path d="M32.5 70 Q38 63 43.5 70" fill="none" stroke={fog} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M51.5 69 Q57 62 62.5 69" fill="none" stroke={fog} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M41 75 Q47.5 83 54 75 Z" fill={fog} />
        </>
      );
    case "error":
      return (
        <>
          <Water />
          <path d="M20 26 Q26 36 20 42 Q14 36 20 26 Z" fill="var(--w-err)" />
          <g transform="rotate(-12 48 68)">
            <Mast top={16} />
            <path d="M52.5 22 Q64 36 70 51 L52.5 52.5 Z" fill={sail} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
            <Hull />
            <Cheeks />
            <Eyes drop={2} />
            <path d="M31 59.5 L42 62" stroke={fog} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M64 58.5 L53 61" stroke={fog} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M43 79 Q47.5 75.5 52 79" fill="none" stroke={fog} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </>
      );
  }
}

export function Doggett({ pose, size = 72, className = "", decorative = false }: { pose: Pose; size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLES[pose]}
    >
      <Body pose={pose} />
    </svg>
  );
}
