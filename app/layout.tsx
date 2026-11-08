import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import localFont from "next/font/local";
import { OfflineShell } from "./components/offline-shell";
import "./globals.css";

// Cormorant Garamond and Geist (OFL), self-hosted by next/font so they keep working offline.
const text = Geist({ subsets: ["latin"], variable: "--nf-text", display: "swap" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--nf-display", display: "swap" });
// Paper Mono (OFL 1.1, github.com/paper-design/paper-mono): amounts, serials and the ASCII art.
const mono = localFont({ src: "../public/fonts/PaperMono.woff2", weight: "100 800", variable: "--nf-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wherry: the ferry for your money when the network's gone", template: "%s · Wherry" },
  description:
    "Offline payments on Solana. Lock test dollars in an onchain tab, pay with signed vouchers while offline, and let the shop settle them in one transaction when the network is back.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${text.variable} ${display.variable} ${mono.variable}`}>
      <body>
        {children}
        <OfflineShell />
      </body>
    </html>
  );
}
