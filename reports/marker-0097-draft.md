# marker-0097 — DRAFT (not tagged; gates pending on the gaming PC)

Prepared during the 2026-07-24 away window at tip `072d922`-era; the
tag lands at the verified sha once the reviewer engine-diff (three
sets, one pass) + Gate-B/sweep come back green. GATE STATUS AT DRAFT
TIME: requested (#2393/#2399/#2405), gaming-PC lanes idle pending a
session nudge.

## Delta since marker-0096 (8047f0b)

**Engine (three windows, one lane, serialized):**
1. **#8 default-defender** (`02c9fc6`): era-relevant founding +
   empty-queue default production (best available land defender,
   defense-first; militia→…→mech-inf). Behavioral but
   committed-golden-NEUTRAL (verified: sim 7/7 + CANONICAL_PIN
   unmoved). Gate includes the ruled 25-seed sweep (behavioral drift
   on non-golden seeds is expected; invariants+floors are the gate).
2. **claimSeat** (`a75fc2b` + catalog fix `aaaa1f1`): the late-join
   §3 engine command — AI seat → human through the normal stamped
   command path (replay reproduces the flip). Fixture-first (scenario
   061, 0xeffb984b), JS==Luau. Red-tree window caught and closed
   same hour by the lane's own correction (event-catalog
   registration).
3. **a6a Future Tech** (`072d922`): the XII.2 repeatable end-of-tree
   science sink (futureTech int, score term, AI sentinel pick, hut
   sentinel exclusion — an audit catch). STAMP-ONLY re-record with
   behaviorhash-unchanged VERIFIED; CANONICAL_PIN → 0xd15b2e83.
   BREAKING-ish stamp: rules.json grew scorePerFutureTech →
   rulesetHash moved (gaming-PC re-baseline + roblox gate-4 re-bake
   ride the pull; no gameplay drift — the sink is dormant until a
   marathon exhausts the tree). Marathon witness queued to
   sim-runner (report-only).

**Late-join + pause + eviction feature (user design, in flight):**
spec `specs/late-join-pause.md` with five architect/user rulings
(AI-only seat pool · second-strongest pick · evict=save+rejoinable ·
generic pre-confirm + post-join reveal · claimSeat-not-server-write).
CLIENT half SHIPPED (`e77f4a5`): Find-game beside Start, lateJoining
checkbox, row states with old-server fallback, serverFull message.
SERVER half in build on `hardening-latejoin-a` (pure core + flag/CLI
done + tested; listing/pause/eviction continuing; the §3 issue-point
unblocked by claimSeat).

**Client batches (helper, all golden-neutral):** boot fade-in
(first paint from black, 4s failsafe) · onboarding-e2e suppress (the
lane's own overlay was swallowing lobby Start clicks under e2e — the
e2ehost mystery root-caused + un-masking spec added) · join-share
(copy-URL + `?join=CODE` deep-link + QR overlay per the user's
design; vendored qrcode-generator v1.4.4 MIT, whitelist updated) ·
A49 flow-2 play-visibility spec (per-seat viewpoint + fog-checksum
guards) · fish-marker fix (ocean specials rode the submerged floor —
the friend-playtest "no fish" report) · Civ1 per-resource special
motifs (11 terrain-keyed icons replacing the generic ball).

**Roblox (both slices landed by the sim-runner):** roster-shuffle
(`8f0e982` — lineups match the browser seed-shuffle, ACTIVATING the
baked age-snapshot instant starts) · specials-motif mirror
(`577086c`). The 9 design-gated runI items RULED
(`specs/runI-design-rulings.md`) + seat-preview align queued.

**Coordination tooling (from an external specialist review, all
verified against our code first):** at-least-once mail (inbox
delivers / ack settles, 15-min redelivery, tag-filter data loss
fixed) · locks are 45-min renewable leases (engine windows: take
--ttl 120) · hub reaper watchdog (working-stale auto-flag; per-lane
30-min cooldown after the first-day spam lesson) · hub /rpc
allowlist (closed an unauthenticated hub-disk read) · dormant
per-lane token auth. Migration plan: specs/agent-mail-hub-upgrade.md.

**Docs:** game-stack-overview.md (reusable architecture write-up) ·
plan-version2 Civ2+ water-feature notes + naming re-rule ·
docs/10 shared-twin grant (#2375) · test counts 747→852 synced.

## Test state at draft

Suite 857/857 at `072d922` (bugfixer full run); twins 11/11;
scenarios 63 files; the known SIGTERM flake green this run.

## For the tag (fill at green)

- [ ] reviewer engine-diff verdict (three sets)
- [ ] Gate-B + #8 25-seed sweep verdict
- [ ] sim-runner re-baseline done (rulesetHash stamp)
- [ ] final sha + consistency declaration
