// Text payloads for every QR (and its paste-code fallback).
import {
  type Address,
  getAddressDecoder,
  getAddressEncoder,
  getI64Decoder,
  getI64Encoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  isAddress,
} from "@solana/kit";

const addrEnc = getAddressEncoder();
const addrDec = getAddressDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Phone pairing code: WP1.<device public key as an address>. */
export const pairingCode = (devicePk: Uint8Array) => `WP1.${addrDec.decode(devicePk)}`;

export function parsePairingCode(text: string): Uint8Array | null {
  const key = text.trim().replace(/^WP1\./, "");
  return isAddress(key) ? new Uint8Array(addrEnc.encode(key)) : null;
}

/** Shop sticker: WS1.<merchant address>.<shop name>. */
export const stickerCode = (merchant: Address, name: string) =>
  `WS1.${merchant}.${encodeURIComponent(name.trim().slice(0, 40))}`;

export function parseSticker(text: string): { merchant: Address; name: string } | null {
  const m = /^WS1\.([1-9A-HJ-NP-Za-km-z]{32,44})\.(.{0,200})$/.exec(text.trim());
  if (!m || !isAddress(m[1])) return null;
  try {
    return { merchant: m[1], name: decodeURIComponent(m[2]) || "Shop" };
  } catch {
    return null;
  }
}

export type SignedVoucher = {
  tab: Address;
  devicePk: Uint8Array;
  mint: Address;
  amount: bigint;
  serial: number;
  voucherExpiresAt: bigint;
  nonce: Uint8Array;
  signature: Uint8Array;
};

// tab 32 | device key 32 | mint 32 | amount 8 | serial 4 | expires 8 | nonce 16 | signature 64
const VOUCHER_CODE_LEN = 196;

/** Voucher QR: WV1.<base64url of the fields above>. The shop is implied (it rebuilds the message with its own key). */
export function encodeVoucher(v: SignedVoucher): string {
  const b = new Uint8Array(VOUCHER_CODE_LEN);
  b.set(addrEnc.encode(v.tab), 0);
  b.set(v.devicePk, 32);
  b.set(addrEnc.encode(v.mint), 64);
  b.set(getU64Encoder().encode(v.amount), 96);
  b.set(getU32Encoder().encode(v.serial), 104);
  b.set(getI64Encoder().encode(v.voucherExpiresAt), 108);
  b.set(v.nonce, 116);
  b.set(v.signature, 132);
  return `WV1.${toBase64Url(b)}`;
}

export function decodeVoucher(text: string): SignedVoucher | null {
  const t = text.trim();
  if (!t.startsWith("WV1.")) return null;
  const b = fromBase64Url(t.slice(4));
  if (!b || b.length !== VOUCHER_CODE_LEN) return null;
  return {
    tab: addrDec.decode(b.subarray(0, 32)),
    devicePk: b.slice(32, 64),
    mint: addrDec.decode(b.subarray(64, 96)),
    amount: getU64Decoder().decode(b.subarray(96, 104)),
    serial: getU32Decoder().decode(b.subarray(104, 108)),
    voucherExpiresAt: getI64Decoder().decode(b.subarray(108, 116)),
    nonce: b.slice(116, 132),
    signature: b.slice(132, 196),
  };
}

export type SignedCourierAuth = {
  merchant: Address;
  tab: Address;
  maxFeeBps: number;
  maxFeeAbs: bigint;
  authExpiresAt: bigint;
  authNonce: Uint8Array;
  signature: Uint8Array;
};

// merchant 32 | tab 32 | max_fee_bps 2 | max_fee_abs 8 | expires 8 | nonce 16 | signature 64
const AUTH_CODE_LEN = 162;

/** Courier authorization: WC1.<base64url>. The shop's signed consent for one tab. */
export function encodeCourierAuth(a: SignedCourierAuth): string {
  const b = new Uint8Array(AUTH_CODE_LEN);
  b.set(addrEnc.encode(a.merchant), 0);
  b.set(addrEnc.encode(a.tab), 32);
  new DataView(b.buffer).setUint16(64, a.maxFeeBps, true);
  b.set(getU64Encoder().encode(a.maxFeeAbs), 66);
  b.set(getI64Encoder().encode(a.authExpiresAt), 74);
  b.set(a.authNonce, 82);
  b.set(a.signature, 98);
  return `WC1.${toBase64Url(b)}`;
}

export function decodeCourierAuth(text: string): SignedCourierAuth | null {
  const t = text.trim();
  if (!t.startsWith("WC1.")) return null;
  const b = fromBase64Url(t.slice(4));
  if (!b || b.length !== AUTH_CODE_LEN) return null;
  return {
    merchant: addrDec.decode(b.subarray(0, 32)),
    tab: addrDec.decode(b.subarray(32, 64)),
    maxFeeBps: new DataView(b.buffer, b.byteOffset).getUint16(64, true),
    maxFeeAbs: getU64Decoder().decode(b.subarray(66, 74)),
    authExpiresAt: getI64Decoder().decode(b.subarray(74, 82)),
    authNonce: b.slice(82, 98),
    signature: b.slice(98, 162),
  };
}

/** A courier bundle is plain text: one WV1 (voucher) or WC1 (authorization) code per line. */
export function parseBundle(text: string) {
  const lines = text.split(/\s+/).filter(Boolean);
  return {
    vouchers: lines.map(decodeVoucher).filter((v): v is SignedVoucher => v !== null),
    auths: lines.map(decodeCourierAuth).filter((a): a is SignedCourierAuth => a !== null),
  };
}
