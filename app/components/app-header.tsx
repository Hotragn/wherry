"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnline } from "../lib/use-online";
import { StepLine } from "./guide";

const ROLES = [
  { href: "/app/owner", label: "Owner", n: 1 },
  { href: "/app/phone", label: "Phone", n: 2 },
  { href: "/app/shop", label: "Shop", n: 3 },
  { href: "/play", label: "Play", n: 0 },
  { href: "/app/courier", label: "Courier", n: 0 },
];

export function AppHeader() {
  const path = usePathname();
  const online = useOnline();
  return (
    <header className="border-b-[1.5px] border-line">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-2xl font-bold">
          Wherry
        </Link>
        <nav aria-label="Roles" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {ROLES.map((r) => {
            const active = path === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-2.5 py-2 font-semibold sm:px-3 ${active ? "bg-surface shadow-1 ring-[1.5px] ring-ink" : "text-muted hover:text-ink"}`}
              >
                {r.n > 0 && (
                  <span className="mono mr-1 text-xs" aria-hidden>
                    {r.n}
                  </span>
                )}
                {r.label}
              </Link>
            );
          })}
        </nav>
        <span
          className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1 text-sm ${online ? "text-muted" : "bg-surface font-semibold text-warn ring-[1.5px] ring-warn"}`}
          role="status"
          aria-live="polite"
        >
          {online ? (
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ok" />
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1.5 6.5a9.5 9.5 0 0 1 13 0M4.2 9.2a5.6 5.6 0 0 1 7.6 0M6.8 11.8a1.9 1.9 0 0 1 2.4 0" />
              <path d="M2 2l12 12" />
            </svg>
          )}
          {online ? "Online · devnet" : "Offline"}
        </span>
      </div>
      <StepLine />
    </header>
  );
}
