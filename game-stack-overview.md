# The RetroMultiCiv game stack — a reusable overview

A write-up of the architecture proven in this repo, for starting new
projects with the same reach: **one game that runs in the browser
(desktop + mobile), on a self-hostable authoritative server, and as a
Roblox port** — with every variant provably running the same rules.
File paths below refer to this repo as the worked example.

## 1. The shape in one paragraph

One **pure, deterministic simulation core** ("the engine") written in
a restricted, Lua-portable subset of JavaScript, wrapped by thin
adapters: a no-build browser client, a Node WebSocket server, and a
Roblox/Luau twin of the engine. Everything above the engine is
replaceable; nothing above the engine is trusted. The engine is a
*reducer*: `apply(state, command) → state`, no I/O, no clocks, no
hidden state. That single decision is what makes every other part of
the stack — multiplayer, replays, saves, cheat-proofing, the Roblox
port, headless testing, AI soaks — cheap instead of heroic.

```
            data/*.json  (rulesets — numbers live here, never in code)
                 │
   ┌─────────────┴─────────────┐
   │   engine/  (JS reducer)   │←──— byte-shaped twin ──→  luau/ (Roblox)
   └─────────────┬─────────────┘
        shared/  (pure helpers usable by any adapter)
                 │
  ┌──────────┬───┴──────┬──────────────┐
  browser    Node ws     headless      Roblox client
  client     server      test/sim      (Rojo project)
  (client/)  (server/)   drivers       (roblox/)
```

## 2. The engine rules (the part worth copying verbatim)

The engine is written in the **intersection of JavaScript and Lua**,
so the port is mechanical transliteration, not reimplementation:

- No `class`/`this`, no `Map`/`Set`, no exceptions, no async. Plain
  functions over plain objects and arrays.
- Integer math through an `idiv()` helper; **no floats anywhere in
  state** (floats drift across languages), **no null** (JSON null
  becomes `nil` in Lua and *vanishes from tables* — the single
  nastiest cross-language trap).
- All randomness through one seeded PRNG (xorshift32) whose **state
  lives inside the game state**. Never `Math.random()`; the Luau twin
  reimplements the same algorithm, never `Random.new`.
- Index/coordinate math only through named helpers (`tileAt`,
  `neighbors`) — 0-vs-1-indexing is the other classic port killer.
- Module size soft-capped (~300 lines), one subsystem per module,
  acyclic imports: each JS module becomes one Luau ModuleScript 1:1.
- Ruleset **numbers live in JSON data files**, never in engine code.
  Generated from a source-of-truth pipeline (here: a wiki dump →
  extraction tool → committed JSON), with license-clean structured
  fields — facts are copyable, prose is not.

**State hygiene is enforced, not hoped for**: a canonical state-hash
function (`shared/statehash.js`) walks the state and rejects illegal
types. The same function exists in both languages with a pinned
cross-language test vector — it is simultaneously the save checksum,
the desync detector, the replay verifier, and the port's acceptance
gate.

## 3. Determinism pays for everything

Because `state + command log → identical state` on every platform:

- **Saves** are trivial (state is JSON) and **tamper-evident** (hash +
  a derived game code; a debug-mode use permanently taints the hash).
- **Replays** are the whole debugging story: the client can dump
  `initial state + every command + per-round hashes` with one
  keypress; a replayer re-runs it and pinpoints the first divergent
  hash. "Something looked wrong" becomes a bisectable artifact.
- **Multiplayer** is command relay: the server applies commands and
  broadcasts; clients can't cheat because the server owns the state
  and answers each seat with a **fog-filtered view** (never the full
  state — see §6).
- **AI soak testing**: headless all-AI games at scale with invariant
  checks every turn and pinned "golden" hashes at checkpoint turns.
  Those goldens double as the **cross-language anchors** the Roblox
  port must reproduce exactly.

## 4. The browser client

- **No build step.** Plain ES modules, an import map for the one
  vendored 3D library (three.js, pinned to the last WebGL1-fallback
  release because real users have old GPUs — verify renderer changes
  headlessly with SwiftShader, including a forced-WebGL1 pass).
- **The session seam**: the client has one `session` object owning
  state + apply/endTurn + an onChange event. Local single-player and
  server play are two implementations of that seam (`session.js` vs
  `session-remote.js`); every UI module reads `session.state` and
  calls `session.apply()` — none of them know or care whether a
  socket is involved. This seam is the cheapest multiplayer
  investment in the whole stack; build it on day one.
- **Mobile is the same client**, not a fork: touch affordances are
  gated on `(pointer: coarse)`, an on-screen log overlay substitutes
  for a console on phones, and save/load get always-visible buttons.
  A dedicated touch-first UI can come later; gating keeps one
  codebase honest until then.
- URL params are the config surface (`?seed`, `?civs`, `?server=1`,
  `?debug=1`, …); the boot canonicalizes the URL afterward. Trap: a
  module reading its own param must capture `location.search` at
  module eval, before canonicalization strips it.

## 5. The Node server

- One process hosts the static client AND N games over `/ws`. Seats
  are tokens; join codes are human-typeable; spectators are a
  host-controlled tokenless view; reconnection is part of the
  protocol from the start (grace windows, AI-regency for absent
  seats, an explicit three-way join answer:
  ended / reload-from-save / never-existed).
- **Views, not state, cross the wire.** Each seat receives its
  fog-filtered view. Client code that works locally can crash against
  a filtered view (absent fields) — test against the server view, not
  just local play.
- Discovery is the old QuakeWorld pattern: self-hosted servers POST a
  heartbeat (name, address, ruleset hashes, open-game count) to a
  tiny master index; the client's Find-game browses it. No accounts,
  no lock-in, LAN-first.
- Robustness is a own concern: connection/game/save caps, per-IP
  limits, allowlist-validated inbound frames, and save rotation. If
  an agent team builds this, make it a separate lane with exclusive
  file ownership (docs/17 here).
- **Python variant note**: this stack shares `engine/` + `shared/`
  between client and server *because both are JS*. A Python server
  would need a third engine twin — the twin discipline (§7) makes
  that tractable but not free. Unless Python is a hard requirement,
  keep the game server in Node and put Python in peripheral services
  (analytics, ops, tooling), where this repo already uses it.

## 6. Testing layers (each catches what the layer below can't)

1. **Unit tests** per engine subsystem (plain `node --test`, no deps).
2. **JSON scenario files** — crafted states + command scripts with a
   pinned final hash. Code-free, so BOTH engines run the same files:
   every scenario is automatically a cross-language contract.
3. **Headless simulation** — full all-AI games on fixed seeds, with
   per-turn invariants, chaos-command injection (random legal+illegal
   commands must never corrupt state), and golden checkpoint hashes.
   Failure artifacts are drag-droppable saves + replayable diagnostics.
4. **Soak** — the same driver across many seeds, parallel, with
   telemetry rows for AI-quality metrics and ratcheted floors.
5. **Server tests** — real ws clients driving join/play/reconnect/
   tamper-reject against a real server instance.
6. **Browser e2e** — the real client in headless Chromium
   (SwiftShader flags), asserting the HUD reaches turn 1 with real
   content; multi-client flows via Playwright on a nightly lane.
7. **The twins gate** (§7) — everything above, cross-checked against
   the Luau engine.

Supporting tooling that proved load-bearing: a one-call
serve+screenshot script, a gallery page rendering every asset through
the real renderer (screenshot-diffable at rest pose), a save/recording
inspector, and a replay-triage script that verdicts a folder of bug
recordings in one run.

## 7. The Roblox port — twins, not rewrites

- **Byte-shaped twins**: each engine module is transliterated to a
  Luau ModuleScript that mirrors the JS line-for-line. If a refactor
  would help the port, refactor the JS *first*, then re-twin. Twin
  fidelity is a review property — a diff-shaped port is reviewable;
  a creative one is not.
- **Port order with gates**: rng → statehash → data loading → then
  subsystems, each gated on (a) anchor tests (pinned cross-language
  vectors), (b) the shared scenario files, (c) the golden sim
  checkpoints, (d) replay-verdict equality (both replayers agree on
  every recording). `lune` runs the Luau side in CI on the dev
  machine — no Studio needed for the engine half.
- **Data crosses by codegen**: a build script converts the committed
  JSON rulesets into generated Luau long-strings with checksums
  count-checked cross-language. Same pattern for any baked artifact.
- **Trap list** (start yours early, it grows): JSON null vs nil,
  0/1-indexing, integer division, float creep, table iteration order,
  string sorting, `%` sign semantics. Every one of these bit us; the
  restricted JS subset (§2) exists to shrink this list.
- The Roblox *client* is a separate build (Parts-based rendering,
  RemoteEvents → the same engine commands) with its own UI-parity
  roadmap; keep it in its own directory owned by its own workstream,
  consuming the engine twin read-only.
- **Perf**: Luau budgets are tighter. Pre-bake expensive derived
  states (here: starting-age fast-forward snapshots) as build-step
  artifacts — never committed, never computed on the host at runtime,
  guarded by a statehash pin so a stale bake falls back to live
  computation instead of corrupting anything.

## 8. Ops (single-VM self-hosting)

One small VM, one Node process under systemd, caddy/nginx for TLS,
rsync **allowlist** deploys (runtime files only — never the repo, and
generated build-step artifacts are baked on the dev machine right
before the rsync). Config with secrets (deploy keys, filled-in
cloud-init) stays gitignored with sanitized templates committed.
Measured here: ~1MB heap per running game — caps and CPU are the real
ceiling, not memory. The master index runs the same way.

## 9. Lessons that transfer (the short list)

1. **Purity of the core is the whole ballgame.** Every platform,
   feature, and test in this stack leans on `apply(state, command)`
   with deterministic RNG in-state. Compromise that and everything
   downstream gets expensive.
2. **Pin golden hashes early and treat them as contracts.** Behavioral
   changes re-record goldens in an explicit ritual; "the hash moved
   unexpectedly" is the highest-value alarm the project has.
3. **The session seam** (UI ↔ state-owner) bought multiplayer,
   hotseat, spectators, and replays with one abstraction.
4. **Views cross the wire, state does not** — decided once, it makes
   cheating structural nonsense instead of a validation chore.
5. **Code-free test fixtures** (JSON scenarios) become cross-language
   contracts for free. Test code has to be ported; test *data* doesn't.
6. **Vendor and pin the few dependencies**; every one is a decision.
   This project ships with: one 3D lib (vendored), `ws`, and two dev
   tools (`lune`, Playwright). That's the whole tree.
7. **Screenshot verification without a GPU** (SwiftShader + a gallery
   page at rest pose) makes visual work reviewable in CI and by
   agents, not just by eyeballs.
8. **Build-step bakes, not committed artifacts, not host runtime
   work** — with a hash pin so staleness degrades gracefully.
9. Replays-as-bug-reports change the support story: a player keypress
   produces a file that mechanically reproduces their game.
