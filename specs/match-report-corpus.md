# Proposal: voluntary match-report corpus (learning from hosted games)

Advisory write-up from the reviewer; the architect holds design authority.
Question answered: when real games run on hosted servers (docs/12: the
user's VM + self-hosted servers on the master index), how do we learn from
them — live stats, strategy marks, or storing what the top/bottom civs did?

## Core recommendation: collect recordings, not stats

Determinism is the asset. A finished game is fully described by its
recording: seed + command log + per-round hashes + game code — the same
artifact Shift+D already produces and `tools/replay.js` already verifies.
Every statistic anyone will ever want (build orders, expansion tempo, tech
paths, war timing, top-2 vs bottom-2 divergence) is DERIVABLE OFFLINE by
replaying the log through the engine. So the collection-time decision is
tiny: save the whole recording with a small metadata envelope. Which civs to
compare and which stats to extract are analysis-time decisions that can
change forever without touching servers. Do not build live stat collection;
do not decide top-2/bottom-2 at the server.

## The artifact: one match report per finished game

```
{ format: "retromulticiv-match-report", version: 1,
  envelope: {
    rulesetHash, engineVersion, gameCode,        // pins + tamper check
    parentGameCode,                              // save-resume lineage (log
                                                 // restarts at load point)
    mapSize, civCount, humanSeats, difficulty,
    turns, endReason,                            // conquest / endYear / abandoned
    ranks: [{ seat, civ, score, alive }],        // final standings only
    labels: []                                   // optional operator/player tags
  },
  recording: { seed, commandLog, roundHashes } }
```

Anonymization at write time: player names are replaced by seat labels
(seat1..seatN); chat never enters the command log so it never leaves the
server; no persistent player identifiers across games. The envelope's
`labels` field is where voluntary "strategy marks" can go later (a post-game
one-tap tag like wonder-focus / rush); v1 ships without any UI for it.

## Consent model (voluntary at two levels)

1. Server operator: off by default; `--share-reports <dir|url>` enables it.
   A dir target only writes local files (operator shares manually); a url
   target uploads. The operator quick-card (docs/16) gains one line.
2. Players: the lobby shows a "match reports shared" notice when enabled;
   any player toggling decline at their seat vetoes the upload for that game
   (the report is not written). Spectator-only games follow the host.

## Transport: v1 is a file drop, not a new surface

At game end the server writes the report beside its saves
(`saves/reports/<gamecode>.json`). Nothing listens, nothing new is exposed —
zero new attack surface, which matters for the docs/16 posture and the
hardening lane. Upload (v2, optional) can later ride the same channel as the
master-index announce (docs/12) since opted-in servers already talk
outbound there; the collector then only needs one hard rule:

- INGEST GATE: a submitted report is accepted only if `tools/replay.js`
  reproduces its round hashes and game code under the pinned rulesetHash.
  Divergent = rejected. This makes the corpus tamper-evident for free
  (docs/07 already defines the verification code) and silently filters
  version skew into per-ruleset buckets.

## Analysis: reuse the existing measurement pipeline

The sim lane already extracts telemetry from AI games (`tools/soak.js
--stats`, the docs/05 activity-baseline format). Extension, not invention:

1. `tools/report-stats.js` (or a soak.js mode) replays a directory of match
   reports and emits the SAME telemetry row shape the soaks emit — per civ,
   per checkpoint: cities, techs, score, army size, first war turn, first
   contact, build-order head, expansion tempo. Human seats are flagged.
2. The interesting derived table is the divergence report the user asked
   about: per game, what the top-2 civs did that the bottom-2 did not
   (opening build order, settler tempo, tech path prefix, war timing) —
   computed at analysis time from the replay, aggregated across the corpus.
3. Learning loop stays the existing one: divergence findings become
   HYPOTHESES about rules knobs (the aiWarDoctrine/scout/expansion family in
   rules.json), the sim-runner A/B-gates them exactly like the opener-scout
   experiment (measured, accepted or rejected), goldens re-record only when
   a knob change is accepted. Human data proposes; the sim lane disposes.
   No ML, no runtime adaptation, engine untouched.

## Storage honesty

A 400-turn recording is a few hundred KB of JSON; a busy server produces
maybe tens of games/day — rotation by count/age on the server side
(keep last N, default ~200) and the corpus lives dev-side. If size ever
matters, a digest mode (envelope + per-civ per-checkpoint timeline, no log)
is the fallback — but digests freeze the stat schema, so prefer full
recordings while volumes are small.

## What this is NOT

- Not live telemetry, not per-player tracking, not ML training data.
- Not an engine change: collection is server/host layer; the engine and all
  goldens are untouched (gamesim-golden-neutral by construction).
- Not mandatory for self-hosters: the master index never requires reports.

## Suggested slices

S1 server-side report writer + consent flag/notice (small; server lane).
S2 report-stats extractor over a local dir + divergence table (tools lane,
   reuses replay + soak formats).
S3 upload channel + ingest gate (only when the master index lands, A51).
S4 optional strategy-mark labels UI (later, if the corpus proves useful).
