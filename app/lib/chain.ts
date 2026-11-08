// Everything that talks to devnet.
import {
  type Address,
  type Base58EncodedBytes,
  type Instruction,
  type Signature,
  type TransactionSigner,
  createClient,
  createSolanaRpc,
  getBase58Decoder,
  getBase64Encoder,
} from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer as signerPlugin } from "@solana/kit-plugin-signer";
import { TOKEN_PROGRAM_ADDRESS, fetchMaybeToken, findAssociatedTokenPda } from "@solana-program/token";
import {
  PAYER_RECORD_DISCRIMINATOR,
  TAB_DISCRIMINATOR,
  VOUCHER_SETTLED_EVENT_DISCRIMINATOR,
  fetchMaybePayerRecord,
  fetchMaybeTab,
  findPayerRecordPda,
  findTabPda,
  getPayerRecordDecoder,
  getTabDecoder,
  getVoucherSettledEventDecoder,
  type PayerRecord,
  type VoucherSettledEvent,
} from "../generated/wherry/index.ts";
import type { TabSnapshot } from "./assess.ts";
import { MINT, PROGRAM_ID, RPC_URL } from "./config.ts";

export const rpc = createSolanaRpc(RPC_URL);
const b58 = getBase58Decoder();
const b64 = getBase64Encoder();

const decodeTabAccount = (address: Address, base64: string): TabSnapshot => ({
  ...getTabDecoder().decode(b64.encode(base64)),
  address,
});

/** All tabs and payer records: the table a shop carries offline. */
export async function fetchSnapshot() {
  const byDisc = (disc: Uint8Array) =>
    rpc
      .getProgramAccounts(PROGRAM_ID, {
        encoding: "base64",
        filters: [{ memcmp: { offset: 0n, bytes: b58.decode(disc) as Base58EncodedBytes, encoding: "base58" } }],
      })
      .send();
  const [tabs, payers] = await Promise.all([byDisc(TAB_DISCRIMINATOR as Uint8Array), byDisc(PAYER_RECORD_DISCRIMINATOR as Uint8Array)]);
  const tabMap: Record<string, TabSnapshot> = {};
  for (const t of tabs) tabMap[t.pubkey] = decodeTabAccount(t.pubkey, t.account.data[0]);
  const payerMap: Record<string, PayerRecord> = {};
  for (const p of payers) {
    const record = getPayerRecordDecoder().decode(b64.encode(p.account.data[0]));
    payerMap[record.owner] = record;
  }
  return { at: Date.now(), tabs: tabMap, payers: payerMap };
}

/** The open tab paired with this phone key, newest first. */
export async function findTabForDevice(devicePk: Uint8Array): Promise<TabSnapshot | null> {
  const found = await rpc
    .getProgramAccounts(PROGRAM_ID, {
      encoding: "base64",
      filters: [
        { memcmp: { offset: 0n, bytes: b58.decode(TAB_DISCRIMINATOR as Uint8Array) as Base58EncodedBytes, encoding: "base58" } },
        { memcmp: { offset: 48n, bytes: b58.decode(devicePk) as Base58EncodedBytes, encoding: "base58" } },
      ],
    })
    .send();
  const tabs = found.map((t) => decodeTabAccount(t.pubkey, t.account.data[0]));
  tabs.sort((a, b) => Number(b.expiresAt - a.expiresAt));
  return tabs[0] ?? null;
}

export async function fetchPayer(owner: Address) {
  const [pda] = await findPayerRecordPda({ owner });
  const r = await fetchMaybePayerRecord(rpc, pda);
  return r.exists ? r.data : null;
}

/** Every tab an owner has opened that still exists (closed tabs are gone onchain). */
export async function fetchOwnerTabs(owner: Address) {
  const payer = await fetchPayer(owner);
  const ids = Array.from({ length: payer?.tabsOpened ?? 0 }, (_, i) => BigInt(i));
  const tabs = await Promise.all(
    ids.map(async (tabId) => {
      const [address] = await findTabPda({ owner, tabId });
      const t = await fetchMaybeTab(rpc, address);
      return t.exists ? ({ ...t.data, address } as TabSnapshot) : null;
    }),
  );
  return { payer, tabs: tabs.filter((t): t is TabSnapshot => t !== null).reverse() };
}

export async function fetchUsdBalance(owner: Address): Promise<bigint> {
  const [ata] = await findAssociatedTokenPda({ mint: MINT, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const t = await fetchMaybeToken(rpc, ata);
  return t.exists ? t.data.amount : 0n;
}

export async function fetchSolBalance(owner: Address): Promise<bigint> {
  return (await rpc.getBalance(owner).send()).value;
}

export type Settlement = VoucherSettledEvent & { signature: Signature; blockTime: number | null };

/** VoucherSettled events for a tab, newest first, read from transaction logs. */
export async function fetchSettlements(tab: Address, limit = 20): Promise<Settlement[]> {
  const sigs = await rpc.getSignaturesForAddress(tab, { limit }).send();
  const out: Settlement[] = [];
  const disc = Array.from(VOUCHER_SETTLED_EVENT_DISCRIMINATOR);
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await rpc
      .getTransaction(s.signature, { maxSupportedTransactionVersion: 1, encoding: "json", commitment: "confirmed" })
      .send();
    for (const line of tx?.meta?.logMessages ?? []) {
      if (!line.startsWith("Program data: ")) continue;
      const bytes = b64.encode(line.slice(14));
      if (disc.every((d, i) => bytes[i] === d)) {
        const ev = getVoucherSettledEventDecoder().decode(bytes.slice(8));
        if (ev.tab === tab) out.push({ ...ev, signature: s.signature, blockTime: s.blockTime === null ? null : Number(s.blockTime) });
      }
    }
  }
  return out;
}

export type Sent = { signature: Signature; seconds: number; feeLamports: bigint | null };

/** Calls `after` once the signer has signed, so confirm time excludes the time a person spends in their wallet. */
function afterSigning(s: TransactionSigner, after: () => void): TransactionSigner {
  if ("modifyAndSignTransactions" in s) {
    return { ...s, modifyAndSignTransactions: async (t, c) => { const r = await s.modifyAndSignTransactions(t, c); after(); return r; } };
  }
  if ("signTransactions" in s) {
    return { ...s, signTransactions: async (t, c) => { const r = await s.signTransactions(t, c); after(); return r; } };
  }
  return s;
}

/**
 * Send instructions as one transaction and time it from signature to confirmation.
 * Version 1 (4,096 bytes) for settlement batches; 0 for wallets that may not sign v1 yet.
 */
export async function send(
  signer: TransactionSigner,
  build: (signer: TransactionSigner) => Instruction[] | Promise<Instruction[]>,
  version: 0 | 1,
  onSigned?: () => void,
): Promise<Sent> {
  let signedAt = 0;
  // Instructions must use this same signer object: Kit rejects two distinct signers for one address.
  const timed = afterSigning(signer, () => ((signedAt = performance.now()), onSigned?.()));
  const client = createClient()
    .use(signerPlugin(timed))
    .use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig: { version } }));
  const instructions = await build(timed);
  const started = performance.now();
  const result = await client.sendTransaction(instructions);
  const seconds = (performance.now() - (signedAt || started)) / 1000;
  const signature = result.context.signature as Signature;
  let feeLamports: bigint | null = null;
  try {
    const tx = await rpc
      .getTransaction(signature, { maxSupportedTransactionVersion: 1, encoding: "json", commitment: "confirmed" })
      .send();
    feeLamports = tx?.meta ? BigInt(tx.meta.fee) : null;
  } catch {
    // The fee is a nice-to-have; the confirmation already happened.
  }
  return { signature, seconds, feeLamports };
}
