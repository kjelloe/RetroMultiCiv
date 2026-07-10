# RetroMultiCiv

A browser-based strategy game implementing the core mechanics of *Sid Meier's
Civilization* (1991), architected so the simulation engine can later be ported
to Roblox Luau. "Multi" as in multiplayer — and multiple implementations.

- Browser client: three.js low-poly renderer (flat tile boxes + raycast picking) behind a renderer interface
- Backend: Node.js (minimal deps), authoritative from phase 3
- One pure, deterministic game engine shared by every phase
- Default world: 80×50, east–west wrapping (Civ 1 size)

## Documentation

| Doc | Contents |
|---|---|
| [docs/01-game-spec.md](docs/01-game-spec.md) | Game rules: map, cities, units, combat, full Civ 1 tech tree, wonders, governments, AI, victory |
| [docs/02-architecture.md](docs/02-architecture.md) | Engine-as-reducer design, repo layout, tech stack, Lua-portability rules, network protocol, Roblox port shape |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Five development phases: single-player → hotseat → authoritative backend → LAN multiplayer → Roblox port |
| [reference-design.md](reference-design.md) | The designer ally's original "Project Founders" spec — kept for reference; its adopted ideas are merged into the docs above |

## Running

```bash
# play: serve the repo root (client imports engine/ and data/ as siblings)
python3 -m http.server 8123
# then open http://localhost:8123/client/  (?seed=12345 for a fixed world)

# run the test suite (headless, no deps)
node --test test/

# regenerate ruleset data from the wiki extraction
node tools/mapdata.js
# re-extract wiki stat tables (needs the dump, see below)
node tools/wiki2data.js ../wikiteam/civ_articles_only/*-current.xml data/wiki-extract
```

## Data source

Ruleset numbers (unit stats, tech tree, wonders, terrain yields) are verified
against a local wikiteam XML dump of the Civilization Fandom wiki at
`../wikiteam/civ_articles_only/` (sibling of this repo, not committed here;
complete, 39,667 pages). `tools/wiki2data.js` has extracted the 7 key Civ 1
pages into `data/wiki-extract/` — raw tables with yields as countable
`[food]/[shield]/[trade]` tokens. Extraction confirmed the spec's terrain and
unit numbers. Next: map these to the final `data/*.json` rulesets (hand-reviewed).

## Status

Steps 0–1 largely complete: the client renders a mock world (three.js flat
boxes, raycast picking, pan/zoom, HUD); `data/terrain.json` + `data/units.json`
are generated from the wiki dump; the engine skeleton (movement, end-turn,
seeded RNG) passes its first JSON scenario with a locked state hash.
Next: map generation (`createGame`), then wiring the client to the engine.

The development prompts behind this project are logged verbatim in
[dev-prompts.md](dev-prompts.md) for anyone curious about the process.
