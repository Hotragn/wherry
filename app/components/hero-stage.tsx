"use client";

import { Doggett } from "./doggett";
import FluidOrb from "./fluid-orb";
import { Ticket } from "./ticket";

// The orb's shader takes a hex colour, so this mirrors --w-amber from design/tokens.css.
const AMBER = "#C8792C";

/** Hero picture: amber light rays, a liquid amber orb (WebGL), plush Doggett holding a ticket, a real ticket drifting by. */
export function HeroStage() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[500px]">
      <div className="absolute inset-0 grid place-items-center">
        <FluidOrb size={440} color={AMBER} className="opacity-90 max-sm:scale-[0.72]" />
      </div>
      <div className="absolute inset-0 z-10 grid place-items-center pb-6">
        <div className="w-float w-lit">
          <Doggett pose="welcome" size={280} decorative className="max-sm:h-auto max-sm:w-[180px]" />
        </div>
      </div>
      <div className="absolute -bottom-6 -right-4 z-20 hidden w-[250px] rotate-6 sm:block">
        <Ticket serial={7} shopName="Amara's kiosk" amount={3_500_000n} />
      </div>
    </div>
  );
}
