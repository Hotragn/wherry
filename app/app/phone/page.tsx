"use client";

import type { Address } from "@solana/kit";
import { useEffect, useState } from "react";
import { Doggett } from "../../components/doggett";
import { Scanner } from "../../components/scanner";
import { Ticket } from "../../components/ticket";
import { CopyButton, Money, QrCode } from "../../components/ui";
import type { TabSnapshot } from "../../lib/assess.ts";
import { findTabForDevice } from "../../lib/chain.ts";
import { pairingCode, parseSticker } from "../../lib/codes.ts";
import {
  ago,
  formatUsd,
  parseUsd,
  serialLabel,
  shortAddress,
} from "../../lib/config.ts";
import {
  deviceKey,
  loadHistory,
  loadTab,
  payShop,
  saveTab,
  type IssuedVoucher,
} from "../../lib/phone.ts";
import {
  NEED_LABEL,
  NEEDS,
  impactLine,
  type Need,
  type Plan,
} from "../../lib/planner.ts";
import { useNow } from "../../lib/use-now.ts";
import { Planner } from "../../components/planner";
import { get, set } from "idb-keyval";
import { useOnline } from "../../lib/use-online.ts";

type Saved = { tab: TabSnapshot; syncedAt: number };
const isSettled = (tab: TabSnapshot, serial: number) =>
  (tab.used[serial >> 3] & (1 << (serial & 7))) !== 0;

function timeLeft(unixSec: bigint, nowMs: number) {
  const s = Number(unixSec) - nowMs / 1000;
  if (s <= 0) return "expired";
  return s < 3600
    ? `${Math.ceil(s / 60)} min`
    : s < 172_800
      ? `${Math.round(s / 3600)} h`
      : `${Math.round(s / 86_400)} days`;
}

export default function PhonePage() {
  const online = useOnline();
  const now = useNow();
  const [pk, setPk] = useState<Uint8Array | null>(null);
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [history, setHistory] = useState<IssuedVoucher[]>([]);
  const [shop, setShop] = useState<{ merchant: Address; name: string } | null>(
    null
  );
  const [amountText, setAmountText] = useState("");
  const [showing, setShowing] = useState<IssuedVoucher | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [need, setNeed] = useState<Need | "other">("food");
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setPk((await deviceKey()).pk);
      } catch {
        setNoKey(true);
      }
      setSaved((await loadTab()) ?? null);
      setHistory(await loadHistory());
      setPlan((await get<Plan>("phone:plan")) ?? null);
    })();
  }, []);

  async function refresh() {
    if (!pk) return;
    setBusy(true);
    setNote(null);
    try {
      const tab = await findTabForDevice(pk);
      if (!tab) {
        setNote(
          "No tab for this phone yet. Open one in the Owner view with this phone's code."
        );
      } else {
        await saveTab(tab);
        setSaved({ tab, syncedAt: Date.now() });
      }
    } catch {
      setNote("Couldn't reach devnet. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (noKey) {
    return (
      <div className="flex max-w-text items-center gap-4">
        <Doggett pose="error" size={72} />
        <p>
          This browser can&apos;t make a secure phone key (Ed25519). Use a
          current version of Chrome, Safari or Firefox.
        </p>
      </div>
    );
  }
  if (saved === undefined || !pk)
    return <p className="text-muted">Opening your phone wallet…</p>;

  if (saved === null) {
    const code = pairingCode(pk);
    return (
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex max-w-text flex-col gap-5">
          <Doggett pose="welcome" size={88} />
          <h1 className="text-4xl">Pair this phone</h1>
          <p>
            This phone now holds a key that signs vouchers. The private half
            never leaves this browser, even offline.
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>On a laptop, open Wherry and go to Owner.</li>
            <li>
              Scan this phone&apos;s code there (or paste it) and lock test
              dollars in a tab.
            </li>
            <li>
              Come back here and find your tab. After that, you can pay with no
              signal.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-sail"
              disabled={busy || !online}
              onClick={refresh}
            >
              {busy ? "Looking for your tab…" : "Find my tab"}
            </button>
            {!online && (
              <span className="text-sm text-warn">
                You&apos;re offline. Pairing needs the network once.
              </span>
            )}
          </div>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>
        <div className="paper flex flex-col items-center gap-3 p-5">
          <span className="label">Phone code</span>
          <QrCode
            text={code}
            size={232}
            label="QR code with this phone's public key"
          />
          <span className="mono break-all text-center text-xs">{code}</span>
          <CopyButton text={code} label="Copy code" />
        </div>
      </div>
    );
  }

  const { tab, syncedAt } = saved;
  const mine = history.filter((h) => h.tab === tab.address);
  const unsettled = mine
    .filter((h) => !isSettled(tab, h.serial))
    .reduce((a, h) => a + h.amount, 0n);
  const spendable = tab.deposited - tab.settled - unsettled;
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const spentToday = (n: Need) =>
    mine
      .filter((h) => h.need === n && h.createdAt >= dayStart)
      .reduce((a, h) => a + h.amount, 0n);
  const amount = parseUsd(amountText);
  const amountProblem =
    amountText === ""
      ? null
      : amount === null || amount === 0n
        ? "Enter an amount like 3.50."
        : amount > spendable
          ? `That's more than you have left in this tab (${formatUsd(spendable)}).`
          : null;

  async function pay() {
    if (!shop || !amount || amountProblem) return;
    setBusy(true);
    try {
      const v = await payShop(tab, shop, amount, undefined, need);
      setHistory(await loadHistory());
      setShowing(v);
      setAmountText("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Your tab"
        className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b-[1.5px] border-line pb-5"
      >
        <div className="flex flex-col">
          <span className="label">You can spend</span>
          <Money units={spendable > 0n ? spendable : 0n} className="text-4xl" />
        </div>
        <div className="flex flex-col text-sm">
          <span>
            <Money units={tab.deposited} /> locked in tab · expires in{" "}
            {timeLeft(tab.expiresAt, now)}
          </span>
          <span className="text-muted">
            Synced {ago(now - syncedAt)}
            {online && (
              <>
                {" · "}
                <button
                  type="button"
                  className="link"
                  onClick={refresh}
                  disabled={busy}
                >
                  Refresh
                </button>
              </>
            )}
          </span>
        </div>
      </section>

      {showing ? (
        <section
          aria-label="Your voucher"
          className="flex flex-col items-center gap-4"
        >
          <h1 className="text-3xl">Show this to {showing.shopName}</h1>
          <p className="max-w-text text-center text-muted">
            They check it without a network. You can close this once
            they&apos;ve scanned it.
          </p>
          <Ticket
            serial={showing.serial}
            shopName={showing.shopName}
            amount={showing.amount}
            tab={showing.tab}
            qr={
              <QrCode
                text={showing.code}
                size={260}
                label={`Voucher ${serialLabel(showing.serial)} QR code`}
              />
            }
            stamp={isSettled(tab, showing.serial) ? "onchain" : undefined}
          />
          <CopyButton text={showing.code} label="Copy voucher code" />
          <button
            type="button"
            className="btn btn-sail"
            onClick={() => setShowing(null)}
          >
            Done
          </button>
        </section>
      ) : (
        <>
          <Planner
            spendable={spendable > 0n ? spendable : 0n}
            plan={plan}
            onPlan={async (p) => (setPlan(p), await set("phone:plan", p))}
            spentToday={spentToday}
          />
          <section
            aria-label="Pay a shop"
            className="flex max-w-xl flex-col gap-5"
          >
            <h1 className="text-3xl">Pay a shop</h1>
            {!shop ? (
              <div className="paper p-5">
                <Scanner
                  title="Scan the shop's sticker"
                  pasteHint="No camera? Paste the shop's code (it starts with WS1.)"
                  accept={(t) =>
                    parseSticker(t) ? null : "That isn't a Wherry shop sticker."
                  }
                  onResult={(t) => setShop(parseSticker(t))}
                />
              </div>
            ) : (
              <form
                className="paper flex flex-col gap-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void pay();
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    Paying <strong>{shop.name}</strong> ·{" "}
                    <span className="mono text-sm">
                      {shortAddress(shop.merchant)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="link text-sm"
                    onClick={() => setShop(null)}
                  >
                    Change shop
                  </button>
                </div>
                <p className="-mt-2 text-sm text-muted">
                  Check this key matches the one on the shop&apos;s screen. A
                  voucher only pays the shop it names.
                </p>
                <label className="flex flex-col gap-1">
                  <span className="label">Amount</span>
                  <span className="flex items-center gap-2">
                    <span className="mono text-3xl text-muted" aria-hidden>
                      $
                    </span>
                    <input
                      className="field mono text-3xl"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      aria-invalid={!!amountProblem}
                      aria-describedby="amount-help"
                    />
                  </span>
                  <span
                    id="amount-help"
                    className={`text-sm ${amountProblem ? "text-err" : "text-muted"}`}
                  >
                    {amountProblem ??
                      `Up to ${formatUsd(spendable > 0n ? spendable : 0n)}. Works offline.`}
                  </span>
                </label>
                {plan && (
                  <label className="flex flex-col gap-1">
                    <span className="label">For</span>
                    <select
                      className="field"
                      value={need}
                      onChange={(e) =>
                        setNeed(e.target.value as Need | "other")
                      }
                    >
                      {NEEDS.map((n) => (
                        <option key={n} value={n}>
                          {NEED_LABEL[n]}
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                    {amount && !amountProblem && need !== "other" && (
                      <span className="text-sm" role="status">
                        {impactLine(plan, need, spentToday(need), amount)}{" "}
                        <span className="text-muted">Your call.</span>
                      </span>
                    )}
                  </label>
                )}
                <button
                  type="submit"
                  className="btn btn-sail self-start"
                  disabled={busy || !amount || !!amountProblem}
                >
                  {amount && !amountProblem
                    ? `Pay ${formatUsd(amount)} to ${shop.name}`
                    : "Pay"}
                </button>
              </form>
            )}
            {note && <p className="text-sm text-err">{note}</p>}
          </section>
        </>
      )}

      {!showing && (
        <section aria-label="Your vouchers" className="flex flex-col gap-3">
          <h2 className="text-2xl">Your vouchers</h2>
          {mine.length === 0 ? (
            <div className="flex items-center gap-4">
              <Doggett pose="welcome" size={64} />
              <p className="text-muted">
                No vouchers yet. Your first payment shows up here, even offline.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y-[1.5px] divide-line border-y-[1.5px] border-line">
              {mine.map((h) => (
                <li
                  key={h.code}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="label w-[72px] text-ink">
                    {serialLabel(h.serial)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{h.shopName}</span>
                  <Money units={h.amount} />
                  <span
                    className={`text-sm ${isSettled(tab, h.serial) ? "text-ok" : "text-muted"}`}
                  >
                    {isSettled(tab, h.serial)
                      ? "✓ Settled"
                      : "Waiting for the shop to settle"}
                  </span>
                  <button
                    type="button"
                    className="link text-sm"
                    onClick={() => setShowing(h)}
                  >
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
