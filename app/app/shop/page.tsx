"use client";

import type { KeyPairSigner } from "@solana/kit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Crossing, type Boat } from "../../components/crossing";
import { Doggett } from "../../components/doggett";
import { Scanner } from "../../components/scanner";
import { Ticket } from "../../components/ticket";
import { lamportsToSol } from "../../components/tx-status";
import { Addr, Money, QrCode, Signal, TxLink } from "../../components/ui";
import { assess, type Assessment, type Pending, type RiskSettings } from "../../lib/assess.ts";
import { fetchSolBalance } from "../../lib/chain.ts";
import { decodeVoucher, stickerCode, type SignedVoucher } from "../../lib/codes.ts";
import { PROGRAM_ID, ago, formatUsd, parseUsd, serialLabel } from "../../lib/config.ts";
import {
  enqueue,
  loadName,
  loadQueue,
  loadRisk,
  loadSnapshot,
  saveName,
  saveRisk,
  settleAll,
  shopSigner,
  syncSnapshot,
  explainError,
  type BatchResult,
  type Queued,
  type Snapshot,
} from "../../lib/shop.ts";
import { useNow } from "../../lib/use-now.ts";
import { useOnline } from "../../lib/use-online.ts";
import { verifyVoucherSignature } from "../../lib/voucher.ts";

const SYNC_ERROR = "Couldn't reach devnet to sync tabs.";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// A settlement costs 5,000 lamports for the transaction plus 5,000 per Ed25519 check (one per voucher);
// the shop's first settlement also opens its token account (rent ~1,488,440 lamports on devnet now).
const vouchersFor = (lamports: bigint) => Math.max(0, Math.floor(Number(lamports - 1_488_440n) / 10_000));
const sumOf = (queue: Queued[], codes: string[]) => queue.filter((q) => codes.includes(q.code)).reduce((a, q) => a + q.v.amount, 0n);

type Check = { code: string; v: SignedVoucher; verifyMs: number; signatureOk: boolean; result: Assessment };

export default function ShopPage() {
  const online = useOnline();
  const [shop, setShop] = useState<KeyPairSigner | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [risk, setRisk] = useState<RiskSettings | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [lastTrip, setLastTrip] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [batches, setBatches] = useState<BatchResult[]>([]);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [arriving, setArriving] = useState<Set<string>>(new Set());
  const [syncError, setSyncError] = useState<string | null>(null);
  const now = useNow();

  const reloadQueue = useCallback(async () => setQueue(await loadQueue()), []);

  useEffect(() => {
    (async () => {
      setShop(await shopSigner());
      setName(await loadName());
      setSnap((await loadSnapshot()) ?? null);
      setRisk(await loadRisk());
      await reloadQueue();
    })();
  }, [reloadQueue]);

  const sync = useCallback(async () => {
    try {
      setSnap(await syncSnapshot());
      setSyncError(null);
    } catch {
      setSyncError(SYNC_ERROR);
    }
  }, []);

  // Keep the offline tab list fresh whenever there's a network.
  useEffect(() => {
    if (online && name) syncSnapshot().then(setSnap, () => setSyncError(SYNC_ERROR));
  }, [online, name]);

  const pending: Pending[] = useMemo(
    () => queue.filter((q) => q.status === "pending").map((q) => ({ tab: q.v.tab, serial: q.v.serial, amount: q.v.amount })),
    [queue],
  );

  if (!shop || name === null || !risk) return <p className="text-muted">Opening the shop…</p>;
  if (!name) return <Setup onDone={(n) => setName(n)} />;

  async function onVoucher(code: string) {
    const v = decodeVoucher(code)!;
    const started = performance.now();
    const signatureOk = await verifyVoucherSignature(PROGRAM_ID, shop!.address, v);
    const verifyMs = performance.now() - started;
    const result = assess({
      v,
      signatureOk,
      tab: snap?.tabs[v.tab],
      pending,
      seen: queue.filter((q) => q.status !== "failed").map((q) => ({ tab: q.v.tab, serial: q.v.serial })),
      risk: risk!,
      nowSec: BigInt(Math.floor(Date.now() / 1000)),
      syncedAtMs: snap?.at,
      nowMs: Date.now(),
    });
    if (result.tripped) setLastTrip(`${serialLabel(v.serial)} for ${formatUsd(v.amount)}: ${result.tripped === "perCustomer" ? "over the one-customer limit" : "over the total limit"}`);
    setCheck({ code, v, verifyMs, signatureOk, result });
  }

  async function accept() {
    if (!check || check.result.decision !== "accept") return;
    await enqueue({ code: check.code, v: check.v, acceptedAt: Date.now(), verifyMs: check.verifyMs, status: "pending" });
    setCheck(null);
    await reloadQueue();
  }

  async function settle() {
    setSettling(true);
    setBatches([]);
    setSettleError(null);
    // ?tx=v0 forces the one-voucher-per-v0-transaction fallback, for testing it.
    const forceV0 = new URLSearchParams(window.location.search).get("tx") === "v0";
    try {
      await settleAll(
        async (r) => {
          setBatches((b) => [...b, r]);
          await reloadQueue();
          const landed = r.codes.filter((c) => !r.failed.some((f) => f.code === c));
          if (landed.length > 0) {
            setArriving((a) => new Set([...a, ...landed]));
            setTimeout(() => setArriving((a) => new Set([...a].filter((c) => !landed.includes(c)))), 1500);
          }
        },
        { forceV0 },
      );
      await sync();
    } catch (e) {
      setSettleError(explainError(e).message);
    } finally {
      setSettling(false);
      await reloadQueue();
    }
  }

  const boats: Boat[] = queue.map((q) => ({
    id: q.code,
    serial: q.v.serial,
    amount: q.v.amount,
    where: q.status === "settled" ? "far" : q.status === "failed" ? "stuck" : "near",
    note: q.status === "settled" && q.sent ? `${q.sent.seconds.toFixed(1)} s` : q.error,
    arriving: arriving.has(q.code),
  }));
  const pendingTotal = pending.reduce((a, p) => a + p.amount, 0n);
  const payer = check ? snap?.payers[snap.tabs[check.v.tab]?.owner ?? ""] : undefined;
  const settlePrimary = !check && pending.length > 0;
  const lastSigs = new Set([...batches].reverse().find((b) => b.sents.length > 0)?.sents.map((x) => x.signature) ?? []);
  const lastSettled = queue.filter((q) => q.sent && lastSigs.has(q.sent.signature));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-10">
        <section aria-label="Accept a voucher" className="flex flex-col gap-4">
          <h1 className="text-4xl">Accept a voucher</h1>
          {!check ? (
            <div className="paper p-5">
              <Scanner
                title="Scan the customer's voucher"
                pasteHint="No camera? Paste the voucher code (it starts with WV1.)"
                accept={(t) => (decodeVoucher(t) ? null : "That isn't a Wherry voucher.")}
                onResult={onVoucher}
              />
            </div>
          ) : (
            <div className="paper grid gap-6 p-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <div className="self-start">
                <Ticket serial={check.v.serial} shopName={name} amount={check.v.amount} tab={check.v.tab} onPaper />
              </div>
              <div className="flex flex-col gap-3">
                {check.signatureOk ? (
                  <Signal tone="ok">
                    Signature valid · checked offline in <span className="mono">{check.verifyMs < 1 ? "<1" : Math.round(check.verifyMs)} ms</span>
                  </Signal>
                ) : null}
                <Signal tone={check.result.decision === "accept" ? "ok" : "err"}>{check.result.headline}</Signal>
                {check.result.warnings.map((w) => (
                  <Signal key={w} tone="warn">
                    {w}
                  </Signal>
                ))}
                {payer && (
                  <p className="text-sm text-muted">
                    Payer record: {plural(payer.tabsOpened, "tab")}, {payer.tabsClosedClean} closed clean, {plural(payer.vouchersSettled, "voucher")} paid,{" "}
                    {payer.shortfalls === 0 ? "no shortfalls" : `${payer.shortfalls} shortfalls (${formatUsd(payer.shortfallAmount)})`}.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  {check.result.decision === "accept" ? (
                    <button type="button" className="btn btn-sail" onClick={accept}>
                      Accept {formatUsd(check.v.amount)}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-quiet" onClick={() => setCheck(null)}>
                    {check.result.decision === "accept" ? "Cancel" : "Scan another"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section aria-label="Vouchers" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">The Crossing</h2>
              <p className="text-sm text-muted">
                {pending.length === 0 ? "Nothing waiting to settle." : `${pending.length} waiting · ${formatUsd(pendingTotal)} to collect.`}
              </p>
            </div>
            {pending.length > 0 && (
              <button type="button" className={`btn ${settlePrimary ? "btn-sail" : "btn-quiet"}`} disabled={!online || settling} onClick={settle}>
                {settling ? "Settling…" : `Settle ${pending.length} voucher${pending.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
          {!online && pending.length > 0 && <p className="text-sm text-warn">You&apos;re offline. Vouchers wait safely here; settle when the network is back.</p>}
          {queue.length === 0 ? (
            <div className="flex items-center gap-4">
              <Doggett pose="welcome" size={72} />
              <p className="text-muted">No vouchers yet. Accepted vouchers wait on the near bank and cross when you settle.</p>
            </div>
          ) : (
            <Crossing boats={boats} />
          )}
          {settling && batches.length === 0 && (
            <div className="flex items-center gap-3">
              <Doggett pose="waiting" size={48} />
              <span>Settling: checking every signature onchain…</span>
            </div>
          )}
          {batches.length > 0 && (
            <ul className="flex flex-col gap-2" aria-live="polite">
              {batches.map((b, i) => {
                const landed = b.codes.filter((c) => !b.failed.some((f) => f.code === c));
                const seconds = Math.max(0, ...b.sents.map((x) => x.seconds));
                const fee = b.sents.reduce((a, x) => a + (x.feeLamports ?? 0n), 0n);
                return (
                  <li key={i} className="flex flex-col gap-1">
                    {landed.length > 0 && (
                      <span className="text-ok">
                        ✓ Settled {plural(landed.length, "voucher")} · {b.sents.length === 1 ? "one transaction" : `${b.sents.length} transactions`} ·{" "}
                        <span className="mono whitespace-nowrap">{seconds.toFixed(1)} s</span>. {formatUsd(sumOf(queue, landed))} is in your account.{" "}
                        <span className="text-muted">
                          Fee <span className="mono">{lamportsToSol(fee)}</span> ·{" "}
                        </span>
                        {b.sents.map((x, j) => (
                          <span key={x.signature}>
                            {j > 0 && " · "}
                            <TxLink signature={x.signature}>{b.sents.length === 1 ? "Explorer" : `Tx ${j + 1}`}</TxLink>
                          </span>
                        ))}
                      </span>
                    )}
                    {b.failed.map((f) => (
                      <span key={f.code} className="text-err">
                        ✕ {serialLabel(queue.find((q) => q.code === f.code)?.v.serial ?? 0)} not settled: {f.error}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
          {settleError && <p className="text-err">✕ {settleError}</p>}
          {lastSettled.length > 0 && (
            <div className="flex flex-wrap gap-4" aria-label="Just settled">
              {lastSettled.map((q) => (
                <div key={q.code} className="w-72 w-rise">
                  <Ticket serial={q.v.serial} shopName={name} amount={q.v.amount} stamp={`${q.sent!.seconds.toFixed(1)} s`} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-8">
        <Sticker shop={shop} name={name} online={online} />
        <RiskCircuit risk={risk} pending={pending} lastTrip={lastTrip} onChange={async (r) => (setRisk(r), await saveRisk(r))} />
        <section aria-label="Tab list" className="flex flex-col gap-2">
          <h2 className="text-xl">Tab list</h2>
          <p className="text-sm">
            {snap ? (
              <>
                {Object.keys(snap.tabs).length} open tabs · synced <span className={now - snap.at > 3_600_000 ? "text-warn" : ""}>{ago(now - snap.at)}</span>
              </>
            ) : (
              <span className="text-warn">Never synced. Vouchers will show as unverified.</span>
            )}
          </p>
          <p className="text-sm text-muted">Your copy of every open tab and payer record, for checking coverage offline.</p>
          <button type="button" className="link self-start text-sm" disabled={!online} onClick={sync}>
            {online ? "Sync now" : "Sync when online"}
          </button>
          {syncError && <p className="text-sm text-err">{syncError}</p>}
        </section>
      </aside>
    </div>
  );
}

function Setup({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex max-w-text flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        await saveName(value);
        onDone(value.trim().slice(0, 40));
      }}
    >
      <Doggett pose="welcome" size={88} />
      <h1 className="text-4xl">Set up your shop</h1>
      <p>Your shop gets its own key in this browser. Customers scan your sticker to pay you, and you settle their vouchers with this key later.</p>
      <label className="flex flex-col gap-1">
        <span className="label">Shop name</span>
        <input className="field" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} placeholder="Amara's kiosk" />
      </label>
      <button type="submit" className="btn btn-sail self-start" disabled={!value.trim()}>
        Make my sticker
      </button>
    </form>
  );
}

function Sticker({ shop, name, online }: { shop: KeyPairSigner; name: string; online: boolean }) {
  const [sol, setSol] = useState<bigint | null>(null);
  const [faucet, setFaucet] = useState<string | null>(null);
  const code = stickerCode(shop.address, name);
  useEffect(() => {
    if (online) fetchSolBalance(shop.address).then(setSol).catch(() => {});
  }, [online, shop.address, faucet]);
  return (
    <section aria-label="Your sticker" className="paper print-area flex flex-col items-center gap-3 p-5">
      <span className="label">Pay {name} with Wherry</span>
      <QrCode text={code} size={200} label={`Shop sticker QR for ${name}`} />
      <Addr value={shop.address} />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm print:hidden">
        <button type="button" className="link" onClick={() => window.print()}>
          Print sticker
        </button>
        <button type="button" className="link" onClick={() => navigator.clipboard.writeText(code)}>
          Copy code
        </button>
      </div>
      <div className="flex flex-col items-center gap-1 text-sm print:hidden">
        <span className="text-center text-muted">
          Fee balance: {sol === null ? "…" : <span className="mono">{lamportsToSol(sol)}</span>}
          {sol !== null && sol > 0n && <> · enough for about {vouchersFor(sol).toLocaleString("en-US")} vouchers</>}
        </span>
        {sol !== null && sol < 5_000_000n && (
          <button
            type="button"
            className="link"
            disabled={!online}
            onClick={async () => {
              const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: shop.address }) })
                .then((x) => x.json())
                .catch(() => ({ error: "The faucet didn't answer." }));
              setFaucet(r.signature ?? r.error);
            }}
          >
            Get fee money (devnet SOL)
          </button>
        )}
        {faucet && <span className="text-muted">{faucet.length > 60 ? <TxLink signature={faucet}>Sent ✓ Explorer</TxLink> : faucet}</span>}
      </div>
    </section>
  );
}

function RiskCircuit({
  risk,
  pending,
  lastTrip,
  onChange,
}: {
  risk: RiskSettings;
  pending: Pending[];
  lastTrip: string | null;
  onChange: (r: RiskSettings) => void;
}) {
  const total = pending.reduce((a, p) => a + p.amount, 0n);
  const byTab = new Map<string, bigint>();
  for (const p of pending) byTab.set(p.tab, (byTab.get(p.tab) ?? 0n) + p.amount);
  const biggest = [...byTab.values()].reduce((a, b) => (b > a ? b : a), 0n);
  const meter = (value: bigint, cap: bigint) => Math.min(100, cap === 0n ? 100 : Number((value * 100n) / cap));

  return (
    <section aria-label="Risk circuit" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl">Risk circuit</h2>
        <p className="text-sm text-muted">Limits on what you hold unsettled while offline. A voucher that would cross one is declined.</p>
      </div>
      {[
        { key: "perCustomer" as const, label: "One customer", value: biggest },
        { key: "total" as const, label: "All customers", value: total },
      ].map((row) => (
        <div key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{row.label}</span>
            <span>
              <Money units={row.value} /> of{" "}
              <input
                className="field mono inline-block min-h-0 w-20 px-1 py-0 text-sm"
                inputMode="decimal"
                aria-label={`${row.label} limit in dollars`}
                defaultValue={(Number(risk[row.key]) / 1e6).toFixed(2)}
                onBlur={(e) => {
                  const v = parseUsd(e.target.value);
                  if (v && v > 0n) onChange({ ...risk, [row.key]: v });
                  else e.target.value = (Number(risk[row.key]) / 1e6).toFixed(2);
                }}
              />
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunk" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter(row.value, risk[row.key])} aria-label={`${row.label} exposure`}>
            <div className={`h-full ${meter(row.value, risk[row.key]) >= 100 ? "bg-err" : "bg-ink"}`} style={{ width: `${meter(row.value, risk[row.key])}%` }} />
          </div>
        </div>
      ))}
      {lastTrip ? (
        <Signal tone="err">Tripped: {lastTrip}</Signal>
      ) : (
        <p className="text-sm text-muted">Not tripped.</p>
      )}
    </section>
  );
}
