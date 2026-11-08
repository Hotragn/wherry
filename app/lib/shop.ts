// The accepting shop: its own key (pays settlement fees), its offline tab table, its queue, its limits.
import { type Instruction, type KeyPairSigner, type TransactionSigner, createSignerFromKeyPair, generateKeyPair } from "@solana/kit";
import { get, set, update } from "idb-keyval";
import { findPayerRecordPda, getSettleInstructionAsync, getWherryErrorMessage } from "../generated/wherry/index.ts";
import { DEFAULT_RISK, type PayerSnapshot, type RiskSettings, type TabSnapshot } from "./assess.ts";
import type { SignedVoucher } from "./codes.ts";
import { fetchSnapshot, send, type Sent } from "./chain.ts";
import { PROGRAM_ID } from "./config.ts";
import { ed25519Instruction, voucherBytes } from "./voucher.ts";

export type Snapshot = { at: number; tabs: Record<string, TabSnapshot>; payers: Record<string, PayerSnapshot> };

export type Queued = {
  code: string;
  v: SignedVoucher;
  acceptedAt: number;
  verifyMs: number;
  status: "pending" | "settled" | "failed";
  sent?: Sent;
  error?: string;
};

export async function shopSigner(): Promise<KeyPairSigner> {
  let pair = await get<CryptoKeyPair>("shop:key");
  if (!pair) {
    pair = await generateKeyPair();
    await set("shop:key", pair);
  }
  return createSignerFromKeyPair(pair);
}

export const loadName = async () => (await get<string>("shop:name")) ?? "";
export const saveName = (name: string) => set("shop:name", name.trim().slice(0, 40));
export const loadQueue = async () => (await get<Queued[]>("shop:queue")) ?? [];
export const loadSnapshot = () => get<Snapshot>("shop:snapshot");
export const loadRisk = async () => (await get<RiskSettings>("shop:risk")) ?? DEFAULT_RISK;
export const saveRisk = (r: RiskSettings) => set("shop:risk", r);

export async function syncSnapshot(): Promise<Snapshot> {
  const snap = await fetchSnapshot();
  await set("shop:snapshot", snap);
  return snap;
}

export async function enqueue(item: Queued) {
  await update<Queued[]>("shop:queue", (q) => [item, ...(q ?? [])]);
}

async function patch(codes: string[], change: Partial<Queued>) {
  await update<Queued[]>("shop:queue", (q) => (q ?? []).map((x) => (codes.includes(x.code) ? { ...x, ...change } : x)));
}

async function settleIxs(shop: TransactionSigner, items: Queued[], snap: Snapshot | undefined): Promise<Instruction[]> {
  const ixs: Instruction[] = [];
  for (const { v } of items) {
    const owner = snap?.tabs[v.tab]?.owner;
    if (!owner) throw new Error(`Tab ${v.tab} is not in your tab list. Sync first.`);
    const [payerRecord] = await findPayerRecordPda({ owner });
    const message = voucherBytes({ ...v, programId: PROGRAM_ID, merchant: shop.address });
    ixs.push(
      ed25519Instruction(v.devicePk, v.signature, message),
      await getSettleInstructionAsync({
        merchant: shop,
        tab: v.tab,
        payerRecord,
        mint: v.mint,
        serial: v.serial,
        amount: v.amount,
        voucherExpiresAt: v.voucherExpiresAt,
        nonce: v.nonce,
      }),
    );
  }
  return ixs;
}

/** Plain words for a failed send. `final` means the program refused it, so retrying won't help. */
export function explainError(e: unknown): { message: string; final: boolean } {
  for (let cur: unknown = e; cur; cur = (cur as { cause?: unknown }).cause) {
    const code = (cur as { context?: { code?: unknown } }).context?.code;
    if (typeof code === "number" && code >= 6000 && code <= 6018) {
      return { message: getWherryErrorMessage(code as Parameters<typeof getWherryErrorMessage>[0]), final: true };
    }
  }
  const text = e instanceof Error ? e.message : String(e);
  if (/insufficient (funds|lamports)|AccountNotFound|no record of a prior credit/i.test(text)) {
    return { message: "This shop needs a little devnet SOL for fees. Use “Get fee money”.", final: false };
  }
  return { message: text.length > 160 ? `${text.slice(0, 160)}…` : text, final: false };
}

export type BatchResult = { codes: string[]; sent?: Sent; error?: string; final?: boolean };

/**
 * Settle every pending voucher, up to 3 per transaction. If a batch fails,
 * retry its vouchers one by one so a single bad voucher doesn't block the rest.
 */
export async function settleAll(onBatch: (r: BatchResult) => void): Promise<BatchResult[]> {
  const shop = await shopSigner();
  const snap = await syncSnapshot();
  const pending = (await loadQueue()).filter((q) => q.status === "pending").reverse();
  const results: BatchResult[] = [];
  const run = async (items: Queued[]) => {
    const codes = items.map((i) => i.code);
    try {
      const sent = await send(shop, (s) => settleIxs(s, items, snap), 1);
      await patch(codes, { status: "settled", sent, error: undefined });
      return { codes, sent };
    } catch (e) {
      const { message, final } = explainError(e);
      // Program refusals are final; network or fee problems stay pending so the shop can retry.
      await patch(codes, final ? { status: "failed", error: message } : { error: message });
      return { codes, error: message, final };
    }
  };
  for (let i = 0; i < pending.length; i += 3) {
    const batch = pending.slice(i, i + 3);
    const r = await run(batch);
    if (r.error && r.final && batch.length > 1) {
      for (const item of batch) {
        const single = await run([item]);
        results.push(single);
        onBatch(single);
      }
      continue;
    }
    results.push(r);
    onBatch(r);
  }
  return results;
}
