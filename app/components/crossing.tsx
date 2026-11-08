import { formatUsd, serialLabel } from "../lib/config.ts";

export type Boat = {
  id: string;
  serial: number;
  amount: bigint;
  where: "near" | "far" | "stuck";
  /** e.g. "0.7 s" on the far bank, or why it's stuck */
  note?: string;
  /** just crossed: animate the arrival */
  arriving?: boolean;
};

export function BoatGlyph({ where = "near", size = 28 }: { where?: Boat["where"]; size?: number }) {
  const sail = where === "far" ? "var(--w-ok)" : where === "stuck" ? "var(--w-err)" : "var(--w-accent)";
  return (
    <svg viewBox="0 0 28 20" width={size} height={(size * 20) / 28} aria-hidden className="shrink-0">
      <path d="M2 13 Q14 14.5 26 12 Q24 18.5 15 18.8 Q6 19 2 13 Z" fill="var(--w-ink)" />
      <line x1="14" y1="13" x2="14" y2="2" stroke="var(--w-ink)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 3 L22 7 L23 12 L15 12.5 Z" fill={sail} stroke="var(--w-ink)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Engraved river: parallel hand-cut wave lines with a few soundings, like an Admiralty chart. */
export function River({ vertical, soundings = ["4", "3½", "5", "2¾"] }: { vertical: boolean; soundings?: string[] }) {
  const lines = [0, 1, 2, 3, 4];
  const wave = (i: number) =>
    vertical
      ? `M${16 + i * 14} 0 q 5 20 0 40 ${"t 0 40 ".repeat(11)}`
      : `M0 ${10 + i * 11} q 20 5 40 0 ${"t 40 0 ".repeat(11)}`;
  return (
    <div className={`relative ${vertical ? "h-full min-h-48 w-full" : "h-16 w-full"}`} aria-hidden>
      <svg viewBox={vertical ? "0 0 88 480" : "0 0 480 64"} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {lines.map((i) => (
          <path
            key={i}
            d={wave(i)}
            fill="none"
            stroke="var(--w-ink)"
            strokeWidth={i % 2 ? 1 : 2}
            strokeOpacity={i % 2 ? 0.4 : 0.85}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {soundings.map((s, i) => (
        <span
          key={i}
          className="mono absolute text-xs text-muted"
          style={vertical ? { top: `${14 + i * 22}%`, left: i % 2 ? "58%" : "22%" } : { left: `${10 + i * 24}%`, top: i % 2 ? "58%" : "8%" }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function Bank({ title, sub, boats, empty }: { title: string; sub: string; boats: Boat[]; empty: string }) {
  return (
    <div className="paper flex min-w-0 flex-col gap-3 p-4">
      <div>
        <h3 className="text-2xl">{title}</h3>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      {boats.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {boats.map((b) => (
            <li key={b.id} className={`flex items-center gap-3 ${b.arriving ? "w-arrive" : ""}`}>
              <BoatGlyph where={b.where} />
              <span className="mono w-[78px] shrink-0 text-sm">{serialLabel(b.serial)}</span>
              <span className="mono text-lg">{formatUsd(b.amount)}</span>
              {b.note && <span className={`truncate text-sm ${b.where === "stuck" ? "text-err" : "text-muted"}`}>{b.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The Crossing: vouchers wait on the near bank (signed offline) and cross when settled onchain. */
export function Crossing({ boats }: { boats: Boat[] }) {
  return (
    <section
      aria-label="The Crossing: vouchers checked offline on the near bank, settled onchain on the far bank"
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)]"
    >
      <Bank title="Near bank" sub="Checked offline, waiting to collect" boats={boats.filter((b) => b.where !== "far")} empty="No tickets waiting." />
      <div className="hidden sm:block">
        <River vertical />
      </div>
      <div className="sm:hidden">
        <River vertical={false} />
      </div>
      <Bank title="Far bank" sub="Collected: paid onchain" boats={boats.filter((b) => b.where === "far")} empty="Nothing collected yet." />
    </section>
  );
}
