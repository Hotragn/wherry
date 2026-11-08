// Anyone-settles courier: the first device with a signal settles shops' vouchers for them,
// with each shop's signed consent, and earns a small capped fee from each voucher.
import { type Address, type KeyPairSigner, createSignerFromKeyPair, generateKeyPair, getAddressEncoder } from "@solana/kit";
import { get, set } from "idb-keyval";
import { fetchMaybeTab, findPayerRecordPda, getSettleViaCourierInstructionAsync } from "../generated/wherry/index.ts";
import { fetchUsdBalance, rpc, send, type Sent } from "./chain.ts";
import { parseBundle, type SignedCourierAuth, type SignedVoucher } from "./codes.ts";
import { PROGRAM_ID } from "./config.ts";
import { courierAuthBytes, ed25519Instruction, verifyVoucherSignature, voucherBytes } from "./voucher.ts";

export async function courierSigner(): Promise<KeyPairSigner> {
  let pair = await get<CryptoKeyPair>("courier:key");
  if (!pair) {
    pair = await generateKeyPair();
    await set("courier:key", pair);
  }
  return createSignerFromKeyPair(pair);
}

export type Job = { v: SignedVoucher; auth: SignedCourierAuth };
export type JobResult = { v: SignedVoucher; merchant: Address; sent?: Sent; error?: string };

/** Pair each voucher with its shop's authorization for that tab, and drop any whose signature doesn't check out. */
export async function planBundle(text: string): Promise<{ jobs: Job[]; skipped: string[] }> {
  const { vouchers, auths } = parseBundle(text);
  const jobs: Job[] = [];
  const skipped: string[] = [];
  for (const v of vouchers) {
    const auth = auths.find((a) => a.tab === v.tab);
    if (!auth) skipped.push(`No. ${v.serial}: no shop authorization for its tab`);
    else if (!(await verifyVoucherSignature(PROGRAM_ID, auth.merchant, v))) skipped.push(`No. ${v.serial}: not signed for that shop`);
    else if (BigInt(Math.floor(Date.now() / 1000)) > auth.authExpiresAt) skipped.push(`No. ${v.serial}: the shop's authorization expired`);
    else jobs.push({ v, auth });
  }
  return { jobs, skipped };
}

export const feeFor = (amount: bigint, a: SignedCourierAuth) => {
  const pct = (amount * BigInt(a.maxFeeBps)) / 10_000n;
  return pct < a.maxFeeAbs ? pct : a.maxFeeAbs;
};

/** Settle each voucher in its own v1 transaction, taking the shop's full allowed fee. */
export async function settleJobs(jobs: Job[], onResult: (r: JobResult) => void): Promise<{ earned: bigint; results: JobResult[] }> {
  const courier = await courierSigner();
  const before = await fetchUsdBalance(courier.address);
  const results: JobResult[] = [];
  for (const { v, auth } of jobs) {
    let r: JobResult;
    try {
      const tab = await fetchMaybeTab(rpc, v.tab);
      if (!tab.exists) throw new Error("tab not found on devnet");
      const [payerRecord] = await findPayerRecordPda({ owner: tab.data.owner });
      const authMsg = courierAuthBytes({ ...auth, programId: PROGRAM_ID });
      const sent = await send(
        courier,
        async (s) => [
          ed25519Instruction(v.devicePk, v.signature, voucherBytes({ ...v, programId: PROGRAM_ID, merchant: auth.merchant })),
          ed25519Instruction(new Uint8Array(getAddressEncoder().encode(auth.merchant)), auth.signature, authMsg),
          await getSettleViaCourierInstructionAsync({
            courier: s,
            merchant: auth.merchant,
            tab: v.tab,
            payerRecord,
            mint: v.mint,
            serial: v.serial,
            amount: v.amount,
            voucherExpiresAt: v.voucherExpiresAt,
            nonce: v.nonce,
            feeBps: auth.maxFeeBps,
            maxFeeBps: auth.maxFeeBps,
            maxFeeAbs: auth.maxFeeAbs,
            authExpiresAt: auth.authExpiresAt,
            authNonce: auth.authNonce,
          }),
        ],
        1,
      );
      r = { v, merchant: auth.merchant, sent };
    } catch (e) {
      const { explainError } = await import("./shop.ts");
      r = { v, merchant: auth.merchant, error: explainError(e).message };
    }
    results.push(r);
    onResult(r);
  }
  const after = await fetchUsdBalance(courier.address).catch(() => before);
  return { earned: after - before, results };
}

