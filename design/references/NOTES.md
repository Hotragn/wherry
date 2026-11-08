# Reference notes (redesign, 2026-11-08)

Inspiration for craft only. No layouts, assets or code were copied.

| Reference | Screenshot | What we take in spirit | What we leave |
|---|---|---|---|
| paper.design/mono (Paper Mono, OFL 1.1) | `paper-mono.png` | Mono type used as display at huge sizes. Construction lines and measurements shown as part of the art. Warm paper ground. | Their blue grid and dark print spread. |
| elayadesign/ai-design-skills | `elaya-skills.png`, `elaya-landing-page-design-SKILL.md` | Anti-slop rules: one idea per section, asymmetric editorial grids, real numbers instead of adjectives, no centred hero with three cards, no gradient or glow. | Their landing-page template structure. |
| rareui.com (blocks bots; captured in the browser pane) | `rareui.jpg` | Motion as the thing you remember. One loud action button against a calm field. | The dark glow look, pill nav and shadcn defaults: that's the "generic AI site" look the owner wants gone. |

How it shows up in Wherry:
- Paper Mono carries every amount, serial and label, plus all the ASCII art (river hero, ticket printer, stamp).
- Bricolage Grotesque, condensed and very bold, for headlines that read like a printed ferry notice.
- One saffron action per screen. Everything else is aubergine ink on fog.
- Hard offset shadows (a ticket lying on a counter) instead of blurs.

## v2 (after owner feedback)
- `dribbble-crypto-animation.jpg`: character-led 3D objects floating over soft fields. That's where the orb + plush Doggett + drifting ticket hero comes from.
- Figma "Web design trends 2026": we took 3D/WebGL, bold type, motion and tactile soft UI. We left out neo-brutalism (v1's hard shadows), neon retrofuturism and collage.
- Rare UI fluid-orb is vendored as `app/components/fluid-orb.tsx` and credited in the footer.
- elaya `figma-designer` rules applied: see `design/persona-brief.md`.
