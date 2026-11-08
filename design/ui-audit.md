# UI audit, before the redesign ([Design critic], 2026-11-08 08:20 ET)

Screens: `design/before/*-{390,1440}.png`.

| # | Tell | Where | Fix in the redesign |
|---|---|---|---|
| 1 | Cream paper + serif headline + red pill button is a 2024 template look ("AI-made") | all | Owner combo 2: fog, aubergine ink, saffron tickets. Condensed grotesque display. Square stamped buttons. |
| 2 | Hero is a headline next to a small clip-art boat: nothing moves, nothing explains | landing | Full-width ASCII river: Doggett rows ticket No. 7 across while the signal drops to NO SIGNAL. |
| 3 | Three stations on a thin river line read as "3 feature columns" | landing | Numbered ledger list (01 / 02 / 03) with a real ticket beside it. Each step has a "What's this?" note. |
| 4 | Jargon up front: escrow, voucher, settle | phone, shop, landing | Plain words first: your locked tab, ferry ticket, collect. The term sits in a "What's this?" note. |
| 5 | The tab balance is a plain number | phone, owner | The hold of a hull fills with saffron to what's left. |
| 6 | Vouchers are pale cards that barely look like tickets | phone, shop | Saffron card stock, serial, "Admit one crossing to", punched notches, a tear-off stub, and a COLLECTED stamp that lands. |
| 7 | Signing a voucher is instant and invisible | phone | The ticket prints character by character in Paper Mono, then the real ticket appears. |
| 8 | "Offline" pill in amber reads like an error | header, phone, shop | Calm saffron line: "No signal. That's fine. Tickets still work." |
| 9 | Mascot is thin and clip-art-like at small sizes | everywhere | Doggett redrawn: chubby hull, big eyes with highlights, blush, bold saffron sail. Waiting pose for loading, error pose for declines. |
| 10 | Body text 16 px and light muted grey; key numbers small on phones | phone | 17 px body, 19 px lead, amounts 40–56 px in Paper Mono. |
| 11 | No first-time guidance per role | owner, phone, shop | Doggett's 3-step first-run guide per role, dismissible. |

## Critique round 1 (after screenshots, `design/after/`)
1. Phone amount ($40.00 at 56 px) overflowed 390 px and pushed the "Your locked tab" label off-screen. Fixed: clamp(40px, 12vw, 56px), label above.
2. The budget planner sat above "Pay": the main job was below the fold. Fixed: Pay comes first, the planner after it.
3. In the shop's 18 rem column the ticket header wrapped and "tab …" collided with the stub. Fixed: 20 rem column, header wraps cleanly, tab on its own line.
4. The COLLECTED stamp covered the shop name. Fixed: moved over the fare area.
5. A declined ticket had no Doggett error pose. Fixed: error pose next to the decline line.

## Critique round 2
1. The hero ASCII was 8 px on a 390 px phone: unreadable. Fixed: minimum 10 px and shorter status text ("tickets still work.") so the line fits about 55 columns.
2. Three Doggetts could be on screen at once (first-run guide, empty list, success). Fixed: dropped the empty-list Doggetts. Doggett now appears only in the guide and in waiting, success and error states.
3. A next/font warning about the Atkinson fallback cluttered the build output. Fixed: `adjustFontFallback: false`.
4. Signing a ticket gave no feedback. Checked: the ASCII print runs about 1.3 s at 220 characters per second, then the real ticket rises in (see `design/after/phone-print-390.png`).
5. Checked side by side for the laptop-only video at 1440 px: the phone window (390 px) is a single column, the shop window is two columns, and the saffron action is the same colour in both.

Still open: the first-run guide's Doggett can share the screen with a success or error Doggett until the guide is dismissed.
