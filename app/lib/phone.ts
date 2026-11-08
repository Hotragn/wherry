// The paying phone: a non-extractable Ed25519 key in IndexedDB that signs vouchers offline.
import { type Address, generateKeyPair, signBytes } from "@solana/kit";
import { get, set, update } from "idb-keyval";
import type { TabSnapshot } from "./assess.ts";
import { encodeVoucher } from "./codes.ts";
import { PROGRAM_ID } from "./config.ts";
import { voucherBytes } from "./voucher.ts";

export type IssuedVoucher = {
  code: string;
  tab: Address;
  serial: number;
  amount: bigint;
  merchant: Address;
  shopName: string;
  createdAt: number;
};

/** The phone key. Created once; the private half can never leave the browser. */
export async function deviceKey(): Promise<{ pair: CryptoKeyPair; pk: Uint8Array }> {
  let pair = await get<CryptoKeyPair>("phone:key");
  if (!pair) {
    pair = await generateKeyPair();
    await set("phone:key", pair);
  }
  return { pair, pk: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)) };
}

export const loadTab = () => get<{ tab: TabSnapshot; syncedAt: number }>("phone:tab");
export const saveTab = (tab: TabSnapshot) => set("phone:tab", { tab, syncedAt: Date.now() });
export const loadHistory = async () => (await get<IssuedVoucher[]>("phone:history")) ?? [];

/** Reserve the next serial before signing, so a serial is never reused even if the app closes mid-payment. */
async function reserveSerial(tab: TabSnapshot): Promise<number> {
  let highestOnchain = -1;
  tab.used.forEach((byte, i) => {
    for (let b = 0; b < 8; b++) if (byte & (1 << b)) highestOnchain = i * 8 + b;
  });
  let serial = 1; // serials start at 1 so the first voucher reads "No. 0001"
  await update<number>(`phone:next:${tab.address}`, (next) => {
    serial = Math.max(next ?? 1, highestOnchain + 1);
    return serial + 1;
  });
  if (serial >= 1024) throw new Error("This tab has used all its voucher numbers. Open a new tab.");
  return serial;
}

/** Sign a voucher for `amount` to a shop. Works offline.
 *  Game vouchers pass `round`: nonce bytes 0–3 carry the studio's seed round (u32 LE), the rest stays random. */
export async function payShop(tab: TabSnapshot, shop: { merchant: Address; name: string }, amount: bigint, round?: number): Promise<IssuedVoucher> {
  const { pair, pk } = await deviceKey();
  const serial = await reserveSerial(tab);
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  if (round !== undefined) new DataView(nonce.buffer).setUint32(0, round, true);
  const fields = {
    tab: tab.address,
    mint: tab.mint,
    amount,
    serial,
    voucherExpiresAt: tab.expiresAt,
    nonce,
  };
  const message = voucherBytes({ ...fields, programId: PROGRAM_ID, merchant: shop.merchant });
  const signature = new Uint8Array(await signBytes(pair.privateKey, message));
  const issued: IssuedVoucher = {
    code: encodeVoucher({ ...fields, devicePk: pk, signature }),
    tab: tab.address,
    serial,
    amount,
    merchant: shop.merchant,
    shopName: shop.name,
    createdAt: Date.now(),
  };
  await update<IssuedVoucher[]>("phone:history", (h) => [issued, ...(h ?? [])]);
  return issued;
}
