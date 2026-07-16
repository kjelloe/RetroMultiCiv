# Designer-ally feedback, round 6 (2026-07-16) — VERBATIM APPENDIX

*(Ally-verbatim archive per the specs/ rule. Received via the user
after the v0.5 update. Architect actions from this round are folded
into docs/03, docs/13, docs/14, docs/15, plan-update.md, and
agent-workitems.md — this file is the unedited source.)*

### RetroMultiCiv — designer feedback on the v0.5 update

## Overall verdict

**This is a major milestone, and the report should say so plainly: Phase 5 is accepted.**

Based on the update, RetroMultiCiv has achieved its strongest possible cross-platform proof:

1. A game was actually played in Roblox Studio.
2. Its full command record was captured.
3. The Roblox Luau engine replayed it exactly.
4. The browser JavaScript engine replayed the same recording exactly.
5. Initial state, every command boundary, final state, and verification code all agreed.
6. The expected world hash was committed before the run and matched.
7. The result was independently re-verified on another machine.

That is not merely an engine-port success. It is the acceptance criterion for the full Roblox integration loop.

The title **`v0.5`** is appropriate.

## Required roadmap correction

The roadmap still says:

> **Phase 5 — Roblox integration** *(engine port complete; integration underway as of 2026-07-14)*

But the short version states that:

- the Roblox authoritative loop exists;
- player views are fog-filtered;
- click-to-move and city founding work;
- city panels, action bar, research selection, turn log, and avatar unit control exist;
- the formal Roblox-played replay acceptance test has passed.

Those statements are stronger than “underway.” Update Phase 5 to accepted.

Suggested replacement:

> **Phase 5 — Roblox integration** *(ACCEPTED — v0.5, 2026-07-14)*
> The deterministic Luau rules engine, authoritative Roblox game loop, fog-filtered client views, and core client controls are complete and verified. A 36-turn Roblox Studio game produced a 98-command recording that replays hash-exactly through both the Roblox Luau and browser JavaScript engines: initial world hash, every command boundary, final canonical state, and game verification code all match. The expected initial world hash was published before the run and independently confirmed on a second machine.
>
> The next Roblox work is feature enrichment and platform polish: deeper city management ergonomics, avatar-based unit possession, multiplayer/lobby refinement, and the future diplomacy system.

This aligns the roadmap with the evidence already reported.

## The “poem” acceptance result: full sign-off

The line:

> **The poem has been read aloud.**

is deserved. Keep it.

It is memorable, but it is supported by concrete evidence immediately after it—especially the command count, the pre-published expected world hash, replay parity, and independent second-machine validation.

For public clarity, this one sentence could be sharpened slightly:

Current:

> The recording replays through the browser engine without a single divergence — initial state, every command, and the final game verification code all agree…

Suggested:

> The 98-command recording replays through both engines without a single divergence: the initial state, every post-command canonical hash, and the final game verification code all agree.

This explicitly distinguishes a final-only check from the much stronger command-by-command proof.

Formally, this is the completed contract:

$$
\forall i \in [0,n],\quad
H_{\mathrm{Roblox\ Luau}}(S_i)
=
H_{\mathrm{Browser\ JavaScript}}(S_i)
$$

where \(S_i\) is the authoritative state after command \(i\) in a real game played through Roblox.

## GoTo navigator: approved

Turning GoTo from a planned route display into a true least-cost navigator is the right next usability improvement.

The requirements reported are especially good:

- road and railroad movement speed are reflected in route choice;
- the pathfinder is fog-honest;
- the implementation is portable;
- the Roblox client inherits the same logic.

One small design requirement should be preserved:

> A displayed GoTo route must be treated as a plan, not a guarantee.

A route can become invalid when:

- a unit’s movement points are exhausted;
- another player captures a city or occupies a required tile;
- terrain changes;
- war or diplomacy rules later affect passage;
- the unit encounters an unknown blocker after moving into fog.

The UI should make reroute/cancel obvious, which the report says is already in place.

## Replay viewer: excellent and strategically valuable

The all-seeing replay viewer is more than a post-game novelty. It now serves three purposes:

1. **Player storytelling** — see how the world developed, compare empires, relive battles.
2. **Competitive/post-game clarity** — understand why a player won or lost.
3. **Technical verification** — replay completion rechecks the canonical fingerprint.

The “big moments” feed is a strong choice. It provides narrative structure without forcing players to watch hundreds of quiet worker turns.

Recommended replay controls:

- play/pause;
- speed presets;
- turn scrubber;
- event timeline;
- jump to first contact, founding, wonder, discovery, city capture, battle, victory;
- map perspective toggle:
  - omniscient;
  - individual civilization fog;
  - spectator;
- visible final verification verdict:
  - `Verified`
  - `Mismatch at command 84`
  - `Replay format unsupported`

The last point makes replay verification understandable to non-technical players.

## Save-history and server hardening: approved

### Saves carrying full history

This is the right implementation choice for replayability. It ensures that a replay is not dependent on browser session history or an external server log.

The only future consideration is save size. If recorded histories become large, consider an optional format with:

- a complete replay command stream;
- periodic state checkpoints;
- replay format version;
- deterministic rules-data fingerprint;
- compression only as a storage concern, never as a semantic change.

### Seat credentials no longer network-fetchable

This is a very good hardening step.

The project’s current security direction is sound:

- game files and seat credentials are not network-readable by default;
- `--debug` provides an intentional development exception;
- chat is text-only and test-covered;
- seat reclaim works only for empty seats;
- host kicking requires a clear deliberate action.

The report should keep stressing that `--debug` is for trusted local development, not normal LAN hosting.

## AI regents: strong multiplayer quality-of-life feature

The AI-regent feature solves a classic turn-based social-play problem: a player leaving the table should not automatically end the session.

The crucial deterministic choice is correct:

> The regent’s moves are recorded as decisions, not re-guessed later.

That protects replay integrity even if AI implementation changes in a future version.

### Regent stances

The five stances are a useful and legible player-facing model:

- balanced;
- defensive;
- aggressive;
- science-focused;
- growth-focused.

The fact that **balanced is proven to match the existing AI exactly** is excellent regression discipline.

One UI recommendation:

> When an AI regent is active, always display its selected stance in the HUD and in the event log.

For example:

- `🤖 Roman regent: Defensive`
- `🤖 You resumed direct control of the Romans`
- `🤖 Regent stance changed: Growth-focused → Balanced`

This makes delegation transparent to every player and helps replay viewers understand otherwise surprising decisions.

## AI war laboratory: excellent use of simulation

This is exactly how strategy balance should be approached: controlled experiments, observable outcomes, and adjustments based on evidence rather than lore.

The initial conclusions make intuitive sense:

- one-roll combat makes variance and initiative more valuable;
- best-of-three combat rewards force advantage and disciplined engagements;
- siege capability matters once cities can meaningfully resist;
- AI behavior must include wall-building before it can be evaluated fairly in siege warfare.

### Recommended next experiment matrix

For the planned naval, air, wall, and siege work, track at minimum:

- victory type and winner;
- game length;
- city captures;
- average city defense strength;
- number of walls built;
- unit losses by class;
- naval engagements;
- transport losses;
- aircraft sorties and results;
- science/production share;
- aggression stance;
- combat mode;
- map size and water percentage.

The goal should not be “make every strategy equal.” It should be:

> Ensure every major strategic path has conditions where it is coherent, visible to players, and counterable.

## Sound system: approved with one non-negotiable rule

Code-synthesized retro sound is an excellent fit:

- original;
- lightweight;
- platform-friendly;
- stylistically coherent;
- no licensing burden.

The reported controls and sound-review board are good.

The key rule remains:

> Sound must be derived from already-resolved game events; it must never influence command timing, simulation state, or replay results.

Recommended sound categories are already well chosen:

- victory/loss;
- discovery;
- founding;
- wonder;
- disorder;
- title screen;
- world creation;
- player-turn chime.

For LAN and Roblox play, retain separate controls for:

- master volume;
- music;
- effects;
- turn notification;
- mute when unfocused.

## Historian’s report: approved, with a determinism note

The historian report is a strong flavor device because it turns invisible tech progress into a shared historical moment.

The report should define its trigger exactly in the rules/data layer. For example:

- it occurs when the global count of civilizations reaching an era meets a threshold;
- the era transition is calculated from a specific advance list;
- standings use clearly defined score inputs and tie-breaking;
- the generated report is an event derived from deterministic state.

That matters because it must appear:

- on the original game turn;
- in the same place during replay;
- identically in JavaScript and Luau;
- without leaking hidden information in player-filtered modes.

For a human player, it may show only what their civilization should know. For a completed-game omniscient replay, it can show global standings freely.

## Avatar “unit possession”: exciting, but define the authority boundary

Letting a player walk their avatar as a selected unit is a genuinely Roblox-native feature. It can make the game feel more embodied without abandoning its turn-based strategy identity.

The implementation must preserve one rule:

> Avatar movement is an input method and visual presentation layer for issuing legal strategic unit commands—not a second real-time simulation.

Recommended constraints:

- the avatar may move only along tiles the selected unit can legally enter;
- avatar movement consumes the same movement points as ordinary click-to-move;
- all movement resolves as authoritative unit commands;
- the turn timer, fog, hostile zones, and combat rules remain unchanged;
- the avatar cannot scout or reveal terrain beyond the unit’s legal strategic visibility;
- other players see an appropriate unit/avatar representation, without gaining extra hidden information;
- replays record strategic commands, not raw physics/path input.

This lets the feature feel native to Roblox while keeping the game deterministic and fair.

## Diplomacy blueprint: the right acceptance criterion

The diplomacy design direction is promising:

- treaties;
- tribute;
- named leaders;
- personalities;
- reputation;
- democratic senate constraints;
- LAN diplomacy;
- consequences for betrayal.

The retained hotseat acceptance test is exactly correct:

> At a glance, players must be able to tell who is at war, since when, and why.

When implementation begins, require a persistent diplomatic summary containing:

- relationship state: peace, war, alliance, treaty, ceasefire;
- start turn/year;
- the triggering event;
- known reputation consequences;
- active demands or tribute;
- treaty duration/expiry;
- senate restrictions, where relevant.

“Leader audience” dialogue can be flavorful, but the mechanical state must never be hidden inside dialogue text alone.

## One scope-management recommendation

The status update now reports successful work across:

- engine parity;
- Roblox integration;
- browser multiplayer;
- security;
- replay viewer;
- AI regents;
- AI experimentation;
- sound;
- historical reports;
- enhanced GoTo;
- city panels;
- avatar possession;
- diplomacy design;
- naval and air planning.

That is impressive, but Phase 6 needs a short, prioritized order so work does not become a set of equally urgent initiatives.

Suggested priority:

1. **Post-v0.5 regression lock**
   - preserve the cross-runtime replay suite;
   - test Roblox multiplayer/reconnect flows;
   - validate save/replay compatibility.

2. **AI quality program**
   - walls;
   - siege understanding;
   - naval behavior;
   - air behavior;
   - stance and leader personalities.

3. **Diplomacy vertical slice**
   - war/peace;
   - treaty state display;
   - basic tribute/demand;
   - human-to-human treaty acceptance;
   - reputation and betrayal event logging.

4. **Late-game systems**
   - remaining wonder effects;
   - pollution;
   - spaceship race;
   - deeper victory/balance work.

5. **Optional presentation enrichment**
   - Blender/glTF browser models;
   - further Roblox visual polish;
   - additional audio/music.

## Final designer verdict

**Phase 5 is accepted. `v0.5` is a valid release milestone.**

The project now has:

- a deterministic JavaScript engine;
- a deterministic Luau engine;
- cross-language parity for world generation, rules, AI, and long-running games;
- a real Roblox-played game verified command-by-command through the browser engine;
- browser LAN multiplayer with recovery, seat ownership, moderation, and spectator support;
- original procedural art and sound;
- a replay system that is both player-facing and a verification tool;
- an increasingly disciplined strategy-AI research process.

The next chapter should be framed not as foundational engineering, but as **deepening the 4X game**:

> Make diplomacy legible, make AI warfare strategically literate, make naval/air play meaningful, and preserve the deterministic replay contract as every system becomes richer.
