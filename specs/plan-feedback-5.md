# Designer ally — feedback round 5 (verbatim, 2026-07-14)

> Preserved verbatim per the specs/ convention; architect triage notes
> are in the labeled appendix at the bottom, never inline.

### RetroMultiCiv — designer feedback on the latest update

## Overall verdict

This is an outstanding update. The project has now cleared the most technically difficult claim it could make:

> The full deterministic rules engine—including world generation, AI, chaotic replay commands, and natural game completion—now produces identical canonical outcomes in JavaScript and Luau.

If the ten replay fixtures, full 400-turn AI games, real playtest recordings, data checks, and divergence tooling are all green as reported, then the **engine-port portion of Phase 5 is complete**.

That is a far more meaningful milestone than merely "the Roblox world renders." You now have evidence that the Roblox implementation is governed by the same rules, consumes randomness in the same order, and reaches the same outcomes under the same command stream.

The remaining Phase 5 work is no longer game-rules porting. It is **Roblox integration**:

- authoritative Roblox session/server ownership;
- Roblox client command UI and state projection;
- player-seat identity and reconnection behavior;
- saving/resuming as appropriate for the Roblox environment;
- a Studio or live-server acceptance game whose move log replays identically through the browser engine.

That is a clean, credible transition.

## Required roadmap correction

The current Phase 5 wording is now behind the actual status. It says:

> Port the deterministic engine module-by-module to Luau … then replay recorded browser games through the Luau engine…

But the status report says that work is already complete.

Replace the Phase 5 section with something like:

> **Phase 5 — Roblox integration** *(engine port complete; integration underway as of 2026-07-14)*
> The deterministic Luau rules engine is complete and verified: all replay fixtures, seeded world generation, AI simulations, chaos scenarios, and recorded browser games reproduce the same canonical outcomes in both runtimes. The remaining work is Roblox integration: authoritative session/server flow, client command UI and filtered views, seat identity/reconnect behavior, and an acceptance game played in Roblox whose recorded move log replays hash-exact through the browser engine.

This makes the roadmap honest, easy to understand, and proportionate to what has been achieved.

## Strongest new technical achievements

### 1. Cross-language AI agreement

This is the headline achievement:

> Entire 400-turn games … now play out move-for-move the same in both engines, matching all pinned milestone fingerprints, including the natural game end.

It demonstrates that the port is not only correct for isolated rules. It validates:

- AI decision ordering;
- map scanning/order traversal;
- unit and city iteration order;
- random-number draw order;
- strategic state evaluation;
- end-of-turn processing;
- victory resolution;
- long-horizon state stability.

This is exactly the kind of evidence that turns "mechanical translation" from an aspiration into an engineering result.

### 2. World generation hashes before turn one

The explicit claim that the engines reach identical world hashes **before a turn is played** is excellent. It narrows any future issue immediately:

- If initial hashes differ, the problem is in data loading, seed handling, generation, or serialization.
- If initial hashes match but later hashes diverge, the problem is in command processing or turn resolution.

That separation will save enormous debugging time.

### 3. Divergence reporter proved itself

The divergence tool catching a genuine cross-language bug shortly after being introduced is an especially good sign.

The phrase:

> zero archaeology

is deserved. Preserve that tooling. It should be treated as a first-class project feature, not merely a temporary porting script.

A cross-runtime mismatch report should remain part of CI and retain:

- replay/fixture name;
- command index;
- turn and acting player;
- command payload;
- JavaScript and Luau state hashes;
- RNG state before/after;
- first canonical path/value mismatch;
- rules-data version;
- replay-format version.

### 4. Missing-pinned-fingerprint safeguard

The admission that missing pins previously passed silently is exactly the sort of issue worth documenting—and the fix is correct.

The current behavior should be considered mandatory:

> A replay test with no expected fingerprint must fail, not pass.

That prevents accidental regression-suite weakening when fixtures are added or reorganized.

## Multiplayer and lobby feedback

### Host moderation: approved, with the right safeguards

Reintroducing kick functionality is reasonable now that it is:

- a deliberate host decision;
- confirmation-gated;
- paired with a clear notice;
- optionally paired with a room-specific block;
- not triggered accidentally.

This is more practical than a blanket "never kick" rule for real LAN/social play.

One small wording improvement for the public update:

> …the host got explicit moderation controls: a confirmed kick, with an optional room-specific block that prevents the same guest from immediately rejoining.

"Room-specific" makes it clearer that this is not a broad/global identity-ban system.

### Seat codes: high-value feature

Private seat codes are a very good addition. They solve the realistic problem of:

- browser storage being cleared;
- changing machines;
- temporary network disruption;
- reconnecting during an active game.

The important behavior is already correctly stated:

> reclaiming a seat only works while it stands empty, so nobody can be displaced mid-play.

That is the correct anti-takeover rule.

Recommended additional acceptance cases:

- A player with a valid seat code cannot reclaim an occupied seat.
- A player who reconnects receives the correct fog-filtered projection immediately.
- A spectator cannot use a player seat code to receive hidden player information unless they genuinely reclaim that now-empty player seat.
- Reconnection does not accidentally duplicate a player identity or create two simultaneously active control paths.
- Server restart preserves only the appropriate seat-code metadata needed for legitimate recovery.

### Lobby chat: good implementation direction

The report's statement that chat is treated as text and a malicious-message test proves harmless rendering is exactly the right baseline.

For game UX, I recommend two modest next-level choices:

- Make lobby chat clearly separate from the turn/event log.
- Show sender names and timestamps, but avoid allowing chat volume to push important game status off-screen.

The status line—who the game is waiting for—must remain more prominent than social chatter during active turns.

## Map overlays: approved

The new overlay registry is a strong scalable design.

The initial layers are well chosen:

- **Territory:** communicates city reach and broad empire shape.
- **Forces:** provides a tactical overview without requiring every unit to be selected.

The key rule is also the right one:

> An unexplored tile never tints.

That rule must be retained for every future overlay type, including:

- resources;
- yields;
- movement range;
- threat;
- corruption;
- pollution;
- trade routes;
- diplomatic influence.

### One visual caution: territory versus ownership

Because the territory overlay is derived from city working areas, it should not visually imply a legal border/ownership model that the game does not yet implement.

Suggested player-facing label:

- **City influence**
- **Worked-land reach**
- **Settlement reach**

Avoid simply calling it "Borders" unless the simulation later adds formal territorial ownership and its associated rules.

This matters especially once diplomacy, war, trespassing, and treaties exist.

## Diorama title screen: approved

The first-visit harbor diorama is exactly the correct kind of polish:

- it makes the game feel alive immediately;
- it uses existing game assets rather than producing a separate art pipeline;
- it reinforces the visual language of cities, ships, walls, and flags;
- it respects return visitors and reduced-animation preferences.

The only UX requirement is that it must never delay access to "New Game," "Load," "Hotseat," or "LAN." From the description, it sounds like it is already functioning as a backdrop rather than an obstacle.

## Visual-system follow-ups: closed appropriately

The update reports that all prior visual concerns are now addressed:

- dedicated tank and submarine silhouettes;
- automated mapping coverage for all unit types;
- documented and verified shared-vertex terrain generation;
- explicit faction color-field semantics;
- gallery labels no longer clipped.

That closes the A1.7 follow-up list well.

The renderer's valuable ongoing invariants should be retained:

1. Every game unit type must resolve to a declared visual mapping.
2. Shared terrain vertices must be deterministic and seam-free.
3. Visual randomness must never touch game RNG or authoritative state.
4. Reduced-motion mode must preserve all information and input timing.
5. Unexplored tiles must never reveal information through overlays, props, or visual effects.

## One terminology refinement: "byte-equivalent" data files

The phrase:

> All eight rule-data files check out byte-equivalent on both sides

is impressive, but it can be slightly risky if "equivalent" means semantic data equality rather than literal source-file bytes—especially since JSON/JavaScript and Luau table formats may differ.

If it truly means raw file bytes after a defined normalization process, state that. Otherwise, prefer:

> All eight shared rule-data sets match exactly under the project's canonical data representation.

Or:

> All eight shared rule-data files produce identical canonical data fingerprints in both runtimes.

That wording is aligned with the rest of the deterministic contract.

## Suggested revised Phase 5 acceptance criterion

The report already contains the ideal idea. I would formalize it:

> **Phase 5 acceptance test:** Play a complete game in Roblox Studio or a Roblox test server. Export its recorded command log. Replay that log through the browser JavaScript engine and the Roblox Luau engine. Both must reproduce the same canonical state hash after every command and the same final game verification code.

Formally:

$$
\forall i \in [0,n],\quad
H_{\text{browser}}(S_i)
=
H_{\text{Luau}}(S_i)
$$

where \(S_i\) is the state after replaying the first \(i\) commands from one Roblox-played game.

That is an elegant, unambiguous, player-visible, and technically rigorous acceptance test.

## Recommended immediate priorities

1. **Update the public roadmap**
   Phase 5 should now be "Roblox integration," not "engine port."

2. **Build the Roblox command/client loop**
   Start with a narrow vertical slice:
   - create/join a game;
   - receive player-filtered state;
   - select unit;
   - issue move;
   - end turn;
   - record/replay the game.

3. **Run the Roblox-originated replay acceptance game**
   Make the first Studio playtest produce a replay that passes in both engines.

4. **Keep browser and Roblox UI work decoupled from rules work**
   The engine is now a verified core. Avoid changing its semantics while building presentation and networking integration unless a replay fixture is added first.

5. **Continue multiplayer UX playtests**
   The most useful human feedback now concerns:
   - whether waiting/turn ownership is obvious;
   - whether chat distracts from game-critical status;
   - whether seat-code recovery feels trustworthy;
   - whether city influence and forces overlays clarify rather than clutter;
   - whether spectators understand their permissions and visibility.

## Final designer verdict

**Approved.**

The engine port may now be described as complete **provided that "complete" is scoped to the deterministic Luau game-rules engine and its replay verification contract**. The project has entered its final Roblox integration phase with unusually strong foundations:

- deterministic cross-runtime engine;
- real multiplayer recovery proof;
- authoritative browser-server architecture;
- a disciplined replay/hash test framework;
- a render system that stays non-authoritative;
- readable original low-poly strategy art;
- growing social/multiplayer usability.

The next milestone is beautifully clear:

> A game played in Roblox produces a command recording that the browser engine can replay without a single canonical-hash divergence.

---

## APPENDIX — architect triage (not the ally's text, 2026-07-14)

- Roadmap correction: APPLIED to docs/03 (his wording adapted) and
  plan-update's phase-5 section.
- Divergence reporter first-class + field list: already CI-resident
  (luau-twins in suite + nightly); permanence note added to docs/09.
- Missing-pin-must-fail: already mandatory (B10 guard test).
- Kick "room-specific" wording: APPLIED to plan-update.
- Seat-code acceptance cases (5): queued as A52 with the overlay
  rename; case analysis inline in the item (two already covered,
  three new, one exposing a real two-path resume nuance).
- Chat/turn-log separation: already structurally separate (chat is
  lobby-only today); his prominence rule recorded for the future
  in-game-chat design.
- Overlay label: "Territory" → "City influence" queued (A52);
  never-tint rule recorded as a standing overlay invariant.
- "byte-equivalent" wording: APPLIED (canonical data fingerprints).
- Formal acceptance criterion: APPLIED to the R4 item (hash after
  EVERY command + the final game verification code).
- Priority 4 (fixture-first engine changes): codified in CLAUDE.md.
