// Doggett's Crossing: power-ups bought offline with vouchers, bonus drops proven by commit/reveal.
import { type Address, type TransactionSigner, getBase64Encoder } from "@solana/kit";
import { get, set, update } from "idb-keyval";
import {
  SEED_REVEALED_EVENT_DISCRIMINATOR,
  fetchMaybeGameConfig,
  findGamePda,
  getCommitSeedInstructionAsync,
  getRevealSeedInstructionAsync,
  getSeedRevealedEventDecoder,
} from "../generated/wherry/index.ts";
import type { TabSnapshot } from "./assess.ts";
import { rpc, send, type Sent } from "./chain.ts";
import { decodeVoucher } from "./codes.ts";
import { sha256 } from "./fair.ts";
import { payShop, type IssuedVoucher } from "./phone.ts";

export const POWER_UP = { name: "Full sail", price: 500_000n, effect: "Rows twice as far" } as const;

export type Studio = { merchant: Address; name: string };
/** The studio's commitment as this phone saw it, before buying. */
export type Commitment = { epoch: number; hash: Uint8Array; seenAt: number };
export type Purchase = { code: string; serial: number; nonce: Uint8Array; tab: Address; studio: Address; commitment?: Commitment; createdAt: number };

const isZero = (b: ArrayLike<number>) => Array.from(b).every((x) => x === 0);

async function gameConfig(studio: Address) {
  const [game] = await findGamePda({ studio });
  const c = await fetchMaybeGameConfig(rpc, game);
  return { game, config: c.exists ? c.data : null };
}

// ---------- player ----------
export const loadStudio = () => get<Studio>("play:studio");
export const saveStudio = (s: Studio) => set("play:studio", s);
export const loadCommitment = () => get<Commitment>("play:commitment");
export const loadPurchases = async () => (await get<Purchase[]>("play:purchases")) ?? [];
export const loadCrossings = async () => (await get<number>("play:crossings")) ?? 0;
export const saveCrossings = (n: number) => set("play:crossings", n);

/** Fetch the studio's current commitment (online). Null if it has nothing committed. */
export async function syncCommitment(studio: Address): Promise<Commitment | null> {
  const { config } = await gameConfig(studio);
  const commitment = config && !isZero(config.seedCommitment) ? { epoch: config.epoch, hash: new Uint8Array(config.seedCommitment), seenAt: Date.now() } : null;
  await set("play:commitment", commitment ?? undefined);
  return commitment;
}

/** Buy the power-up with a voucher. Signed and unlocked on this device, no network needed. */
export async function buyPowerUp(tab: TabSnapshot, studio: Studio): Promise<{ purchase: Purchase; voucher: IssuedVoucher }> {
  const voucher = await payShop(tab, studio, POWER_UP.price);
  const purchase: Purchase = {
    code: voucher.code,
    serial: voucher.serial,
    nonce: decodeVoucher(voucher.code)!.nonce,
    tab: tab.address,
    studio: studio.merchant,
    commitment: (await loadCommitment()) ?? undefined,
    createdAt: Date.now(),
  };
  await update<Purchase[]>("play:purchases", (p) => [purchase, ...(p ?? [])]);
  return { purchase, voucher };
}

/** The seed the studio revealed for `epoch`: from the account if it's the latest, else from SeedRevealed events. */
export async function revealedSeed(studio: Address, epoch: number): Promise<Uint8Array | null> {
  const { game, config } = await gameConfig(studio);
  if (!config || config.epoch <= epoch) return null;
  if (config.epoch === epoch + 1) return new Uint8Array(config.lastRevealedSeed);
  const disc = Array.from(SEED_REVEALED_EVENT_DISCRIMINATOR);
  const b64 = getBase64Encoder();
  for (const s of await rpc.getSignaturesForAddress(game, { limit: 50 }).send()) {
    const tx = await rpc.getTransaction(s.signature, { maxSupportedTransactionVersion: 1, encoding: "json" }).send();
    for (const line of tx?.meta?.logMessages ?? []) {
      if (!line.startsWith("Program data: ")) continue;
      const bytes = b64.encode(line.slice(14));
      if (!disc.every((d, i) => bytes[i] === d)) continue;
      const ev = getSeedRevealedEventDecoder().decode(bytes.slice(8));
      if (ev.epoch === epoch) return new Uint8Array(ev.seed);
    }
  }
  return null;
}

// ---------- studio (the shop key) ----------
export async function studioState(studio: Address) {
  const { config } = await gameConfig(studio);
  return config && { epoch: config.epoch, committed: !isZero(config.seedCommitment), hash: new Uint8Array(config.seedCommitment) };
}

/** Commit to a fresh secret seed. The seed stays in this browser until the reveal. */
export async function commitSeed(signer: TransactionSigner, onSigned?: () => void): Promise<Sent> {
  const state = await studioState(signer.address);
  const epoch = state?.epoch ?? 0;
  const seed = crypto.getRandomValues(new Uint8Array(32));
  await set(`studio:seed:${signer.address}:${epoch}`, seed);
  const seedHash = await sha256(seed);
  return send(signer, async (s) => [await getCommitSeedInstructionAsync({ studio: s, seedHash })], 0, onSigned);
}

/** Reveal the committed seed and commit the next one in the same transaction. */
export async function revealSeed(signer: TransactionSigner, onSigned?: () => void): Promise<Sent> {
  const state = await studioState(signer.address);
  if (!state?.committed) throw new Error("Nothing is committed yet.");
  const seed = await get<Uint8Array>(`studio:seed:${signer.address}:${state.epoch}`);
  if (!seed) throw new Error("This browser doesn't hold the committed seed, so it can't reveal it.");
  const next = crypto.getRandomValues(new Uint8Array(32));
  await set(`studio:seed:${signer.address}:${state.epoch + 1}`, next);
  const nextHash = await sha256(next);
  return send(signer, async (s) => [await getRevealSeedInstructionAsync({ studio: s, seed, nextHash })], 0, onSigned);
}
