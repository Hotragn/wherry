"use client";

import { Doggett } from "./doggett";
import FluidOrb from "./fluid-orb";
import { Ticket } from "./ticket";
import { QrCode, Signal } from "./ui";

// The orb shader takes a hex colour, so this mirrors --w-gold from design/tokens.css.
const GOLD = "#E8B04B";

/** The product in one look, built from the real components: phone signs offline → shop checks offline → collected on Solana. */
export function ProductCrux() {
  return (
    <section id="how" aria-labelledby="crux-title" className="mx-auto max-w-page px-4 pb-20 pt-6 md:px-8">
      <div className="mb-10 flex flex-col gap-3 text-center">
        <p className="label">The whole product in one look</p>
        <h2 id="crux-title" className="text-[clamp(36px,5vw,64px)]">
          Signed offline. Checked offline. <em className="italic text-accent">Collected on Solana.</em>
        </h2>
      </div>
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* 1. the phone */}
        <figure className="relative mx-auto flex w-full max-w-[300px] flex-col items-center gap-3">
          <div aria-hidden className="absolute -top-10 left-1/2 -z-10 -translate-x-1/2 opacity-70">
            <FluidOrb size={260} color={GOLD} />
          </div>
          <div className="w-full rounded-[44px] border border-line bg-night p-3 shadow-lift">
            <div className="flex flex-col gap-3 rounded-[34px] bg-base p-4">
              <div className="mx-auto h-5 w-24 rounded-full bg-night" />
              <p className="rounded-full bg-surface px-3 py-1.5 text-center text-xs font-semibold">No signal · payments still work</p>
              <div aria-hidden>
                <Ticket
                  serial={7}
                  shopName="Amara's kiosk"
                  amount={3_500_000n}
                  qr={<QrCode text="WV1.wherry-demo-ticket-no-7-amaras-kiosk-3.50" size={150} label="Example payment QR" />}
                  onPaper
                />
              </div>
            </div>
          </div>
          <figcaption className="text-center">
            <span className="mono text-sm text-accent">1 · Phone</span>
            <br />
            Signs an offline payment. No signal needed.
          </figcaption>
        </figure>

        <Arrow label="no network" />

        {/* 2. the shop checks */}
        <figure className="mx-auto flex w-full max-w-[340px] flex-col gap-3">
          <div className="paper flex flex-col gap-3 p-5">
            <p className="flex items-center justify-between">
              <span className="display text-2xl">Amara&apos;s kiosk</span>
              <span className="label">offline</span>
            </p>
            <Signal tone="ok">
              Signature valid · checked offline in <span className="mono">2 ms</span>
            </Signal>
            <Signal tone="ok">Covered: $36.50 left in this tab after this sale.</Signal>
            <Signal tone="ok">AI officer on this device: looks normal.</Signal>
            <span className="btn-gold mt-1 rounded-full px-5 py-3 font-semibold">Accept $3.50</span>
          </div>
          <figcaption className="text-center">
            <span className="mono text-sm text-accent">2 · Shop</span>
            <br />
            Checks it in milliseconds, still offline.
          </figcaption>
        </figure>

        <Arrow label="signal back" />

        {/* 3. collected */}
        <figure className="mx-auto flex w-full max-w-[300px] flex-col items-center gap-3">
          <div className="relative w-full pt-8">
            <Doggett pose="success" size={96} className="absolute -top-6 right-2 z-10" />
            <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} stamp="0.6 s" />
          </div>
          <figcaption className="text-center">
            <span className="mono text-sm text-accent">3 · Solana</span>
            <br />
            Collected in one transaction, about a second.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div aria-hidden className="flex flex-col items-center gap-1 text-muted max-lg:rotate-0">
      <span className="label">{label}</span>
      <span className="text-3xl text-accent max-lg:rotate-90">→</span>
    </div>
  );
}
