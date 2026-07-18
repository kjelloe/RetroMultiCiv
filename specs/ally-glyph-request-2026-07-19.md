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
