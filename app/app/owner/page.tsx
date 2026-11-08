"use client";

import { type Address, type KeyPairSigner, type TransactionSigner, createSignerFromKeyPair, generateKeyPair } from "@solana/kit";
import { del, get, set } from "idb-keyval";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from "@solana-program/token";
import { useCallback, useEffect, useState } from "react";
import { Scanner } from "../../components/scanner";
import { TxStatus, lamportsToSol, type TxState } from "../../components/tx-status";
import { Addr, Money, Stat, TxLink } from "../../components/ui";
import { getCloseTabInstructionAsync, getOpenTabInstructionAsync, getTopUpInstructionAsync, type PayerRecord } from "../../generated/wherry/index.ts";
import type { TabSnapshot } from "../../lib/assess.ts";
import { fetchOwnerTabs, fetchSettlements, fetchSolBalance, fetchUsdBalance, send, type Settlement } from "../../lib/chain.ts";
import { pairingCode, parsePairingCode } from "../../lib/codes.ts";
import { MINT, formatUsd, parseUsd, serialLabel, shortAddress, unixNow } from "../../lib/config.ts";
import { explainError } from "../../lib/shop.ts";
import { useNow } from "../../lib/use-now.ts";
import { useOnline } from "../../lib/use-online.ts";
import { FirstRun } from "../../components/guide";
import { HullGauge } from "../../components/hull";
import { WhatsThis } from "../../components/ui";
import { WalletProvider, useWallet } from "../../lib/wallet/context";

const EXPIRY = [
  { label: "1 day", sec: 86_400 },
  { label: "3 days", sec: 3 * 86_400 },
  { label: "7 days", sec: 7 * 86_400 },
  { label: "30 days", sec: 30 * 86_400 - 600 },
];

const when = (unixSec: bigint) =>
  new Date(Number(unixSec) * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function OwnerPage() {
  return (
    <WalletProvider>
      <Owner />
    </WalletProvider>
  );
}

type Data = { payer: PayerRecord | null; tabs: TabSnapshot[]; sol: bigint; usd: bigint };
const LOAD_ERROR = "Couldn't read your tabs from devnet. Try again in a moment.";

async function readOwner(owner: Address): Promise<Data> {
  const [{ payer, tabs }, sol, usd] = await Promise.all([fetchOwnerTabs(owner), fetchSolBalance(owner), fetchUsdBalance(owner)]);
  return { payer, tabs, sol, usd };
}

/** A devnet-only test wallet kept in this browser (non-extractable key), for people without a wallet app. */
async function testWallet(create: boolean): Promise<KeyPairSigner | null> {
  let pair = await get<CryptoKeyPair>("owner:test-wallet");
  if (!pair && !create) return null;
  if (!pair) {
    pair = await generateKeyPair();
    await set("owner:test-wallet", pair);
  }
  await set("owner:use-test-wallet", true);
  return createSignerFromKeyPair(pair);
}

function Owner() {
  const w = useWallet();
  const { connectors, connect, status, error } = w;
  const [burner, setBurner] = useState<KeyPairSigner | null>(null);
  const online = useOnline();
  const signer: TransactionSigner | undefined = w.signer ?? burner ?? undefined;
  const owner = w.wallet?.account.address ?? burner?.address;
  const disconnect = async () => {
    if (burner) {
      await del("owner:use-test-wallet");
      setBurner(null);
    } else await w.disconnect();
  };

  useEffect(() => {
    get<boolean>("owner:use-test-wallet").then(async (use) => {
      if (use) setBurner(await testWallet(false));
    });
  }, []);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>({ s: "idle" });

  const load = useCallback(
    () =>
      owner
        ? readOwner(owner)
            .then((d) => (setData(d), setLoadError(null)))
            .catch(() => setLoadError(LOAD_ERROR))
        : Promise.resolve(),
    [owner],
  );

  useEffect(() => {
    if (owner) readOwner(owner).then(setData).catch(() => setLoadError(LOAD_ERROR));
  }, [owner]);

  async function run(what: string, build: Parameters<typeof send>[1]) {
    if (!signer) return;
    setTx({ s: "wallet" });
    try {
      const sent = await send(signer, build, 0, () => setTx({ s: "sending", what }));
      setTx({ s: "done", what, sent });
      await load();
      return true;
    } catch (e) {
      const msg = /reject|denied|cancel/i.test(String((e as Error)?.message)) ? "You declined in your wallet. Nothing was sent." : explainError(e).message;
      setTx({ s: "error", message: msg });
      return false;
    }
  }

  if (!owner) {
    return (
      <div className="flex max-w-text flex-col gap-5">
        <FirstRun role="owner" />
        <h1 className="text-5xl md:text-6xl">Lock money in a tab</h1>
        <p className="text-lg">
          A tab is money locked on Solana for one phone. Once it&apos;s open, your paired phone can pay offline, up to what&apos;s locked. Shops get paid from it when they&apos;re back online, and
          you get the rest back after the settlement window.
        </p>
        <WhatsThis term="Escrow">Money held by a Solana program, not by you or the shop. Only tickets signed by your paired phone can draw on it.</WhatsThis>
        <p className="text-sm text-muted">This is the only part of Wherry that needs a wallet. Use devnet: these are test dollars, not money.</p>
        {connectors.length === 0 ? (
          <p className="text-warn">No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, switch it to devnet, then reload.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {connectors.map((c, i) => (
              <button key={c.id} type="button" className={`btn ${i === 0 ? "btn-sail" : "btn-quiet"}`} disabled={status === "connecting"} onClick={() => connect(c.id)}>
                {/* Wallet icons are data URIs from the wallet itself. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.icon && <img src={c.icon} alt="" width={20} height={20} className="rounded-sm" />}
                Connect {c.name}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="link self-start" onClick={async () => setBurner(await testWallet(true))}>
          No wallet? Use a test wallet in this browser (devnet only)
        </button>
        {status === "connecting" && <p className="text-muted">Waiting for your wallet…</p>}
        {error != null && <p className="text-err">The wallet didn&apos;t connect: {error instanceof Error ? error.message : String(error)}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <FirstRun role="owner" />
      <section aria-label="Your wallet" className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b-2 border-ink pb-5">
        <Stat label={burner ? "Test wallet (this browser)" : "Wallet"}>
          <Addr value={owner} />
        </Stat>
        <Stat label="Test dollars">{data ? <Money units={data.usd} /> : "…"}</Stat>
        <Stat label="Devnet SOL">{data ? <span className="mono">{lamportsToSol(data.sol)}</span> : "…"}</Stat>
        <div className="flex flex-wrap gap-3 sm:ml-auto">
          <Faucet address={owner} onDone={load} disabled={!online} />
          <button type="button" className="link text-sm" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </section>
      {loadError && <p className="text-err">{loadError}</p>}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <OpenTab owner={owner} usd={data?.usd ?? null} disabled={!online || tx.s === "wallet" || tx.s === "sending"} onOpen={run} tx={tx} />
        <div className="flex flex-col gap-8">
          <Tabs tabs={data?.tabs ?? null} run={run} />
          <PayerCard payer={data?.payer ?? null} />
        </div>
      </div>
    </div>
  );
}

function Faucet({ address, onDone, disabled }: { address: Address; onDone: () => void; disabled: boolean }) {
  const [state, setState] = useState<{ s: "idle" | "busy" } | { s: "ok"; sig: string } | { s: "err"; msg: string }>({ s: "idle" });
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-quiet"
        disabled={disabled || state.s === "busy"}
        onClick={async () => {
          setState({ s: "busy" });
          const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) })
            .then((x) => x.json())
            .catch(() => ({ error: "The faucet didn't answer." }));
          if (r.signature) {
            setState({ s: "ok", sig: r.signature });
            onDone();
          } else setState({ s: "err", msg: r.error });
        }}
      >
        {state.s === "busy" ? "Sending test dollars…" : "Get $50 test dollars"}
      </button>
      {state.s === "ok" && (
        <span className="text-sm text-ok">
          ✓ Sent. <TxLink signature={state.sig}>Explorer</TxLink>
        </span>
      )}
      {state.s === "err" && <span className="text-sm text-err">{state.msg}</span>}
    </span>
  );
}

function OpenTab({
  owner,
  usd,
  disabled,
  onOpen,
  tx,
}: {
  owner: Address;
  usd: bigint | null;
  disabled: boolean;
  onOpen: (what: string, build: Parameters<typeof send>[1]) => Promise<boolean | undefined>;
  tx: TxState;
}) {
  const [amountText, setAmountText] = useState("40");
  const [expiry, setExpiry] = useState(EXPIRY[0].sec);
  const [device, setDevice] = useState<Uint8Array | null>(null);
  const amount = parseUsd(amountText);
  const problem =
    amount === null || amount === 0n ? "Enter an amount like 40." : usd !== null && amount > usd ? `You have ${formatUsd(usd)} in test dollars. Get more first.` : null;

  return (
    <section aria-label="Open a tab" className="paper flex flex-col gap-5 self-start p-5">
      <h1 className="text-4xl">Open a tab</h1>
      <label className="flex flex-col gap-1">
        <span className="label">Lock</span>
        <span className="flex items-center gap-2">
          <span className="mono text-2xl text-muted" aria-hidden>
            $
          </span>
          <input className="field mono text-2xl" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-describedby="lock-help" />
        </span>
        <span id="lock-help" className={`text-sm ${problem ? "text-err" : "text-muted"}`}>
          {problem ?? "Your phone can spend up to this much offline."}
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Tab lasts</span>
        <select className="field" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
          {EXPIRY.map((x) => (
            <option key={x.sec} value={x.sec}>
              {x.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">Shops then get 24 hours to settle before you can close it and take back the rest.</span>
      </label>
      {device ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-sunk px-3 py-2">
          <span className="text-ok">✓ Phone paired</span>
          <span className="mono text-sm">{shortAddress(pairingCode(device).slice(4), 6)}</span>
          <button type="button" className="link text-sm" onClick={() => setDevice(null)}>
            Change
          </button>
        </div>
      ) : (
        <Scanner
          title="Pair your phone"
          pasteHint="On the phone, open Wherry → Phone. Scan its code, or paste it here (WP1.…)."
          accept={(t) => (parsePairingCode(t) ? null : "That isn't a Wherry phone code.")}
          onResult={(t) => setDevice(parsePairingCode(t))}
        />
      )}
      <button
        type="button"
        className="btn btn-sail"
        disabled={disabled || !device || !!problem}
        onClick={async () => {
          if (!device || !amount) return;
          const expiresAt = BigInt(unixNow() + expiry);
          const ok = await onOpen(`Tab opened with ${formatUsd(amount)}`, async (signer) => {
            const { payer } = await fetchOwnerTabs(owner);
            const [ownerToken] = await findAssociatedTokenPda({ mint: MINT, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS });
            return [
              await getOpenTabInstructionAsync({ owner: signer, mint: MINT, ownerToken, tabId: BigInt(payer?.tabsOpened ?? 0), deviceKey: device, amount, expiresAt }),
            ];
          });
          if (ok) setDevice(null);
        }}
      >
        {amount && !problem ? `Lock ${formatUsd(amount)} in a tab` : "Lock in a tab"}
      </button>
      <TxStatus state={tx} />
    </section>
  );
}

function Tabs({ tabs, run }: { tabs: TabSnapshot[] | null; run: Parameters<typeof OpenTab>[0]["onOpen"] }) {
  if (tabs === null) return <p className="text-muted">Reading your tabs from devnet…</p>;
  return (
    <section aria-label="Your tabs" className="flex flex-col gap-4">
      <h2 className="text-3xl">Your tabs</h2>
      {tabs.length === 0 ? <p className="text-muted">No open tabs. Open one to pay offline.</p> : tabs.map((t) => <TabCard key={t.address} tab={t} run={run} />)}
    </section>
  );
}

function TabCard({ tab, run }: { tab: TabSnapshot; run: Parameters<typeof OpenTab>[0]["onOpen"] }) {
  const [topUp, setTopUp] = useState("");
  const [settlements, setSettlements] = useState<Settlement[] | null | "loading">(null);
  const now = BigInt(Math.floor(useNow() / 1000));
  const left = tab.deposited - tab.settled;
  const canClose = now > tab.settleDeadline;
  const live = now < tab.expiresAt;
  const topUpAmount = parseUsd(topUp);

  return (
    <article className="paper flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-3xl">Tab {String(tab.tabId)}</h3>
        <Addr value={tab.address} />
      </header>
      <HullGauge left={left > 0n ? left : 0n} total={tab.deposited} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Locked">
          <Money units={tab.deposited} />
        </Stat>
        <Stat label="Paid to shops">
          <Money units={tab.settled} />
        </Stat>
        <Stat label="Left">
          <Money units={left} />
        </Stat>
        <Stat label="Shortfall">
          <Money units={tab.shortfall} className={tab.shortfall > 0n ? "text-err" : ""} />
        </Stat>
      </div>
      <p className="text-sm text-muted">
        {live ? `Open until ${when(tab.expiresAt)}.` : `Expired ${when(tab.expiresAt)}.`} Shops can settle until {when(tab.settleDeadline)}.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {live && (
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!topUpAmount) return;
              const ok = await run(`Added ${formatUsd(topUpAmount)}`, async (signer) => [
                await getTopUpInstructionAsync({ owner: signer, tab: tab.address, mint: MINT, ownerToken: (await findAssociatedTokenPda({ mint: MINT, owner: tab.owner, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0], amount: topUpAmount }),
              ]);
              if (ok) setTopUp("");
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="label">Top up</span>
              <input className="field mono w-28" inputMode="decimal" placeholder="10.00" value={topUp} onChange={(e) => setTopUp(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-quiet" disabled={!topUpAmount}>
              Add
            </button>
          </form>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          disabled={!canClose}
          title={canClose ? undefined : `Shops can settle until ${when(tab.settleDeadline)}`}
          onClick={() => run(`Tab closed, ${formatUsd(left)} back to you`, async (signer) => [await getCloseTabInstructionAsync({ owner: signer, tab: tab.address, mint: MINT })])}
        >
          Close and take back {formatUsd(left)}
        </button>
      </div>
      {!canClose && <p className="text-sm text-muted">You can close it after {when(tab.settleDeadline)}, once shops have had their window.</p>}
      <div className="flex flex-col gap-2">
        {settlements === null ? (
          <button
            type="button"
            className="link self-start text-sm"
            onClick={async () => {
              setSettlements("loading");
              setSettlements(await fetchSettlements(tab.address).catch(() => []));
            }}
          >
            Show settlements
          </button>
        ) : settlements === "loading" ? (
          <p className="text-sm text-muted">Reading settlements from devnet…</p>
        ) : settlements.length === 0 ? (
          <p className="text-sm text-muted">No vouchers settled from this tab yet.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-ink text-sm">
            {settlements.map((s) => (
              <li key={`${s.signature}-${s.serial}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="label w-[72px] text-ink">{serialLabel(s.serial)}</span>
                <Money units={s.paid} />
                {s.paid < s.amount && <span className="text-err">short {formatUsd(s.amount - s.paid)}</span>}
                <span className="text-muted">to {shortAddress(s.merchant)}</span>
                <TxLink signature={s.signature} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function PayerCard({ payer }: { payer: PayerRecord | null }) {
  return (
    <section aria-label="Your payer record" className="flex flex-col gap-3">
      <h2 className="text-3xl">Your payer record</h2>
      <p className="text-sm text-muted">Public and onchain. Shops see it before they accept a voucher.</p>
      {payer === null ? (
        <p className="text-muted">No record yet. It starts with your first tab.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Tabs opened">
            <span className="mono">{payer.tabsOpened}</span>
          </Stat>
          <Stat label="Closed clean">
            <span className="mono">{payer.tabsClosedClean}</span>
          </Stat>
          <Stat label="Vouchers paid">
            <span className="mono">{payer.vouchersSettled}</span>
          </Stat>
          <Stat label="Volume">
            <Money units={payer.volumeSettled} />
          </Stat>
          <Stat label="Shortfalls">
            <span className={`mono ${payer.shortfalls > 0 ? "text-err" : ""}`}>
              {payer.shortfalls} ({formatUsd(payer.shortfallAmount)})
            </span>
          </Stat>
        </div>
      )}
    </section>
  );
}
