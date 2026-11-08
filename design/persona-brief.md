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

## Palette: owner combo 4, Warm Ivory #F9EBD7 · Emerald #046A38 · Vermilion #E34222
- **[Brand designer]:** emerald says money and safe (a banknote), ivory says calm and premium and matches the plush mascot, vermilion is the one call to action. Of the four combos, this is the only one with a natural money colour and a natural action colour that don't fight.
- Contrast: ink #0E2A1D on ivory 13.08:1. Emerald on ivory 5.73:1, both ways. Vermilion #E34222 with ivory text is only 3.53:1, so per the elaya rule the button uses the deeper vermilion #C8361A (4.89:1). The bright #E34222 is kept for stamps, the pennant and blush.
- Rejected: combo 1 (mocha, platinum, lavender): lavender on platinum is 1.01:1, so there's no visible action. Combo 2 (ice silver, aubergine, marigold) was v1; the owner found it ineffective, and marigold fails as text (1.58:1). Combo 3 (mocha #5B4632, champagne gold #F4D9A0, burnt amber #C8792C): luxurious, but amber on champagne is 2.45:1 and brown reads as coffee, not money.

## Type
**[Brand designer]** Geist for everything (a single family, as elaya asks), Paper Mono for numbers. Headlines are Geist 600 at -0.035em, 48-96 px. Body is 16-20 px. Sentence case everywhere: v1's shouty uppercase mono labels are gone.

## Buttons ([UI designer])
- Primary: a vermilion pill, 48 px, Geist 600 16 px, with a round ivory arrow chip that slides 3 px on hover. Hover darkens and lifts. Press scales to 98%. Disabled is 45% opacity. Focus is a 2 px emerald ring. One per screen.
- Secondary: an ivory pill with a hairline border and a soft shadow.
- Text links: a 1 px underline at 40% that goes solid on hover.

## Every screen answers three questions ([UX writer], [First-time user])
Where am I (the role pill in the header), what do I do next (one vermilion button, plus Doggett's 3-step guide), is my money safe (the "Is my money safe?" section, devnet and test-money labels, explorer links, the program ID in the footer).

## [Motion designer]
Orb drift (WebGL, static under reduced motion). Doggett floats (5 s ease). The ASCII river and the ticket print stay. The COLLECTED stamp lands and the stub tears off.
