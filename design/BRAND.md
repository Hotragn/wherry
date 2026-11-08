# Wherry: brand

Written by the manager as [Brand designer] + [Character designer], 2026-11-08 03:30 ET. **Status: APPROVED** (palette A picked).
Inputs: knowledge/design.md (process, crypto trust UX, checklist), knowledge/quality-bar.md, decision.md.

## Name and promise
- **Name:** Wherry
- **Promise (one line):** The ferry for your money when the network's gone.
- **Personality (3 words):** Steady. Plainspoken. Resourceful.
- **Why the name:** a wherry was the small open boat London's licensed Thames watermen rowed to ferry people and goods across the river, before there were enough bridges. Wherry carries your money across the gap when the network drops.

## Mood: a real-world reference, not "web3"
**Thames watermen and Admiralty river charts, 1750–1880.**
- Warm chart paper with engraved river-ink lines and soundings.
- The red-oxide sails of Thames barges.
- Tarred clinker-built hulls, rope and brass.
- Numbered ferry tickets with perforated edges.
- The waterman's licence badge.

Design translation:
- engraved line work, not gradients;
- paper surfaces, not glass;
- serial-numbered tickets for vouchers;
- one red sail for the one primary action.

## Palette (redesign, 2026-11-08): owner combo 2, "Fog · Aubergine · Saffron"
Swatch page with all three owner combos on the same real UI: `design/swatches.html` (screenshot `design/after/swatches.png`).

| Combo | Colours | Verdict |
|---|---|---|
| 1 | coffee #6F4E37 · platinum #E5E4E2 (owner wrote "ese4e2") · lavender mist #E6E0F0 | Rejected. Lavender on platinum is 1.01:1, so the primary action and the ticket vanish. |
| **2** | **fog #DDE3E8 · aubergine #3A0F34 · saffron #EAAA00** | **Picked.** Saffron is real ferry-ticket card stock. Aubergine on fog is 12.5:1, aubergine on saffron 7.9:1. Readable in daylight, nothing like a dark crypto site. |
| 3 | walnut #5B4632 · hot pink #FA4D90 · copper #C8792C | Rejected. Pink on walnut is 2.76:1 and copper 2.63:1, and it reads as a promo site. |

Tokens (`design/tokens.css`): base fog · surface #EEF1F4 (lifted fog) · sunk #CDD5DC · ink aubergine · muted #5C4A5A (6.28:1) · accent saffron, with aubergine text on it · ok #1C6641 (5.36:1) · err #A3231C (5.77:1) · night = aubergine, with on-night = fog.
Rules: saffron is only ever a fill (as text on fog it's 1.58:1). Warnings are ink plus a "!" mark, never a fourth hue. No #FFFFFF or #000000.

**Superseded:** palette A "Admiralty chart" (paper #F3EBDD / river ink #11313A / red-oxide sail #B0432A), with Fraunces, Instrument Sans and IBM Plex Mono.

## Type (redesign)
- **Display: Bricolage Grotesque** at 78% width and weight 800. A condensed, slightly quirky grotesque, like a printed ferry notice. OFL, via next/font.
- **Text: Atkinson Hyperlegible Next.** Made for low-vision readers, so it suits a first-time user on a phone at a market stall. Body 17 px, lead 19 px. OFL.
- **Mono: Paper Mono** (paper.design, OFL 1.1, self-hosted at `public/fonts/PaperMono.woff2`) for every amount, serial, label and all the ASCII art.

## ASCII animation
Pure text frames in Paper Mono (`app/components/ascii.tsx`, frames in `ascii-frames.ts`, tested). They run on requestAnimationFrame at 10–30 fps, pause off-screen, render one static frame under reduced motion, and are aria-hidden with a text alternative.
- Landing: Doggett rows ticket No. 7 from PHONE to SHOP while the signal drops from `[||||] 4G` to `[....] NO SIGNAL`.
- Phone: the ticket prints character by character when the phone signs it.
- Shop: the COLLECTED stamp lands and the stub tears off.

## Space, radii, shadows, motion
- Spacing on a 4 px base (4, 8, 12, 16, 20, 24, 32, 40, 56, 72). Generous section spacing; the page breathes like a chart margin.
- Radii: 3 inputs · 6 tickets · 8 panels · 4 buttons (square, stamped).
- Shadows: a hard 2–6 px aubergine offset, like a ticket lying on a counter. **Never blurred, never a glow.**
- Motion: a boat on calm water. 120/200/320 ms, ease `cubic-bezier(.2,.8,.2,1)`, no bounce. The only loop is Doggett's three waiting dots (1.2 s). Everything goes static under `prefers-reduced-motion`.

## Mascot: Doggett
- **Who:** Doggett, a chubby little Thames wherry with an aubergine hull, a saffron sail and stripe, big eyes with highlights, and a saffron blush (redrawn 2026-11-08).
- **Name:** from *Doggett's Coat and Badge*, the race for young Thames watermen rowed every year since 1715, the oldest rowing race in the world.
- **Personality:** unflappable, cheerful, a little proud of always getting across. Doggett never panics in the dark; it just keeps rowing.
- **Why it fits:** the product's job is getting money safely across a gap (the outage). A tiny, sturdy ferry that keeps going when the lights are out is the promise in one picture. It's simple enough to read at 32 px: hull, sail, two eyes.
- **Poses → app states** (`design/mascot/*.svg`, hand-built, brand colours, colours via `--w-*` with fallbacks):
  | File | State | Used for |
  |---|---|---|
  | `welcome.svg` | sail up, smiling | landing hero, empty states ("No vouchers yet") |
  | `waiting.svg` | sail furled, rowing, three dots | "Waiting for your wallet", settling, AI thinking, offline queue |
  | `success.svg` | full sail, green check, happy eyes | confirmed / settled / voucher accepted |
  | `error.svg` | listing, worried brows, red droplet | failed tx, declined voucher, shortfall |
  | `favicon.svg` | hull + sail + eyes on a paper tile | favicon and app icon (32 px and 16 px) |
- Rules: small (40–96 px in the UI; hero up to 160 px). Never more than one Doggett on screen. Never over text. Animate only the waiting dots (`.w-dot-1/2/3`, staggered opacity), and not under reduced motion.

## Signature details (the memorable parts)
1. **Ferry-ticket vouchers.** Every voucher is a paper ticket: serial number (`No. 0007`), perforated divider, mono amount, a notch on each side, and the shop name. The QR sits inside a ticket frame. Settled tickets get a small "SETTLED" stamp in ok-green with the confirm time.
2. **The Crossing.** A thin engraved river line across the shop screen. Each voucher sits on the near bank as a tiny boat glyph (offline, verified); when settled, it crosses to the far bank ("Settled in 0.7 s"). It's the data visual for "signed offline → settled onchain". It is also the how-it-works diagram on the landing page (escrow → voucher → settlement as three stations along one river line). It is not a centred hero with three cards.

## Layout
- Landing: left-aligned editorial hero (Fraunces headline + one sentence + one red-sail button "Open the app"); Doggett beside it; under it a **night band** with the blackout fact ("Apr 28, 2025: Spain and Portugal went dark. In-store card payments fell 55%."); then The Crossing explainer; then "Why this is safe" (escrow, coverage, payer record, risk circuit, AI officer); footer with program ID and GitHub.
- App: three role tabs (Owner · Phone · Shop) plus Play. One primary action per view. Wallet connect only in Owner view and when the Shop settles.
- 375 px first: tickets stack, The Crossing turns vertical.

## Voice
Plain, short, concrete. Like a waterman: calm and exact.
- Yes: "Waiting for your wallet" · "Confirmed in 0.8 s" · "Checked offline in 3 ms" · "Covered: $36.50 left in this tab" · "Tab synced 12 min ago" · "Declined: this would put you over your $20 limit for one customer" · "Settled 3 vouchers. $9.80 is in your account."
- No: "seamless", "revolutionize", "leverage", "cutting-edge", "game-changer", "robust", "delve", "unlock", emoji bullets, rhetorical questions, filler intros.
- Every simulated thing is labelled ("test dollars", "devnet").

## Banned looks (from the quality bar)
Purple-to-blue gradients · glowing neon crypto cards · glassmorphism · generic 3D blobs · stock emoji as icons · centred hero + three feature cards · lorem ipsum · template defaults left unchanged · plain #FFFFFF/#000000 backgrounds · Tailwind default palette colours.

## Critic checklist (M3 / M4; [Design critic] uses it on screenshots)
1. No hex outside `design/tokens.css` (grep).
2. One accent action per screen.
3. Body 16 px; mono for every number.
4. Every tx state in words plus an explorer link.
5. Empty, loading and error states with the right Doggett pose.
6. 375 px has no horizontal scroll.
7. Ferry-ticket vouchers and The Crossing present.
8. No banned look, no banned word.
