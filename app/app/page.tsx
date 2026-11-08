import Link from "next/link";
import { STEPS } from "../lib/steps.ts";

export const metadata = { title: "Try it in 60 seconds" };

export default function AppHome() {
  return (
    <div className="flex max-w-text flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="label">Devnet · test dollars</span>
        <h1 className="text-4xl">Try it in 60 seconds</h1>
        <p className="text-muted">
          Three roles, one crossing. A real run uses two devices, a phone that pays and a shop that accepts, but one laptop with two windows works too: copy and paste the codes
          between them.
        </p>
      </div>
      <ol className="flex flex-col border-t-2 border-ink">
        {STEPS.map((s) => (
          <li key={s.href} className="border-b-2 border-ink">
            <Link href={s.href} className="group flex items-start gap-4 py-5">
              <span
                aria-hidden
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface display text-lg "
              >
                {s.n}
              </span>
              <span className="flex flex-col">
                <span className="display text-2xl  group-hover:underline">
                  {s.role}: {s.line}
                </span>
                <span className="text-muted">{s.todo}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link href={STEPS[0].href} className="btn btn-sail self-start">
        Start with step 1
      </Link>
      <p className="text-sm text-muted">
        Then try <Link href="/play" className="link">Play</Link>: the same vouchers buy an in-game power-up offline, with a bonus drop you can prove was fair.
      </p>
    </div>
  );
}
