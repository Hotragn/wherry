// Program tests: LiteSVM (in-process SVM) + the Codama client + the same voucher code the app uses.
// Run: pnpm anchor-build && pnpm test
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from "litesvm";
import {
  type Address,
  type Instruction,
  type KeyPairSigner,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPair,
  generateKeyPairSigner,
  getAddressEncoder,
  getAddressFromPublicKey,
  getTransactionEncoder,
  lamports,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLoadedAccountsDataSizeLimit,
  signBytes,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getMintEncoder,
  getMintSize,
  getTokenDecoder,
  getTokenEncoder,
  getTokenSize,
} from "@solana-program/token";
import {
  WHERRY_PROGRAM_ADDRESS,
  findGamePda,
  findPayerRecordPda,
  findTabPda,
  getCloseTabInstructionAsync,
  getCommitSeedInstructionAsync,
  getGameConfigDecoder,
  getOpenTabInstructionAsync,
  getPayerRecordDecoder,
  getRevealSeedInstruction,
  getSettleInstructionAsync,
  getTabDecoder,
  getTopUpInstructionAsync,
} from "../app/generated/wherry/index.ts";
import { ED25519_PROGRAM_ADDRESS, ed25519Instruction, voucherBytes, type Voucher } from "../app/lib/voucher.ts";

const SO = new URL("../anchor/target/deploy/wherry.so", import.meta.url).pathname;
const NOW = 1_800_000_000n;
const DAY = 86_400n;
const SETTLE_WINDOW = DAY;
const USD = 1_000_000n; // test USD has 6 decimals

type Result = TransactionMetadata | FailedTransactionMetadata;

function setTime(svm: LiteSVM, unix: bigint) {
  const clock = svm.getClock();
  clock.unixTimestamp = unix;
  svm.setClock(clock);
}

async function send(svm: LiteSVM, payer: KeyPairSigner, ixs: Instruction[]) {
  svm.expireBlockhash(); // new blockhash so a replayed instruction gets a new tx signature
  const message = pipe(
    createTransactionMessage({ version: 1 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
    (m) => appendTransactionMessageInstructions(ixs, m),
    (m) => setTransactionMessageComputeUnitLimit(1_400_000, m),
    (m) => setTransactionMessageLoadedAccountsDataSizeLimit(64 * 1024 * 1024, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  return { result: svm.sendTransaction(tx) as Result, size: getTransactionEncoder().encode(tx).length };
}

function ok(r: { result: Result }) {
  if (r.result instanceof FailedTransactionMetadata) {
    assert.fail(`tx failed: ${r.result.toString()}\n${r.result.meta().logs().join("\n")}`);
  }
  return r.result;
}

function fails(r: { result: Result }, errorCode: string) {
  assert.ok(r.result instanceof FailedTransactionMetadata, `expected ${errorCode}, but tx succeeded`);
  const logs = r.result.meta().logs().join("\n");
  assert.match(logs, new RegExp(`Error Code: ${errorCode}\\.`), logs);
}

function read<T>(svm: LiteSVM, address: Address, decode: (d: Uint8Array) => T): T {
  const account = svm.getAccount(address);
  assert.ok(account.exists, `account ${address} missing`);
  return decode(account.data);
}

async function rawKey() {
  const pair = await generateKeyPair();
  const pk = new Uint8Array(getAddressEncoder().encode(await getAddressFromPublicKey(pair.publicKey)));
  return { pair, pk };
}

async function world(deposit = 40n * USD) {
  const svm = new LiteSVM();
  svm.addProgramFromFile(WHERRY_PROGRAM_ADDRESS, SO);
  setTime(svm, NOW);

  const owner = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const merchant2 = await generateKeyPairSigner();
  for (const s of [owner, merchant, merchant2]) svm.airdrop(s.address, lamports(10_000_000_000n));

  const mint = (await generateKeyPairSigner()).address;
  svm.setAccount({
    address: mint,
    programAddress: TOKEN_PROGRAM_ADDRESS,
    executable: false,
    lamports: lamports(10_000_000n),
    space: BigInt(getMintSize()),
    data: new Uint8Array(
      getMintEncoder().encode({
        mintAuthority: owner.address,
        supply: 1_000n * USD,
        decimals: 6,
        isInitialized: true,
        freezeAuthority: null,
      }),
    ),
  });
  const [ownerToken] = await findAssociatedTokenPda({
    mint,
    owner: owner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  svm.setAccount({
    address: ownerToken,
    programAddress: TOKEN_PROGRAM_ADDRESS,
    executable: false,
    lamports: lamports(10_000_000n),
    space: BigInt(getTokenSize()),
    data: new Uint8Array(
      getTokenEncoder().encode({
        mint,
        owner: owner.address,
        amount: 1_000n * USD,
        delegate: null,
        state: AccountState.Initialized,
        isNative: null,
        delegatedAmount: 0n,
        closeAuthority: null,
      }),
    ),
  });

  const device = await rawKey();
  const [payer] = await findPayerRecordPda({ owner: owner.address });
  const w = { svm, owner, merchant, merchant2, mint, ownerToken, device, payer, tab: "" as Address, expiresAt: NOW + DAY };
  if (deposit > 0n) {
    ok(await openTab(w, { amount: deposit }));
    [w.tab] = await findTabPda({ owner: owner.address, tabId: 0n });
  }
  return w;
}
type World = Awaited<ReturnType<typeof world>>;

async function openTab(w: World, o: { amount?: bigint; tabId?: bigint; expiresAt?: bigint } = {}) {
  const ix = await getOpenTabInstructionAsync({
    owner: w.owner,
    mint: w.mint,
    ownerToken: w.ownerToken,
    tabId: o.tabId ?? 0n,
    deviceKey: w.device.pk,
    amount: o.amount ?? 40n * USD,
    expiresAt: o.expiresAt ?? w.expiresAt,
  });
  return send(w.svm, w.owner, [ix]);
}

type Signed = { v: Voucher; msg: Uint8Array; sig: Uint8Array; pk: Uint8Array };

async function voucher(
  w: World,
  o: { serial: number; amount: bigint; merchant?: Address; expiresAt?: bigint; key?: Awaited<ReturnType<typeof rawKey>> },
): Promise<Signed> {
  const key = o.key ?? w.device;
  const v: Voucher = {
    programId: WHERRY_PROGRAM_ADDRESS,
    tab: w.tab,
    merchant: o.merchant ?? w.merchant.address,
    mint: w.mint,
    amount: o.amount,
    serial: o.serial,
    voucherExpiresAt: o.expiresAt ?? w.expiresAt,
    nonce: crypto.getRandomValues(new Uint8Array(16)),
  };
  const msg = voucherBytes(v);
  const sig = new Uint8Array(await signBytes(key.pair.privateKey, msg));
  return { v, msg, sig, pk: key.pk };
}

async function settleIxs(w: World, s: Signed, o: { merchant?: KeyPairSigner; amount?: bigint; ed25519?: Instruction | null } = {}) {
  const settle = await getSettleInstructionAsync({
    merchant: o.merchant ?? w.merchant,
    tab: w.tab,
    payerRecord: w.payer,
    mint: w.mint,
    serial: s.v.serial,
    amount: o.amount ?? s.v.amount,
    voucherExpiresAt: s.v.voucherExpiresAt,
    nonce: s.v.nonce,
  });
  const ed = o.ed25519 === undefined ? ed25519Instruction(s.pk, s.sig, s.msg) : o.ed25519;
  return ed ? [ed, settle] : [settle];
}

async function tokenBalance(w: World, owner: Address) {
  const [ata] = await findAssociatedTokenPda({ mint: w.mint, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const account = w.svm.getAccount(ata);
  return account.exists ? getTokenDecoder().decode(account.data).amount : 0n;
}

describe("open_tab", () => {
  test("locks the deposit in the tab's vault and starts the payer record", async () => {
    const w = await world();
    const tab = read(w.svm, w.tab, (d) => getTabDecoder().decode(d));
    assert.equal(tab.owner, w.owner.address);
    assert.equal(tab.deposited, 40n * USD);
    assert.equal(tab.settleDeadline, w.expiresAt + SETTLE_WINDOW);
    assert.deepEqual(new Uint8Array(tab.deviceKey), w.device.pk);
    assert.equal(await tokenBalance(w, w.tab), 40n * USD);
    assert.equal(await tokenBalance(w, w.owner.address), 960n * USD);
    const payer = read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d));
    assert.equal(payer.tabsOpened, 1);
  });

  test("rejects a zero amount, a bad expiry and an out-of-order tab id", async () => {
    const w = await world(0n);
    fails(await openTab(w, { amount: 0n }), "InvalidAmount");
    fails(await openTab(w, { expiresAt: NOW - 1n }), "InvalidExpiry");
    fails(await openTab(w, { expiresAt: NOW + 31n * DAY }), "InvalidExpiry");
    fails(await openTab(w, { tabId: 1n }), "InvalidTabId");
    ok(await openTab(w));
    ok(await openTab(w, { tabId: 1n }));
  });
});

describe("top_up", () => {
  test("adds to the vault while the tab is live, not after it expires", async () => {
    const w = await world();
    const topUp = (amount: bigint) =>
      getTopUpInstructionAsync({ owner: w.owner, tab: w.tab, mint: w.mint, ownerToken: w.ownerToken, amount });
    ok(await send(w.svm, w.owner, [await topUp(10n * USD)]));
    assert.equal(await tokenBalance(w, w.tab), 50n * USD);
    assert.equal(read(w.svm, w.tab, (d) => getTabDecoder().decode(d)).deposited, 50n * USD);
    fails(await send(w.svm, w.owner, [await topUp(0n)]), "InvalidAmount");
    setTime(w.svm, w.expiresAt);
    fails(await send(w.svm, w.owner, [await topUp(1n)]), "TabExpired");
  });
});

describe("settle", () => {
  test("pays one voucher and updates the tab and payer record", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 7, amount: 3_500_000n });
    ok(await send(w.svm, w.merchant, await settleIxs(w, s)));
    assert.equal(await tokenBalance(w, w.merchant.address), 3_500_000n);
    const tab = read(w.svm, w.tab, (d) => getTabDecoder().decode(d));
    assert.equal(tab.settled, 3_500_000n);
    assert.equal(tab.used[0], 1 << 7);
    const payer = read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d));
    assert.equal(payer.vouchersSettled, 1);
    assert.equal(payer.volumeSettled, 3_500_000n);
  });

  test("settles a batch of 3 vouchers in one v1 transaction", async () => {
    const w = await world();
    const amounts = [3_500_000n, 2_000_000n, 1_250_000n];
    const ixs: Instruction[] = [];
    for (const [i, amount] of amounts.entries()) {
      ixs.push(...(await settleIxs(w, await voucher(w, { serial: i, amount }))));
    }
    const sent = await send(w.svm, w.merchant, ixs);
    const meta = ok(sent);
    assert.ok(sent.size <= 4096, `batch is ${sent.size} bytes`);
    assert.ok(sent.size > 1232, "a batch of 3 needs a v1 transaction");
    assert.equal(await tokenBalance(w, w.merchant.address), 6_750_000n);
    assert.equal(read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d)).vouchersSettled, 3);
    console.log(`  batch of 3: ${sent.size} bytes, ${meta.computeUnitsConsumed()} CU`);
  });

  test("settles 5 vouchers in one v1 transaction, and measures compute per voucher", async () => {
    const w = await world();
    const one = await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 1, amount: USD })));
    const ixs: Instruction[] = [];
    for (let serial = 2; serial <= 6; serial++) ixs.push(...(await settleIxs(w, await voucher(w, { serial, amount: USD }))));
    const five = await send(w.svm, w.merchant, ixs);
    assert.ok(five.size <= 4096, `5 vouchers are ${five.size} bytes`);
    assert.equal(await tokenBalance(w, w.merchant.address), 6n * USD);
    console.log(
      `  CU: 1 voucher ${ok(one).computeUnitsConsumed()} (${one.size} bytes, first settle also opens the shop's token account); ` +
        `5 vouchers ${ok(five).computeUnitsConsumed()} (${five.size} bytes)`,
    );
  });

  test("rejects a voucher signed by a different key", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 1, amount: USD, key: await rawKey() });
    fails(await send(w.svm, w.merchant, await settleIxs(w, s)), "DeviceKeyMismatch");
  });

  test("rejects a tampered amount", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 1, amount: USD });
    fails(await send(w.svm, w.merchant, await settleIxs(w, s, { amount: 30n * USD })), "VoucherMismatch");
  });

  test("rejects a voucher made out to another shop", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 1, amount: USD, merchant: w.merchant.address });
    fails(await send(w.svm, w.merchant2, await settleIxs(w, s, { merchant: w.merchant2 })), "VoucherMismatch");
  });

  test("requires exactly one inline Ed25519 check right before it", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 1, amount: USD });
    fails(await send(w.svm, w.merchant, await settleIxs(w, s, { ed25519: null })), "MissingEd25519Instruction");

    // The same valid signature listed twice: the precompile passes, the program refuses count != 1.
    const PK = 30, SIG = PK + 32, MSG = SIG + 64;
    const data = new Uint8Array(MSG + s.msg.length);
    const view = new DataView(data.buffer);
    data[0] = 2;
    for (const entry of [0, 1]) {
      [SIG, 0xffff, PK, 0xffff, MSG, s.msg.length, 0xffff].forEach((v, i) =>
        view.setUint16(2 + entry * 14 + i * 2, v, true),
      );
    }
    data.set(s.pk, PK);
    data.set(s.sig, SIG);
    data.set(s.msg, MSG);
    const doubled = { programAddress: ED25519_PROGRAM_ADDRESS, data };
    fails(await send(w.svm, w.merchant, await settleIxs(w, s, { ed25519: doubled })), "MalformedEd25519Instruction");
  });

  test("rejects a replayed serial, even with a different amount", async () => {
    const w = await world();
    const s = await voucher(w, { serial: 9, amount: USD });
    ok(await send(w.svm, w.merchant, await settleIxs(w, s)));
    fails(await send(w.svm, w.merchant, await settleIxs(w, s)), "VoucherAlreadySettled");
    const again = await voucher(w, { serial: 9, amount: 2n * USD });
    fails(await send(w.svm, w.merchant, await settleIxs(w, again)), "VoucherAlreadySettled");
    assert.equal(await tokenBalance(w, w.merchant.address), USD);
  });

  test("rejects serial 1024 and vouchers that outlive the tab", async () => {
    const w = await world();
    fails(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 1024, amount: USD }))), "SerialOutOfRange");
    const late = await voucher(w, { serial: 2, amount: USD, expiresAt: w.expiresAt + 1n });
    fails(await send(w.svm, w.merchant, await settleIxs(w, late)), "VoucherOutlivesTab");
  });

  test("works through the settlement window and stops after it", async () => {
    const w = await world();
    setTime(w.svm, w.expiresAt + SETTLE_WINDOW);
    ok(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 1, amount: USD }))));
    setTime(w.svm, w.expiresAt + SETTLE_WINDOW + 1n);
    fails(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 2, amount: USD }))), "SettlementWindowClosed");
  });

  test("records a shortfall when vouchers exceed the escrow", async () => {
    const w = await world(5n * USD);
    ok(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 0, amount: 3n * USD }))));
    const s2 = await voucher(w, { serial: 1, amount: 3n * USD, merchant: w.merchant2.address });
    const r = ok(await send(w.svm, w.merchant2, await settleIxs(w, s2, { merchant: w.merchant2 })));
    assert.ok(r.logs().some((l) => l.startsWith("Program data:")), "events emitted");
    assert.equal(await tokenBalance(w, w.merchant2.address), 2n * USD);
    const tab = read(w.svm, w.tab, (d) => getTabDecoder().decode(d));
    assert.equal(tab.shortfall, USD);
    const payer = read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d));
    assert.equal(payer.shortfalls, 1);
    assert.equal(payer.shortfallAmount, USD);
    assert.equal(payer.volumeSettled, 5n * USD);
  });
});

describe("close_tab", () => {
  test("waits for the settlement window, then refunds and counts a clean close", async () => {
    const w = await world();
    ok(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 0, amount: 4n * USD }))));
    const close = () => getCloseTabInstructionAsync({ owner: w.owner, tab: w.tab, mint: w.mint });
    fails(await send(w.svm, w.owner, [await close()]), "SettlementWindowOpen");
    setTime(w.svm, w.expiresAt + SETTLE_WINDOW + 1n);
    ok(await send(w.svm, w.owner, [await close()]));
    assert.equal(w.svm.getAccount(w.tab).exists, false);
    assert.equal(await tokenBalance(w, w.owner.address), 996n * USD);
    const payer = read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d));
    assert.equal(payer.tabsClosedClean, 1);
    // The closed tab's address can't be reopened, so its old vouchers stay dead.
    fails(await openTab(w, { tabId: 0n, expiresAt: w.expiresAt + SETTLE_WINDOW + DAY }), "InvalidTabId");
  });

  test("does not count a tab with a shortfall as clean", async () => {
    const w = await world(USD);
    ok(await send(w.svm, w.merchant, await settleIxs(w, await voucher(w, { serial: 0, amount: 2n * USD }))));
    setTime(w.svm, w.expiresAt + SETTLE_WINDOW + 1n);
    ok(await send(w.svm, w.owner, [await getCloseTabInstructionAsync({ owner: w.owner, tab: w.tab, mint: w.mint })]));
    const payer = read(w.svm, w.payer, (d) => getPayerRecordDecoder().decode(d));
    assert.equal(payer.tabsClosedClean, 0);
    assert.equal(payer.shortfalls, 1);
  });
});

describe("game seed", () => {
  test("commit, reject a wrong reveal, reveal and chain the next commitment", async () => {
    const w = await world(0n);
    const studio = w.owner;
    const sha = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const next = crypto.getRandomValues(new Uint8Array(32));
    const [game] = await findGamePda({ studio: studio.address });

    ok(await send(w.svm, studio, [await getCommitSeedInstructionAsync({ studio, seedHash: sha(seed) })]));
    fails(await send(w.svm, studio, [await getCommitSeedInstructionAsync({ studio, seedHash: sha(next) })]), "SeedAlreadyCommitted");
    const reveal = (s: Uint8Array) => getRevealSeedInstruction({ studio, game, seed: s, nextHash: sha(next) });
    fails(await send(w.svm, studio, [reveal(next)]), "SeedMismatch");
    ok(await send(w.svm, studio, [reveal(seed)]));

    const config = read(w.svm, game, (d) => getGameConfigDecoder().decode(d));
    assert.equal(config.epoch, 1);
    assert.deepEqual(new Uint8Array(config.lastRevealedSeed), seed);
    assert.deepEqual(new Uint8Array(config.seedCommitment), sha(next));
  });
});

describe("settle properties (seeded random runs)", () => {
  // Small deterministic PRNG so a failing seed can be replayed.
  const rng = (seed: number) => () => ((seed = (seed * 1_103_515_245 + 12_345) >>> 0) / 2 ** 32);

  test("25 random worlds: no overpay, no double pay, only the named shop is paid, shortfall adds up", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = rng(seed);
      const deposit = BigInt(1 + Math.floor(r() * 30)) * USD;
      const w = await world(deposit);
      const third = await generateKeyPairSigner();
      w.svm.airdrop(third.address, lamports(10_000_000_000n));
      const shops = [w.merchant, w.merchant2, third];
      const paidTo = new Map<string, bigint>(shops.map((s) => [s.address, 0n]));
      const settledSerials = new Set<number>();
      let owedShort = 0n;

      for (let k = 0; k < 10; k++) {
        const named = shops[Math.floor(r() * shops.length)];
        const serial = 1 + Math.floor(r() * 6); // small range: plenty of reused serials
        const amount = BigInt(1 + Math.floor(r() * 1_500)) * 10_000n; // $0.01 – $15.00
        const s = await voucher(w, { serial, amount, merchant: named.address });
        const submitter = r() < 0.25 ? shops.find((x) => x !== named)! : named; // sometimes the wrong shop tries
        const vaultBefore = await tokenBalance(w, w.tab);
        const before = await tokenBalance(w, submitter.address);
        const { result } = await send(w.svm, submitter, await settleIxs(w, s, { merchant: submitter }));
        const landed = !(result instanceof FailedTransactionMetadata);

        if (submitter !== named) assert.equal(landed, false, `seed ${seed}: a shop was paid for a voucher naming another shop`);
        if (landed) {
          assert.ok(!settledSerials.has(serial), `seed ${seed}: serial ${serial} paid twice`);
          settledSerials.add(serial);
          const got = (await tokenBalance(w, submitter.address)) - before;
          assert.equal(got, amount < vaultBefore ? amount : vaultBefore, `seed ${seed}: paid min(amount, vault)`);
          paidTo.set(submitter.address, paidTo.get(submitter.address)! + got);
          owedShort += amount - got;
        }
        const tab = read(w.svm, w.tab, (d) => getTabDecoder().decode(d));
        const totalPaid = [...paidTo.values()].reduce((a, b) => a + b, 0n);
        assert.equal(tab.settled, totalPaid, `seed ${seed}: tab.settled tracks payouts`);
        assert.ok(totalPaid <= deposit, `seed ${seed}: paid more than deposited`);
        assert.equal(await tokenBalance(w, w.tab), deposit - totalPaid, `seed ${seed}: vault + payouts = deposit`);
        assert.equal(tab.shortfall, owedShort, `seed ${seed}: shortfall = owed minus paid`);
      }
    }
  });
});
