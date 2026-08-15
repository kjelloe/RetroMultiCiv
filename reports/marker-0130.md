# marker-0130 — canonical-floors CI repair + the road-city guard

**Tag:** `marker-0130` (workflow + test + doc sync only — no client or
engine changes) · **merge-consistent — the user may merge this**
(supersedes marker-0129, which the user merged and deployed 2026-08-15;
v1.0.2 is in effect).

## Delta since marker-0129

1. **`nightly-soak.yml` — canonical-floors budget 45 → 150 (measured).**
   The M-floor RATCHET job has been KILLED at its 45-minute wire every
   night since at least 2026-08-09 — the floor enforcement was silently
   dead for about a week, invisible inside a nightly that was already red
   for unrelated pre-merge reasons (the ui-lane specs fixed on dev_night
   2026-08-05 only reached main with the marker-0129 merge). Cause: the
   same W6-W8 density growth that took the soak job 45→120 on 2026-08-03;
   canonical-floors was missed in that raise. Measurement, not a wave:
   the 2026-08-15 run completed 8 of 25 seeds in 45 min (~5.1 min/seed
   with the runner's 2-way parallelism) → 25 seeds need ~130 min. NOT
   sharded: the floors are defined on the 25-seed canonical MEDIAN, and
   per-shard medians are the thin-sample noise the naval arc already
   measured. Lesson appended to the ci-nightly-lessons memory: when one
   job's budget is raised for a systemic cost change, audit its siblings.
2. **`test/road-city.test.js`** — permanent H13b regression guard, red
   on revert by construction: runs `createTileProps` headless at all
   three tiers and asserts (a) the road tile AND the city tile each draw
   their half toward the join, (b) the half on the city side carries only
   road styling even when the neighbour is a rail (road-brown or
   dash-white; never rail steel/dark), (c) two adjacent roadless cities
   sprout nothing. Enabled by **`test/three-alias.mjs`** — a per-process
   module-loader hook resolving the bare `three` specifier to the
   vendored module (what the browser import map does). Recorded gotcha:
   instance colors are stored in the LINEAR working space — compare
   through `THREE.Color`, never raw hex.
3. **Medium road markings** (`props.js`; user follow-up 2026-08-15).
   The dash pass was high-branch-only since H2, so medium's "marked
   road" stage rendered unmarked. Medium now draws one centerline dash
   per half-segment at stages 3–4 (twin rows on the highway); LOW stays
   dashless — the byte-frozen classic — proven by the g0-final `cmp`,
   and the default-frame CI golden renders at low, so no golden
   re-record rides this.
4. **Doc sync.** Test-count pins 1063 → 1062 (README / plan-update /
   agent-workitems; the count is environment-dependent — CI counts 1064
   with lune + browser present — the pins track the local sync-check
   invocation). human-workitems twins: A2 marked done (merge + deploy,
   user, 2026-08-15), A2b added for this marker. plan-version1 twins:
   v1.0.2-in-effect header. Memories: graphics-levels-resume,
   ci-nightly-lessons (+ index lines).

## Verification

- `test/road-city.test.js` green at low/medium/high; full local suite
  with the new guard: see the suite line in the tag mail.
- The workflow change is inert until it reaches main (the scheduled
  nightly runs there) — **until this marker is merged, the nightly's
  canonical-floors job keeps dying at the 45-minute wire.** Tonight's
  main nightly should clear the ui-lane reds either way (their fixes
  rode marker-0129).

## Open

- Roblox re-mirror queue (roadStageFor + road styling + city halves).
- User: merge marker-0130 (workflow fix reaches the scheduled nightly);
  v1.0.2 release notes on the user's word; playtest.md remaining rows;
  P1 ntfy topic + gamesindex uncommitted files; P2 VM backup steps.
