# marker-0111 — W8 econ pair (the last engine window) + the two-surface UI pass

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
- **Sim-runner acceptance re-run at aff4366 — GREEN** (#2884), and this is the
  proof W8c existed for: `diplomatMission` **34 → TECH_STOLEN 8 + SABOTAGE 26 =
  34, i.e. ZERO wasted missions** (the ~94-missions-for-2-steals waste is gone);
  `establishTradeRoute` **3/3 established**, combined 4/4 across both jobs (the
  sim-runner explicitly corrected its own earlier "routes look dormant" reading —
  they are seed-rare, not inert); **DUP_TECH PASS on all seeds** including the
  load-bearing 13 and 18; floors held (M2-cities 18, M3-pop 66, M4 93%,
  M10-buys 14, resource coverage 85.5%).
- Local: **full suite 1027/1027, zero failures** — the first clean board of the
  arc, reached by fixing three standing reds rather than labelling them (below).
  Also simulation 7/7, luau-twins 11/11, econ-doctrine 13/13,
  diplomat-missions 18/18, naval-probe 8/8, browser 19/19, mobile specs 7 passed.

## The three "known flakes" were mostly not flakes

A user instruction — "no flaky tests indeed" — turned into the most valuable
audit of the arc. Of three standing suite reds, only ONE was environmental:

1. **N3 "a coastal naval civ builds a ship" — a REAL regression, live since W6
   slice-3 and dismissed for four windows.** It fails in ISOLATION, which no
   amount of parallel-load contention can explain. The mis-diagnosis was an
   attribution error: N3 lives in `test/naval-probe.test.js` (7 tests) while the
   isolation runs quoted as clearing it ("52/52") were of `test/ai.test.js` (52
   tests). Bisected with clean worktrees — passes at marker-0108, fails from
   slice-3 — and the mechanism confirmed by toggling one knob: with
   `rules.cityRoles` the coastal city takes the SPAWNER role, whose +1 settler
   headroom outranks the naval slot. Assessed as RULED behaviour (expansion
   outranks doctrine; ships still get built and used in play — 35-38 hulls and 5
   overseas cities on the archipelago probe), so the fix was to stop one fixture
   silently covering two contracts: the omit-safe legacy path (no `cityRoles` ⇒
   naval priority) and the real sequence (a spawner expands first, then reaches
   its hull) are now pinned separately.
2. **B13 witness — a STALE ARTIFACT, not a flake.** The W6-W8 behavioural windows
   invalidated a recording that must replay exactly. Regenerated.
3. **Browser smoke — the one real environmental case**, fixed at source rather
   than tolerated: `debugging/t.sh` caps runner concurrency for full-suite runs,
   `dumpDom` retries once on an EMPTY dump (unambiguously a boot failure, never a
   wrong assertion), and four fixed real-time budgets were raised after measuring
   the onboarding session at 91.8s against a 35s deadline — a LATE overlay had
   been reported as a MISSING one. None of these weaken an assertion: every one
   asks whether the client eventually does X, never whether it does X quickly.

**The transferable rule, now in memory:** "known flake" is a claim requiring
evidence per RUN, not a label a test inherits — and a slice that changes a CAP
changes every decision ranked below it.

## Breaking / compatibility

No protocol or save-format change. `data/rules.json` gained
`diplomatDoctrine` / `caravanDoctrine` in W8 (the stamp moved there and has
since held). Client changes are presentation only. The Roblox generated data was
re-baked for the new knobs.

## Consistency

**MERGE-CONSISTENT — the user may merge this.** It SUPERSEDES marker-0110 as the
merge candidate. Basis: the reviewer's pristine clean-clone and independent lune
reproduction at aff4366, the sim-runner's acceptance-ratio proof, a full local
suite at **1027/1027 with zero failures**, the #28 classification honest with
t100/t200 held byte-identical, and the natural golden holding 545/p2 for a
seventh consecutive re-record.

Riding on top, all golden-neutral: the ruled title on every client surface, the
mobile playthrough plus the d-pad/modal fix it found, the Roblox playthrough
checklist and its F1 divergence record, the Roblox data re-bake, and the
usage-metrics design handed to the hardening lane.

Open and NOT blocking: the water-heavy map shapes ship by user ruling with the
overseas-expansion gap filed as `specs/unit-doctrine-v1x.md` §8; the hardening
lane's metrics implementation is in progress.
