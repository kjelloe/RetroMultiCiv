# RetroMultiCiv

A browser-based strategy game implementing the core mechanics of *Sid Meier's
Civilization* (1991), architected so the simulation engine can later be ported
to Roblox Luau. "Multi" as in multiplayer — and multiple implementations.

![Early-game world under fog of war: settlers on a revealed patch of terrain](docs/screenshot.png)

- Browser client: three.js low-poly renderer (flat tile boxes + raycast picking) behind a renderer interface — three pinned to r162 so WebGL1-only browsers still render
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

## Requirements

- Node.js 20+ (tests and tools; no npm dependencies)
- Any static file server for the client (`python3 -m http.server` shown below)
- A browser with WebGL — WebGL1 suffices (three.js is pinned to r162 for that);
  append `?diag=1` to the game URL for a graphics diagnostics panel

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
against a local wikiteam XML dump of the Civilization Fandom wiki, expected at
`../wikiteam/civ_articles_only/` (sibling of this repo, not committed).
`tools/wiki2data.js` extracts the key Civ 1 pages into `data/wiki-extract/`,
which is **gitignored**: the raw extraction contains CC BY-SA 3.0 prose from
the wiki and stays out of this MIT repo — regenerate it locally when needed.
The committed `data/*.json` rulesets hold game statistics (facts) structured
for this engine. Tests that need the dump or extraction self-skip without them.

## Status

Phase 1 is playable: seeded world generation, fog of war, unit movement,
city founding/growth/production, Civ 1 one-shot combat (stack death, veterans,
zone of control, city capture with plunder), and barbarians — all in the
browser against the real engine. Select a unit, explore, press B to found a
city, 1/2/3 to set production, attack by clicking adjacent enemies, E to end
turns. Research is live (all 68 Civ 1 advances, T to pick), buildings &
wonders too (all 21 of each, working effects, wonder race, C to build), and
now: **AI opponents** that explore, settle, defend, and attack under their own
fog of war; **victory conditions** (conquest or score at 2100 AD, with a
victory/defeat banner); and **save/load** (S/L keys). Start a bigger game with
`?civs=3` (up to 7). **Phase 1 complete: a full, winnable game vs AI.**
70 headless tests including hash-locked JSON scenarios, an AI-determinism
lock, and a real-browser e2e smoke test. Next: phase 2 — hotseat multiplayer.

This game is built AI-assisted (Claude Code) with a human designer and a WebGL
specialist contributing reviews. The full development prompt log is kept
locally and will be published, curated, with the 1.0 release.

## License

[MIT](LICENSE). Vendored [three.js](https://threejs.org) is MIT (see LICENSE
for the notice).

RetroMultiCiv is an unofficial fan project inspired by the 1991 game
*Sid Meier's Civilization*. It is not affiliated with, endorsed by, or
connected to Take-Two Interactive, Firaxis Games, or MicroProse.
"Civilization" is a trademark of Take-Two Interactive Software, Inc.
No original game assets, code, or content are used.
