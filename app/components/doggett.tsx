// Doggett, the Wherry mascot (v4), drawn from the owner's mascot sheets (design/mascot/owner-mascot-*.png):
// a glowing egg-shaped plush sitting in a little amber wherry with a waving flag, over a champagne wave.
// Only the three brand colours. `glow` adds the soft 3D light and fur used at hero sizes; small sizes stay flat.
// Reads at 16 px: egg, two eyes, boat, flag. Only the waiting dots move, and not under reduced motion.

export type Pose = "welcome" | "waiting" | "success" | "error";

const TITLES: Record<Pose, string> = {
  welcome: "Doggett, a glowing egg-shaped plush in a little boat with a flag, smiling",
  waiting: "Doggett in his boat, looking up and waiting",
  success: "Doggett in his boat, eyes closed with a big smile",
  error: "Doggett in a tilting boat, looking worried",
};

const INK = "var(--w-navy)";
const MIST = "var(--w-mist)";
const GOLD = "var(--w-gold)";

const Defs = ({ glow }: { glow: boolean }) => (
  <defs>
    <radialGradient id="dg4-egg" cx="38%" cy="26%" r="85%">
      <stop offset="0" stopColor={MIST} />
      <stop offset=".6" stopColor="color-mix(in srgb, var(--w-gold) 14%, var(--w-mist))" />
      <stop offset="1" stopColor="color-mix(in srgb, var(--w-gold) 38%, var(--w-mist))" />
    </radialGradient>
    {/* warm light from inside the plush, low in the body, as in the 3D sheet */}
    <radialGradient id={glow ? "dg4-inner-lit" : "dg4-inner-flat"} cx="50%" cy="80%" r="55%">
      <stop offset="0" stopColor={GOLD} stopOpacity={glow ? 0.55 : 0} />
      <stop offset="1" stopColor={GOLD} stopOpacity="0" />
    </radialGradient>
    <linearGradient id="dg4-hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={GOLD} />
      <stop offset="1" stopColor="color-mix(in srgb, var(--w-navy) 35%, var(--w-gold))" />
    </linearGradient>
    <filter id="dg4-fuzz" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="9" />
      <feDisplacementMap in="SourceGraphic" scale="1.8" />
    </filter>
  </defs>
);

const EGG = "M70 18 C95 18 110 46 110 74 C110 98 96 106 70 106 C44 106 30 98 30 74 C30 46 45 18 70 18 Z";

function Boat() {
  return (
    <>
      <line x1="118" y1="90" x2="118" y2="16" stroke={MIST} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M120 17 C130 13 137 22 150 17 L146 27 L150 37 C137 42 130 33 120 36 Z" fill={GOLD} />
      <path d="M16 92 L144 86 Q138 118 98 121 L56 122 Q26 119 16 92 Z" fill="url(#dg4-hull)" />
      <path d="M20 95 L140 89" stroke={MIST} strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
      <path d="M32 107 Q82 112 132 103" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity=".35" />
    </>
  );
}
const Wave = () => <path d="M12 130 Q38 120 64 128 T116 126 T152 120" fill="none" stroke={MIST} strokeWidth="4" strokeLinecap="round" />;

function Egg({ glow }: { glow: boolean }) {
  return (
    <g filter={glow ? "url(#dg4-fuzz)" : undefined}>
      <path d={EGG} fill="url(#dg4-egg)" />
      <path d={EGG} fill={glow ? "url(#dg4-inner-lit)" : "url(#dg4-inner-flat)"} />
    </g>
  );
}
const Cheeks = () => (
  <>
    <ellipse cx="52" cy="74" rx="6" ry="3.8" fill={GOLD} opacity=".45" />
    <ellipse cx="88" cy="74" rx="6" ry="3.8" fill={GOLD} opacity=".45" />
  </>
);
const Eyes = ({ dy = 0 }: { dy?: number }) => (
  <>
    <circle cx="60" cy={64 + dy} r="4.6" fill={INK} />
    <circle cx="80" cy={64 + dy} r="4.6" fill={INK} />
    <circle cx="58.6" cy={62.4 + dy} r="1.5" fill={MIST} />
    <circle cx="78.6" cy={62.4 + dy} r="1.5" fill={MIST} />
  </>
);
const Paws = () => (
  <>
    <ellipse cx="50" cy="91" rx="9" ry="6.5" fill="url(#dg4-egg)" />
    <ellipse cx="90" cy="89" rx="9" ry="6.5" fill="url(#dg4-egg)" />
  </>
);

function PoseArt({ pose, glow }: { pose: Pose; glow: boolean }) {
  const face = (() => {
    switch (pose) {
      case "welcome":
        return (
          <>
            <Eyes />
            <path d="M64 74 Q70 80 76 74" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </>
        );
      case "waiting":
        return (
          <>
            <Eyes dy={-3} />
            <circle cx="70" cy="76" r="2.6" fill={INK} />
          </>
        );
      case "success":
        return (
          <>
            <path d="M54.5 65 Q60 59 65.5 65" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M74.5 65 Q80 59 85.5 65" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M62 72 Q70 82 78 72 Z" fill={INK} />
          </>
        );
      case "error":
        return (
          <>
            <Eyes dy={1.5} />
            <path d="M53 57 L63 54" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M87 57 L77 54" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M63 77 Q66.5 74 70 77 T77 77" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );
    }
  })();
  const tilt = pose === "error" ? "rotate(-9 80 100)" : undefined;
  return (
    <>
      <Wave />
      {pose === "waiting" && (
        <>
          <circle className="w-dot w-dot-1" cx="56" cy="6" r="3.6" fill={MIST} />
          <circle className="w-dot w-dot-2" cx="70" cy="6" r="3.6" fill={MIST} />
          <circle className="w-dot w-dot-3" cx="84" cy="6" r="3.6" fill={MIST} />
        </>
      )}
      {pose === "success" && <path d="M18 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill={MIST} />}
      {pose === "error" && <path d="M22 26 Q28 36 22 42 Q16 36 22 26 Z" fill={GOLD} />}
      <g transform={tilt}>
        <Egg glow={glow} />
        <Cheeks />
        {face}
        <Boat />
        <Paws />
      </g>
    </>
  );
}

export function Doggett({
  pose,
  size = 72,
  className = "",
  decorative = false,
  glow,
}: {
  pose: Pose;
  size?: number;
  className?: string;
  decorative?: boolean;
  /** soft inner light and fur; defaults on at 120 px and up */
  glow?: boolean;
}) {
  const lit = glow ?? size >= 120;
  return (
    <svg
      viewBox="0 0 160 140"
      width={size}
      height={(size * 140) / 160}
      className={`shrink-0 overflow-visible ${className}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLES[pose]}
    >
      <Defs glow={lit} />
      <PoseArt pose={pose} glow={lit} />
    </svg>
  );
}
