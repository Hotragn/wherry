// The core flow on devnet with real transactions:
// create the test-USD mint (once) -> open a $40 tab -> sign 3 vouchers with a phone key
// -> one shop settles all 3 in one v1 transaction -> a replay is rejected.
// Run: node scripts/devnet-proof.ts   (keys live in keys/, which is gitignored)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  type Instruction,
  type KeyPairSigner,
  type Signature,
  createClient,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  generateKeyPair,
  getAddressEncoder,
  getAddressFromPublicKey,
  lamports,
  signBytes,
} from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";
import {
  WHERRY_PROGRAM_ADDRESS,
  fetchMaybePayerRecord,
  fetchPayerRecord,
  fetchTab,
  findPayerRecordPda,
  findTabPda,
  getOpenTabInstructionAsync,
  getSettleInstructionAsync,
} from "../app/generated/wherry/index.ts";
import { ed25519Instruction, voucherBytes, type Voucher } from "../app/lib/voucher.ts";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const KEYS = new URL("../keys/", import.meta.url).pathname;
const USD = 1_000_000n;
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const usd = (n: bigint) => `$${(Number(n) / 1e6).toFixed(2)}`;

/** Load a Solana CLI keypair file, creating it on first use. Never prints the secret. */
async function keypairFile(name: string): Promise<KeyPairSigner> {
  const path = KEYS + name;
  if (!existsSync(path)) {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const pub = getAddressEncoder().encode((await createKeyPairSignerFromPrivateKeyBytes(seed)).address);
    writeFileSync(path, JSON.stringify([...seed, ...pub]), { mode: 0o600 });
  }
  return createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(path, "utf8"))));
}

/** Public devnet RPC rate-limits (HTTP 429). Retry reads only; sends are never retried. */
async function read<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 6 || !String((e as Error)?.message).includes("429")) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const rpcClient = (who: KeyPairSigner) =>
  createClient().use(signer(who)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig: { version: 1 } }));

async function send(client: ReturnType<typeof rpcClient>, label: string, ixs: Instruction[]) {
  const started = performance.now();
  const result = await client.sendTransaction(ixs);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const signature = result.context.signature as Signature;
  const tx = await read(() =>
    client.rpc.getTransaction(signature, { maxSupportedTransactionVersion: 1, commitment: "confirmed", encoding: "json" }).send(),
  );
  console.log(`${label}: confirmed in ${seconds} s, fee ${tx?.meta?.fee ?? "?"} lamports\n  ${explorer(signature)}`);
  return signature;
}

const deployer = await keypairFile("devnet-deployer.json");
const mintKey = await keypairFile("test-usd-mint.json");
const mintAuthority = await keypairFile("test-usd-authority.json");
const shop = await keypairFile("demo-shop.json");
const owner = rpcClient(deployer);
const mint = mintKey.address;
console.log(`program ${WHERRY_PROGRAM_ADDRESS}\nmint    ${mint}\nowner   ${deployer.address}\nshop    ${shop.address}`);

// 1. Test-USD mint (6 decimals), created once.
const { value: mintAccount } = await read(() => owner.rpc.getAccountInfo(mint, { encoding: "base64" }).send());
if (!mintAccount) {
  const space = BigInt(getMintSize());
  const rent = await read(() => owner.rpc.getMinimumBalanceForRentExemption(space).send());
  await send(owner, "create test-USD mint", [
    getCreateAccountInstruction({ payer: deployer, newAccount: mintKey, lamports: rent, space, programAddress: TOKEN_PROGRAM_ADDRESS }),
    getInitializeMint2Instruction({ mint, decimals: 6, mintAuthority: mintAuthority.address }),
  ]);
}

// 2. Give the owner test dollars.
const [ownerToken] = await findAssociatedTokenPda({ mint, owner: deployer.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
await send(owner, "mint 100 test USD to owner", [
  await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: deployer, mint, owner: deployer.address }),
  getMintToInstruction({ mint, token: ownerToken, mintAuthority, amount: 100n * USD }),
]);

// 3. Open a tab paired with a fresh, non-extractable phone key.
const device = await generateKeyPair();
const devicePk = new Uint8Array(getAddressEncoder().encode(await getAddressFromPublicKey(device.publicKey)));
const [payerRecord] = await findPayerRecordPda({ owner: deployer.address });
const existing = await read(() => fetchMaybePayerRecord(owner.rpc, payerRecord));
const tabId = BigInt(existing.exists ? existing.data.tabsOpened : 0);
const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 86_400);
const [tab] = await findTabPda({ owner: deployer.address, tabId });
await send(owner, `open tab #${tabId} with $40`, [
  await getOpenTabInstructionAsync({ owner: deployer, mint, ownerToken, tabId, deviceKey: devicePk, amount: 40n * USD, expiresAt }),
]);

// 4. Offline: the phone signs the vouchers for the shop.
async function signVoucher(serial: number, amount: bigint) {
  const v: Voucher = { programId: WHERRY_PROGRAM_ADDRESS, tab, merchant: shop.address, mint, amount, serial, voucherExpiresAt: expiresAt, nonce: crypto.getRandomValues(new Uint8Array(16)) };
  const msg = voucherBytes(v);
  return { v, msg, sig: new Uint8Array(await signBytes(device.privateKey, msg)) };
}
const COUNT = Number(process.argv[2] ?? 3); // vouchers settled in the one transaction
const vouchers = [];
for (let i = 1; i <= COUNT; i++) vouchers.push(await signVoucher(i, BigInt(500_000 + 250_000 * i)));

// 5. Back online: the shop settles all of them in one transaction (it pays its own fee and token account).
const shopBalance = (await read(() => owner.rpc.getBalance(shop.address).send())).value;
if (shopBalance < 10_000_000n) {
  await send(owner, "fund shop with 0.02 SOL for fees", [
    getTransferSolInstruction({ source: deployer, destination: shop.address, amount: lamports(20_000_000n) }),
  ]);
}
const shopClient = rpcClient(shop);
const settleIxs = async (s: Awaited<ReturnType<typeof signVoucher>>) => [
  ed25519Instruction(devicePk, s.sig, s.msg),
  await getSettleInstructionAsync({ merchant: shop, tab, payerRecord, mint, serial: s.v.serial, amount: s.v.amount, voucherExpiresAt: s.v.voucherExpiresAt, nonce: s.v.nonce }),
];
const batch: Instruction[] = [];
for (const s of vouchers) batch.push(...(await settleIxs(s)));
await send(shopClient, `settle ${COUNT} vouchers in one tx`, batch);

const t = (await read(() => fetchTab(owner.rpc, tab))).data;
const p = (await read(() => fetchPayerRecord(owner.rpc, payerRecord))).data;
console.log(`tab ${tab}: deposited ${usd(t.deposited)}, settled ${usd(t.settled)}, shortfall ${usd(t.shortfall)}`);
console.log(`payer record: tabs ${p.tabsOpened}, vouchers ${p.vouchersSettled}, volume ${usd(p.volumeSettled)}, shortfalls ${p.shortfalls}`);

// 6. A replayed voucher is rejected (simulation fails before anything lands).
try {
  await send(shopClient, "replay the first voucher", await settleIxs(vouchers[0]));
  console.log("UNEXPECTED: replay landed");
  process.exitCode = 1;
} catch (e) {
  const text = JSON.stringify(e, (_, v) => (typeof v === "bigint" ? v.toString() : v)) + String((e as Error).message);
  console.log(`replay of the first voucher: rejected (${/VoucherAlreadySettled|6011|0x177b/.test(text) ? "VoucherAlreadySettled" : (e as Error).message})`);
}
