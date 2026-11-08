import Link from "next/link";
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
      <header className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-8">
        <Link href="/" className="display text-3xl">
          Wherry
        </Link>
        <nav aria-label="Page" className="flex items-center gap-5 text-sm">
          <a href="#how" className="link">
            How it works
          </a>
          <a href="#safe" className="link hidden sm:inline">
            Is it safe?
          </a>
          <span className="label rounded-sm border-2 border-ink px-2 py-1 text-ink">Devnet · test money</span>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-page gap-8 px-4 pb-16 pt-6 md:px-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end lg:gap-x-12 lg:pt-10">
          <div className="flex flex-col gap-6">
            <span className="label text-ink">Offline payments on Solana</span>
            <h1 className="text-[clamp(52px,8.6vw,124px)]">The ferry for your money when the network&apos;s&nbsp;gone.</h1>
          </div>
          <div className="flex flex-col gap-6 lg:pb-3">
            <p className="text-xl leading-snug">
              Your phone pays the shop with a signed ferry ticket, even with no signal. The money was locked on Solana first, so the ticket is good.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/app" className="btn btn-sail">
                Try the crossing
              </Link>
              <a href="#how" className="link">
                How it works
              </a>
            </div>
          </div>
          <div className="lg:col-span-2">
            <RiverHero />
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="border-y-2 border-ink bg-surface">
          <div className="mx-auto grid max-w-page gap-12 px-4 py-16 md:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-3">
                <span className="label text-ink">How it works</span>
                <h2 id="how-title" className="text-[clamp(40px,6vw,72px)]">
                  Three steps. One of them needs no signal.
                </h2>
              </div>
              <ol className="flex flex-col">
                {STEPS.map((s) => (
                  <li key={s.n} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-t-2 border-ink py-6 sm:grid-cols-[6rem_minmax(0,1fr)]">
                    <span className="mono text-4xl leading-none sm:text-5xl" aria-hidden>
                      {s.n}
                    </span>
                    <div className="flex flex-col gap-2">
                      <span className="label">{s.when}</span>
                      <h3 className="text-3xl">{s.title}</h3>
                      <p className="max-w-[52ch]">{s.text}</p>
                      <WhatsThis term={s.term}>{s.tech}</WhatsThis>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start lg:pt-28">
              <span className="label text-ink">This is a ferry ticket</span>
              <div className="-rotate-2">
                <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} tab="7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM" onPaper />
              </div>
              <p className="max-w-[36ch] text-sm text-muted">
                Your phone signs it in a few milliseconds. The stub tears off when the shop collects the money.
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Why offline matters" className="bg-night text-on-night">
          <div className="mx-auto grid max-w-page gap-10 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <div className="flex flex-col gap-5">
              <span className="label text-on-night-muted">April 28, 2025 · Spain and Portugal</span>
              <p className="display text-[clamp(40px,6.5vw,84px)]">
                The power went out. In-store card payments fell <span className="bg-accent px-2 text-ink">55%</span>.
              </p>
              <p className="text-sm text-on-night-muted">Source: Banco de España, Financial Stability Report, autumn 2025.</p>
            </div>
            <div className="flex flex-col justify-end gap-4">
              <p className="@container flex flex-col">
                {/* Sized to its column (11 mono characters), so it never runs off the night band. */}
                <span className="mono whitespace-nowrap text-[clamp(2rem,13cqw,3.5rem)] leading-tight">2.2 billion</span>
                <span className="text-on-night-muted">people were offline in 2025 (ITU).</span>
              </p>
              <p className="text-on-night-muted">
                When the network drops, card payments stop and the shop eats the loss. Some offline payment ideas hand the shop a promise the payer can still empty.
                Wherry hands it money that was locked before the signal went.
              </p>
            </div>
          </div>
        </section>

        <section id="safe" aria-labelledby="safe-title">
          <div className="mx-auto grid max-w-page gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div className="flex flex-col gap-3">
              <span className="label text-ink">Is my money safe?</span>
              <h2 id="safe-title" className="text-[clamp(40px,5vw,64px)]">
                The shop sees its worst case before it says yes.
              </h2>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {SAFETY.map(([term, text], i) => (
                <div key={term} className="flex flex-col gap-1 border-t-2 border-ink py-5">
                  <dt className="flex items-baseline gap-3 text-lg font-bold">
                    <span className="mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                    {term}
                  </dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-label="Try it" className="mx-auto max-w-page px-4 pb-20 md:px-8">
          <div className="paper flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex flex-col gap-2">
              <h2 className="text-4xl">Try it with two windows.</h2>
              <p className="max-w-[56ch]">
                One window is the customer&apos;s phone, one is the shop. Lock test dollars, switch off the network, pay with a ticket, then collect when you&apos;re back.
              </p>
            </div>
            <Link href="/app" className="link shrink-0 text-lg">
              Open the app →
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-night text-on-night">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-10 text-sm md:px-8">
          <span className="display text-3xl">Wherry</span>
          <span className="flex flex-wrap items-baseline gap-2 text-on-night-muted">
            Program on Solana devnet:
            <span className="text-on-night [&_a]:text-on-night [&_button]:text-on-night">
              <Addr value={PROGRAM_ID} chars={6} />
            </span>
          </span>
          <span className="text-on-night-muted">Devnet only. Test dollars are not money. Built for the MLH Solana Hackathon, November 2026.</span>
        </div>
      </footer>
    </div>
  );
}
