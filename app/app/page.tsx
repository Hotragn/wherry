import Link from "next/link";
import { BoatGlyph } from "../components/crossing";

export const metadata = { title: "Open the app" };

const ROLES = [
  { href: "/app/owner", role: "Owner", line: "Lock test dollars in a tab and pair your phone. Needs a wallet and the network, once." },
  { href: "/app/phone", role: "Phone", line: "Pay with signed vouchers. Works with no signal." },
  { href: "/app/shop", role: "Shop", line: "Check vouchers offline, see your worst case, settle them later in one transaction." },
];

export default function AppHome() {
  return (
    <div className="flex max-w-text flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Pick your side of the counter</h1>
        <p className="text-muted">Use two devices for the real thing: a phone that pays and a shop that accepts. Everything runs on Solana devnet with test dollars.</p>
      </div>
      <ol className="flex flex-col border-t-[1.5px] border-line">
        {ROLES.map((r) => (
          <li key={r.href} className="border-b-[1.5px] border-line">
            <Link href={r.href} className="group flex items-center gap-4 py-5">
              <BoatGlyph size={36} />
              <span className="flex flex-col">
                <span className="font-display text-2xl font-bold group-hover:underline">{r.role}</span>
                <span className="text-muted">{r.line}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
