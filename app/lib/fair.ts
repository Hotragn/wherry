// Provably fair bonus drops. Pure: the same inputs give the same drop on any device.
// drop = DROPS[ sha256(studio seed ‖ voucher nonce ‖ serial u32 LE)[0] ]
// The studio commits sha256(seed) onchain before players buy; the nonce is the player's seed,
// random per voucher and signed into it. Neither side can choose the result after seeing the other's.

export const DROPS = [
  { upTo: 149, item: "Oar polish", rarity: "common" },
  { upTo: 219, item: "Lantern", rarity: "uncommon" },
  { upTo: 249, item: "Red sail", rarity: "rare" },
  { upTo: 255, item: "Doggett's coat and badge", rarity: "legendary" },
] as const;
export type Drop = (typeof DROPS)[number];

export async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", all as BufferSource));
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const sameBytes = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);

export async function rollDrop(seed: Uint8Array, nonce: Uint8Array, serial: number): Promise<{ roll: number; hash: Uint8Array; drop: Drop }> {
  const s = new Uint8Array(4);
  new DataView(s.buffer).setUint32(0, serial, true);
  const hash = await sha256(seed, nonce, s);
  const roll = hash[0];
  return { roll, hash, drop: DROPS.find((d) => roll <= d.upTo)! };
}

/** Does the revealed seed match what the studio committed before the purchase? */
export async function seedMatches(seed: Uint8Array, commitment: Uint8Array) {
  return sameBytes(await sha256(seed), commitment);
}
