import type { CSSProperties, ReactNode } from "react";
import { formatUsd, serialLabel, shortAddress } from "../lib/config.ts";

/** A voucher as a paper ferry ticket: serial, shop, QR in a frame, perforation, notches, mono amount, stamp. */
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
  /** e.g. "0.7 s": shows the green SETTLED stamp */
  stamp?: string;
  /** true when the ticket sits on a surface panel, so the notches match it */
  onPaper?: boolean;
}) {
  const style = {
    "--notch-y": "calc(100% - 36px)",
    "--notch-bg": onPaper ? "var(--w-surface)" : "var(--w-base)",
  } as CSSProperties;
  return (
    <article className="ticket w-full max-w-sm" style={style} aria-label={`Voucher ${serialLabel(serial)}, ${formatUsd(amount)}, ${shopName}`}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <span className="label">{serialLabel(serial)}</span>
        <span className="truncate text-sm font-semibold">{shopName}</span>
      </header>
      {qr && <div className="mx-auto mt-3 w-fit max-w-[calc(100%-2rem)] rounded-md border-[1.5px] border-line p-1">{qr}</div>}
      <div className="perf mx-5 mt-4" />
      <footer className="flex h-[72px] items-center justify-between gap-3 px-5">
        <span className="mono text-3xl">{formatUsd(amount)}</span>
        {stamp ? (
          <span className="stamp">
            Settled
            <span className="mono text-xs normal-case tracking-normal">{stamp}</span>
          </span>
        ) : (
          tab && <span className="mono whitespace-nowrap text-sm text-muted">tab {shortAddress(tab)}</span>
        )}
      </footer>
    </article>
  );
}
