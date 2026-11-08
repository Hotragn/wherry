import {
  type Address,
  type Instruction,
  address,
  getAddressEncoder,
  getI64Encoder,
  getU32Encoder,
  getU64Encoder,
} from "@solana/kit";

export const ED25519_PROGRAM_ADDRESS = address(
  "Ed25519SigVerify111111111111111111111111111",
);
export const VOUCHER_DOMAIN = new TextEncoder().encode("WHERRY01");
export const VOUCHER_LEN = 172;
export const MAX_SERIALS = 1024;

export type Voucher = {
  programId: Address;
  tab: Address;
  merchant: Address;
  mint: Address;
  amount: bigint;
  serial: number;
  voucherExpiresAt: bigint;
  /** 16 random bytes. Also the player seed in the game. */
  nonce: Uint8Array;
};

const addr = getAddressEncoder();

/** The exact 172 bytes the phone signs; must match `voucher_bytes` in the program. */
export function voucherBytes(v: Voucher): Uint8Array {
  if (v.nonce.length !== 16) throw new Error("nonce must be 16 bytes");
  const m = new Uint8Array(VOUCHER_LEN);
  m.set(VOUCHER_DOMAIN, 0);
  m.set(addr.encode(v.programId), 8);
  m.set(addr.encode(v.tab), 40);
  m.set(addr.encode(v.merchant), 72);
  m.set(addr.encode(v.mint), 104);
  m.set(getU64Encoder().encode(v.amount), 136);
  m.set(getU32Encoder().encode(v.serial), 144);
  m.set(getI64Encoder().encode(v.voucherExpiresAt), 148);
  m.set(v.nonce, 156);
  return m;
}

/**
 * Ed25519 precompile instruction verifying one signature with everything inline:
 * [count=1][pad][7 x u16 offsets][pubkey 32][signature 64][message].
 * Instruction indexes are u16::MAX ("this instruction"), which the program requires.
 */
export function ed25519Instruction(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
): Instruction {
  if (publicKey.length !== 32 || signature.length !== 64) {
    throw new Error("bad key or signature length");
  }
  const PK = 16,
    SIG = PK + 32,
    MSG = SIG + 64;
  const data = new Uint8Array(MSG + message.length);
  const view = new DataView(data.buffer);
  data[0] = 1;
  const offsets = [SIG, 0xffff, PK, 0xffff, MSG, message.length, 0xffff];
  offsets.forEach((v, i) => view.setUint16(2 + i * 2, v, true));
  data.set(publicKey, PK);
  data.set(signature, SIG);
  data.set(message, MSG);
  return { programAddress: ED25519_PROGRAM_ADDRESS, data };
}

/** Offline check a shop runs: does this signature cover these exact voucher bytes for `merchant`? */
export async function verifyVoucherSignature(
  programId: Address,
  merchant: Address,
  v: { tab: Address; devicePk: Uint8Array; mint: Address; amount: bigint; serial: number; voucherExpiresAt: bigint; nonce: Uint8Array; signature: Uint8Array },
): Promise<boolean> {
  const message = voucherBytes({ ...v, programId, merchant });
  try {
    const key = await crypto.subtle.importKey("raw", v.devicePk as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, v.signature as BufferSource, message as BufferSource);
  } catch {
    return false;
  }
}

/** Hash chain: nonce bytes 4–11 carry the first 8 bytes of sha256(previous voucher bytes) from the same phone.
 *  All zeroes marks the start of a chain. Two vouchers with the same link are a fork, provable from their signatures. */
export const linkOf = (nonce: Uint8Array) => nonce.slice(4, 12);
export const isChainStart = (link: Uint8Array) => link.every((b) => b === 0);
export async function chainLink(previousVoucherBytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", previousVoucherBytes as BufferSource)).slice(0, 8);
}
