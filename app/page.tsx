import Link from "next/link";
import { BoatGlyph, River } from "./components/crossing";
import { Doggett } from "./components/doggett";
import { Ticket } from "./components/ticket";
import { Addr } from "./components/ui";
import { PROGRAM_ID } from "./lib/config.ts";

const STATIONS = [
  {
    n: "1",
    when: "Online, once",
    title: "Escrow",
    text: "The customer locks test dollars in a tab on Solana and pairs a phone key with it. The money exists before the signal goes.",
    visual: (
      <span className="paper inline-flex items-baseline gap-2 px-3 py-2 shadow-1">
        <span className="mono text-xl">$40.00</span>
        <span className="text-sm text-muted">locked in a tab</span>
      </span>
    ),
  },
  {
    n: "2",
    when: "Offline",
    title: "Voucher",
    text: "The phone signs a voucher for one shop and one amount. The shop checks the signature and the escrow left, with no network, in milliseconds.",
    visual: (
      <div className="w-64">
        <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} />
      </div>
    ),
  },
  {
    n: "3",
    when: "Back online",
    title: "Settlement",
    text: "The shop settles a batch in one transaction. The program checks every signature onchain and pays from the escrow in about a second.",
    visual: (
      <span className="flex flex-col gap-1">
        {[3_500_000n, 2_000_000n, 1_250_000n].map((a, i) => (
          <span key={i} className="flex items-center gap-2 text-sm">
            <BoatGlyph where="far" size={24} />
            <span className="mono">${(Number(a) / 1e6).toFixed(2)}</span>
            <span className="text-muted">settled</span>
          </span>
        ))}
      </span>
    ),
  },
];

const SAFETY = [
  ["Escrow first", "Vouchers draw on money already locked onchain. A phone can't promise more than its tab holds."],
  ["Checked twice", "The shop checks the Ed25519 signature offline. The program checks it again onchain, through Solana's Ed25519 precompile."],
  ["No replays", "Every voucher has a serial. The tab keeps an onchain ledger of the 1,024 serials it can settle, and each one pays once."],
  ["Coverage you can see", "Before accepting, the shop sees what's left in the tab after its other unsettled vouchers, and how fresh that number is."],
  ["Shortfall on the record", "If vouchers ever outrun the escrow, the late shop gets what's left and the gap goes on the payer's public record."],
  ["Risk circuit", "Each shop caps what it holds unsettled, per customer and in total. A voucher over the cap is declined, visibly."],
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-page items-center justify-between px-4 py-4">
        <span className="font-display text-2xl font-bold">Wherry</span>
        <nav className="flex gap-5 text-sm font-semibold">
          <a href="#how" className="link">
            How it works
          </a>
          <a href="#safe" className="link">
            Why it&apos;s safe
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-page items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:pt-16">
          <div className="flex max-w-2xl flex-col gap-6">
            <span className="label">Offline payments on Solana · devnet</span>
            <h1 className="text-4xl md:text-5xl">The ferry for your money when the network&apos;s gone.</h1>
            <p className="max-w-text text-lg">
              Lock dollars in an escrow on Solana. Pay with signed vouchers while the phone has no signal. The shop checks each one offline and settles them all in one
              transaction when the network comes back.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/app" className="btn btn-sail">
                Open the app
              </Link>
              <a href="#how" className="link font-semibold">
                See how it works
              </a>
            </div>
          </div>
          <Doggett pose="welcome" size={168} className="justify-self-center md:justify-self-end" />
        </section>

        <section aria-label="Why offline matters" className="bg-night text-on-night">
          <div className="mx-auto grid max-w-page gap-8 px-4 py-14 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-3">
              <span className="label text-on-night-muted">April 28, 2025</span>
              <p className="font-display text-3xl font-bold leading-tight md:text-4xl">
                Spain and Portugal went dark. In-store card payments fell 55%.
              </p>
              <p className="text-on-night-muted">Banco de España, Financial Stability Report, autumn 2025.</p>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <p>
                <span className="mono text-3xl">2.2 billion</span>
                <br />
                <span className="text-on-night-muted">people were offline in 2025 (ITU).</span>
              </p>
              <p className="text-on-night-muted">
                When the network drops, digital payments stop and the shop eats the loss. Other offline Solana payment projects sign a full transaction offline and
                broadcast it later. That hands the shop a promise the payer can still empty. Wherry hands it funded money.
              </p>
            </div>
          </div>
        </section>

        <section id="how" aria-label="How it works" className="mx-auto flex max-w-page flex-col gap-10 px-4 py-16">
          <div className="flex max-w-text flex-col gap-2">
            <span className="label">The crossing</span>
            <h2 className="text-3xl md:text-4xl">Three stations on one river</h2>
            <p className="text-muted">Money crosses the gap the way a wherry crossed the Thames: loaded on one bank, landed on the other.</p>
          </div>
          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 hidden md:block">
              <River vertical={false} soundings={["4", "3½", "5", "2¾"]} />
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-14 md:hidden">
              <River vertical soundings={["4", "3½", "5"]} />
            </div>
            {STATIONS.map((s) => (
              <li key={s.n} className="relative flex flex-col gap-4 pl-16 md:pl-0 md:pt-20">
                <span
                  aria-hidden
                  className="absolute left-3 top-0 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink bg-surface font-display text-lg font-bold md:left-0 md:top-3.5"
                >
                  {s.n}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="label">{s.when}</span>
                  <h3 className="text-2xl">{s.title}</h3>
                  <p className="max-w-sm text-muted">{s.text}</p>
                </div>
                {s.visual}
              </li>
            ))}
          </ol>
        </section>

        <section id="safe" aria-label="Why it's safe" className="border-t-[1.5px] border-line">
          <div className="mx-auto grid max-w-page gap-10 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-2">
              <span className="label">Why it&apos;s safe</span>
              <h2 className="text-3xl md:text-4xl">The shop sees its worst case before it says yes</h2>
            </div>
            <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {SAFETY.map(([term, text]) => (
                <div key={term} className="flex flex-col gap-1 border-t-[1.5px] border-line pt-3">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto flex max-w-page flex-col items-start gap-4 px-4 pb-16">
          <h2 className="text-3xl">Try the crossing</h2>
          <p className="max-w-text text-muted">
            Use two devices: one as the phone, one as the shop. Get test dollars, open a tab, switch both to airplane mode, pay, then settle when you&apos;re back.
          </p>
          <Link href="/app" className="link font-semibold">
            Open the app
          </Link>
        </section>
      </main>

      <footer className="bg-night text-on-night">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-10 text-sm">
          <span className="font-display text-xl font-bold">Wherry</span>
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
