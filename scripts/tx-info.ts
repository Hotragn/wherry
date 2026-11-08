// Print what a devnet transaction really was: version, limits in its message, compute used, fee.
// Run: node --no-warnings scripts/tx-info.ts <signature>
import { type Signature, createSolanaRpc, getBase64Encoder, getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";

const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com");
const sig = process.argv[2] as Signature;
const tx = await rpc.getTransaction(sig, { encoding: "base64", maxSupportedTransactionVersion: 1, commitment: "confirmed" }).send();
if (!tx) throw new Error("not found");
const wire = getTransactionDecoder().decode(getBase64Encoder().encode(tx.transaction[0]));
const msg = getCompiledTransactionMessageDecoder().decode(wire.messageBytes) as Record<string, unknown>;
console.log(JSON.stringify({
  version: tx.version,
  configMask: msg.configMask, configValues: msg.configValues,
  instructions: ((msg.instructions ?? msg.instructionHeaders) as unknown[] | undefined)?.length,
  computeUnitsConsumed: String(tx.meta?.computeUnitsConsumed),
  feeLamports: String(tx.meta?.fee),
  err: tx.meta?.err ?? null,
}, (_, v) => (typeof v === "bigint" ? String(v) : v), 2));
