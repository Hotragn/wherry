// Doggett, the Wherry mascot (design/mascot/*.svg), inlined so colours come from the tokens.
// Never more than one on screen; only the waiting dots move, and not under reduced motion.

export type Pose = "welcome" | "waiting" | "success" | "error";

const TITLES: Record<Pose, string> = {
  welcome: "Doggett the wherry, sail up, smiling",
  waiting: "Doggett the wherry, sail furled, rowing and waiting",
  success: "Doggett the wherry, sail full, payment landed",
  error: "Doggett the wherry, listing to one side, something went wrong",
};

const ink = "var(--w-ink)";
const paper = "var(--w-surface)";
const sail = "var(--w-accent)";

const Water = () => (
  <path d="M6 80 Q18 74 30 80 T54 80 T78 80 T102 80" fill="none" stroke="var(--w-muted)" strokeWidth="3" strokeLinecap="round" />
);
const Hull = () => (
  <>
    <path d="M12 58 Q48 61 86 53 Q80 76 52 78 Q24 79 12 58 Z" fill={ink} />
    <path d="M15 60.5 Q48 63.5 83 56" fill="none" stroke={paper} strokeWidth="2.4" strokeLinecap="round" />
  </>
);
const Eyes = ({ look = 0, drop = 0 }: { look?: number; drop?: number }) => (
  <>
    <ellipse cx="38" cy="67" rx="4.2" ry="5" fill={paper} />
    <ellipse cx="53" cy="66.5" rx="4.2" ry="5" fill={paper} />
    <circle cx={38 + look} cy={67 + drop} r="2.2" fill={ink} />
    <circle cx={53 + look} cy={66.5 + drop} r="2.2" fill={ink} />
  </>
);
const Mast = ({ top = 16 }: { top?: number }) => (
  <line x1="50" y1="57" x2="50" y2={top} stroke={ink} strokeWidth="3" strokeLinecap="round" />
);

function Body({ pose }: { pose: Pose }) {
  switch (pose) {
    case "welcome":
      return (
        <>
          <Water />
          <Mast />
          <path d="M50 16 L60 19.5 L50 23 Z" fill={ink} />
          <path d="M52.5 19 L74 31 L78 51 L52.5 54 Z" fill={sail} />
          <path d="M53.5 52.5 L74 31" stroke={paper} strokeWidth="2" strokeLinecap="round" opacity=".75" />
          <Hull />
          <Eyes look={1} drop={1} />
          <path d="M42 73.5 Q45.5 76.5 49 73.5" fill="none" stroke={paper} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case "waiting":
      return (
        <>
          <Water />
          <circle className="w-dot w-dot-1" cx="38" cy="30" r="3" fill="var(--w-muted)" />
          <circle className="w-dot w-dot-2" cx="48" cy="30" r="3" fill="var(--w-muted)" />
          <circle className="w-dot w-dot-3" cx="58" cy="30" r="3" fill="var(--w-muted)" />
          <Mast top={40} />
          <rect x="50" y="47" width="28" height="7" rx="3.5" fill={sail} />
          <line x1="27" y1="62" x2="11" y2="84" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="10" cy="85.5" rx="5" ry="2.4" transform="rotate(-54 10 85.5)" fill={ink} />
          <Hull />
          <Eyes look={-1.4} drop={-0.6} />
          <path d="M42.5 74 L48.5 74" fill="none" stroke={paper} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case "success":
      return (
        <>
          <Water />
          <Mast />
          <path d="M50 16 L60 19.5 L50 23 Z" fill={ink} />
          <path d="M52.5 18 Q80 26 80 51 L52.5 54 Z" fill={sail} />
          <path d="M53.5 52.5 L75 30" stroke={paper} strokeWidth="2" strokeLinecap="round" opacity=".75" />
          <circle cx="80" cy="16" r="10" fill="var(--w-ok)" />
          <path d="M75 16.5 L79 20.5 L86 12.5" fill="none" stroke={paper} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Hull />
          <path d="M33.8 67.5 Q38 62.5 42.2 67.5" fill="none" stroke={paper} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M48.8 67 Q53 62 57.2 67" fill="none" stroke={paper} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M40.5 72 Q45.5 77.5 50.5 72" fill="none" stroke={paper} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case "error":
      return (
        <>
          <Water />
          <path d="M24 30 Q29 38 24 43 Q19 38 24 30 Z" fill="var(--w-err)" />
          <g transform="rotate(-11 48 66)">
            <Mast top={18} />
            <path d="M52.5 22 L68 35 L71 52 L52.5 54 Z" fill={sail} />
            <Hull />
            <Eyes drop={2} />
            <path d="M34 60 L41.5 62" stroke={paper} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M57 60 L49.5 62" stroke={paper} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M42 75 Q45.5 72.5 49 75" fill="none" stroke={paper} strokeWidth="2.2" strokeLinecap="round" />
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
