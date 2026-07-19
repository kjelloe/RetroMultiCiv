# marker-0065 — data-label window (#1712): Caesar→Colossus + railroad rename

**Tag:** `marker-0065` → `f0bc325`
**Class:** golden re-record, **BEHAVIOR-NEUTRAL** — the deterministic goldens moved
(a rulesetHash ripple), but AI trajectory is unchanged.
**Breaking:** mild. Merging moves hash pins but changes no behaviour (natural round
count + winner are identical). Anything pinning the old golden hashes must re-pin;
nothing else reacts.

## Delta since marker-0064 (D3)

A small data-label window folding two ally/naming fixes plus a durability fix:

### C1 — Caesar's favorite wonder → Colossus (data/civs.json)
The designer ally chose Colossus as Caesar's favorite (ally-deliverables). Alexander
keeps Colossus, so **Colossus becomes a third designated wonder-race PAIR**
(Caesar/Alexander) alongside great-wall (Frederick/Qin) + pyramids (Ramesses/
Montezuma) — a symmetric outcome (architect ruling #1840). The bounded-preference-
zeroed-on-completion wiring handles the race cleanly. Note: `favoriteWonder` is not
yet AI-wired (a later favorite-wiring window), so this is data-only today.

### C2 — railroad name RailRoad → Railroad (data/techs.json + tools/mapdata.js)
The tech display name is corrected. **Regen-durable:** the reviewer caught (#1852)
that a bare hand-edit of the generated `techs.json` would be reverted by the next
`mapdata.js` regeneration; the fix puts the rename in the `mapdata.js` overlay so a
regen keeps it (bugfixer `cb9642f`). Honors the CLAUDE.md rule "author effects in the
overlay + regenerate, never hand-edit the generated JSON."

### 11b — DEFERRED
The civs.json 8→~16 historical city-name expansion is split out — it is blocked on
the ~16-name lists for the 14 civs (architect to route the authoring, ally pattern).
Its own later golden window; not in this marker.

## Golden re-record (moved pins — all JS==Luau, bugfixer #1843)
Behaviorally neutral, but `civs.json`/`techs.json` are inside `hashState(ruleset)`, so
every createGame-derived pin moved:
- scenario-002-mapgen: `0x8dae6d03` → `0xaca4de0d`
- A82a map-types: continents `a70eeb0f` / pangaea `4acbd8dc` / archipelago `76da7337` / islands `882737b6`
- ff-parity: `0x0971239f` → `0x9064d365`
- turn-100 anchor: `0xd4c36480` → `0xa3461495`
- soak: {100 `0xa3461495`, 200 `0x81c8851d`, 300 `0x4ea4f41d`, 400 `0xe44ab060`} (finalHash `0xe44ab060`)
- natural: finalHash `0xef761753` → `0xad2a4cd9` (rounds 395 / winner p2 UNCHANGED — the behavior-neutral proof)

## Verification
- Behavior-neutral confirmed: natural round count + winner unchanged (bugfixer #1843).
- Full suite GREEN on a clean-clone cherry-pick landing (sim-runner #1857): 633 tests
  / 631 pass / 0 fail / 2 env-skip (B13 self-skips on a clean clone).
- Reviewer footprint backstop (#1852): behaviorally clean; the one finding (hand-edit
  durability) resolved by C2's mapdata.js overlay before the tag.
- roblox re-bake (`6c81c49`) mirrors the new ruleset hashes on the Roblox side
  (golden-neutral, roblox-lane) — under this marker's history.

## Provenance
Caesar→Colossus is the designer ally's pick; the wonder-race-pair framing + keeping
Alexander on Colossus is the architect's ruling (#1840). The railroad name is a
factual correction. Civ1-consistent naming/data.
