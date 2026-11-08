import Link from "next/link";
import { Doggett } from "../components/doggett";
import { STEPS } from "../lib/steps.ts";

export const metadata = { title: "Try it in 60 seconds" };

const DOES = ["Lock $40 of test money for a phone.", "Pay a shop with no signal.", "Check the ticket offline, then collect."];

export default function AppHome() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-3">
          <p className="label">Devnet · test money only · about 60 seconds</p>
          <h1 className="text-[clamp(48px,7vw,96px)]">Three pages, one crossing.</h1>
          <p className="max-w-[60ch] text-lg text-muted">
            Go left to right. Open the Phone and the Shop in two windows side by side; copy and paste the codes between them if you have no second device.
          </p>
        </div>
        <Doggett pose="welcome" size={150} className="hidden md:block" />
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="paper group flex h-full flex-col gap-4 p-6 transition-transform hover:-translate-y-1">
              <span className="mono grid h-10 w-10 place-items-center rounded-full bg-accent text-on-accent">{s.n}</span>
              <span className="display text-4xl">{s.role}</span>
              <span className="text-lg">{DOES[i]}</span>
              <span className="text-sm text-muted">{s.todo}</span>
              <span className="mt-auto font-semibold group-hover:underline">Open {s.role.toLowerCase()} →</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <Link href={STEPS[0].href} className="btn btn-sail">
          Start with step 1
        </Link>
        <p className="text-sm text-muted">
          Then try{" "}
          <Link href="/play" className="link">
            Play
          </Link>{" "}
          (buy a power-up offline) or{" "}
          <Link href="/app/courier" className="link">
            Courier
          </Link>{" "}
          (collect for a shop).
        </p>
      </div>
    </div>
  );
}
