import type { CSSProperties, ReactNode } from "react";
import { formatUsd, serialLabel, shortAddress } from "../lib/config.ts";

/**
 * A ferry ticket (the voucher): emerald card stock like a banknote, serial, destination shop, mono fare,
 * a perforated stub with punched notches. When collected, a vermilion stamp lands and the stub tears off.
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
  /** e.g. "0.7 s": shows the COLLECTED stamp and tears the stub */
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
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm font-medium opacity-80">Wherry ferry ticket</span>
          <span className="mono whitespace-nowrap text-sm opacity-80">{serialLabel(serial)}</span>
        </header>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm opacity-80">Pay to</span>
          <span className="display truncate text-2xl">{shopName}</span>
        </div>
        {qr && <div className="w-fit max-w-full rounded-lg bg-surface p-2">{qr}</div>}
        <div className="flex flex-col gap-1">
          <span className="mono text-4xl leading-none">{formatUsd(amount)}</span>
          {tab && <span className="mono truncate text-xs opacity-75">from tab {shortAddress(tab)}</span>}
        </div>
      </div>
      <div
        aria-hidden
        className={`flex w-16 shrink-0 flex-col items-center justify-between border-l-2 border-dashed border-on-brand/40 py-5 ${stamp ? "w-tear" : ""}`}
      >
        <span className="mono text-xs opacity-80 [writing-mode:vertical-rl]">{serialLabel(serial)}</span>
        <span className="display text-base [writing-mode:vertical-rl]">Wherry</span>
      </div>
      {stamp && (
        <span className="stamp w-stamp absolute bottom-5 right-20 z-[2]">
          Collected
          <span className="text-xs normal-case tracking-normal">{stamp}</span>
        </span>
      )}
    </article>
  );
}
