# XII.6 — Tech tree view + beeline + tech glyphs: buildable spec (architect, 2026-07-18)

> User refinement (2026-07-18): a graphical tech-tree for viewing + selecting
> the next research (esp. for new players), alongside the current list; plus
> a procedural icon/glyph per tech. Design forks RULED by the user
> (AskUserQuestion): tech-tree = **graphical tree**; selection depth =
> **client-side beeline**; icon style = **procedural house-style glyphs**.
> ALL GOLDEN-NEUTRAL CLIENT (reads `data/techs.json` prereqs + player state;
> `setResearch` already exists; no engine/save/luau change). Helper lane.

Data is ready: `data/techs.json` entries carry `name`, `level`, `era`,
`prereqs[]` — a clean DAG. Research is single-target today (`player.researching`,
set by the `setResearch` command); the beeline is a CLIENT layer over it, no
engine research-queue (the user chose the client-side option, not the engine
queue).

## Part A — the graphical tech tree (client/ui/tech-tree.js, NEW)

- **Layout:** columns by ERA (ancient → renaissance → industrial → modern, the
  techs.json era order), techs within a column ordered by `level`. Edges drawn
  from each tech's `prereqs` to it. Pan + zoom (the map-pan idiom already in the
  renderer/client; this is a 2D overlay, canvas or SVG/DOM — pick per what keeps
  it crisp at zoom; DOM nodes + an SVG edge layer is the simplest maintainable
  choice and Roblox-portable in shape).
- **Node states** (from player state, view-fog-honest — only the viewer's own
  techs): `✓ known` (in `player.techs`), `○ available` (all prereqs known —
  researchable NOW), `· locked` (prereqs unmet). The CURRENT `researching` tech
  is highlighted; the beeline GOAL (Part B) and its computed path are highlighted
  distinctly (e.g. a dashed route along the edges).
- **Each node** shows the glyph (Part C) + name; hover/click surfaces the
  blurb (the 68 from tech-blurbs.js) + prereqs + unlocks (reuse catalog-text
  cross-links / the pedia data). This makes the tree the visual twin of the
  pedia's advances category.
- **Interaction:** click an `available` node → `setResearch` (the existing
  command). Click a `locked`/distant node → set it as the beeline GOAL (Part B).
  A visible toggle/entry opens the tree (a 🌳 button near the research readout +
  a key), NOT replacing the current list — it is IN ADDITION (the user's ask).
- **Entry point:** the current "basic list selection" stays; the tree is an
  alternate view of the same choice. Keyboard: ignore INPUT/TEXTAREA targets
  (dialog rule). Opening the tree must not steal the research list.

## Part B — client-side beeline (golden-neutral)

- **Goal state lives CLIENT-side** (session/client state, NOT game state — keeps
  it golden-neutral): `researchGoal` = a tech id (or null). Optionally mirror to
  localStorage so it survives a reload (nice-to-have, per-game key).
- **Set:** clicking a not-yet-researchable tech in the tree (or a "beeline here"
  action) sets `researchGoal` and immediately issues `setResearch` for the NEXT
  step toward it (see below). Clicking an available tech directly = a normal
  single pick AND clears any goal (manual override).
- **Next-step computation (deterministic):** the next tech to research toward
  the goal = the shallowest unresearched tech on a prereq path to the goal whose
  OWN prereqs are all known (i.e. researchable now). Walk the goal's prereq
  closure; pick a researchable-now node on the path (stable tie-break by
  `level` then id). Pure function over techs.json + player.techs.
- **Auto-advance:** on each state update where a tech just completed
  (`session.onChange` — researching cleared + a new id in `player.techs`), if a
  goal is set and not yet reached, issue `setResearch(nextStep)`. When the goal
  tech is researched, clear the goal (+ a turnlog/toast "beeline reached: X").
  If the goal becomes unreachable or the player manually picks elsewhere, clear.
- **Server + hotseat:** the beeline just issues the same `setResearch` commands
  a human would — works identically over the socket and in hotseat (it's the
  viewer's own seat; `ctx.HUMAN` is the current viewpoint — recompute per seat,
  never cache). No engine awareness needed.
- Determinism note: the beeline issues COMMANDS (recorded/replayed like any
  human command); the goal itself is never in game state, so goldens are
  untouched. A recording of a beeline'd game replays hash-exact (the setResearch
  commands are in the log).

## Part C — procedural tech glyphs (client render, house style)

68 custom glyphs is a lot — make it TRACTABLE + consistent with a COMPOSED
recipe (the factions.js / asset-recipes idiom): every glyph = a shared FRAME +
a per-tech central MOTIF.

- **Shared frame:** an era-colored ring/badge (one palette per era — reuse/
  extend the era coloring), so all glyphs read as a family and the era is
  legible at a glance. Zero external assets — procedural canvas (the factions.js
  CanvasTexture pattern) or SVG; deterministic, cached by id.
- **Per-tech motif:** a distinct central symbol drawn from a small vocabulary of
  primitive shapes (the asset-recipes primitive set: disc/bar/triangle/ring/
  polyline…), chosen to evoke the tech from its name/blurb (e.g. alphabet = a
  glyph-letter mark; wheel = a spoked circle; gunpowder = a burst; space-flight
  = a rocket/arc; banking = stacked coins/bar). A `tech-glyphs.js` recipe table
  id → motif recipe, authored like asset-recipes (data, not per-tech code).
- **Authoring the 68 motifs** is the real work. Path: the helper builds the
  glyph SYSTEM (frame + motif renderer + the recipe table scaffold) and drafts
  the OBVIOUS motifs; the genuinely ambiguous ones get flagged for a design
  pass (the ally — who wrote the blurbs — is the natural voice for a motif
  concept per tech, parallel to the blurb workflow; OR the user/ally refines the
  helper's first draft). The tree (A) + beeline (B) ship with NAME LABELS first
  so they don't block on the full glyph set; glyphs layer in as they land.
- **Reuse:** the glyphs also enhance the discovery card (tech-blurbs) and the
  research readout — one glyph system, three surfaces.
- **Roblox:** glyphs are procedural + data-driven → port to Roblox the same way
  the faction emblems + asset-recipes do (docs/13; roblox-helper, later).

## Sequencing (helper)

1. **A + B first** (the functional new-player feature): the graphical tree with
   name-label nodes + the client-side beeline. Highest value, fully golden-
   neutral, engine-independent — buildable NOW. Playwright DOM coverage on the
   A49 lane (open tree, node states, click→research, beeline→auto-advance over a
   couple of turns).
2. **C as a follow art pass:** the glyph system + obvious motifs, then the
   ambiguous-motif design pass. The tree adopts glyphs when ready (name labels
   until then).

## Roblox parity

Browser gets the graphical tree; Roblox gets the **era-grouped list** shape
(docs/13 tier — the cheaper option from the fork, as the Roblox twin) + the same
glyphs. roblox-helper picks this up later; not gated on this spec.

## Scope fence / provenance

- Golden-neutral CLIENT only — no engine, no save format, no ruleset, no Luau.
  The beeline is client-issued `setResearch` commands (the user chose this over
  an engine research-queue, keeping saves/replay/twin untouched).
- A graphical tech tree + beeline are `Civ1-authentic` in spirit (Civ has always
  shown the advances tree) rendered in RetroMultiCiv's `original` house style;
  the glyph system is `original`. No wiki prose (glyphs are shapes; blurbs
  already cleared).
