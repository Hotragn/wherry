"use client";

import { Doggett } from "./doggett";
import FluidOrb from "./fluid-orb";
import { Ticket } from "./ticket";

// The orb's shader takes a hex colour, so this mirrors --w-emerald from design/tokens.css.
const EMERALD = "#046A38";

/** Hero picture: an emerald fluid orb (WebGL), plush Doggett floating in front, a real ticket drifting by. */
export function HeroStage() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[480px]">
      <div className="absolute inset-0 grid place-items-center">
        <FluidOrb size={420} color={EMERALD} className="max-sm:scale-[0.72]" />
      </div>
      <div className="absolute inset-0 z-10 grid place-items-center pb-10">
        <div className="w-float">
          <Doggett pose="welcome" size={230} decorative className="max-sm:h-auto max-sm:w-[170px]" />
        </div>
      </div>
      <div className="absolute -bottom-4 right-0 z-20 w-[230px] rotate-6 sm:w-[260px]">
        <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} />
      </div>
    </div>
  );
}
