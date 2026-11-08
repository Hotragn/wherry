"use client";

import { useEffect, useState } from "react";
import { River } from "../components/crossing";
import { Doggett } from "../components/doggett";
import { Scanner } from "../components/scanner";
import { Ticket } from "../components/ticket";
import { CopyButton, QrCode, Signal } from "../components/ui";
import type { TabSnapshot } from "../lib/assess.ts";
import { parseSticker } from "../lib/codes.ts";
import { ago, duration, formatUsd, serialLabel, shortAddress } from "../lib/config.ts";
import { hex, rollDrop, seedMatches, type Drop } from "../lib/fair.ts";
import {
  POWER_UP,
  buyPowerUp,
  loadCommitment,
  loadCrossings,
  loadPurchases,
  loadStudio,
  revealedSeed,
  roundOf,
  saveCrossings,
  saveStudio,
  syncCommitment,
  type Commitment,
  type Purchase,
  type Studio,
} from "../lib/game.ts";
import { loadHistory, loadTab } from "../lib/phone.ts";
import { useNow } from "../lib/use-now.ts";
import { useOnline } from "../lib/use-online.ts";

type Proof = { seed: Uint8Array; matches: boolean; roll: number; hash: Uint8Array; drop: Drop };

export default function PlayPage() {
  const online = useOnline();
  const now = useNow();
  const [tab, setTab] = useState<TabSnapshot | null | undefined>(undefined);
  const [spendable, setSpendable] = useState(0n);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [proofs, setProofs] = useState<Record<string, Proof | "sealed">>({});
  const [crossings, setCrossings] = useState(0);
  const [pos, setPos] = useState(0);
  const [bought, setBought] = useState<{ code: string; serial: number; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadTab();
      setTab(saved?.tab ?? null);
      if (saved) {
        const t = saved.tab;
        const unsettled = (await loadHistory())
          .filter((h) => h.tab === t.address && !(t.used[h.serial >> 3] & (1 << (h.serial & 7))))
          .reduce((a, h) => a + h.amount, 0n);
        setSpendable(t.deposited - t.settled - unsettled);
      }
      setStudio((await loadStudio()) ?? null);
      setCommitment((await loadCommitment()) ?? null);
      setPurchases(await loadPurchases());
      setCrossings(await loadCrossings());
    })();
  }, []);

  // While online, keep the studio's commitment fresh, so purchases can be proven fair later.
  useEffect(() => {
    if (online && studio) syncCommitment(studio.merchant).then(setCommitment, () => {});
  }, [online, studio]);

  const sail = purchases.length > 0;

  function row() {
    const next = pos + (sail ? 25 : 12.5);
    if (next >= 100) {
      setPos(0);
      setCrossings(crossings + 1);
      void saveCrossings(crossings + 1);
    } else setPos(next);
  }

  async function buy() {
    if (!tab || !studio) return;
    setBusy(true);
    setNote(null);
    try {
      const started = performance.now();
      const { purchase } = await buyPowerUp(tab, studio);
      setBought({ code: purchase.code, serial: purchase.serial, ms: performance.now() - started });
      setPurchases(await loadPurchases());
      setSpendable((s) => s - POWER_UP.price);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkReveals() {
    setBusy(true);
    const next: Record<string, Proof | "sealed"> = {};
    for (const p of purchases) {
      if (!p.commitment) continue;
      const seed = await revealedSeed(p.studio, p.commitment.epoch).catch(() => null);
      if (!seed) {
        next[p.code] = "sealed";
        continue;
      }
      next[p.code] = { seed, matches: await seedMatches(seed, p.commitment.hash), ...(await rollDrop(seed, p.nonce, p.serial)) };
    }
    setProofs(next);
    setBusy(false);
  }

  if (tab === undefined) return <p className="text-muted">Opening the game…</p>;
  if (tab === null) {
    return (
      <div className="flex max-w-text flex-col gap-4">
        <h1 className="text-4xl">Doggett&apos;s Crossing</h1>
        <p>The game pays for power-ups with your phone&apos;s tab. Pair this phone first: open the Phone tab, show its code to the Owner view, then find your tab.</p>
      </div>
    );
  }

  const canBuy = !!studio && !!commitment && spendable >= POWER_UP.price && !busy;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <section aria-label="Game" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl">Doggett&apos;s Crossing</h1>
            <p className="text-muted">Row the ferry across. Every crossing lands a crate. Works offline.</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="label">Crossings</span>
            <span className="mono text-4xl">{crossings}</span>
          </div>
        </div>
        <div className="paper relative h-48 overflow-hidden p-4">
          <div className="absolute inset-x-0 top-24">
            <River vertical={false} />
          </div>
          <div className="absolute top-8 transition-[left] duration-200 ease-boat" style={{ left: `calc(${pos}% * 0.8)` }}>
            <Doggett pose={sail ? "success" : "welcome"} size={96} decorative />
          </div>
          <span className="absolute bottom-3 left-4 text-sm text-muted">Near bank</span>
          <span className="absolute bottom-3 right-4 text-sm text-muted">Far bank</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={`btn ${sail ? "btn-sail" : "btn-quiet"} min-w-40`} onClick={row}>
            Row
          </button>
          <span className="text-sm text-muted">{sail ? "Full sail: each stroke rows twice as far." : "Eight strokes per crossing."}</span>
        </div>

        <section aria-label="Bonus drops" className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl">Bonus drops</h2>
              <p className="text-sm text-muted">Each power-up comes with a sealed drop. It opens once the studio reveals its seed, and you can check it was fair.</p>
            </div>
            {purchases.length > 0 && (
              <button type="button" className="btn btn-quiet" disabled={!online || busy} onClick={checkReveals}>
                {online ? "Check for reveals" : "Check when online"}
              </button>
            )}
          </div>
          {purchases.length === 0 ? (
            <p className="text-muted">No power-ups yet.</p>
          ) : (
            <ul className="flex flex-col divide-y-[1.5px] divide-line border-y-[1.5px] border-line">
              {purchases.map((p) => (
                <DropRow key={p.code} p={p} proof={proofs[p.code]} now={now} />
              ))}
            </ul>
          )}
        </section>
      </section>

      <aside aria-label="Power-up" className="flex flex-col gap-6">
        {bought ? (
          <div className="flex flex-col items-center gap-3">
            <Signal tone="ok">
              {POWER_UP.name} unlocked in <span className="mono">{Math.round(bought.ms)} ms</span>, checked against your tab on this phone. No network used.
            </Signal>
            <Ticket
              serial={bought.serial}
              shopName={studio?.name ?? "Studio"}
              amount={POWER_UP.price}
              qr={<QrCode text={bought.code} size={220} label={`Power-up voucher ${serialLabel(bought.serial)}`} />}
            />
            <p className="text-center text-sm text-muted">Show this to the studio. They settle it with their other vouchers when they&apos;re online.</p>
            <CopyButton text={bought.code} label="Copy voucher code" />
            <button type="button" className="link text-sm" onClick={() => setBought(null)}>
              Back to the game
            </button>
          </div>
        ) : (
          <div className="paper flex flex-col gap-4 p-5">
            <div>
              <span className="label">Power-up</span>
              <h2 className="text-2xl">{POWER_UP.name}</h2>
              <p className="text-muted">
                {POWER_UP.effect}. <span className="mono">{formatUsd(POWER_UP.price)}</span> in test dollars, paid with a voucher from your tab.
              </p>
            </div>
            {!studio ? (
              <Scanner
                title="Connect the game studio"
                pasteHint="Scan or paste the studio's sticker code (WS1.…)"
                accept={(t) => (parseSticker(t) ? null : "That isn't a studio sticker.")}
                onResult={async (t) => {
                  const s = parseSticker(t)!;
                  await saveStudio(s);
                  setStudio(s);
                }}
              />
            ) : (
              <>
                <p className="text-sm">
                  Studio: <strong>{studio.name}</strong> · <span className="mono">{shortAddress(studio.merchant)}</span>
                </p>
                {commitment ? (
                  <p className="text-sm text-muted">
                    Studio seed for round <span className="mono">{commitment.epoch}</span> committed (<span className="mono">{hex(commitment.hash).slice(0, 12)}…</span>), seen{" "}
                    {ago(now - commitment.seenAt)}. Your voucher carries round <span className="mono">{commitment.epoch}</span>, and your drop is checked against that seed.
                  </p>
                ) : (
                  <p className="text-sm text-warn">No studio seed seen yet. Go online once so the game can see it; you can buy after that, even offline.</p>
                )}
                <button type="button" className={`btn ${sail ? "btn-quiet" : "btn-sail"}`} disabled={!canBuy} onClick={buy}>
                  Buy {POWER_UP.name} · {formatUsd(POWER_UP.price)}
                </button>
                <p className="text-sm text-muted">
                  {spendable >= POWER_UP.price ? `Works offline. ${formatUsd(spendable)} left in your tab.` : "Not enough left in your tab."}
                </p>
              </>
            )}
            {note && <p className="text-sm text-err">{note}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]">
        <span>{value}</span>
        <CopyButton text={value} />
      </dd>
    </>
  );
}

function DropRow({ p, proof, now }: { p: Purchase; proof?: Proof | "sealed"; now: number }) {
  const round = roundOf(p.nonce);
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="label w-[72px] text-ink">{serialLabel(p.serial)}</span>
        <span>{POWER_UP.name}</span>
        {!p.commitment ? (
          <span className="text-sm text-warn">Can&apos;t be proven: no studio seed was seen before this purchase.</span>
        ) : !proof || proof === "sealed" ? (
          <span className="text-sm text-muted">
            Sealed. Round <span className="mono">{p.commitment.epoch}</span> not revealed for {duration(now - p.createdAt)}.
          </span>
        ) : proof.matches && round === p.commitment.epoch ? (
          <span className="font-semibold text-ok">
            ✓ {proof.drop.item} <span className="font-normal text-muted">({proof.drop.rarity})</span>
          </span>
        ) : (
          <span className="font-semibold text-err">✕ The proof doesn&apos;t check out. Open it to see which part fails.</span>
        )}
      </div>
      {p.commitment && proof && proof !== "sealed" && (
        <details className="text-sm">
          <summary className="link cursor-pointer">Fairness proof</summary>
          <dl className="mono mt-2 grid min-w-0 gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <ProofRow label={`Commitment, round ${p.commitment.epoch} (seen before buying)`} value={hex(p.commitment.hash)} />
            <ProofRow label="Revealed seed" value={hex(proof.seed)} />
            <dt className="text-muted">sha256(seed) matches</dt>
            <dd>{proof.matches ? "yes" : "no"}</dd>
            <ProofRow label="Your seed (voucher nonce)" value={hex(p.nonce)} />
            <dt className="text-muted">Round inside your voucher (nonce bytes 0–3)</dt>
            <dd>{round === p.commitment.epoch ? round : `${round}: doesn't match round ${p.commitment.epoch}`}</dd>
            <ProofRow label="sha256(seed ‖ nonce ‖ serial)" value={hex(proof.hash)} />
            <dt className="text-muted">Roll (first byte)</dt>
            <dd>
              {proof.roll} → {proof.drop.item} (0–149 common, 150–219 uncommon, 220–249 rare, 250–255 legendary)
            </dd>
          </dl>
        </details>
      )}
    </li>
  );
}
