# marker-0133 — fastengine change requests R1–R14

**Tag:** `marker-0133` at `8c62aaa` · **merge-consistent — the user may
merge this** (supersedes marker-0132). gamesim-golden-neutral: no golden,
scenario hash or data checksum moved. One caveat, stated plainly: the
Luau twins gate did not run locally (lune is absent on the dev PC; the
local install was refused by the permission layer). The only Luau change
is one table entry, twinned byte-shaped; the main nightly installs lune
and runs the gate, so the merge itself verifies it.

The tag is local only: `git push` from this session has no GitHub
credentials. Push with `git push origin dev_night marker-0133`.

## Delta since marker-0132

| Commit | What |
|---|---|
| `f60e890` | playtest.md: the 2026-08-15 mobile-phone session finds |
| `1d1b32a` | tech-glyphs record corrected |
| `d70ab22` | `workitems-roblox.md`: the roblox-helper queue in file form |
| `e612651` | fastengine requests R1–R14 (below) |
| `8c62aaa` | sync pass: Luau catch-up plan, Roblox items 6–7, records |

## The fastengine batch (`e612651`)

fastengine (`~/GIT/fastengine`) mirrors read-only helpers in C# for a
native client and filed 14 requests
(`../fastengine/specs/handoff/retromulticiv.md`). Their R-numbers clash
with the Roblox R-items, so the work items here are A107–A113 and
B29–B30, tagged `fe-R<n>`. Design and per-item record:
`specs/fastengine-requests.md`.

1. **A107 — door validation (fe-R13, R2).** A join name with a non-ASCII
   character ("Åse") or a lone surrogate killed the server (exit 70):
   the name entered game state, and `statehash` refuses non-ASCII. Now
   join/create names must be printable ASCII (≤ 24) or the frame gets
   `rejected badName`; every string in a `cmd` and in `create.options`
   is checked the same way (`badShape`). `claimSeat` is server-only
   (`SERVER_ONLY_COMMANDS`). The message handler is wrapped: a fault
   sends `rejected internal` and, if the game's state no longer hashes,
   closes that game instead of the process. The browser folds names to
   ASCII before sending (Åse → Ase). New `shared/state-string.js`.
2. **A108 — live save downloads are seat-only (fe-R1).** `/saves/<id>`
   for a running game needs an `X-Seat-Token` header matching a seat;
   finished games and `--debug` servers serve without it.
3. **A109 — protocol version, compression, wss (fe-R5, R4, R3).**
   `PROTOCOL = 1` rides `joined`, the open-games rows and the master
   announce; `/ws?proto=N` with a different N is refused with
   `protocolMismatch` naming both versions. permessage-deflate above
   4 KB: turn-1 views measured 72 KB → ~1 KB (medium) and 283 KB → ~1 KB
   (huge), 0.2–0.5 ms per view. The lobby uses wss on 443/https.
4. **A110 — off-turn command waiter (fe-R8).** One waiter keyed by
   commandId; only its own ack counts; a `rateLimited` reject settles it;
   30 s timeout; a new request supersedes the old one; a rejoin on your
   own turn flushes queued off-turn commands.
5. **A111 — client re-filter + world age (fe-R7, R12).** The ruleset is
   passed at all 14 client `filterView`-family sites. `ageChanged` is
   world news in `engine/visibility.js` and `luau/visibility.luau` —
   every seat now sees the world enter a new age (fixture first,
   red → green). Enter on the historian no longer also ends the turn.
6. **A112 — native downloads (fe-R6).** `server/native.js` (from
   CarrierDominion) serves `/native.json` + `/native/<file>` with byte
   ranges when the `NATIVE_DOWNLOADS` env var is set; the
   setup screen lists the files on desktop.
7. **A113 — `--saves-dir`, `--crashdumps-dir` (fe-R14).**
8. **B29, B30 — browser UI batch (fe-R9–R11, 26 items).** Notable:
   the envoy offer re-popped after Accept; pedia terrain entries never
   opened; tech-tree Back left the research list hidden; the end screen
   with no winner; HUD overlap at 721–1439 px; several button colours.
   The `?envoydemo` hook had been broken since A105 and is fixed.

CLAUDE.md gained the "Downstream mirrors (fastengine)" paragraph: changes
to the listed helpers stay fine, but the commit message names them.

## Wire changes (all additive; `PROTOCOL` stays 1)

`proto` last on `joined` (4 sites) and `openGames` rows; announce
`protocolVersion`; reject reasons `notAllowed`, `internal`,
`protocolMismatch`; `presence.stances`; `X-Seat-Token` on save fetches;
deflate negotiated by the client. Nothing a running game must react to.

## Records (`8c62aaa`)

- `specs/luau-catchup-2026-10-30.md`: the plan for a lune lane (twins
  last green at `d32f12d`, 2026-08-05).
- `workitems-roblox.md` item 6: the Roblox `GameServer` has the same door
  gap (any client `cmd` field reaches the engine; `claimSeat` reachable).
  Item 7: `ageChanged` now reaches Roblox clients with no code change.
- `debugging/mobile-playthrough/` gitignored; `sync-check.sh` no longer
  checks the missing `plan-update.md`.

## Test state

- `node --test test/`: 1078 tests, 1056 pass, 0 fail, 22 skipped (the
  Luau twins among the skips — lune absent).
- Playwright lane `test-ui/`: 65 pass, 2 skipped, including
  `test-ui/fe-batch.spec.js` 8/8.
- fastengine's R13 repro: `join -> rejected badName` for both names.
