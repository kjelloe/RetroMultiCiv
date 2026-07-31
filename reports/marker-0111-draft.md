# marker-0111 — W8 econ pair (the last engine window) + the two-surface UI pass

DRAFT — tags on the sim-runner's acceptance-ratio re-run at `aff4366` (the one
gate outstanding; the `[RATIO]` slot below fills from it).

Delta since marker-0110 (@dac46ec): the final engine window of the v1 programme
landed, was measured, was found half-inert in play, and was repaired — twice.
Plus the ruled title on every surface, a mobile UI playthrough that found a real
defect, a Roblox playthrough checklist, and the metrics design.

## The engine work — W8, in three landings

**W8 @c074384 — the econ pair.** Offensive diplomat doctrine (steal when behind
in tech, preferring a rival whose reputation toward us is already worst; sabotage
an assault target before the ground attack lands; incite only when the treasury
can pay) and caravan doctrine (the classic chain feeding a wonder under
construction; a peace economy opening trade routes). **AI brain only** — every
mechanic already shipped in D6, `cities.helpWonder` and
`trade.establishTradeRoute`, so this window taught `ai.js` to build the units and
issue the commands. Fixture-first, 11 contracts, twinned in one window.

**W8c — what the coverage run caught.** The goldens moved, the fixtures were
green, the twin was faithful — and half the doctrine was inert in play:

| surface | commands issued | acceptance events | verdict |
|---|---|---|---|
| `helpWonder` | 27 / 2 / 8 / 37 | `wonderHelped` 27 / 2 / 8 / 37 | 1:1 — works |
| `diplomatMission` | ~94 total | `TECH_STOLEN` 2 | **2 accepted** |
| `establishTradeRoute` | 624 total | `tradeRouteEstablished` **0** | **none accepted** |

Causes: the steal intent ignored Civ 1's once-per-city immunity and kept
re-picking the same immune city; and the caravan brain picked the NEAREST own
city as a trade partner, which in a dense empire is always inside the 10-tile
`minDomesticDistance` and always refused. Both fixed, with the legality rules now
encoded in fixtures — including a corrected W8b-10, which had been asserting a
BUILD for a route the engine would reject.

**W8d — the gate sweep's find.** The sim-runner's 25-seed sweep passed every
floor and still surfaced a **duplicate tech** on seeds 13 and 18: `stealTech`
pushed the stolen tech without clearing the thief's research, so the turn wrap
completed it again and pushed a second copy. Latent since D6; W8 drives enough
steals to surface it. `grantTech` and `diploGrantTech` both already carried the
guard — this was the last path without it. Not cosmetic: the tech count feeds
W8's own tech-lag read plus score and era rank.

## Re-record

BEHAVIORAL, no stamp for W8c/W8d (`002` / maptype / ff-parity / age-snapshot all
HOLD, 002 re-verified independently). Two signatures make it honest:
- **t100 and t200 byte-identical** to the W8 record — the immunity skip cannot
  bite before a theft creates immunity, and the route rule cannot bite before
  empires are dense. A paste-back would have moved them.
- The duplicate-tech fix is **golden-neutral at the pinned seeds** — two
  discriminator runs, before and after, produced identical numbers — while
  correcting sweep seeds 13/18.

Pins: `GOLDEN_SOAK` 0x1392d799 / 0x096df72c / 0x5d92e626 / 0x55dff9e5;
`GOLDEN_NATURAL` 545 p2 0x7550defb — the **seventh** consecutive natural hold;
`BEHAVIOR` 0x184dd153 / 0x24ad814c / 0x104a0912 / 0x3d8e2731 + 0xa7463164.

## The two-surface UI pass (user request)

**Mobile.** `test-ui/mobile-playthrough.spec.js` walks a whole session at
390×844 and 360×640 — setup, first turn, founding, city view, panel stack, three
end-turns, save/load by TAP only — with no-horizontal-overflow as the
load-bearing assertion and 10 screenshots for human review. **It found a real
defect on its first run:** the touch d-pad covered the CENTRE of the city-name
dialog's confirm button (`elementFromPoint` returned `#dpad`), so tapping the
obvious spot panned the map instead of founding your first city. Fixed by
raising the modal above the touch overlay and suppressing the pad under
`body.modal-open`; guarded by an `elementFromPoint` assertion, since "visible"
never catches an overlay.

**Roblox.** `roblox/PLAYTHROUGH-UI.md` — 18 tap-by-tap steps in three groups,
each with Tap / Expect / Likely-wrong and a docs/13 tier tag, plus a 12-artifact
screenshot plan; the headless clears (31 gates / 103 assertions) were run FIRST
so the Studio sitting spends time only on presentation and wiring. It also found
**F1**: the Roblox client has no city-name dialog at all (`doFound()` auto-names)
— recorded in docs/13 as a ruled v1.0 divergence, parity deferred to v1.x.

## Naming

The browser and mobile start screen now reads **A World Begun** with **Project
RetroMultiCiv** linking to the repo, matching the Roblox client. One swap point
(`client/ui/game-name.js`) drives the setup header, document title, og:title,
meta description and HUD title. Player-facing server surfaces followed (host
guide, maintenance page, the default public server name in the list); technical
identity did not (systemd unit, CLI usage, boot logs, save-format check).

## W7 naval acceptance — RULED

Measured: the AI treats ring / inland-sea / oval as land maps — 0 overseas
cities at 200t and at 400t with ring **saturated** (~117 cities against ~112 of
capacity) — while the **archipelago control reports 5 on the same probe**, which
is what rules out an instrument artefact. **User ruling 2026-07-31: SHIP** the
shapes as the labelled opt-in group; the gap is opponent strength on three
non-default maps, not correctness. Filed as `specs/unit-doctrine-v1x.md` §8 with
its acceptance pinned to the probe's overseas count, not to a moved hash.

## Also in this span

- **Usage metrics designed and handed to hardening** (`specs/metrics-v1.md`),
  user-ruled v1.0 scope and localhost-private: six questions the counters must
  answer, a binding privacy contract (counts only, no IPs/agents/tokens/names, no
  per-request log), 404-not-403 for remote requests, and persistence that never
  sits in a request path.
- `reports/v1-rc.md` — the RC evidence digest, axis by axis, each claim naming
  its gate.
- Roblox data re-bake for the econ knobs (`rules 0xe8c9e1cd`), committed by the
  sim-runner under the standing grant.
- Process lessons banked: read the concept histogram as a RATIO (commands vs
  acceptance events); a command-level fixture proves the AI *chose*, never that
  the engine will *take*; backticks in a double-quoted `git commit -m` are
  command substitution.

## Gates

- **Reviewer @aff4366 — CODE GREEN** (#2880): pristine clean-clone
  1026/1021/2-fail with both failures proven flakes (the recurring density
  false-red, isolated 52/52 for a fourth window; a browser CDP flake whose
  failing subtest wanders across six runs with no client-code touch). All
  goldens reproduce JS==Luau including the seventh natural hold; #28 honest;
  the duplicate-tech guard confirmed as closing a real latent bug; the coverage
  pickers deterministic. They also endorsed the priority call — doctrines above
  the army treadmill, below the settler loop.
- **[RATIO]** sim-runner acceptance re-run at aff4366: `diplomatMission` vs
  `TECH_STOLEN`, `establishTradeRoute` vs `tradeRouteEstablished`, floors, and
  no duplicate tech on seeds 13/18: ___
- Local: simulation 7/7, luau-twins 11/11, econ-doctrine 13/13,
  diplomat-missions 18/18, mobile specs 7 passed.

## Breaking / compatibility

No protocol or save-format change. `data/rules.json` gained
`diplomatDoctrine` / `caravanDoctrine` in W8 (the stamp moved there and has
since held). Client changes are presentation only. The Roblox generated data was
re-baked for the new knobs.

## Consistency

[filled at tag time]
