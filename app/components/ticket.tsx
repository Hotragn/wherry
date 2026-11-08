import type { CSSProperties, ReactNode } from "react";
import { formatUsd, serialLabel, shortAddress } from "../lib/config.ts";

/**
 * A ferry ticket (the voucher): saffron card stock, serial, destination shop, mono fare,
 * a perforated stub with punched notches. When collected, a stamp lands and the stub tears off.
 */
export function Ticket({
  serial,
  shopName,
  amount,
  tab,
  qr,
  stamp,
  onPaper = false,
}: {
  serial: number;
  shopName: string;
  amount: bigint;
  tab?: string;
  qr?: ReactNode;
  /** e.g. "0.7 s": shows the green COLLECTED stamp and tears the stub */
  stamp?: string;
  /** true when the ticket sits on a surface panel, so the notches match it */
  onPaper?: boolean;
}) {
  const style = { "--notch-bg": onPaper ? "var(--w-surface)" : "var(--w-base)" } as CSSProperties;
  return (
    <article
      className="ticket flex w-full max-w-sm"
      style={style}
      aria-label={`Ferry ticket ${serialLabel(serial)}, ${formatUsd(amount)}, to ${shopName}${stamp ? ", collected" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 pr-5">
        <header className="flex items-baseline justify-between gap-3">
          <span className="label text-ink">Wherry ferry</span>
          <span className="mono text-sm">{serialLabel(serial)}</span>
        </header>
        <div className="flex flex-col">
          <span className="label text-ink">Admit one crossing to</span>
          <span className="display truncate text-2xl">{shopName}</span>
        </div>
        {qr && <div className="w-fit max-w-full rounded-sm border-2 border-ink bg-surface p-1">{qr}</div>}
        <div className="flex items-end justify-between gap-2">
          <span className="mono text-4xl leading-none">{formatUsd(amount)}</span>
          {tab && !stamp && <span className="mono whitespace-nowrap text-xs">tab {shortAddress(tab)}</span>}
        </div>
      </div>
      <div
        aria-hidden
        className={`flex w-16 shrink-0 flex-col items-center justify-between border-l-[3px] border-dotted border-ink py-4 ${stamp ? "w-tear" : ""}`}
      >
        <span className="mono text-xs [writing-mode:vertical-rl]">{serialLabel(serial)}</span>
        <span className="display text-lg [writing-mode:vertical-rl]">Wherry</span>
      </div>
      {stamp && (
        <span className="stamp w-stamp absolute right-20 top-1/3 z-[2]">
          Collected
          <span className="text-xs normal-case tracking-normal">{stamp}</span>
        </span>
      )}
    </article>
  );
}
