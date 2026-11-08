"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnline } from "../lib/use-online";

const ROLES = [
  { href: "/app/owner", label: "Owner" },
  { href: "/app/phone", label: "Phone" },
  { href: "/app/shop", label: "Shop" },
  { href: "/play", label: "Play" },
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
                className={`rounded-sm px-3 py-2 font-semibold ${active ? "bg-surface shadow-1 ring-[1.5px] ring-ink" : "text-muted hover:text-ink"}`}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm" role="status" aria-live="polite">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${online ? "bg-ok" : "bg-warn"}`} />
          <span className={online ? "text-muted" : "font-semibold text-warn"}>{online ? "Online · devnet" : "Offline"}</span>
        </span>
      </div>
    </header>
  );
}
