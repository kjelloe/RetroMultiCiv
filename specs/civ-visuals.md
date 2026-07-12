# Designer ally — 14-civilization visual identity table (verbatim, 2026-07-12)

(Authored for A1.6a on request. Client-side visual table only; slots map
onto existing civ ids. Goals: readable by primary color alone; secondary
color + emblem for colorblind support; emblems work as pennant geometry,
CanvasTexture flags, and tiny UI icons; no real-flag copying; faction
color stays an accent.)

| Slot | Visual theme name | Primary | Secondary | Emblem | Design intent |
|---:|---|---:|---:|---|---|
| 1 | Crimson Sun | #B83C3C | #F2C66D | sun | Classic strong empire color; aggressive, readable. |
| 2 | Azure Wave | #2F6FB3 | #D9EEF7 | wave | Naval/exploration feel; high contrast on land. |
| 3 | Emerald Oak | #3F8F4A | #F0E2B6 | oak | Growth, forests, stability; warm secondary prevents green-on-green. |
| 4 | Imperial Violet | #6B4BB3 | #E6D7FF | star | Regal and distinctive; good against terrain. |
| 5 | Amber Wheel | #C9822B | #3F2A16 | wheel | Trade, movement, engineering; dark emblem reads on amber. |
| 6 | Iron Mountain | #5F6872 | #E8EEF2 | mountain | Defensive/industrial tone; strong neutral identity. |
| 7 | Teal Chevron | #218C8C | #FFE0A3 | chevron | Clean, modern, readable vs blue/green neighbors. |
| 8 | Umber Hammer | #7A4B2A | #F0B85A | hammer | Production/mining identity; earthy but visible. |
| 9 | Ivory Tower | #F0E6C8 | #2C2C35 | tower | Light civ; dark emblem and base outline essential. |
| 10 | Rose Diamond | #C24C7A | #FFD6E6 | diamond | Distinct from red/purple; strong UI personality. |
| 11 | Cobalt Crescent | #1F4F99 | #F5D36C | crescent | Deep blue; gold emblem keeps it distinct from Azure Wave. |
| 12 | Olive Spiral | #758A35 | #F4E9C1 | spiral | Ancient/organic; less saturated than Emerald Oak. |
| 13 | Maroon Flame | #8E2F45 | #FFB36B | flame | War/energy without duplicating Crimson Sun. |
| 14 | Arctic Rune | #66AFC2 | #1D3340 | rune | Pale cold civ; dark emblem/base rim gives readability. |

Rendering notes: primary color on unit base discs, city ownership
markers, selected-city accents, minimap/player list, diplomatic chip.
Light primaries (Ivory Tower) need a thin dark outline/rim. Pennants:
field=primary, emblem=secondary, pole=neutral wood, optional secondary/
dark border (invert for Ivory Tower). Unit accents (shield face, sail
stripe, horse cloth, small side panel, banner, base) in primary; never
recolor the whole body.

Emblem build order: sun, wave, oak, star, wheel, mountain, chevron,
hammer, tower, diamond, crescent, spiral, flame, rune.

Acceptance criteria (gallery): all 14 civs side by side on grassland/
desert/forest/coast/tundra; recognizable at gameplay zoom; recognizable
with body colors disabled; recognizable by flag/emblem when primaries
are hard to distinguish; light civs have dark outlines; no emblem
resembles a real national flag; NO effect on canonical state, replay
hashes, fog, or command validation.
