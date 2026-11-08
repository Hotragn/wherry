"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The 60-second path for a first-time visitor: Owner, then Phone, then Shop. */
export const STEPS = [
  { href: "/app/owner", n: 1, role: "Owner", line: "you fund the tab", todo: "Get test dollars, pair the phone, lock $40." },
  { href: "/app/phone", n: 2, role: "Phone", line: "pays with no signal", todo: "Find your tab, scan the shop's sticker, pay." },
  { href: "/app/shop", n: 3, role: "Shop", line: "Amara's kiosk", todo: "Check the voucher offline, accept, settle when you're back online." },
] as const;

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
    <nav aria-label="Next step" className="mx-auto mt-4 max-w-page border-t-[1.5px] border-line px-4 py-6">
      {next ? (
        <Link href={next.href} className="group inline-flex flex-col">
          <span className="label">Next: step {next.n} of 3</span>
          <span className="font-display text-2xl font-bold group-hover:underline">
            {next.role}: {next.line} →
          </span>
          <span className="text-sm text-muted">{next.todo}</span>
        </Link>
      ) : (
        <Link href="/play" className="group inline-flex flex-col">
          <span className="label">You&apos;ve made the crossing</span>
          <span className="font-display text-2xl font-bold group-hover:underline">Next: Play, buy a power-up offline →</span>
          <span className="text-sm text-muted">The same vouchers pay for an in-game item, with a bonus drop you can prove was fair.</span>
        </Link>
      )}
    </nav>
  );
}
