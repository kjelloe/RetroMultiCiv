# Designer-ally request — tech-glyph motif concepts (2026-07-19)

Companion to the 68 tech blurbs (which landed cleanly). We built a procedural
tech-GLYPH system in the house style: every glyph = a shared **era-colored
frame** (ancient tan / renaissance green / industrial blue / modern purple) +
a **per-tech central motif** drawn from a small 2D-primitive vocabulary
(disc / ring / arc / ellipse / bar / polyline / triangle …). All 68 render
today; the OBVIOUS motifs are solid (alphabet = letter mark, wheel = spoked
circle, gunpowder = burst, space-flight = rocket, pottery = vessel, etc.).

**The ask:** a one-line MOTIF CONCEPT for each tech below — the ~32 that are
currently PROVISIONAL, either because two techs collide on the same obvious
symbol, or because the tech is abstract. Keep each concept BUILDABLE from
simple 2D primitives (describable in a sentence; no fine detail — these render
at ~26px). Where two techs are noted as a collision CLUSTER, the goal is to
make them visually DISTINCT from each other. You know the tech identities from
the blurbs, so a concept like "Feudalism = a stepped pyramid of ranks" is
exactly the level we need.

## Collision clusters to disambiguate (make each distinct)
- **currency / trade / banking** — all money-ish. currency (provisional $ coin),
  trade (exchange arrows), banking (stacked coins). Three distinct commerce
  motifs?
- **horseback-riding / magnetism** — both provisional horseshoe. Split them
  (horse vs magnet/compass-needle?).
- **republic / democracy** — both column/civic. republic (3 columns), democracy
  (ballot box). Distinct?
- **flight / advanced-flight** — plane vs swept jet; keep a clear
  early-vs-advanced read.
- **construction / engineering / invention** — arch vs gear vs lightbulb; three
  distinct "building/making" motifs?
- **map-making / navigation** — folded map vs compass; keep distinct.
- **nuclear-fission / nuclear-power / fusion-power** — atom-split vs cooling
  tower vs bright core; three distinct atomic motifs.

## Single techs wanting a stronger concept (current provisional in parens)
- ceremonial-burial (ankh / grave pillar) — a burial-rite mark?
- chivalry (shield + cross) — heraldry concept?
- metallurgy (cannon) — or armor / ingot?
- physics (pendulum) — or a prism?
- theory-of-gravity (apple + fall arc — reads tree-like) — a cleaner falling-mass?
- combustion (flame) — or a piston?
- communism (5-point star) — vs a hammer-sickle read?
- conscription (crossed rifles — reads as an X) — a clearer draft?
- corporation (rising bar chart) — or a building/tower?
- explosives (TNT bundle) — ok, or a blast?
- refining (oil derrick) — or a barrel/distillation?
- electronics (resistor / circuit) — ok, or a chip?
- future-tech (8-point burst) — the endless sink; an infinity/∞ or open-frontier alt?
- labor-union (clasped hands — reads as a swirl) — solidarity / raised-fist alt?
- plastics (polymer ring) — or a molded bottle?
- superconductor (maglev disc over a rail) — ok, or a zero-resistance loop?

## Format
Just: `tech-id → one-line motif`. We implement procedurally; you don't need to
draw anything. Provisional art ships in the tree meanwhile (functional, not
final), and we wire the discovery card + research readout once your concepts
land (kept to one surface until then). Sheet to review the current state:
`debugging/glyph-sheet.html` (a labeled 68-glyph grid, flagged marks amber).

---

## ANSWERED — ally motif concepts (2026-07-19)

All 32 delivered. Original design prose (committable). Design grammar to
preserve: object/value → exchange → institution; early machine → advanced
machine; split atom → reactor → stellar union; public offices → ballot
participation. Implement procedurally in `client/ui/tech-glyphs.js` (replace
the provisional motifs), keep the ~26px silhouette read.

- `currency` → a single round coin with a centered square hole (standardized value).
- `trade` → two opposing horizontal arrows through a small central dot (goods both ways).
- `banking` → a solid vault rectangle containing three stacked small coins.
- `horseback-riding` → a horse-head profile with short mane + one angled rein line (NOT a horseshoe).
- `magnetism` → a U-magnet with two contrasting pole tips pulling three small dots inward.
- `republic` → a semicircle of three equal columns beneath one straight lintel.
- `democracy` → a ballot rectangle dropping through a slot into a square box.
- `flight` → a straight-wing propeller-plane silhouette, small nose disc + broad horizontal wings.
- `advanced-flight` → a sharp swept-wing jet, narrow triangular nose + trailing speed lines.
- `construction` → three offset stone blocks rising into a simple arch.
- `engineering` → a bridge truss: two upright supports joined by a bold triangular brace.
- `invention` → a small lightbulb disc above a short zigzag filament/base.
- `map-making` → a folded three-panel map (zigzag rectangle) with a tiny route dot.
- `navigation` → a compass rose: central disc, one long needle, four short cardinal points.
- `nuclear-fission` → a nucleus split into two separated half-discs, three small particles escaping.
- `nuclear-power` → a broad cooling-tower silhouette with a glow disc / three rising heat arcs above.
- `fusion-power` → two small discs converging into one bright center, enclosed by a partial energy ring.
- `ceremonial-burial` → a low grave mound beneath a tall upright memorial stone, small rising arc above.
- `chivalry` → a heraldic kite shield split by one bold diagonal band, topped by a tiny crown crest.
- `metallurgy` → a faceted ingot above a shallow crucible bowl (metal shaped, not a weapon).
- `physics` → a prism triangle splitting one entering bar into two diverging rays.
- `theory-of-gravity` → a single solid circle descending along a curved arc toward a baseline (no tree/apple).
- `combustion` → a vertical piston cylinder with a small flame/burst in its lower chamber.
- `communism` → a five-point star above a broad bar, two short equal support bars beneath.
- `conscription` → three upright rifle-like bars behind a small forward-pointing chevron.
- `corporation` → a tall central tower flanked by two shorter towers, one shared base line.
- `explosives` → a compact bundle of three parallel bars with a short lit fuse ending in a 4-point spark.
- `refining` → a vertical distillation column with two side pipes to two small output discs.
- `electronics` → a square microchip, four short pins each side, one central circuit dot.
- `future-tech` → an open broken ring curving outward into two horizon-bound arcs (knowledge beyond the frontier).
- `labor-union` → three raised vertical forearms ending in clenched disc fists, linked at the wrist by one bar.
- `plastics` → a molded bottle silhouette: rounded rectangle, narrow neck, small cap.
- `superconductor` → a continuous closed loop encircling a central disc, two opposing arrows flowing, no breaks.
