"use client";

import type { KeyPairSigner } from "@solana/kit";
import { get, set } from "idb-keyval";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Crossing, type Boat } from "../../components/crossing";
import { Doggett } from "../../components/doggett";
import { FirstRun } from "../../components/guide";
import { ListenButton } from "../../components/sound";
import { Scanner } from "../../components/scanner";
import { Ticket } from "../../components/ticket";
import { TxStatus, lamportsToSol, type TxState } from "../../components/tx-status";
import { hex } from "../../lib/fair.ts";
import { commitSeed, revealSeed, studioState } from "../../lib/game.ts";
import { Addr, Money, QrCode, Signal, TxLink, WhatsThis } from "../../components/ui";
import { assess, type Assessment, type Pending, type RiskSettings } from "../../lib/assess.ts";
import { fetchSolBalance, secondsToFinalized } from "../../lib/chain.ts";
import { decodeVoucher, stickerCode, type SignedVoucher } from "../../lib/codes.ts";
import { PROGRAM_ID, ago, formatUsd, parseUsd, serialLabel } from "../../lib/config.ts";
import { OFFICER_MODEL, askOfficer, finalDecision, loadOfficer, officerSupported, type OfficerFacts, type Opinion } from "../../lib/officer.ts";
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
  courierBundle,
  type BatchResult,
  type Queued,
  type Snapshot,
} from "../../lib/shop.ts";
import { useNow } from "../../lib/use-now.ts";
import { useOnline } from "../../lib/use-online.ts";
import { verifyVoucherSignature } from "../../lib/voucher.ts";

const OFFICER_LABEL = OFFICER_MODEL.split("-Instruct")[0].replace(/-/g, " ");
const SYNC_ERROR = "Couldn't reach devnet to sync tabs.";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// A settlement costs 5,000 lamports for the transaction plus 5,000 per Ed25519 check (one per voucher);
// the shop's first settlement also opens its token account (rent ~1,488,440 lamports on devnet now).
const vouchersFor = (lamports: bigint) => Math.max(0, Math.floor(Number(lamports - 1_488_440n) / 10_000));
const sumOf = (queue: Queued[], codes: string[]) => queue.filter((q) => codes.includes(q.code)).reduce((a, q) => a + q.v.amount, 0n);

type Check = {
  code: string;
  v: SignedVoucher;
  verifyMs: number;
  signatureOk: boolean;
  result: Assessment;
  officer?: { s: "thinking" } | { s: "done"; opinion: Opinion } | { s: "failed" };
};
/** Real measurements from this device's last settlement and AI decision. */
type Numbers = {
  vouchers?: number;
  txs?: number;
  confirmedS?: number;
  finalizedS?: number | null | "waiting";
  cu?: bigint;
  feeLamports?: bigint;
  aiMs?: number;
};
type OfficerState = { status: "off" | "unsupported" | "ready" | "error" } | { status: "loading"; progress: number };

export default function ShopPage() {
  const online = useOnline();
  const [shop, setShop] = useState<KeyPairSigner | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [risk, setRisk] = useState<RiskSettings | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [heard, setHeard] = useState<number | null>(null); // seconds, when the voucher came by sound
  const [lastTrip, setLastTrip] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [batches, setBatches] = useState<BatchResult[]>([]);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [arriving, setArriving] = useState<Set<string>>(new Set());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [officer, setOfficer] = useState<OfficerState>({ status: "off" });
  const [numbers, setNumbers] = useState<Numbers | null>(null);
  const saveNumbers = useCallback((patch: Partial<Numbers>) => {
    setNumbers((n) => {
      const next = { ...(n ?? {}), ...patch } as Numbers;
      void set("shop:numbers", next);
      return next;
    });
  }, []);

  const startOfficer = useCallback(() => {
    if (!officerSupported()) return setOfficer({ status: "unsupported" });
    setOfficer({ status: "loading", progress: 0 });
    void set("shop:officer-on", true);
    loadOfficer((p) => setOfficer({ status: "loading", progress: p.progress })).then(
      () => setOfficer({ status: "ready" }),
      () => setOfficer({ status: "error" }),
    );
  }, []);

  // Once turned on, the officer loads from this browser's cache on every visit, with or without a network.
  useEffect(() => {
    if (!officerSupported()) {
      Promise.resolve().then(() => setOfficer({ status: "unsupported" }));
      return;
    }
    get<boolean>("shop:officer-on").then((on) => on && startOfficer());
  }, [startOfficer]);
  const now = useNow();

  const reloadQueue = useCallback(async () => setQueue(await loadQueue()), []);

  useEffect(() => {
    (async () => {
      setShop(await shopSigner());
      setName(await loadName());
      setSnap((await loadSnapshot()) ?? null);
      setRisk(await loadRisk());
      setNumbers((await get<Numbers>("shop:numbers")) ?? null);
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

  if (!shop || name === null || !risk)
    return (
      <div className="flex items-center gap-3">
        <Doggett pose="waiting" size={56} />
        <p className="text-lg">Opening the shop…</p>
      </div>
    );
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
      seen: queue.filter((q) => q.status !== "failed").map((q) => ({ tab: q.v.tab, serial: q.v.serial, nonce: q.v.nonce })),
      risk: risk!,
      nowSec: BigInt(Math.floor(Date.now() / 1000)),
      syncedAtMs: snap?.at,
      nowMs: Date.now(),
    });
    if (result.tripped) setLastTrip(`${serialLabel(v.serial)} for ${formatUsd(v.amount)}: ${result.tripped === "perCustomer" ? "over the one-customer limit" : "over the total limit"}`);
    // The AI officer only reviews what the rules accepted, and can only turn it down.
    const ask = result.decision === "accept" && officer.status === "ready";
    setCheck({ code, v, verifyMs, signatureOk, result, officer: ask ? { s: "thinking" } : undefined });
    if (!ask) return;
    const tab = snap?.tabs[v.tab];
    const record = tab ? snap?.payers[tab.owner] : undefined;
    const facts: OfficerFacts = {
      amount: v.amount,
      coverageLeft: result.coverageLeft,
      tabsOpened: record?.tabsOpened,
      tabsClosedClean: record?.tabsClosedClean,
      shortfalls: record?.shortfalls,
      vouchersSettled: record?.vouchersSettled,
      waitingFromTab: pending.filter((p) => p.tab === v.tab).length,
      syncAgeMin: snap ? Math.round((Date.now() - snap.at) / 60_000) : undefined,
    };
    const opinion = await askOfficer(facts);
    setCheck((c) => (c?.code === code ? { ...c, officer: opinion ? { s: "done", opinion } : { s: "failed" } } : c));
    if (opinion) saveNumbers({ aiMs: opinion.ms });
  }

  async function accept() {
    if (!check || !acceptable || check.officer?.s === "thinking") return;
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
    const started = performance.now(); // the moment the shop is back online and presses Settle
    try {
      const results = await settleAll(
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
      const sents = results.flatMap((r) => r.sents);
      const vouchers = results.reduce((n, r) => n + r.codes.length - r.failed.length, 0);
      if (sents.length > 0) {
        const last = sents[sents.length - 1];
        saveNumbers({
          vouchers,
          txs: sents.length,
          confirmedS: (performance.now() - started) / 1000,
          finalizedS: "waiting",
          cu: sents.reduce((a, x) => a + (x.computeUnits ?? 0n), 0n),
          feeLamports: sents.reduce((a, x) => a + (x.feeLamports ?? 0n), 0n),
        });
        secondsToFinalized(last.signature, started).then((f) => saveNumbers({ finalizedS: f }));
      }
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
  // Tighten-only: the rules decide first, the officer can only turn an accept into a decline.
  const acceptable = !!check && finalDecision(check.result.decision, check.officer?.s === "done" ? check.officer.opinion : null).decision === "accept";
  const lastSigs = new Set([...batches].reverse().find((b) => b.sents.length > 0)?.sents.map((x) => x.signature) ?? []);
  const lastSettled = queue.filter((q) => q.sent && lastSigs.has(q.sent.signature));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-10">
        <FirstRun role="shop" />
        {!online && (
          <p role="status" className="flex items-center gap-3 rounded-2xl bg-night px-5 py-4 text-lg font-semibold text-on-night">
            <span aria-hidden className="mono">[....]</span>
            No signal. That&apos;s fine. Tickets still check offline.
          </p>
        )}
        <section aria-label="Check a ferry ticket" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h1 className="text-5xl md:text-6xl">Check a ferry ticket</h1>
            <span className="mono text-sm">{name}</span>
          </div>
          {!check ? (
            <div className="paper p-5">
              <Scanner
                title="Scan the customer's ferry ticket"
                pasteHint="No camera? Paste the ticket code (it starts with WV1.)"
                accept={(t) => (decodeVoucher(t) ? null : "That isn't a Wherry voucher.")}
                onResult={(c) => (setHeard(null), onVoucher(c))}
              />
              <div className="mt-4 border-t border-line pt-4">
                <ListenButton onCode={(c, s) => (setHeard(s), onVoucher(c))} />
              </div>
            </div>
          ) : (
            <div className="paper grid gap-6 p-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <div className="self-start">
                <Ticket serial={check.v.serial} shopName={name} amount={check.v.amount} tab={check.v.tab} onPaper />
              </div>
              <div className="flex flex-col gap-3">
                {heard !== null && (
                  <span className="flex items-center gap-2 text-sm">
                    <Doggett pose="success" size={36} />
                    Heard by sound in <span className="mono">{heard.toFixed(1)} s</span>
                  </span>
                )}
                {check.signatureOk ? (
                  <Signal tone="ok">
                    Signature valid · checked offline in <span className="mono">{check.verifyMs < 1 ? "<1" : Math.round(check.verifyMs)} ms</span>
                  </Signal>
                ) : null}
                {check.result.decision !== "accept" && <Doggett pose="error" size={56} />}
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
                {check.officer?.s === "thinking" && <p className="text-sm text-muted">AI officer is reading this voucher on this device…</p>}
                {check.officer?.s === "done" && (
                  <Signal tone={check.officer.opinion.decision === "accept" ? "ok" : "err"}>
                    <span className="label mr-2 text-ink">AI officer</span>
                    {check.officer.opinion.line}{" "}
                    <span className="text-sm text-muted">
                      ({OFFICER_LABEL}, <span className="mono">{(check.officer.opinion.ms / 1000).toFixed(1)} s</span>, on this device)
                    </span>
                  </Signal>
                )}
                {check.officer?.s === "failed" && <p className="text-sm text-muted">The AI officer didn&apos;t answer in time, so your rules decide.</p>}
                <div className="mt-2 flex flex-wrap gap-3">
                  {acceptable ? (
                    <button type="button" className="btn btn-sail" onClick={accept} disabled={check.officer?.s === "thinking"}>
                      Accept {formatUsd(check.v.amount)}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-quiet" onClick={() => setCheck(null)}>
                    {acceptable ? "Cancel" : "Scan another"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section aria-label="Tickets to collect" className="flex flex-col gap-5 border-t border-line pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-4xl">Tickets to collect</h2>
              <p className="text-lg">
                {pending.length === 0 ? "Nothing waiting to collect." : (
                  <>
                    <span className="mono">{pending.length}</span> waiting · <Money units={pendingTotal} /> to collect.
                  </>
                )}
              </p>
              <WhatsThis term="Settle">Collecting sends your tickets to Solana in one transaction. It checks every signature again and pays you from each customer&apos;s locked tab.</WhatsThis>
            </div>
            {pending.length > 0 && (
              <button type="button" className={`btn ${settlePrimary ? "btn-sail" : "btn-quiet"}`} disabled={!online || settling} onClick={settle}>
                {settling ? "Collecting…" : `Collect ${formatUsd(pendingTotal)}`}
              </button>
            )}
          </div>
          {!online && pending.length > 0 && <p className="text-sm text-warn">Tickets wait safely here. Collect when the network is back.</p>}
          {queue.length === 0 ? (
            <div className="flex items-center gap-4">
              <p className="text-muted">No tickets yet. Accepted tickets wait on the near bank and cross when you collect.</p>
            </div>
          ) : (
            <Crossing boats={boats} />
          )}
          {settling && batches.length === 0 && (
            <div className="flex items-center gap-3">
              <Doggett pose="waiting" size={48} />
              <span className="text-lg">Collecting: Solana is checking every signature…</span>
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
                        ✓ Collected {plural(landed.length, "ticket")} · {b.sents.length === 1 ? "one transaction" : `${b.sents.length} transactions`} ·{" "}
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
            <div className="flex flex-wrap items-center gap-6" aria-label="Just collected">
              <Doggett pose="success" size={72} />
              {lastSettled.map((q) => (
                <div key={q.code} className="w-80 w-rise">
                  <Ticket serial={q.v.serial} shopName={name} amount={q.v.amount} stamp={`${q.sent!.seconds.toFixed(1)} s`} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-8 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-6">
        <Sticker shop={shop} name={name} online={online} />
        <RiskCircuit risk={risk} pending={pending} lastTrip={lastTrip} onChange={async (r) => (setRisk(r), await saveRisk(r))} />
        <OfficerPanel state={officer} onStart={startOfficer} onStop={async () => (await set("shop:officer-on", false), setOfficer({ status: "off" }))} />
        <StudioPanel shop={shop} online={online} />
        <NumbersPanel n={numbers} />
        <CourierPanel pending={pending.length} />
        <section aria-label="Tab list" className="flex flex-col gap-2">
          <h2 className="text-2xl">Tab list</h2>
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
      <FirstRun role="shop" />
      <h1 className="text-5xl">Set up your shop</h1>
      <p className="text-lg">Your shop gets its own key in this browser. Customers scan your sticker to pay you, and you collect their ferry tickets with this key later.</p>
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
      <span className="label text-ink">Pay {name} with Wherry</span>
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

/** Hand vouchers to whoever finds a signal first, with this shop's signed consent to a capped fee. */
function CourierPanel({ pending }: { pending: number }) {
  const [bundle, setBundle] = useState<string | null>(null);
  return (
    <section aria-label="Hand to a courier" className="flex flex-col gap-2">
      <h2 className="text-2xl">Hand to a courier</h2>
      <p className="text-sm text-muted">
        No signal here? Anyone who finds one can collect your tickets for you. You sign a note allowing a fee of 1%, at most $0.05 a ticket, valid for 48 hours. The money
        still comes to you.
      </p>
      {pending === 0 ? (
        <p className="text-sm text-muted">No tickets waiting.</p>
      ) : (
        <button type="button" className="link self-start text-sm" onClick={async () => setBundle((await courierBundle()).text)}>
          Make a courier bundle for {pending} ticket{pending === 1 ? "" : "s"}
        </button>
      )}
      {bundle && (
        <div className="flex flex-col gap-1">
          <textarea className="field mono min-h-24 text-xs" readOnly value={bundle} aria-label="Courier bundle" />
          <button type="button" className="link self-start text-sm" onClick={() => navigator.clipboard.writeText(bundle)}>
            Copy bundle
          </button>
        </div>
      )}
    </section>
  );
}

function NumbersPanel({ n }: { n: Numbers | null }) {
  const per = (v: bigint | undefined) => (v !== undefined && n?.vouchers ? v / BigInt(n.vouchers) : undefined);
  const rows: [string, React.ReactNode][] = [
    ["Back online → confirmed", n?.confirmedS !== undefined ? `${n.confirmedS.toFixed(1)} s (${n.vouchers} voucher${n.vouchers === 1 ? "" : "s"}, ${n.txs} tx)` : "—"],
    ["Back online → finalized", n?.finalizedS === "waiting" ? "waiting for finality…" : typeof n?.finalizedS === "number" ? `${n.finalizedS.toFixed(1)} s` : n?.finalizedS === null ? "not seen within 60 s" : "—"],
    ["Compute", n?.cu !== undefined ? `${n.cu.toLocaleString("en-US")} CU · ${per(n.cu)?.toLocaleString("en-US")} per voucher` : "—"],
    ["Fee", n?.feeLamports !== undefined ? `${lamportsToSol(n.feeLamports)} · ${lamportsToSol(per(n.feeLamports) ?? 0n)} per voucher` : "—"],
    ["AI decision, offline", n?.aiMs !== undefined ? `${(n.aiMs / 1000).toFixed(1)} s` : "—"],
  ];
  return (
    <section aria-label="Measured on this device" className="flex flex-col gap-2">
      <h2 className="text-2xl">Measured here</h2>
      <p className="text-sm text-muted">Real numbers from your last settlement on devnet and the last AI decision. Nothing estimated.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** This shop can also sell game power-ups: it commits a secret seed before selling and reveals it after settling. */
function StudioPanel({ shop, online }: { shop: KeyPairSigner; online: boolean }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof studioState>> | undefined>(undefined);
  const [tx, setTx] = useState<TxState>({ s: "idle" });
  useEffect(() => {
    if (online) studioState(shop.address).then(setState, () => {});
  }, [online, shop.address]);

  async function run(what: string, fn: typeof commitSeed) {
    setTx({ s: "sending", what });
    try {
      const sent = await fn(shop);
      setTx({ s: "done", what, sent });
      setState(await studioState(shop.address));
    } catch (e) {
      setTx({ s: "error", message: explainError(e).message });
    }
  }

  return (
    <section aria-label="Game studio" className="flex flex-col gap-2">
      <h2 className="text-2xl">Game studio</h2>
      <p className="text-sm text-muted">
        Sell power-ups for Doggett&apos;s Crossing. Commit a secret seed before you sell and reveal it after you settle, so players can check their bonus drops.
      </p>
      {state === undefined ? (
        <p className="text-sm text-muted">{online ? "Reading your seed from devnet…" : "Connect to see your seed."}</p>
      ) : state?.committed ? (
        <div className="flex flex-col gap-1 text-sm">
          <span>
            Seed for round <span className="mono">{state.epoch}</span> committed: <span className="mono">{hex(state.hash).slice(0, 12)}…</span>
          </span>
          <button type="button" className="link self-start" disabled={!online || tx.s === "sending"} onClick={() => run("Seed revealed", revealSeed)}>
            Reveal the seed (after settling)
          </button>
        </div>
      ) : (
        <button type="button" className="link self-start text-sm" disabled={!online || tx.s === "sending"} onClick={() => run("Seed committed", commitSeed)}>
          Commit a secret seed
        </button>
      )}
      <TxStatus state={tx} compact />
    </section>
  );
}

function OfficerPanel({ state, onStart, onStop }: { state: OfficerState; onStart: () => void; onStop: () => void }) {
  return (
    <section aria-label="AI risk officer" className="flex flex-col gap-2">
      <h2 className="text-2xl">AI risk officer</h2>
      <p className="text-sm text-muted">
        A small language model ({OFFICER_LABEL}) running in this browser on WebGPU. It reads each voucher your rules accept and can
        turn it down. It can never accept one the rules decline.
      </p>
      {state.status === "off" && (
        <button type="button" className="btn btn-quiet self-start text-sm" onClick={onStart}>
          Download once (about 1 GB), then it works offline
        </button>
      )}
      {state.status === "loading" && (
        <div className="flex flex-col gap-1 text-sm">
          <span>Getting the officer ready: {Math.round(state.progress * 100)}%</span>
          <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={Math.round(state.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-ink" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
        </div>
      )}
      {state.status === "ready" && (
        <p className="flex flex-wrap gap-x-3 text-sm">
          <span className="text-ok">✓ Ready. It runs on this device and needs no network.</span>
          <button type="button" className="link" onClick={onStop}>
            Turn off
          </button>
        </p>
      )}
      {state.status === "unsupported" && (
        <p className="text-sm">
          <strong>Rules only on this device.</strong> <span className="text-muted">This browser has no WebGPU, so the AI officer can&apos;t run here. Your coverage checks and risk limits still apply.</span>
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-err">
          The officer didn&apos;t load. Its first load needs the network, and it needs about 1.6 GB of graphics memory. Your rules still apply.{" "}
          <button type="button" className="link" onClick={onStart}>
            Try again
          </button>
        </p>
      )}
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
        <h2 className="text-2xl">Risk circuit</h2>
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
