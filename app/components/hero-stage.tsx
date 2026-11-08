"use client";

import { Doggett } from "./doggett";
import FluidOrb from "./fluid-orb";

// The orb's shader takes a hex colour, so this mirrors --w-amber from design/tokens.css.
const AMBER = "#C8792C";

/** Hero picture: a liquid amber "sun" (Rare UI orb) behind, glowing Doggett in his boat in front. */
export function HeroStage() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute right-0 top-0 max-sm:-right-10 max-sm:-top-6 max-sm:scale-75">
        <FluidOrb size={300} color={AMBER} className="opacity-80" />
      </div>
      <div className="absolute inset-x-0 bottom-10 z-10 grid place-items-center">
        <div className="w-float w-lit">
          <Doggett pose="welcome" size={420} decorative glow className="max-sm:h-auto max-sm:w-[280px]" />
        </div>
      </div>
    </div>
  );
}
