"use client";

import { useState } from "react";
import { AsciiAnim } from "./ascii";
import { ticketLines, typed } from "./ascii-frames";

const CPS = 220;

/** The phone "prints" the ticket in Paper Mono, character by character, then hands over the real one. */
export function PrintedTicket({
  serial,
  shop,
  amount,
  children,
}: {
  serial: string;
  shop: string;
  amount: string;
  children: React.ReactNode;
}) {
  const [done, setDone] = useState(false);
  const text = ticketLines(serial, shop.slice(0, 21), amount);
  if (done)
    return <div className="w-rise flex w-full justify-center">{children}</div>;
  return (
    <div className="flex w-full justify-center rounded-lg border border-line bg-surface p-4 text-[clamp(12px,3.6vw,16px)]">
      <AsciiAnim
        render={(ms) => typed(text, ms, CPS)}
        duration={(text.length / CPS) * 1000 + 350}
        fps={30}
        onDone={() => setDone(true)}
        label={`Printing offline payment ${serial} for ${amount} to ${shop}`}
      />
    </div>
  );
}
