# MultiCiv

A browser-based strategy game implementing the core mechanics of *Sid Meier's
Civilization* (1991), architected so the simulation engine can later be ported
to Roblox Luau.

- Browser client: 2D canvas tile renderer first, three.js-ready via a renderer interface
- Backend: Node.js (minimal deps: `ws` only), authoritative from phase 3
- One pure, deterministic game engine shared by every phase

## Documentation

| Doc | Contents |
|---|---|
| [docs/01-game-spec.md](docs/01-game-spec.md) | Game rules: map, cities, units, combat, full Civ 1 tech tree, wonders, governments, AI, victory |
| [docs/02-architecture.md](docs/02-architecture.md) | Engine-as-reducer design, repo layout, tech stack, Lua-portability rules, network protocol, Roblox port shape |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Five development phases: single-player → hotseat → authoritative backend → LAN multiplayer → Roblox port |

## Status

Specification phase. No code yet.
