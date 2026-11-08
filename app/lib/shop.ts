// The accepting shop: its own key (pays settlement fees), its offline tab table, its queue, its limits.
import { type Instruction, type KeyPairSigner, type TransactionSigner, createSignerFromKeyPair, generateKeyPair, signBytes } from "@solana/kit";
import { get, set, update } from "idb-keyval";
import { findPayerRecordPda, getSettleInstructionAsync, getWherryErrorMessage } from "../generated/wherry/index.ts";
import { DEFAULT_RISK, type PayerSnapshot, type RiskSettings, type TabSnapshot } from "./assess.ts";
import { encodeCourierAuth, type SignedVoucher } from "./codes.ts";
import { fetchSnapshot, send, type Sent } from "./chain.ts";
import { PROGRAM_ID } from "./config.ts";
import { courierAuthBytes, ed25519Instruction, voucherBytes } from "./voucher.ts";

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
    if (typeof code === "number" && code >= 6000 && code <= 6022) {
      return { message: getWherryErrorMessage(code as Parameters<typeof getWherryErrorMessage>[0]), final: true };
    }
  }
  const text = e instanceof Error ? e.message : String(e);
  if (/insufficient (funds|lamports)|AccountNotFound|no record of a prior credit/i.test(text)) {
    return { message: "This shop needs a little devnet SOL for fees. Use “Get fee money”.", final: false };
  }
  return { message: text.length > 160 ? `${text.slice(0, 160)}…` : text, final: false };
}

/** One settlement step: either one v1 transaction for up to BATCH vouchers, or one v0 transaction per voucher sent in parallel. */
/** Vouchers per v1 settlement transaction: 5 measured at about 2.2 KB of 4,096 (tests/wherry.test.ts). */
export const BATCH = 5;

export type BatchResult = {
  codes: string[];
  /** Every transaction that landed for these vouchers. */
  sents: Sent[];
  /** Vouchers that didn't settle, with the reason. */
  failed: { code: string; error: string; final: boolean }[];
};

async function settleOne(shop: KeyPairSigner, items: Queued[], snap: Snapshot, version: 0 | 1) {
  const codes = items.map((i) => i.code);
  try {
    const sent = await send(shop, (s) => settleIxs(s, items, snap), version);
    await patch(codes, { status: "settled", sent, error: undefined });
    return { sent };
  } catch (e) {
    const { message, final } = explainError(e);
    // Program refusals are final; network or fee problems stay pending so the shop can retry.
    await patch(codes, final ? { status: "failed", error: message } : { error: message });
    return { error: message, final };
  }
}

/** Fallback for anything that can't take a v1 transaction: one (ed25519, settle) pair per v0 transaction, in parallel. */
async function settleSingles(shop: KeyPairSigner, items: Queued[], snap: Snapshot): Promise<BatchResult> {
  const outcomes = await Promise.all(items.map((item) => settleOne(shop, [item], snap, 0)));
  return {
    codes: items.map((i) => i.code),
    sents: outcomes.flatMap((o) => (o.sent ? [o.sent] : [])),
    failed: outcomes.flatMap((o, i) => (o.error ? [{ code: items[i].code, error: o.error, final: !!o.final }] : [])),
  };
}

/**
 * Settle every pending voucher, up to BATCH per v1 transaction (even 3 inline Ed25519 checks need 1,536 bytes,
 * over the 1,232-byte legacy limit). If a v1 batch fails, or `forceV0` is set, fall back to one v0
 * transaction per voucher, sent in parallel, so one bad voucher or a v1-shy RPC doesn't block the rest.
 */
export async function settleAll(onBatch: (r: BatchResult) => void, opts: { forceV0?: boolean } = {}): Promise<BatchResult[]> {
  const shop = await shopSigner();
  const snap = await syncSnapshot();
  const queued = (await loadQueue()).filter((q) => q.status === "pending");
  // Vouchers a courier already settled for this shop: mark them settled instead of sending them again.
  const doneOnchain = queued.filter((q) => {
    const used = snap.tabs[q.v.tab]?.used;
    return used && q.v.serial < 1024 && (used[q.v.serial >> 3] & (1 << (q.v.serial & 7))) !== 0;
  });
  if (doneOnchain.length) await patch(doneOnchain.map((q) => q.code), { status: "settled", error: "settled by a courier" });
  const pending = queued.filter((q) => !doneOnchain.includes(q)).reverse();
  const results: BatchResult[] = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    let r: BatchResult;
    if (opts.forceV0) {
      r = await settleSingles(shop, batch, snap);
    } else {
      const v1 = await settleOne(shop, batch, snap, 1);
      r = v1.sent
        ? { codes: batch.map((b) => b.code), sents: [v1.sent], failed: [] }
        : batch.length > 1
          ? await settleSingles(shop, batch, snap)
          : { codes: batch.map((b) => b.code), sents: [], failed: [{ code: batch[0].code, error: v1.error!, final: !!v1.final }] };
    }
    results.push(r);
    onBatch(r);
  }
  return results;
}

/** The shop's consent for a courier: one signed authorization per tab it holds vouchers from, plus those vouchers. */
export async function courierBundle(maxFeeBps = 100, maxFeeAbs = 50_000n, hours = 48): Promise<{ text: string; count: number }> {
  const shop = await shopSigner();
  const pending = (await loadQueue()).filter((q) => q.status === "pending");
  const tabs = [...new Set(pending.map((q) => q.v.tab))];
  const authExpiresAt = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
  const lines = pending.map((q) => q.code);
  for (const tab of tabs) {
    const authNonce = crypto.getRandomValues(new Uint8Array(16));
    const msg = courierAuthBytes({ programId: PROGRAM_ID, merchant: shop.address, tab, maxFeeBps, maxFeeAbs, authExpiresAt, authNonce });
    const signature = new Uint8Array(await signBytes(shop.keyPair.privateKey, msg));
    lines.push(encodeCourierAuth({ merchant: shop.address, tab, maxFeeBps, maxFeeAbs, authExpiresAt, authNonce, signature }));
  }
  return { text: lines.join("\n"), count: pending.length };
}
