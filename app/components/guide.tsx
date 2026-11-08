"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Doggett } from "./doggett";
import { STEPS } from "../lib/steps.ts";

const stepFor = (path: string) => STEPS.findIndex((s) => s.href === path);

/** "Step 2 of 3 · Phone: pays with no signal" under the header, on step pages only. */
export function StepLine() {
  const i = stepFor(usePathname());
  if (i < 0) return null;
  const s = STEPS[i];
  return (
    <p className="mx-auto max-w-page px-4 pb-3 text-sm text-muted">
      <span className="label text-ink">
        Step {s.n} of 3
      </span>{" "}
      · <strong className="text-ink">{s.role}:</strong> {s.line}
    </p>
  );
}

/** The link to the next step, at the end of each step's view. */
export function NextStep() {
  const i = stepFor(usePathname());
  if (i < 0) return null;
  const next = STEPS[i + 1];
  return (
    <nav aria-label="Next step" className="mx-auto mt-4 max-w-page border-t-2 border-ink px-4 py-6">
      {next ? (
        <Link href={next.href} className="group inline-flex flex-col">
          <span className="label">Next: step {next.n} of 3</span>
          <span className="display text-2xl  group-hover:underline">
            {next.role}: {next.line} →
          </span>
          <span className="text-sm text-muted">{next.todo}</span>
        </Link>
      ) : (
        <Link href="/play" className="group inline-flex flex-col">
          <span className="label">You&apos;ve made the crossing</span>
          <span className="display text-2xl  group-hover:underline">Next: Play, buy a power-up offline →</span>
          <span className="text-sm text-muted">The same vouchers pay for an in-game item, with a bonus drop you can prove was fair.</span>
        </Link>
      )}
    </nav>
  );
}

const FIRST_RUN = {
  owner: ["Get test dollars. They're devnet money, not real money.", "Pair the customer's phone by scanning its code.", "Lock the money in a tab. Now the phone can pay with no signal."],
  phone: ["Find your tab: the money someone locked for this phone.", "Scan the shop's sticker and type the amount.", "Show the ferry ticket. No signal needed."],
  shop: ["Scan the customer's ferry ticket.", "Check it: signature, money left in their tab, your limits. All offline.", "Collect your money when the network is back."],
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
