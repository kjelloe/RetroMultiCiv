# Lessons learned #1 — multi-agent collaboration & tooling (2026-07-26)

Written mid-W6 (the build-doctrine window), after a stretch that produced four
honest golden re-records, two falsified hypotheses, and three gate-caught
defects in a single arc. Facts and measured patterns, not aspirations.
Companion: `lessons-learned-1.html` (same content, card markup).

---

## Part 1 — Collaborating with other agents

### What works

**1. Adversarial gates catch what tests cannot — run them on PUSHED shas.**
The single most valuable pattern this project has. Slice-1a was 7/7 green on
fixtures, twins 11/11 bit-exact, clean-clone 0-fail — and behaviorally DORMANT
(0.9% coverage). Only the sim-runner's 25-seed measurement caught it. Then the
1b fix passed code review AND an independent 3-seed probe — and the 25-seed
sweep caught the M3-pop collapse (25 → 15.25) that both missed. Tests prove the
mechanism; sweeps prove the *effect*. A gate that re-derives from git (reviewer
clean-clone, lune repro) also catches "works in my tree" drift.

**2. Independent reproduction beats trust.** The reviewer re-derives goldens
under lune from the pushed sha rather than believing the commit message. That
converted "the natural winner-flip is scary" into "the winner-flip reproduces
byte-identical in BOTH engines = a deterministic butterfly, not a bug" — a
verdict nobody could have asserted honestly from one side alone.

**3. Queue = obligation, mail = context, status = presence.** Three channels
with distinct semantics. Work travels as `queue add` items (acked ≠ done; a
lane pulls when idle). Mail carries context and verdicts (at-least-once with
ack windows — poll with `peek`, ack what you acted on). The status board is a
one-line-per-lane heartbeat (`waiting | working X | working X (long ~Nm)`).
When all three are used correctly, a coordinator reads the whole system in one
`status` call. When they blur (work sent as mail, status stale), lanes stall
silently — the one ambiguity this session (sim-runner "waiting" while holding a
taken queue item) cost a flag-raise round-trip.

**4. Locks are leases; pathspec-scope every commit.** Three agents share one
dev-PC tree. File locks (45-min leases, renewable, reaper-freed) prevent
edit-throughs; every commit names its files explicitly so one lane's `git add`
never swallows another's WIP. The one time this saved the day: bugfixer's
uncommitted endscreen work survived an architect rebase via `git stash push --
<its files>`. Corollary: NEVER `git checkout <file>` casually — it wiped an
uncommitted knob change this session (cost: one redo).

**5. Two stamp-shifting golden windows cannot parallelize in one tree.** Both
ripple the SAME createGame-stamp goldens; whoever runs the sim picks up the
other's uncommitted data change and contaminates the re-record. Serialize
stamp windows; parallelize only golden-neutral work (client, docs, roblox).

**6. Openings matter: "git pull origin dev_night — expect tip <sha>".** Every
task to a remote-clone lane starts with the pull line and the expected tip.
Removes a whole class of "reviewed the wrong tree" failures.

**7. Blocked lanes raise their hand; silence is never a status.** The
`blocked` tag → coordinator → ruling loop resolved the M3 regression within
one cycle because sim-runner mailed BLOCKED with the full floor table instead
of idling. The flag mechanism (`flag raise/lower/wait`) is the poll floor.

**8. Report state, not agency.** Build-log voice ("M3-pop 15.5 FAILS floor
22, do not tag") makes verdicts machine-checkable and keeps momentum out of
the language. A verdict mail that leads with the verdict line can be routed
without reading the body.

**9. Proactive lanes are worth their tokens — when they respect authority.**
The reviewer proactively gated W5; sim-runner proactively started the slice-1
sweep before being asked. Both accelerated the arc. The boundary that makes
this safe: measure/review lanes hold NO design authority and say so in their
mails ("your call", "advisory, no block").

**10. User rulings are design inputs — fetch them at the fork, not after.**
The W4 effect scope, the 1c defer-knob choice, and the 1d role-discipline
ruling each came from a single targeted question with concrete options. The
anti-pattern is building first and asking forgiveness; the measured pattern is
options-with-a-recommendation at the moment the fork is reached.

### What does not work

- **Trusting green tests as evidence of effect** (slice-1a). Coverage/impact
  numbers must come from direct measurement, by count, in the wild config.
- **Small-sample probes as gate evidence.** 1-seed said 73%, 3-seed said
  5.8%-and-fine, 25-seed said M3 FAIL. Probes pick between variants; only the
  canonical sweep gates. (Re-learned twice in one window.)
- **Inline mail bodies / heredoc-into-send.** Hook-blocked for a reason: they
  stream the body through the transcript. Two steps, always: Write the body
  file, then `send --body-file`.
- **Assuming a lane's environment.** sim-runner's session lost Write/lune
  approvals mid-arc; the fix was committing probes INTO the repo
  (`debugging/probe-peace.js`) so a write-blocked lane can still run them.
  Design tasks so the remote lane only needs read+run.
- **Letting "known flakes" pass unread.** Every not-ok name gets read; the one
  local red (B13 witness) is verified-gitignored and re-verified each window.

---

## Part 2 — Tools & scripts

### /tmp scratchpad vs ./debugging — the rule that emerged

- **Session scratchpad (`/tmp/claude-.../scratchpad/`)**: one-shot diagnostics,
  probe variants mid-calibration, mail body files. Dies with the session —
  which is correct for exploration, and fatal for anything a remote lane or a
  future session needs.
- **`./debugging/` (committed)**: any probe that (a) a write-blocked remote
  lane must run, (b) gates or witnesses reuse across slices, or (c) encodes a
  measurement config worth repeating (probe-peace.js, the standing .sh tools).
  The moment a scratch probe proves useful twice, commit it.
- The project's standing scripts (`t.sh`, `peek.sh`, `shoot.sh`,
  `killport.sh`, `triage.sh`) exist to replace ad-hoc pipes — inline pipes
  trigger permission prompts and irreproducible one-liners. Use them.

### The simulator stack — what proved critical

| Tool / pattern | Why it is load-bearing |
|---|---|
| `test/sim-driver.js` `runSim(opts)` | The universal probe substrate: seeds, size, civs, chaos, difficulty, `roster` (new — pick SPECIFIC civs, e.g. a low-aggression pair), `rulesOverrides`. Every diagnostic this window was ~30 lines on top of it. |
| GOLDEN vs BEHAVIOR hashes (#28) | The stamp/behavior discriminator. Null-and-run: null the GOLDEN pins, run, and read whether BEHAVIOR moved. t100-held + later-moved is also an anti-paste-back proof. |
| `tools/soak.js --seeds N --stats --enforce-floors` | The authoritative multi-seed truth + the M-floor ratchet. The ratchet RULE: a floor enters `--enforce-floors` only in the commit where the sim-runner confirms the median clears it. |
| Probe-before-pin | Any surprising golden (winner flip, early ending) gets a direct probe of the final state BEFORE the pin is committed, so the re-record comment states what the ending IS. |
| Committed witnesses | The peace witness / duel witness / naval witnesses: fixed configs that re-run per slice as acceptance tests. A falsified witness (2-civ ≠ peace) is still a witness — renamed, kept, it measures the other extreme. |
| `tools/replay.js` + twins gate under lune | Divergence bisection and the cross-language contract. "Reproduces byte-identical JS==Luau" is the strongest sentence in any verdict. |

### Patterns to keep (the critical list)

1. **Fixture-first, always.** Write the failing test before the mechanism; the
   pre-implementation failure is part of the evidence.
2. **Measure in the canonical config.** Golden-seed sims (4-civ 56×35) are for
   determinism, not for effect sizes; effects are measured at 7-civ medium.
3. **Honest re-record headers.** Every pin block states what moved, why, the
   classification (BEHAVIORAL/STAMP), and the probe numbers. The file is the
   audit trail.
4. **Background long runs; read outputs from files.** Foreground sleeps are
   blocked and pipes get trimmed — `run_in_background` + Read the output file,
   and never let `tail` eat the failing test's name.
5. **Kill contaminated runs.** A baker/sim started before a knob flip is
   poisoned data — stop it, don't reason about it.
6. **One measurement lesson per file-edit tool:** `Edit` for surgical changes;
   whole-file JSON rewrites via scripts re-serialize and churn the diff.
7. **Skills for recurring asks** (`sync-pass`, `marker`, `status-report`):
   checklists beat memory for anything the user asks verbatim more than twice.

### The meta-lesson

The expensive defects this window were never in the code the tests covered —
they were in the *interaction* between mechanisms (garrison floor × threat
gate × settler loop) that only whole-game measurement exposes. The system that
catches them is: fixture-first tests (mechanism) + twins gate (portability) +
25-seed sweeps (effect) + independent review (honesty) + a user ruling at each
design fork (intent). Remove any one leg and a plausible-but-wrong change
ships.
