// Offline logic the phone and the shop run: payload codes, money parsing, signature checks, coverage and risk.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Address, generateKeyPair, generateKeyPairSigner, signBytes } from "@solana/kit";
import { assess, DEFAULT_RISK, type Pending, type TabSnapshot } from "../app/lib/assess.ts";
import { decodeVoucher, encodeVoucher, pairingCode, parsePairingCode, parseSticker, stickerCode, type SignedVoucher } from "../app/lib/codes.ts";
import { formatUsd, MINT, parseUsd, PROGRAM_ID } from "../app/lib/config.ts";
import { chunkJoiner, soundChunks } from "../app/lib/sound.ts";
import { verifyVoucherSignature, voucherBytes } from "../app/lib/voucher.ts";
import { TabStatus } from "../app/generated/wherry/index.ts";

const USD = 1_000_000n;
const NOW = 1_800_000_000n;

async function setup(amount = 3_500_000n, serial = 7) {
  const device = await generateKeyPair();
  const devicePk = new Uint8Array(await crypto.subtle.exportKey("raw", device.publicKey));
  const shop = (await generateKeyPairSigner()).address;
  const other = (await generateKeyPairSigner()).address;
  const tabAddr = (await generateKeyPairSigner()).address;
  const mint = (await generateKeyPairSigner()).address;
  const fields = { tab: tabAddr, mint, amount, serial, voucherExpiresAt: NOW + 3600n, nonce: crypto.getRandomValues(new Uint8Array(16)) };
  const signature = new Uint8Array(await signBytes(device.privateKey, voucherBytes({ ...fields, programId: PROGRAM_ID, merchant: shop })));
  const v: SignedVoucher = { ...fields, devicePk, signature };
  const tab: TabSnapshot = {
    discriminator: new Uint8Array(8),
    address: tabAddr,
    owner: other,
    tabId: 0n,
    deviceKey: devicePk,
    mint,
    deposited: 40n * USD,
    settled: 0n,
    shortfall: 0n,
    expiresAt: NOW + 3600n,
    settleDeadline: NOW + 3600n + 86_400n,
    used: new Uint8Array(128),
    status: TabStatus.Open,
    bump: 255,
  };
  return { v, tab, shop, other };
}

const run = (v: SignedVoucher, tab: TabSnapshot | undefined, pending: Pending[] = [], signatureOk = true) =>
  assess({ v, signatureOk, tab, pending, risk: DEFAULT_RISK, nowSec: NOW, syncedAtMs: 0, nowMs: 60_000 });

test("payload codes round-trip and reject junk", async () => {
  const { v, shop } = await setup();
  const back = decodeVoucher(encodeVoucher(v))!;
  assert.deepEqual({ ...back, devicePk: [...back.devicePk], nonce: [...back.nonce], signature: [...back.signature] }, { ...v, devicePk: [...v.devicePk], nonce: [...v.nonce], signature: [...v.signature] });
  assert.equal(decodeVoucher("WV1.abc"), null);
  assert.equal(decodeVoucher("hello"), null);
  assert.deepEqual(parseSticker(stickerCode(shop, "Amara's kiosk")), { merchant: shop, name: "Amara's kiosk" });
  assert.equal(parseSticker("WS1.notanaddress.x"), null);
  assert.deepEqual(parsePairingCode(pairingCode(v.devicePk)), v.devicePk);
  assert.equal(parsePairingCode("WP1.nope"), null);
});

test("money parsing is exact to the cent", () => {
  assert.equal(parseUsd("3.50"), 3_500_000n);
  assert.equal(parseUsd("$12"), 12_000_000n);
  assert.equal(parseUsd("0.5"), 500_000n);
  assert.equal(parseUsd("1.234"), null);
  assert.equal(parseUsd("-1"), null);
  assert.equal(parseUsd("abc"), null);
  assert.equal(formatUsd(36_500_000n), "$36.50");
  assert.equal(formatUsd(1_234_567_890n), "$1,234.56");
});

test("the signature binds the voucher to one shop", async () => {
  const { v, shop, other } = await setup();
  assert.equal(await verifyVoucherSignature(PROGRAM_ID, shop, v), true);
  assert.equal(await verifyVoucherSignature(PROGRAM_ID, other, v), false);
  assert.equal(await verifyVoucherSignature(PROGRAM_ID, shop, { ...v, amount: v.amount + 1n }), false);
});

test("coverage, replays and the risk circuit", async () => {
  const { v, tab } = await setup();
  const ok = run(v, tab);
  assert.equal(ok.decision, "accept");
  assert.equal(ok.coverageLeft, 40n * USD);
  assert.match(ok.headline, /\$36\.50 left/);

  assert.equal(run(v, tab, [], false).decision, "decline");
  assert.match(run(v, tab, [{ tab: v.tab, serial: 7, amount: 1n }]).headline, /Already accepted/);
  const replay = assess({ v, signatureOk: true, tab, pending: [], seen: [{ tab: v.tab, serial: 7 }], risk: DEFAULT_RISK, nowSec: NOW, nowMs: 0 });
  assert.match(replay.headline, /Replay/);
  const used = new Uint8Array(128);
  used[0] = 1 << 7;
  assert.match(run(v, { ...tab, used }).headline, /Already settled onchain/);
  assert.match(run(v, { ...tab, settled: 38n * USD }).headline, /Not covered: only \$2\.00/);
  assert.match(run(v, { ...tab, deviceKey: new Uint8Array(32) }).headline, /phone/);

  const big = (await setup(12n * USD, 9)).v;
  const sameTab = { ...big, tab: v.tab, devicePk: v.devicePk, mint: v.mint };
  const pending: Pending[] = [{ tab: v.tab, serial: 1, amount: 3_500_000n }, { tab: v.tab, serial: 2, amount: 2n * USD }];
  const tripped = run(sameTab, tab, pending, true);
  assert.equal(tripped.tripped, "perCustomer");
  assert.match(tripped.headline, /over your \$15\.00 limit for one customer/);

  const others: Pending[] = Array.from({ length: 4 }, (_, i) => ({ tab: `T${i}` as Address, serial: i, amount: 12n * USD }));
  assert.equal(run(v, tab, others).tripped, "total");

  const unknown = run(v, undefined);
  assert.equal(unknown.decision, "accept");
  assert.match(unknown.warnings[0], /Unverified tab/);
});

test("bonus drops are deterministic and bound to the committed seed", async () => {
  const { DROPS, rollDrop, seedMatches, sha256 } = await import("../app/lib/fair.ts");
  const seed = new Uint8Array(32).fill(7);
  const nonce = new Uint8Array(16).fill(9);
  const a = await rollDrop(seed, nonce, 8);
  const b = await rollDrop(seed, nonce, 8);
  assert.equal(a.roll, b.roll);
  assert.equal(a.drop.item, DROPS.find((d) => a.roll <= d.upTo)!.item);
  assert.notDeepEqual((await rollDrop(seed, nonce, 9)).hash, a.hash);
  assert.equal(await seedMatches(seed, await sha256(seed)), true);
  assert.equal(await seedMatches(nonce, await sha256(seed)), false);
});

test("the AI officer can only decline when the code found a warning sign", async () => {
  const { officerLine, verdict, warningSigns } = await import("../app/lib/officer.ts");
  const clean = { amount: 3_500_000n, coverageLeft: 40_000_000n, tabsOpened: 1, tabsClosedClean: 0, shortfalls: 0, vouchersSettled: 0, waitingFromTab: 0, syncAgeMin: 2 };
  assert.deepEqual(warningSigns(clean), []);
  assert.equal(verdict(clean, "new_payer"), "accept"); // a wrong model answer can't decline a clean voucher
  assert.equal(officerLine(clean, "accept"), "Looks fine: 8% of this tab, first tab from this customer.");
  assert.equal(officerLine({ ...clean, tabsOpened: 38, tabsClosedClean: 37 }, "accept"), "Looks fine: 8% of this tab, 37 clean tabs before.");
  const risky = { ...clean, amount: 30_000_000n };
  assert.match(warningSigns(risky).join("; "), /75% of the tab in one sale/);
  assert.equal(verdict(risky, "large_share"), "decline");
  assert.equal(verdict(risky, "clean_history"), "accept");
  assert.match(officerLine(risky, "decline"), /^Caution: 75% of the tab in one sale/);
});

test("tighten-only: the officer never overrides a rules decline, and no answer means the rules decide", async () => {
  const { finalDecision, parseOpinion, withTimeout } = await import("../app/lib/officer.ts");
  const facts = { amount: 30_000_000n, coverageLeft: 40_000_000n, tabsOpened: 1, tabsClosedClean: 0, shortfalls: 0, vouchersSettled: 0, waitingFromTab: 0, syncAgeMin: 2 };
  // (a) rules decline + model says accept -> decline
  assert.deepEqual(finalDecision("decline", { decision: "accept" }), { decision: "decline", by: "rules" });
  // the officer can turn an accept into a decline
  assert.deepEqual(finalDecision("accept", { decision: "decline" }), { decision: "decline", by: "officer" });
  // (b) junk, an unknown reason, or no answer at all -> the rules decide
  assert.equal(parseOpinion("not json at all", facts), null);
  assert.equal(parseOpinion('{"reason":"trust_me"}', facts), null);
  assert.equal(parseOpinion(undefined, facts), null);
  assert.deepEqual(finalDecision("accept", null), { decision: "accept", by: "rules" });
  assert.equal(parseOpinion('{"reason":"large_share"}', facts)?.decision, "decline");
  // a model that never answers times out to null
  assert.equal(await withTimeout(new Promise(() => {}), 20), null);
  assert.equal(await withTimeout(Promise.resolve("ok"), 20), "ok");
});

test("the phone key can't leave the device: exporting the private key fails", async () => {
  // Same call the phone uses (app/lib/phone.ts deviceKey): Kit's generateKeyPair makes a non-extractable Ed25519 key.
  const pair = await generateKeyPair();
  assert.equal(pair.privateKey.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("pkcs8", pair.privateKey));
  await assert.rejects(crypto.subtle.exportKey("jwk", pair.privateKey));
  assert.equal((await crypto.subtle.exportKey("raw", pair.publicKey)).byteLength, 32); // the public half is shareable
});

test("hash-chained vouchers: a fork after the same voucher is rejected, a proper chain is fine", async () => {
  const { chainLink } = await import("../app/lib/voucher.ts");
  const { v, tab } = await setup();
  const withLink = (link: Uint8Array, serial: number) => {
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    nonce.set(link, 4);
    return { ...v, serial, nonce };
  };
  const first = withLink(new Uint8Array(8), 1); // start of the chain
  const link1 = await chainLink(voucherBytes({ ...first, programId: PROGRAM_ID, merchant: first.tab }));
  const second = withLink(link1, 2);
  const forked = withLink(link1, 3); // a second voucher signed after the same predecessor
  const seenAfter = (xs: SignedVoucher[]) => xs.map((x) => ({ tab: x.tab, serial: x.serial, nonce: x.nonce }));
  const check = (x: SignedVoucher, held: SignedVoucher[]) =>
    assess({ v: x, signatureOk: true, tab, pending: [], seen: seenAfter(held), risk: DEFAULT_RISK, nowSec: NOW, nowMs: 0 });
  assert.equal(check(second, [first]).decision, "accept");
  const verdict = check(forked, [first, second]);
  assert.equal(verdict.decision, "decline");
  assert.match(verdict.headline, /^Fork: this phone signed No\. 0002 and No\. 0003/);
  // two chain starts (e.g. a reinstalled app) are not called a fork
  assert.equal(check(withLink(new Uint8Array(8), 4), [first]).decision, "accept");
});

test("budget planner math: weights add to 100, per-day split, impact lines", async () => {
  const { DEFAULT_WEIGHTS, impactLine, normalizeWeights, planFor } = await import("../app/lib/planner.ts");
  assert.deepEqual(normalizeWeights({ water: 20, food: 50, transport: 5, phone_credit: 25 }), { water: 20, food: 50, transport: 5, phone_credit: 25 });
  const odd = normalizeWeights({ water: 1, food: 1, transport: 1, phone_credit: 0 })!;
  assert.equal(Object.values(odd).reduce((a, b) => a + b, 0), 100);
  assert.equal(normalizeWeights({ water: "x", food: -5 }), null); // junk -> caller uses the default plan
  const plan = planFor(36n * USD, 3, DEFAULT_WEIGHTS, "stuck", "default");
  assert.equal(plan.perDay.food, 5_400_000n); // $12/day x 45%
  assert.match(impactLine(plan, "food", 0n, 2_160_000n), /^This is 40% of today's food budget/);
  assert.match(impactLine(plan, "food", 4_000_000n, 2_000_000n), /^This goes \$0\.60 over today's food budget/);
});

test("pay by sound: two messages under ggwave's 140-byte limit rebuild the voucher in any order", async () => {
  const { v } = await setup();
  const code = encodeVoucher({ ...v, mint: MINT }); // the mint is left out on air and restored from config
  const [a, b] = soundChunks(code);
  assert.ok(a.length <= 140 && b.length <= 140);
  const join = chunkJoiner();
  assert.equal(join(b), null);
  assert.equal(join(Uint8Array.of(1, 2, 3)), null); // stray noise is ignored
  assert.equal(join(a), code);
  const flipped = chunkJoiner();
  assert.equal(flipped(a), null);
  assert.equal(flipped(b), code);
  assert.throws(() => soundChunks("WV1.abc"));
});
