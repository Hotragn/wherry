import Link from "next/link";
import { Doggett } from "../components/doggett";
import { HullGauge } from "../components/hull";
import { STEP_COPY } from "../components/step-copy";
import { Ticket } from "../components/ticket";
import { STEPS } from "../lib/steps.ts";

export const metadata = { title: "Try it in 60 seconds" };

// What each step looks like when it's done: the real components, small.
const PREVIEW = [
  <div key="owner" className="flex flex-col items-center gap-1">
    <span className="mono text-3xl">$40.00</span>
    <HullGauge left={40_000_000n} total={40_000_000n} />
  </div>,
  <div key="phone" className="w-full max-w-[260px]">
    <Ticket serial={1} shopName="Amara's kiosk" amount={3_500_000n} onPaper />
  </div>,
  <div key="shop" className="w-full max-w-[260px] pt-6">
    <Ticket serial={1} shopName="Amara's kiosk" amount={3_500_000n} stamp="0.6 s" onPaper />
  </div>,
];

export default function AppHome() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-3">
          <p className="label">Devnet · test money only · about 60 seconds</p>
          <h1 className="text-[clamp(44px,6.5vw,88px)]">You play all three people.</h1>
          <p className="max-w-[62ch] text-lg text-muted">
            A customer locks money, pays a shop with no signal, and the shop collects. Do the steps in order. On one laptop, keep the Phone and the Shop open in two
            windows side by side and copy-paste the codes between them.
          </p>
        </div>
        <Doggett pose="welcome" size={150} className="hidden md:block" />
      </div>

      <ol className="relative grid gap-5 lg:grid-cols-3">
        <div aria-hidden className="absolute left-0 right-0 top-[38px] hidden h-px bg-line lg:block" />
        {STEPS.map((s, i) => {
          const c = STEP_COPY[s.href];
          return (
            <li key={s.href} className="relative flex">
              <Link href={s.href} className="paper group flex w-full flex-col gap-5 p-6 transition-transform hover:-translate-y-1">
                <div className="flex items-center gap-3">
                  <span className="mono grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-xl text-on-accent">{s.n}</span>
                  <span className="flex flex-col">
                    <span className="label">Step {s.n} · {s.role}</span>
                    <span className="text-sm text-muted">{c.who}</span>
                  </span>
                </div>
                <h2 className="text-3xl">{c.action}</h2>
                <ol className="flex flex-col gap-2">
                  {c.doIt.map((d, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="mono text-sm text-accent">{j + 1}.</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ol>
                <span className="self-start rounded-full border border-line px-3 py-1 text-sm">{c.signal}</span>
                <div className="flex min-h-[170px] items-center justify-center rounded-2xl bg-sunk/60 p-4">{PREVIEW[i]}</div>
                <p className="text-sm">
                  <span className="font-semibold">Result: </span>
                  <span className="text-muted">{c.result}</span>
                </p>
                <span className={`btn mt-auto self-start ${i === 0 ? "btn-sail" : "btn-quiet"}`}>Open step {s.n}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted">
        Done all three? Try{" "}
        <Link href="/play" className="link">
          Play
        </Link>{" "}
        (buy a game power-up offline) or{" "}
        <Link href="/app/courier" className="link">
          Courier
        </Link>{" "}
        (anyone with signal can collect for a shop).
      </p>
    </div>
  );
}
