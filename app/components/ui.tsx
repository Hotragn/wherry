"use client";

import { useState } from "react";
import { encode } from "uqr";
import { explorerAddress, explorerTx, formatUsd, shortAddress } from "../lib/config.ts";

export const Money = ({ units, className = "" }: { units: bigint; className?: string }) => (
  <span className={`mono ${className}`}>{formatUsd(units)}</span>
);

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** An address in mono with a middle ellipsis, a copy button and an Explorer link. */
export function Addr({ value, chars = 4, explorer = true }: { value: string; chars?: number; explorer?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="mono text-sm" title={value}>
        {shortAddress(value, chars)}
      </span>
      <CopyButton text={value} />
      {explorer && (
        <a className="link text-sm" href={explorerAddress(value)} target="_blank" rel="noreferrer">
          Explorer
        </a>
      )}
    </span>
  );
}

export const TxLink = ({ signature, children }: { signature: string; children?: React.ReactNode }) => (
  <a className="link" href={explorerTx(signature)} target="_blank" rel="noreferrer">
    {children ?? <span className="mono text-sm">{shortAddress(signature, 6)}</span>}
  </a>
);

export function QrCode({ text, size = 232, label }: { text: string; size?: number; label: string }) {
  const { data, size: n } = encode(text, { ecc: "M", border: 3 });
  let d = "";
  data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges" className="block max-w-full h-auto">
      <rect width={n} height={n} fill="var(--w-surface)" />
      <path d={d} fill="var(--w-ink)" />
    </svg>
  );
}

/** Ok / err / warn line: never colour alone, always a word and a mark. */
export function Signal({ tone, children }: { tone: "ok" | "err" | "warn"; children: React.ReactNode }) {
  const mark = tone === "ok" ? "✓" : tone === "err" ? "✕" : "!";
  const color = tone === "ok" ? "text-ok" : tone === "err" ? "text-err" : "text-warn";
  return (
    <p className={`flex gap-2 ${color}`}>
      <span aria-hidden className="mono w-4 shrink-0 text-center font-bold">
        {mark}
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="text-lg">{children}</span>
    </div>
  );
}

/** A plain word with its technical term tucked in a "what's this?" note. */
export function WhatsThis({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-bold underline decoration-accent decoration-2 underline-offset-4 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="mono">?</span> What&apos;s this?
      </summary>
      <p className="mt-2 max-w-sm border-l-[3px] border-accent pl-3 text-muted">
        <span className="mono text-ink">{term}.</span> {children}
      </p>
    </details>
  );
}
