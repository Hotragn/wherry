import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { OfflineShell } from "./components/offline-shell";
import "./globals.css";

// Google Fonts, self-hosted by next/font so they keep working offline.
const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "500", variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wherry: the ferry for your money when the network's gone", template: "%s · Wherry" },
  description:
    "Offline payments on Solana. Lock test dollars in an onchain tab, pay with signed vouchers while offline, and let the shop settle them in one transaction when the network is back.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <OfflineShell />
      </body>
    </html>
  );
}
