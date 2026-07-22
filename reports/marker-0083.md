# marker-0083 — difficulty ladder + danger-abandon + the entry-flow rulings (MERGE-CONSISTENT)

Tagged at `c746298` (2026-07-22 early). **MERGE-CONSISTENT — supersedes
0082. This is the current merge candidate** (15th consecutive consistent
marker, 0069–0083). **Both gates REAL**: reviewer clean-clone GREEN
(739/736, luau-400 `0x56b99cb2`) + sim-runner Gate-B lune GREEN (#2176 —
all four checkpoints byte-exact, natural 519/p2/`0xfe154790`, twins 9/9).
No fallback needed.

## What changed (delta since 0082)

1. **Danger-based abandon** (`706b19d`, user ruling #2138): the space
   arc's threat-metric latch removed entirely; abandon = concrete events
   only (warring / enemy adjacent to capital / city lost while
   committed); recommit open. 4th witness: abandon criteria MET (24
   commits, 4 survive, floors green) — the launch blocker moved
   upstream to wonder-building (ruled staged-both #2160; apollo-narrow
   landing next).
2. **Authentic difficulty** (`bb176c4`, rulings #2155/#2158/#2164): the
   7-level Civ1-named ladder (trainer…godemperor, default prince),
   middle-5 rows carrying pack-#1955 values exactly; knob-class split —
   world knobs always, AI-vs-human asymmetric knobs only with a human
   seat (all-AI soak neutral, proven by a controlled field-diff);
   M3-pop floor re-pinned 28→27 (provisional; 25-seed confirm running).
   Natural reference game: 519 rounds (victory before endYear — weaker
   authentic barbarians speed the endgame).
3. **B27** (`23b6a25`): the sweep-caught trireme-on-land invariant was
   `disbandCity` stranding docked sea units on a size-1 coastal disband
   (§40 interaction — both naval.js leads wrong); ship+cargo now lost
   with the city; scenario 055 (`0x544794da`); golden-neutral. The
   reviewer reproduced seed 23 clean past the original break.
4. **A50 hardening arc merged** (3 branches: a50-healthz `1812acf`,
   oom-slice2b `579ba2e`, heartbeat `b4b9dcd`) — /healthz, invite
   brute-force throttle, OOM guard 2b, connection heartbeat. KNOWN GAP:
   the a50-healthz merge took an earlier branch sha and missed the
   audit-fix commit (#2178); the re-delivered `hardening-audit-fixes`
   branch lands immediately after this marker.
5. **Entry-flow rulings (user, 2026-07-22)**: bare `/` and `/client/`
   land on the LOCAL setup screen (`b44a344` — reverses XIV §16ext;
   server = Host/Join LAN + Find game ONLY); tab-loss answered by the
   localStorage autosave + setup-screen resume card + `?resume=local`
   boot + 💾 corner icon (`c746298`).
6. **Client batches** (helper lane): §26 discovery celebration + §22
   pedia hover-links (`7b78285`), §23/§25 input pacing + right-click
   goto + mobile §10 (`35c8bc9`).
7. **Twin-file parity guard** (`159d2c9`) + docs: agent-mail topologies/
   onboarding, mailbox-flag standard, reviewer sweep-gate doctrine,
   plan-version1 currency pass, cloud-init --max-turns 700.

## Gates

Reviewer: clean-clone 739/736 (lone red = the SIGTERM parallel flake,
17/17 isolated), engine-diff on B27 verified correct (Luau
pairs()+delete snapshot noted), seed-23 replay clean, golden-neutral
calls confirmed. An interim RED at `b44a344` (#2171 — a hide-toggle
specificity miss in the short-lived server link) was overtaken by
`c746298` removing the element; guards 15/15 at the tag. Gate-B:
sim-runner real lune run at `c746298` (#2176), byte-exact on every pin.

## Breaking notes (for the redeploy)

rulesetHash moved (difficulty table); save format gains
`state.difficulty` (omit-safe — old saves load); `?difficulty` ids
changed (prince default; easy/hard removed); box unit needs
`--max-turns 700` + optional `--bug-reports` (see the deploy review).
Entry default is now LOCAL — server games via the LAN/Find buttons.

## Test state

Full suite at tag: 739 stable passes, 0 real fails (2-3 parallel-load
flakes, all green isolated). Scenario count 55; twins gate 9/9.
