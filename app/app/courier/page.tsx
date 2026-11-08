"use client";

import type { KeyPairSigner } from "@solana/kit";
import { useEffect, useState } from "react";
import { Doggett } from "../../components/doggett";
import { FirstRun } from "../../components/guide";
import { WhatsThis } from "../../components/ui";
import { lamportsToSol } from "../../components/tx-status";
import { Addr, Money, Signal, TxLink } from "../../components/ui";
import { fetchSolBalance } from "../../lib/chain.ts";
import { formatUsd, serialLabel, shortAddress } from "../../lib/config.ts";
import { courierSigner, feeFor, planBundle, settleJobs, type Job, type JobResult } from "../../lib/courier.ts";
import { useOnline } from "../../lib/use-online.ts";

export default function CourierPage() {
  const online = useOnline();
  const [me, setMe] = useState<KeyPairSigner | null>(null);
  const [sol, setSol] = useState<bigint | null>(null);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<{ jobs: Job[]; skipped: string[] } | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [earned, setEarned] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [faucet, setFaucet] = useState<string | null>(null);

  useEffect(() => {
    courierSigner().then(setMe);
  }, []);
  useEffect(() => {
    if (me && online) fetchSolBalance(me.address).then(setSol, () => {});
  }, [me, online, faucet, earned]);

  if (!me)
    return (
      <div className="flex items-center gap-3">
        <Doggett pose="waiting" size={56} />
        <p className="text-lg">Opening the courier…</p>
      </div>
    );
  const total = plan?.jobs.reduce((a, j) => a + j.v.amount, 0n) ?? 0n;
  const maxEarn = plan?.jobs.reduce((a, j) => a + feeFor(j.v.amount, j.auth), 0n) ?? 0n;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <FirstRun role="courier" />
      <div className="flex flex-col gap-3">
        <span className="label text-ink">Anyone can collect for a shop</span>
        <h1 className="text-5xl md:text-7xl">Carry the tickets across.</h1>
        <p className="max-w-[60ch] text-lg">
          The first phone to find a signal collects for everyone. Shops hand you their ferry tickets with a signed note that lets you collect them and keep a small fee. The
          money still goes to the shop; you can&apos;t redirect it.
        </p>
        <WhatsThis term="Courier authorization">A note the shop signs with its own key. It names a fee cap (1%, at most $0.05 a ticket) and expires after 48 hours. Solana checks it onchain.</WhatsThis>
      </div>

      <section aria-label="Your courier key" className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y-2 border-ink py-4 text-sm">
        <span>
          Courier key: <Addr value={me.address} />
        </span>
        <span className="text-muted">Fee balance: {sol === null ? "…" : <span className="mono">{lamportsToSol(sol)}</span>}</span>
        {sol !== null && sol < 5_000_000n && (
          <button
            type="button"
            className="link"
            disabled={!online}
            onClick={async () => {
              const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: me.address }) })
                .then((x) => x.json())
                .catch(() => ({ error: "The faucet didn't answer." }));
              setFaucet(r.signature ?? r.error);
            }}
          >
            Get fee money (devnet SOL)
          </button>
        )}
        {faucet && <span className="text-muted">{faucet.length > 60 ? <TxLink signature={faucet}>Sent ✓</TxLink> : faucet}</span>}
      </section>

      <section aria-label="Bundle" className="paper flex flex-col gap-3 p-5">
        <label className="flex flex-col gap-1">
          <span className="label text-ink">Paste a shop&apos;s courier bundle</span>
          <textarea
            className="field mono min-h-32 text-sm"
            value={text}
            spellCheck={false}
            onChange={(e) => (setText(e.target.value), setPlan(null), setResults([]), setEarned(null))}
            placeholder="WV1.… and WC1.… codes, from the shop's “Hand to a courier”"
          />
        </label>
        <button type="button" className="btn btn-quiet self-start" disabled={!text.trim()} onClick={async () => setPlan(await planBundle(text))}>
          Check the bundle
        </button>
        {plan && (
          <div className="flex flex-col gap-2 text-sm">
            {plan.jobs.length > 0 ? (
              <Signal tone="ok">
                {plan.jobs.length} ticket{plan.jobs.length === 1 ? "" : "s"} for <Money units={total} />, signed and authorized by{" "}
                {[...new Set(plan.jobs.map((j) => shortAddress(j.auth.merchant)))].join(", ")}. You can earn up to <Money units={maxEarn} />.
              </Signal>
            ) : (
              <Signal tone="err">Nothing in this bundle can be settled.</Signal>
            )}
            {plan.skipped.map((s) => (
              <Signal key={s} tone="warn">
                {s}
              </Signal>
            ))}
          </div>
        )}
        {plan && plan.jobs.length > 0 && earned === null && (
          <button
            type="button"
            className="btn btn-sail self-start"
            disabled={!online || busy}
            onClick={async () => {
              setBusy(true);
              const { earned } = await settleJobs(plan.jobs, (r) => setResults((x) => [...x, r]));
              setEarned(earned);
              setBusy(false);
            }}
          >
            {busy ? "Collecting…" : online ? `Collect ${formatUsd(total)} for the shop` : "Collect when you have a signal"}
          </button>
        )}
      </section>

      {busy && results.length === 0 && (
        <div className="flex items-center gap-3">
          <Doggett pose="waiting" size={48} />
          <span className="text-lg">Collecting: Solana is checking every signature…</span>
        </div>
      )}
      {results.length > 0 && (
        <section aria-label="Results" className="flex flex-col gap-2" aria-live="polite">
          <ul className="flex flex-col gap-2">
            {results.map((r) =>
              r.sent ? (
                <li key={`${r.v.tab}-${r.v.serial}`} className="text-ok">
                  ✓ {serialLabel(r.v.serial)} · {formatUsd(r.v.amount)} to {shortAddress(r.merchant)} · confirmed in{" "}
                  <span className="mono">{r.sent.seconds.toFixed(1)} s</span> · <TxLink signature={r.sent.signature}>Explorer</TxLink>
                </li>
              ) : (
                <li key={`${r.v.tab}-${r.v.serial}`} className="text-err">
                  ✕ {serialLabel(r.v.serial)}: {r.error}
                </li>
              ),
            )}
          </ul>
          {earned !== null && (
            <div className="flex items-center gap-3">
              <Doggett pose={earned > 0n ? "success" : "error"} size={56} />
              <p className="display text-4xl">
                {earned > 0n ? (
                  <>
                    You earned <Money units={earned} />.
                  </>
                ) : (
                  "Nothing collected this time."
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
