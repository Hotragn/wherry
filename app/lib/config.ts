import { address } from "@solana/kit";
import { WHERRY_PROGRAM_ADDRESS } from "../generated/wherry/index.ts";

/** Devnet only. */
export const PROGRAM_ID = WHERRY_PROGRAM_ADDRESS;
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const MINT = address(
  process.env.NEXT_PUBLIC_WHERRY_MINT || "DQRut6HQcdzu1bpKFzYRCPYfW1u7MCHso2EVGK6tuFs",
);
export const CHAIN = "solana:devnet";

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export const explorerAddress = (account: string) =>
  `https://explorer.solana.com/address/${account}?cluster=devnet`;

/** Test USD has 6 decimals. The UI works in cents. */
const UNIT = 1_000_000n;

export function formatUsd(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const v = units < 0n ? -units : units;
  const cents = (v % UNIT) / 10_000n;
  return `${sign}$${(v / UNIT).toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
}

/** "3.50", "$3.5", "12" -> base units. Null for anything else (max 2 decimals, 7 digits). */
export function parseUsd(text: string): bigint | null {
  const m = /^\s*\$?\s*(\d{1,7})(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return BigInt(m[1]) * UNIT + BigInt((m[2] ?? "").padEnd(2, "0")) * 10_000n;
}

export const shortAddress = (a: string, n = 4) => (a.length > 2 * n + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);

/** "No. 0007" */
export const serialLabel = (serial: number) => `No. ${String(serial).padStart(4, "0")}`;

/** Unix seconds now. For event handlers; render code uses useNow(). */
export const unixNow = () => Math.floor(Date.now() / 1000);

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
