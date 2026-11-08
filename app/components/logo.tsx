import Link from "next/link";
import { Doggett } from "./doggett";

/** The Wherry lockup from the owner's mascot sheet: Doggett in his boat + the serif wordmark. */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={`display flex items-center gap-2 text-2xl ${className}`} aria-label="Wherry, home">
      <Doggett pose="welcome" size={size} decorative glow={false} />
      <span>Wherry</span>
    </Link>
  );
}
