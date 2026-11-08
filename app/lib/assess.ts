// What a shop decides about a voucher, offline. Pure: no network, no storage.
import type { Address } from "@solana/kit";
import type { PayerRecord, Tab } from "../generated/wherry/index.ts";
import type { SignedVoucher } from "./codes.ts";
import { formatUsd, serialLabel } from "./config.ts";

export type TabSnapshot = Tab & { address: Address };
export type PayerSnapshot = PayerRecord;
export type RiskSettings = { perCustomer: bigint; total: bigint };
/** A voucher this shop accepted and has not settled yet. */
export type Pending = { tab: Address; serial: number; amount: bigint };

export const DEFAULT_RISK: RiskSettings = { perCustomer: 15_000_000n, total: 50_000_000n };

export type Assessment = {
  decision: "accept" | "decline";
  /** One plain sentence for the shopkeeper. */
  headline: string;
  /** Amber notes that don't block: stale or missing sync. */
  warnings: string[];
  /** Escrow left in the tab after this shop's other unsettled vouchers, before this one. */
  coverageLeft?: bigint;
  /** Which limit tripped, if any. */
  tripped?: "perCustomer" | "total";
};

const sum = (xs: Pending[]) => xs.reduce((a, p) => a + p.amount, 0n);
const usedBit = (used: ArrayLike<number>, serial: number) => serial < 1024 && (used[serial >> 3] & (1 << (serial & 7))) !== 0;
const sameKey = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);

export function assess(input: {
  v: SignedVoucher;
  signatureOk: boolean;
  tab?: TabSnapshot;
  pending: Pending[];
  /** Every voucher this shop has taken, settled or not: replays are caught even before the next sync. */
  seen?: { tab: Address; serial: number }[];
  risk: RiskSettings;
  nowSec: bigint;
  syncedAtMs?: number;
  nowMs: number;
}): Assessment {
  const { v, tab, pending, risk } = input;
  const decline = (headline: string, extra: Partial<Assessment> = {}): Assessment => ({ decision: "decline", headline, warnings: [], ...extra });

  if (!input.signatureOk) return decline("Signature doesn't match. This voucher is for another shop, or it was changed.");
  if (v.serial >= 1024) return decline("Voucher number out of range.");
  if (pending.some((p) => p.tab === v.tab && p.serial === v.serial)) {
    return decline(`Already accepted: ${serialLabel(v.serial)} is in your queue.`);
  }
  if (input.seen?.some((p) => p.tab === v.tab && p.serial === v.serial)) {
    return decline(`Replay: ${serialLabel(v.serial)} was already taken here.`);
  }
  if (input.nowSec > v.voucherExpiresAt) return decline("This voucher has expired.");

  const warnings: string[] = [];
  let coverageLeft: bigint | undefined;
  if (tab) {
    if (!sameKey(tab.deviceKey, v.devicePk)) return decline("Not signed by this tab's phone.");
    if (tab.mint !== v.mint) return decline("Wrong token for this tab.");
    if (usedBit(tab.used, v.serial)) return decline(`Already settled onchain: ${serialLabel(v.serial)}.`);
    if (v.voucherExpiresAt > tab.expiresAt) return decline("The voucher outlives its tab.");
    if (input.nowSec > tab.settleDeadline) return decline("This tab can't be settled any more.");
    coverageLeft = tab.deposited - tab.settled - sum(pending.filter((p) => p.tab === v.tab));
    if (v.amount > coverageLeft) {
      return decline(`Not covered: only ${formatUsd(coverageLeft > 0n ? coverageLeft : 0n)} left in this tab.`, { coverageLeft });
    }
    const age = input.syncedAtMs === undefined ? Infinity : input.nowMs - input.syncedAtMs;
    if (age > 60 * 60_000) warnings.push("Your tab list is over an hour old. Other shops may have been paid since.");
  } else {
    warnings.push("Unverified tab: it wasn't in your last sync, so its escrow is unknown. You carry the risk.");
  }

  const customer = sum(pending.filter((p) => p.tab === v.tab)) + v.amount;
  if (customer > risk.perCustomer) {
    return decline(
      `Declined: this would put this customer at ${formatUsd(customer)} offline, over your ${formatUsd(risk.perCustomer)} limit for one customer.`,
      { coverageLeft, tripped: "perCustomer" },
    );
  }
  const total = sum(pending) + v.amount;
  if (total > risk.total) {
    return decline(
      `Declined: this would put your unsettled total at ${formatUsd(total)}, over your ${formatUsd(risk.total)} limit.`,
      { coverageLeft, tripped: "total" },
    );
  }

  return {
    decision: "accept",
    headline:
      coverageLeft === undefined
        ? "Signature valid. Tab not verified."
        : `Covered: ${formatUsd(coverageLeft - v.amount)} left in this tab after this sale.`,
    warnings,
    coverageLeft,
  };
}
