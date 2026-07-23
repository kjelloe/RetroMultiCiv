# marker-0098 — the late-join + polish marker (MERGE-CONSISTENT)

Tagged at `bb0bcc8` (2026-07-24 night). **MERGE-CONSISTENT —
supersedes 0097. Current merge candidate** (30th consecutive,
0069–0098). GOLDEN-NEUTRAL: zero engine/luau/data delta since the
0097 tag — every component individually reviewer-gated (#2419
late-join, #2437 view-contract, #2453 master-proxy + lobby-drop) and
the client batches ride the standing engine-neutrality; no Gate-B
applicable. Core verify at the tag: 84/84 + the three server suites
10/10.

## Delta since marker-0097 (9f12dba)

1. **Late-join + pause-on-empty + eviction — FEATURE-COMPLETE**
   (user design → shipped same day). Server half merged on green
   (`205bbfe`): claimSeat-integrated takeover (second-strongest,
   never-human pool), pause with zero AI/regency cost, eviction
   (era → humans → pause-age, saves survive), listing rows,
   serverFull. Client: rows/checkbox/messages + the named post-join
   reveal banner. Operator flag `--no-late-join` documented in
   how-to-host.
2. **join-share family**: copy-join-URL + `?join=CODE` deep-link +
   the QR overlay (vendored qrcode-generator v1.4.4 MIT,
   whitelisted) with open-in-new-tab.
3. **runI design batch + runJ feedback (Roblox)** — the 9 ruled
   items built (fortify visual, lobby seats/start/messages, toggles,
   tile-yield icons, overlays…) + the Studio-verified held set + the
   user's runJ feedback batch (`0116b18`, 12 files). Seat-preview
   aligned to the seed-shuffled roster.
4. **Play-lane sweep** — the e2e play lane had never really run
   (the onboarding overlay swallowed first clicks on ~13 specs).
   Now: webdriver-based AUTOMATION gate, the envoy-probe
   replay-hash divergence fixed (restore ABSENCE), locator/copy
   drift fixed, sentry/upgrade reworked — **zero unexplained reds**,
   2 documented contention flakes.
5. **Self-host find-a-game fixed** (reviewer finding #2446): the
   server proxies `/master/servers` when `--master` is set
   (same-origin, no CORS), plus actionable dead-end text + host-guide
   line. Lobby socket drops now surface (`lobby-drop`).
6. **D4 prep**: the treaty-UI shell on provisional parley wire
   (chooser + envoy-modal inbound, engine-probe-gated Propose) —
   one rename pass rides the D4 landing. witness-8 BEFORE-half
   banked at 0097 (0 launches baseline).
7. **docs/16 §7 re-assessment**: no RC-blocker across the new
   surfaces; takeover-cap residual shelved to v2.
8. **Coordination tooling**: lane-watcher (zero-token wake daemon,
   per-dir serialized) deployed on the gaming PC and verified live;
   flag-wait hub-outage resilience + store-origin markers; reaper
   cooldown.

## Parked / in flight

- **#32 A8 tile contention**: correctness PROVEN (4/4 + 10-seed
  clean) but 5–18x hot-path cost — parked with the pickup kit
  (WIP diff + tests + soak logs); the fresh bugfixer session
  implements the ruled threading structure. NO pins moved.
- **#34 Founder's Record**: fresh helper session.
- Studio-gated: the item-3 segmented-bar remainder.

## Test state

Suite ~870 at the tag (core verify 84/84 + server suites 10/10 at
tag time; the full-suite runs ride the component landings). Twins
untouched (no engine delta). Play lane: zero unexplained reds.
