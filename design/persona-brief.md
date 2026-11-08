# Redesign v2: brief for each persona (2026-11-08, after owner feedback)

The owner's feedback on v1: the buttons and the overall feel weren't modern or premium, the colours weren't well chosen, and the references weren't really used. v2 restarts the visual language from the references below. Logic is unchanged.

## The references, and what each one is used for
| Reference | Used for |
|---|---|
| Paper Mono (`~/Downloads/paper-mono-v1.000`, the same v1.000 we self-host at `public/fonts/PaperMono.woff2`, OFL) | Every amount, serial, code and the ASCII river. Nothing else. |
| Rare UI `fluid-orb` (`npx shadcn add swamimalode07/rare-ui/fluid-orb`) | Landing hero: a WebGL emerald orb behind Doggett. Vendored as `app/components/fluid-orb.tsx` (`cn` replaced by a plain join so no new deps). Its licence (MIT + Commons Clause + attribution) is honoured with a footer credit. |
| elaya `ai-design-skills` (`landing-page-design`, `figma-designer`) | Rules: one typeface plus a mono for data; Tailwind type, spacing and radius scale; nested radius = outer - gap; flat surfaces; the only gradient is on the hero heading text; one accent under 80% saturation; borders all the way round or none; no eyebrow tags; no three equal cards; sentence case; Default/Hover/Pressed/Focus/Disabled states for buttons; contrast 4.5:1 for text and 3:1 for UI. |
| Dribbble, crypto animation | Character-led 3D objects floating over soft colour fields, with depth and light. That's the hero composition: orb, plush mascot, and a real ticket drifting in front. No neon, no dark glow. |
| Figma, web design trends 2026 | Taken: 3D and WebGL (orb), bold typography (72-96 px Geist hero), motion (float, ticket print, stamp), tactile soft UI for fintech (soft shadows on ivory cards), gamified feel (Play). Rejected for money: neo-brutalism (v1's hard offsets, now gone), retrofuturism neon, collage. |
| Meta Muse mascot (owner image) | Doggett v2: a soft cream plush body with fur texture, a smooth face patch, dot eyes with highlights, a blush, simple limbs. He sits in a little emerald wherry with a vermilion pennant. |

## Palette (v3): owner combo 3 only, Mocha #5B4632 · Champagne Gold #F4D9A0 · Burnt Amber #C8792C
- **[Brand designer]:** the owner asked for one of the given combos and nothing else, and shared two reference sites built on exactly these combos (dark mocha with champagne/amber, and mocha with lavender). Combo 3 matches the "Inner Peace" reference, which is lit folded paper, and folded paper is Wherry's ticket and paper-boat hat.
- No other hue anywhere. Shadows are mocha deepened. The orb shader's white was replaced with champagne.
- Contrast: champagne/mocha 6.46 both ways. Amber/mocha 2.63, so amber is decoration only.
- v2 (ivory, emerald, vermilion) is superseded.

## Type
**[Brand designer]** Cormorant Garamond for display, as in the owner's references (the owner's references win over elaya's one-typeface rule). Geist for UI text, Paper Mono for numbers and tiny tracked caps labels (also from the references). Headlines are 56-120 px.

## Buttons ([UI designer])
- Primary: a champagne pill with mocha text (6.46:1), 48 px, Geist 600 16 px, with a round mocha arrow chip that slides 3 px on hover. Hover darkens and lifts. Press scales to 98%. Disabled is 45% opacity. Focus is a 2 px emerald ring. One per screen.
- Secondary: an outlined champagne pill on mocha, like the references' "Explore →".
- Text links: a 1 px underline at 40% that goes solid on hover.

## Every screen answers three questions ([UX writer], [First-time user])
Where am I (the role pill in the header), what do I do next (one vermilion button, plus Doggett's 3-step guide), is my money safe (the "Is my money safe?" section, devnet and test-money labels, explorer links, the program ID in the footer).

## [Motion designer]
Orb drift (WebGL, static under reduced motion). Doggett floats (5 s ease). The ASCII river and the ticket print stay. The COLLECTED stamp lands and the stub tears off.
