"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Doggett } from "./doggett";
import { STEPS } from "../lib/steps.ts";
import { STEP_COPY } from "./step-copy";

const stepFor = (path: string) => STEPS.findIndex((s) => s.href === path);

/** Under the header on step pages: all 3 steps at a glance, where you are, and a one-click "Next" (the 3-second answer for judges). */
export function StepLine() {
  const i = stepFor(usePathname());
  if (i < 0) return null;
  const next = STEPS[i + 1];
  return (
    <nav aria-label="Demo steps" className="mx-auto flex max-w-page flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, j) => (
          <li key={s.href} className="flex items-center gap-1.5">
            {j > 0 && <span aria-hidden className="text-muted">→</span>}
            <Link
              href={s.href}
              aria-current={j === i ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 ${j === i ? "border-ink bg-ink/10 font-semibold" : "border-line text-muted hover:text-ink"}`}
            >
              <span className={`mono grid h-5 w-5 place-items-center rounded-full text-xs ${j <= i ? "bg-accent text-on-accent" : "border border-line"}`}>{j < i ? "✓" : s.n}</span>
              {s.role}
              <span className="hidden text-muted md:inline">· {STEP_COPY[s.href]?.short ?? s.line}</span>
            </Link>
          </li>
        ))}
      </ol>
      <Link href={next?.href ?? "/play"} className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 font-semibold text-on-accent">
        Next: {next ? next.role : "Play"} →
      </Link>
    </nav>
  );
}

/** The link to the next step, at the end of each step's view. */
export function NextStep() {
  const i = stepFor(usePathname());
  if (i < 0) return null;
  const next = STEPS[i + 1];
  return (
    <nav aria-label="Next step" className="mx-auto mt-4 max-w-page border-t border-line px-4 py-6">
      {next ? (
        <Link href={next.href} className="group inline-flex flex-col">
          <span className="label">Next: step {next.n} of 3</span>
          <span className="display text-2xl group-hover:underline">
            {next.role}: {STEP_COPY[next.href]?.action ?? next.line} →
          </span>
          <span className="text-sm text-muted">{STEP_COPY[next.href]?.who ?? next.todo}</span>
        </Link>
      ) : (
        <Link href="/play" className="group inline-flex flex-col">
          <span className="label">Done: you paid with no signal and the shop got its money</span>
          <span className="display text-2xl group-hover:underline">Bonus: Play, buy a game power-up offline →</span>
          <span className="text-sm text-muted">The same offline payments buy an in-game item, with a bonus drop you can prove was fair.</span>
        </Link>
      )}
    </nav>
  );
}

const FIRST_RUN = {
  owner: ["Get test dollars. They're devnet money, not real money.", "Pair the customer's phone by scanning its code.", "Lock the money in a tab. Now the phone can pay with no signal."],
  phone: ["Find your tab: the money someone locked for this phone.", "Scan the shop's sticker and type the amount.", "Show the offline payment. No signal needed."],
  courier: ["Paste the bundle a shop handed you.", "Check it: every payment is signed, and the shop's note allows your fee.", "Find a signal and collect. The shop gets its money; you keep the fee."],
  shop: ["Scan the customer's offline payment.", "Check it: signature, money left in their tab, your limits. All offline.", "Collect your money when the network is back."],
} as const;

/** Doggett's 3-step first-run guide for a role. Dismissed once per browser. */
export function FirstRun({ role }: { role: keyof typeof FIRST_RUN }) {
  const key = `wherry:first-run:${role}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) Promise.resolve().then(() => setOpen(true));
    } catch {}
  }, [key]);
  if (!open) return null;
  return (
    <aside aria-label="First time here?" className="paper flex gap-4 p-4">
      <Doggett pose="welcome" size={56} decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-bold">First time here? Three steps:</p>
        <ol className="flex flex-col gap-1">
          {FIRST_RUN[role].map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mono text-muted">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="link self-start text-sm"
          onClick={() => {
            setOpen(false);
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }}
        >
          Got it, hide this
        </button>
      </div>
    </aside>
  );
}
