import Link from "next/link";
import { BuiltWith } from "./components/built-with";
import { Logo } from "./components/logo";
import { ProductCrux } from "./components/product-crux";
import { RiverHero } from "./components/river-hero";
import { Ticket } from "./components/ticket";
import { Addr, WhatsThis } from "./components/ui";
import { PROGRAM_ID } from "./lib/config.ts";

const STEPS = [
  {
    n: "01",
    when: "Online, once",
    title: "Lock money in a tab",
    text: "Before the signal goes, the customer locks test dollars on Solana and pairs their phone with it. Nobody can spend that money twice.",
    term: "Escrow",
    tech: "Money held by a Solana program, not by either side. Only signed tickets for that tab can draw on it.",
  },
  {
    n: "02",
    when: "No signal",
    title: "Pay with a ferry ticket",
    text: "The phone signs a ticket for one shop and one amount. The shop checks it in milliseconds, with no network at all.",
    term: "Voucher",
    tech: "An IOU your phone signs with an Ed25519 key that never leaves it. It names the shop, the amount and a serial number.",
  },
  {
    n: "03",
    when: "Back online",
    title: "The shop collects",
    text: "When the network returns, the shop hands in its tickets in one transaction. Solana checks every signature again and pays out of the tab.",
    term: "Settle",
    tech: "One onchain transaction that verifies each ticket and moves the money from the tab to the shop, in about a second.",
  },
];

const SAFETY = [
  ["The money exists first", "Every ticket draws on dollars already locked onchain. A phone can't promise more than its tab holds."],
  ["Checked twice", "The shop checks the signature offline. Solana checks it again onchain, through its Ed25519 precompile."],
  ["Each ticket pays once", "Every ticket has a serial. The tab keeps an onchain record of the 1,024 serials it can pay, and each one pays once."],
  ["The shop sees its worst case", "Before saying yes, the shop sees what's left in the tab after its other uncollected tickets, and how fresh that number is."],
  ["Shortfalls go on the record", "If tickets ever outrun the tab, the late shop gets what's left and the gap goes on the payer's public record."],
  ["Limits the shop sets", "Each shop caps what it holds uncollected, per customer and in total. A small AI on the shop's own device can also say no."],
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="relative isolate overflow-hidden">
        {/* Painted hero (generated in Canva): a river at dusk, town lights out, one lantern-lit ferry still crossing. */}
        <img src="/hero-river.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--w-navy)_45%,transparent)_0%,color-mix(in_srgb,var(--w-navy)_30%,transparent)_40%,color-mix(in_srgb,var(--w-navy)_55%,transparent)_75%,var(--w-navy)_100%)]" />
        <header className="relative z-10 mx-auto flex max-w-page items-center justify-between gap-3 px-4 py-5 md:px-8">
          <Logo size={44} className="text-3xl" />
          <nav aria-label="Page" className="flex items-center gap-2 text-sm">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 font-medium hover:bg-surface sm:inline">
              How it works
            </a>
            <a href="#safe" className="hidden rounded-full px-3 py-1.5 font-medium hover:bg-surface sm:inline">
              Is it safe
            </a>
            <Link href="/app" className="btn-gold rounded-full px-4 py-2 font-semibold">
              Open the app ↗
            </Link>
          </nav>
        </header>

        <main>
          <section className="mx-auto flex max-w-[960px] flex-col items-center gap-8 px-4 pb-24 pt-16 text-center md:pt-24">
            <p className="label text-ink">Offline payments on Solana · devnet</p>
            <h1 className="text-[clamp(52px,8vw,112px)] [text-shadow:0_2px_30px_color-mix(in_srgb,var(--w-navy)_80%,transparent)]">
              Pay with <em className="italic text-accent">no signal.</em>
            </h1>
            <Link href="/app/owner" className="btn-gold rounded-full px-10 py-4 text-lg font-semibold">
              Start the demo
            </Link>
            <div className="flex max-w-[680px] flex-col gap-5 text-left text-lg md:text-xl [text-shadow:0_1px_12px_color-mix(in_srgb,var(--w-navy)_90%,transparent)]">
              <p>When the network goes down, card payments stop. Wherry keeps the market open.</p>
              <p>
                Your phone pays the shop with a <strong>signed ferry ticket</strong>, even in airplane mode. The money was <strong>locked on Solana first</strong>, so the
                ticket is always good.
              </p>
              <p>
                The shop checks it in milliseconds with no network, and <strong>collects every ticket in one transaction</strong> when the signal comes back.
              </p>
            </div>
            <nav aria-label="Demo in three steps" className="flex flex-col items-center gap-2">
              <span className="label text-ink">Judges: the whole demo is 3 pages</span>
              <ol className="flex flex-wrap items-center justify-center gap-2 text-sm">
                {[
                  ["/app/owner", "1", "Owner", "lock $40"],
                  ["/app/phone", "2", "Phone", "pay offline"],
                  ["/app/shop", "3", "Shop", "check + collect"],
                ].map(([href, n, role, what], i) => (
                  <li key={href} className="flex items-center gap-2">
                    {i > 0 && (
                      <span aria-hidden className="text-muted max-sm:hidden">
                        →
                      </span>
                    )}
                    <Link href={href} className="flex items-center gap-2 rounded-full border border-line bg-base/60 px-3 py-1.5 backdrop-blur hover:border-ink">
                      <span className="mono grid h-5 w-5 place-items-center rounded-full bg-accent text-xs text-on-accent">{n}</span>
                      <span className="font-semibold">{role}</span>
                      <span className="text-muted">{what}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </section>
        </main>
      </div>

      <div>
        <ProductCrux />

        <BuiltWith />

        <section aria-label="Watch a crossing" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <RiverHero />
        </section>

        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <h2 id="how-title" className="mb-10 max-w-[680px] text-[clamp(36px,5vw,60px)]">
            Three steps. Only the first one needs a signal.
          </h2>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-2">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className={`paper flex flex-col gap-3 p-6 md:p-8 ${i === 1 ? "lg:col-start-2 lg:row-span-2 lg:row-start-1 bg-night text-on-night" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`mono grid h-9 w-9 place-items-center rounded-full text-sm ${i === 1 ? "bg-accent text-on-accent" : "bg-accent text-on-accent"}`}>{s.n}</span>
                  <span className={`text-sm font-medium ${i === 1 ? "text-on-night-muted" : "text-muted"}`}>{s.when}</span>
                </div>
                <h3 className="text-3xl">{s.title}</h3>
                <p className={`max-w-[52ch] ${i === 1 ? "text-on-night-muted" : "text-muted"}`}>{s.text}</p>
                <WhatsThis term={s.term}>{s.tech}</WhatsThis>
                {i === 1 && (
                  <div className="mt-auto flex justify-center pt-6">
                    <div className="w-full max-w-sm -rotate-2">
                      <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} tab="7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM" />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Why offline matters" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <div className="grid gap-10 rounded-3xl bg-night p-8 text-on-night md:p-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="flex flex-col gap-5">
              <p className="text-sm text-on-night-muted">April 28, 2025 · Spain and Portugal</p>
              <p className="display text-[clamp(36px,5vw,64px)]">The power went out. In-store card payments fell 55%.</p>
              <p className="text-sm text-on-night-muted">Banco de España, Financial Stability Report, autumn 2025.</p>
            </div>
            <div className="flex flex-col justify-end gap-4">
              <p className="flex flex-col">
                <span className="mono whitespace-nowrap text-4xl sm:text-5xl">2.2 billion</span>
                <span className="text-on-night-muted">people were offline in 2025 (ITU).</span>
              </p>
              <p className="text-on-night-muted">
                When the network drops, card payments stop and the shop eats the loss. Wherry hands the shop money that was locked before the signal went.
              </p>
            </div>
          </div>
        </section>

        <section id="safe" aria-labelledby="safe-title" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <h2 id="safe-title" className="text-[clamp(36px,4.5vw,56px)]">
              Is my money safe? Here&apos;s how it&apos;s protected.
            </h2>
            <dl className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
              {SAFETY.map(([term, text]) => (
                <div key={term} className="flex flex-col gap-2 py-4">
                  <div aria-hidden className="h-px w-full bg-line" />
                  <dt className="pt-3 text-lg font-semibold">{term}</dt>
                  <dd className="text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-label="Try it" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <div className="paper flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="flex flex-col gap-2">
              <h2 className="text-4xl">Try it with two windows.</h2>
              <p className="max-w-[56ch] text-muted">
                One window is the customer&apos;s phone, one is the shop. Lock test dollars, switch off the network, pay with a ticket, then collect when you&apos;re back.
              </p>
            </div>
            <Link href="/app" className="btn btn-quiet shrink-0">
              Open the app
            </Link>
          </div>
        </section>
      </div>

      <footer className="bg-night text-on-night">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-10 text-sm md:px-8">
          <span className="display text-2xl">Wherry</span>
          <span className="flex flex-wrap items-baseline gap-2 text-on-night-muted">
            Program on Solana devnet:
            <span className="text-on-night [&_a]:text-on-night [&_button]:text-on-night">
              <Addr value={PROGRAM_ID} chars={6} />
            </span>
          </span>
          <span className="text-on-night-muted">Devnet only. Test dollars are not money. Built for the MLH Solana Hackathon, November 2026.</span>
          <span className="text-on-night-muted">
            Fluid orb by{" "}
            <a className="link" href="https://www.rareui.com" target="_blank" rel="noreferrer">
              Rare UI
            </a>
            . Type: Newsreader, Geist and Paper Mono (OFL).
          </span>
        </div>
      </footer>
    </div>
  );
}
