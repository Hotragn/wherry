"use client";

import { useEffect, useRef, useState } from "react";
import { AsciiAnim } from "./ascii";
import { riverFrame } from "./ascii-frames";

/** The landing hero's moving picture: Doggett rows a ticket across while the signal drops. The river fills its box. */
export function RiverHero() {
  const box = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(62);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const probe = document.createElement("span");
    probe.className = "ascii";
    probe.style.cssText = "position:absolute;visibility:hidden";
    probe.textContent = "0".repeat(20);
    el.appendChild(probe);
    const fit = () => {
      const ch = probe.getBoundingClientRect().width / 20;
      if (ch > 0)
        setCols(Math.max(44, Math.min(140, Math.floor(el.clientWidth / ch))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => (ro.disconnect(), probe.remove());
  }, []);
  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-3xl bg-night px-4 py-6 text-on-night shadow-2 sm:px-8 sm:py-8">
        <div
          ref={box}
          className="relative overflow-hidden text-[clamp(10px,2.6vw,17px)]"
        >
          <AsciiAnim
            render={(ms) => riverFrame(ms, cols)}
            staticAt={4200}
            fps={10}
            label="Animation: a small boat named Doggett carries payment number 7 for $3.50 from the phone's bank to the shop's bank. Halfway across the signal drops to nothing and the boat keeps going."
          />
        </div>
      </div>
      <figcaption className="text-sm text-muted">
        The signal drops halfway across. The payment still lands.
      </figcaption>
    </figure>
  );
}
