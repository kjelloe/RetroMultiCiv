# fastengine change requests R1–R14: review, design, plan

Source: `../fastengine/specs/handoff/retromulticiv.md` (R1–R14) + `retromulticiv-r13-repro.mjs`.
Audited by the requester at `d70ab22`; re-verified here at the same commit (2026-10-30).
R1–R13 user-approved for handover; R14 awaits the user's word.

**Naming:** fastengine's `R<n>` labels collide with this repo's Roblox R-items. Here they become
A107–A113 / B29–B30 (below); every item keeps its `fe-R<n>` alias in marks and commit lines so the
status rows for `~/GIT/unityworks/specs/server_change_requests.md` map 1:1.

**Wire rule (theirs, adopted):** additive only — new fields last, nothing renamed/removed, every wire
change named in the commit message. Server stays startable on `--port 0 --host 127.0.0.1`.

## Verification

| fe-R | Verdict at d70ab22 | Notes |
|---|---|---|
| R1 | CONFIRMED | `server/index.js:330-337` serves `toDownload()` (full state, tokens stripped) to any GET; `openGames` rows list every gameId. |
| R2 | CONFIRMED | `protocol.js:162-166` checks only `cmd.type` is a string; engine `claimSeat` (`engine/index.js:206`) is reachable from a socket. Same `e.game.apply` path as the server's late-join flow, so the gate belongs at the socket, not in the engine. |
| R3 | CONFIRMED | `lobby.js:1028` hardcodes `ws://`. |
| R4 | CONFIRMED | `WebSocketServer` at `index.js:382` has no `perMessageDeflate` (ws default false). |
| R5 | CONFIRMED | No protocol constant. FOUR `joined` sends, not three: `index.js:1044` (spectator), `:1133` (late join), `:1184` (start), and `protocol.js:226` (seat join/reconnect route). The list reply is `t:'openGames'` (`:1349`), not `games`. |
| R6 | CONFIRMED (feature) | No `/native*` routes. |
| R7 | CONFIRMED | 14 call sites, none pass the ruleset (hud 243, minimap 43, automate 132/155/270, replay 156/319, advice 247/267, sound 183, turnlog 117/162, input 1143, overlays 124). |
| R8 | CONFIRMED | `session-remote.js:140` re-baselines `prevActive`; `request` (`:212`) has one slot, no timeout; `-1` rejects only set status (`:154`). |
| R9–R11 | see "Client batch" | |
| R12 | CONFIRMED | `ageChanged` absent from `WORLD_NEWS` in BOTH `engine/visibility.js:256` and its twin `luau/visibility.luau:276`. |
| R13 | REPRODUCED | Repro (run with an ABSOLUTE repo path — a relative one resolves under the tmp cwd): "Åse" and "\ud800" both `joinedLobby` → exit 70 at handleStart's autosave. |
| R14 | CONFIRMED | `opts.savesDir` (`index.js:129`) has no CLI flag; `crash.js:23` writes `crashdumps/` relative to cwd. |
| CLAUDE.md line | — | Request to note the C#-mirrored helpers. |

## Design decisions

### R13 — non-ASCII names (P1, first)
Keep `canonical`'s rule (no hash bump: the goldens and the Luau byte parity stay put). Three layers:
1. **Door (server/protocol.js):** a `isStateString(s, max)` predicate exported from
   `shared/statehash.js` (the rule lives once, next to `canonical`). `join`/`create` `name` → `badName`.
   `cmd`: walk every string value in `cmd` (bounded depth) → `badShape` if any fails; `foundCity.name`
   additionally ≤ 24. The deep walk closes the class (diplomacy/debug payloads too), not only the two
   names found.
2. **Browser:** fold before sending — NFD + strip combining marks + a small map for non-decomposing
   letters (ø→o, æ→ae, ß→ss, ð→d, þ→th, ł→l); anything left outside 32–126 is dropped. Lobby name and
   the city-name dialog both use it (one helper in `client/ui/`). So "Åse" joins as "Ase"; the server
   reject is the backstop for other clients (the native client mirrors the same rule).
3. **Containment (server/index.js):** try/catch around the per-message dispatch and `handleStart`:
   log one line, answer `rejected` with new code `internal`, keep the process. If the throw came out
   of a game (state already committed with the bad value), mark that game `errored`: unlist it,
   refuse further `cmd`s with `internal`, keep its last good save. The process-level crash handler
   stays for genuine bugs. This touches the docs/17 command path — hardening-lane region.

Accept: repro prints `join -> rejected badName` for both names; a socket `foundCity` with `"Åse"` →
`rejected badShape`; a test that forces a throw inside dispatch gets `rejected internal` and the
server keeps answering.

### R2 — command allowlist (P1)
`CLIENT_COMMANDS` in `server/protocol.js` = every engine command type except `claimSeat`
(`debug` stays: gated by `state.debugEnabled`). Unknown/forbidden → `rejected notAllowed` (new
code). A drift test greps `cmd.type === '…'` out of `engine/index.js` and asserts each type is in
exactly one of `CLIENT_COMMANDS` / `SERVER_ONLY_COMMANDS` — a new engine command fails the suite until
someone decides which side it is on. Accept: socket `claimSeat` for an AI pid → rejected, `human`
stays false; `server-latejoin-takeover.test.js` stays green.

### R1 — save download (P1)
Rule: a live game's `/saves/<id>.json` is served only when `state.gameOver`, or the request carries
header `X-Seat-Token` matching a seat bound in that game; otherwise 404 (same as unknown id — no
oracle). Header, not query string, so tokens stay out of access logs. The served body stays the full
`toDownload()` because the save's purpose is re-hosting, which needs the authoritative state.
Trade-off: a seated player can still read through fog via their own download — the same exposure
a local/hotseat save has; the anonymous leak (R1's actual finding) is closed. `--debug` unchanged.
Client: `saves.js:132` adds the header from `session.token`; `rejoin.js` (ended games) needs nothing.
Accept: `server-save-download.test.js` gains token-less → 404, wrong-game token → 404, own token →
200, gameOver → 200.

### R5 — protocol version (P2)
`PROTOCOL = 1` exported from `server/protocol.js`. `proto` appended last to all four `joined`
sends and to each `openGames` row (and the master announce body). `/ws?proto=N`: parsed in the
upgrade handler next to the invite check; mismatch → accept the socket, send
`{t:'rejected', commandId:-1, code:'protocolMismatch', message:'server speaks 1, client 2'}`, close
1008 before any seat work (a handshake-level 4xx gives the client no readable reason). Absent →
accepted. Bump rule recorded in docs/06.

### R4 — compression (P2)
`perMessageDeflate: { threshold: 4096, serverNoContextTakeover: true, clientNoContextTakeover: true,
concurrencyLimit: 10 }`. Measure before/after with `debugging/probe-lan8.js` (bytes + per-command
push latency) and record in docs/08 §8; ship only if latency stays within the existing budget.

### R3 — wss (P2)
`joinOrigin = (s.port === 443 || location.protocol === 'https:' ? 'wss' : 'ws') + …`. Both
conditions: an https page cannot open ws:// at all. No master-announce field needed now.

### R8 — off-turn flush + waiter (P2)
After `joined`: `if (state.activePlayer === playerId) flushOffturn()`. `request`: 10 s timer →
`{ok:false, reason:'timeout'}`; a `rejected commandId:-1` while `awaiting` resolves it `ok:false`;
a new `request` while one is in flight first settles the old one `superseded`. Success requires the
awaited id's own ack: the server always sends `applied{commandId}` before the views
(`protocol.js:255`), so `applied` marks the waiter only when its `commandId` matches (today it marks
unconditionally, `:146`), and a `view` resolves `ok:true` only a marked waiter. A dropped frame whose
throttled `-1` reply never came now times out instead of resolving `ok:true` on someone else's view.

### R12 — historian (P3)
1. `ageChanged` joins `WORLD_NEWS` in `engine/visibility.js` AND `luau/visibility.luau` in one
   window. View-only (filterEvents never touches state) → gamesim-golden-neutral; twins gate +
   replay-verdict equality is the check. Fixture first: a filterEvents unit test (seat hears it).
2. `historian.js onKey`: `e.stopPropagation()`; plus `if (e.defaultPrevented) return;` at the top of
   `input.js`'s window handler (covers future modals too).

### R7 — ruleset to the client re-filter (P2)
Pass `session.ruleset` at all 14 sites (replay's `viewFor` included). One-line each; no server-mode
skip (keeping one code path for both modes). Accept: test-ui spec — sight-2 unit's second ring
bright with a rival on it in both modes; local rival submarine hidden unless adjacent.

### R6 — native downloads (P2, feature)
Port CarrierDominion's `server/native.js` as specified (new file, routes added before the static
whitelist). Link on setup + lobby, hidden on touch and on `kind:'none'`. Read their file first;
match it, do not redesign.

### R14 — saves dir (P3, needs user go)
`--saves-dir DIR` (mkdir -p) → `opts.savesDir`; `--crashdumps-dir DIR` → `crashDeps.dir`. USAGE +
`docs/how-to-host.md`. Test boots the CLI with `--saves-dir <tmp>`.

### CLAUDE.md line
Add their paragraph verbatim under "Hard rules"-adjacent as a "Downstream mirrors" note.

## Client batch (R9, R10, R11) — verification

Of the 27 live items, 26 are CONFIRMED and 1 is PARTLY. Struck items: R11.21 (= R3) and R11.26.
Some citations are off by about 1 line; the sites below are the corrected ones.

| Item | Fix site | Fix |
|---|---|---|
| R9.1 🔍 never fires | hud.js:43 | `pointerdown` + `stopPropagation`, the same as mute and ✕ |
| R9.2 GoTo arrival | input.js:857 | after the loop, check arrival and delete the target before the note |
| R9.3 empty hut flash (latent) | turnlog.js:286 | use the same fallback text as `put` |
| R9.4 HUD under the research bar at 800 px | css 2687 block | `#hud` max-width in the 721–1439 band |
| R10.1 Save is never green | css:1094 | `#options-saverow #opt-save` |
| R10.2 ✋ always shows | css:1298 | `#regent-off.hidden { display: none }` |
| R10.3 stance never highlighted | index.js `regentMap` callers (924/941/1155/1198/1549) + session-remote.js:191 | append `stances: {pid: game.regentOf(pid)}` after `regents` in `presence`. Additive: `regents` keeps `true`, so a native `=== true` check keeps working |
| R11.1 envoy re-pops (P2) | diplomacy.js:248-249, and the same order bug at :325-326 | `await dispatch(...)` with `envoyPid` held, then `closeEnvoy()` |
| R11.2 peace wording for every offer kind | diplomacy.js:228 | map `offer.kind` → the `describeParley` term (peace/tribute/techswap) |
| R11.3 standing offer waits a view | diplomacy.js:347 | one `scanOffers()` at init |
| R11.4 spectator rows unknown | diplomacy.js:86-92 | no 🤝 button when spectating (spectators have no relations) |
| R11.5 "(Esc)" tooltip | input.js:1435 | Esc also closes overviews (keeps the tooltip true) |
| R11.6 nearest city ignores wrap | military-overview.js:28 | wrap-aware dx (`engine/movement.js` distance) |
| R11.7 panel covers its buttons | css 2687 block | overview panels `top: 78px` |
| R11.8 two nameless pedia rows | pedia.js:60 | `sorted(terrain.terrains)` |
| R11.9 hover card under tree | css:1830 | z-index 65 |
| R11.10 tree Back (PARTLY: Back reveals nothing; the research list stays hidden) | tech-tree.js:52-57 | Back and Close re-open / close the research panel explicitly |
| R11.11 `dots` glyph draws nothing | tech-glyphs.js drawPrim | add a `dots` branch; re-shoot `debugging/glyph-sheet.html` |
| R11.12 `.loss` unstyled | css | `#city-panel .loss` + overview tables |
| R11.13 "Mood wonders" dead | panels.js:460-462 | read `happyEverywhere` / `contentEverywhere` / `allContentInCity` |
| R11.14 stale capital tooltip | panels.js:362 | clear it when the city is not the capital |
| R11.15 rival city opens on its turn | input.js:1313 + panels.js:252 | compare against `ctx.HUMAN`; guard un-hide on `openCityId !== null` |
| R11.16 stale action bar | panels.js:245 | `ctx.refreshActionBar()` |
| R11.17 ←/→ re-show a hidden city panel | panels.js:910 | `isCityOpen` also requires not `.hidden` |
| R11.18 kick button colours | css:1351 | `.setup-lan-btn.lobby-kick` |
| R11.19 lobby labels laid out as grid | css after 1767 | the two toggles `display: inline` |
| R11.20 `?master=` base/URL mismatch | setup.js:567 | treat the param as a base and append `/servers` (matches lobby.js) |
| R11.22 dead-end refusal screens | lobby.js:418, :512 | add "↻ retry" / "browse games" beside back |
| R11.23 Continue never green | css:1659 | `#discovery-card .dc-actions .dc-continue` |
| R11.24 dead `.dc-name` rule | css:1634 | `#discovery-card.ci-card .dc-name` |
| R11.25 peace padding lost | css:990 | `#moment-card.moment-peace` |
| R11.27 DEFEAT with no winner (latent) | endscreen.js:288 | no verdict line when `wid` is undefined |
| R11.28 `?ending=score` spectator TypeError | endscreen.js:164 | guard the missing player |

Test coverage: each item gets an assertion in the area's existing `test-ui/` spec (diplomacy,
pedia, tech-tree, discovery-card, endscreen, regency, lobby-chat, city-happiness,
layout-contract). Items with no spec today (banner 🔍, GoTo arrival, opt-save colour, city-panel
keys) go into a new `test-ui/fe-batch.spec.js`. Pure-logic items (R9.2, R11.6, R11.28) also get
`node --test` unit coverage. Run `npx playwright test` on each touched spec; this lane is not
covered by `node --test`.

## Plan

### Work items

Each line reads: lane, golden status, and the files the item touches.

| ID | fe-R | Title | Lane | Golden | Files |
|---|---|---|---|---|---|
| **A107** | R13 + R2 | Door validation + command allowlist + dispatch containment | hardening (docs/17 region) + helper for protocol.js/client fold | neutral | shared/statehash.js (export predicate only), server/protocol.js, server/index.js dispatch/handleStart, client fold helper, lobby.js + city-name dialog |
| **A108** | R1 | Token-gated save download | helper | neutral | server/index.js:330, client/ui/saves.js |
| **A109** | R5 + R4 + R3 | Protocol version, deflate, wss | hardening (upgrade path) + helper (lobby.js) | neutral | server/protocol.js, server/index.js, client/ui/lobby.js, docs/06 |
| **A110** | R8 | Remote session waiter + rejoin flush | helper | neutral | client/session-remote.js, test/session-remote-offturn.test.js |
| **A111** | R7 + R12 | Ruleset to client re-filters; `ageChanged` world news; historian keys | architect (engine+luau twin window) + helper (client) | neutral, verified by the twins gate | engine/visibility.js + luau/visibility.luau, 14 client call sites, historian.js, input.js |
| **B29** | R9 + R10 | HUD / options / regency batch | bugfixer | neutral | hud.js, input.js, turnlog.js, style.css, regency.js, session-remote.js, server/index.js presence |
| **B30** | R11 | Panels batch, 26 items, in 4 sub-slices: diplomacy (1-4), overviews+pedia+tree (5-11), city view (12-17), lobby+cards+end (18-28) | bugfixer | neutral | per the table above |
| **A112** | R6 | Native downloads endpoint | helper | neutral | server/native.js (new), server/index.js, setup/lobby link |
| **A113** | R14 | `--saves-dir` / `--crashdumps-dir` | helper | neutral | server/index.js CLI + USAGE, how-to-host.md |
| — | CLAUDE.md | Downstream-mirrors paragraph | architect | — | CLAUDE.md |

### Order
1. **A107 first.** R13 is a remote, unauthenticated crash of the whole process. If the mail hub
   is still down (d70ab22: "hub down"), the architect self-executes A107 rather than waiting on
   routing.
2. A108 and A110 in parallel with A107; their files are disjoint.
3. A109, then A111. The A111 engine twin window is small, view-only, with a fixture first.
4. B29, then B30 sub-slices in order. B30.1 (envoy re-pop) is the only P2 in the client batch;
   it goes first.
5. A112 and A113 last. A113 waits for the user's go.

### Wire changes (list in each commit message)

All are additive.
- `rejected` codes: `internal`, `notAllowed`, `protocolMismatch`.
- `joined.proto` (×4 sites).
- `openGames[].proto`.
- `presence.stances`.
- `/ws?proto=`.
- Header `X-Seat-Token` on `/saves/`.
- `GET /native.json`, `/native/<file>`.
- Compression negotiated by `permessage-deflate`.

### Close-out
- Status rows go to `~/GIT/unityworks/specs/server_change_requests.md` ("RetroMultiCiv
  (fastengine)"), one per fe-R: commit + wire delta.
- Re-run their repro (absolute path) as the R13 acceptance.
- Marker report per the usual flow.

## Implementation record (2026-10-30)

Self-executed by the architect in plan order; all golden-neutral (the only engine touch is
`WORLD_NEWS` in `engine/visibility.js` + its `luau/visibility.luau` twin, view-only).

| Item | fe-R | State | Notes |
|---|---|---|---|
| A107 | R13, R2 | done | `shared/state-string.js` (isStateString / onlyStateStrings / foldToAscii); protocol door checks; `CLIENT_COMMANDS` + `SERVER_ONLY_COMMANDS` with an engine-dispatch drift test; per-frame `containFault` (closes a game whose state no longer hashes). The fastengine repro prints `join -> rejected badName` for both names. `test/server-door-validation.test.js`. |
| A108 | R1 | done | `X-Seat-Token` header (client `session.saveHeaders()`); gameOver and `--debug` serve without it. |
| A109 | R5, R4, R3 | done | `PROTOCOL = 1`; `proto` last on 4 `joined` sites + `games`/`openGames` rows; announce `protocolVersion` reads it. Deflate measured: turn-1 views 72 KB (medium) / 283 KB (huge) → ~1 KB, 0.2–0.5 ms per view (mid-game views compress less). `test/server-proto.test.js`. |
| A110 | R8 | done | ack-gated waiter, 30 s timeout, `rateLimited` -1 settles, `superseded`, rejoin-on-own-turn flush. |
| A111 | R7, R12 | done | ruleset at all 14 sites; `ageChanged` world news (fixture red→green); historian keys stop propagation; `?historiandemo` hook. |
| B29 | R9, R10 | done | R10.3 rides `presence.stances` (additive; `regents` unchanged). |
| B30 | R11 | done | 26 items. Found beyond the request: pedia terrain entries never OPENED either (showEntry read `r.terrain[id]`); the `?envoydemo` hook was stale since A105 (no `met`), so its Accept failed `notMet` — fixed, and a refused answer now defers the offer instead of re-popping it. R11.22: retry added to the blocked/failed screen; the kicked screen keeps back-to-setup only (a retry would hit the block). |
| A112 | R6 | done | `server/native.js` ported (product name only); setup-screen line `client/ui/native-links.js`; `test/server-native.test.js`. |
| A113 | R14 | done (user go 2026-10-30) | `--saves-dir`, `--crashdumps-dir`; `test/server-saves-dir.test.js`. |
| — | CLAUDE.md | done | "Downstream mirrors" paragraph. |

### Follow-ups (sync pass 2026-10-30)

- Luau twins gate + full goldens run 2026-10-30 after lune was
  installed: all equal (`specs/luau-catchup-2026-10-30.md`).
- The Roblox server has the same door gap R13/R2 closed here (unchecked
  `cmd` fields, `claimSeat` reachable from a client): queued as
  `workitems-roblox.md` item 6.
- No marker cut yet; `human-workitems.md` C5. [marker-0133 cut 2026-10-30.]
- Gap found 2026-11-01 (A116, fixed same day — `onlyStateValues`): the R13/R2 door accepts a
  non-integer number and `null` inside a `cmd` (probed:
  `{type:'setRates',tax:50.5}` and `{type:'wait',unitId:null}` both pass
  `parseMessage`). Game state allows neither; if the engine stores one, the
  next hash throws and `containFault` closes the game. The Roblox twin
  (`luau/state-string.luau`) already rejects both.
- 2026-11-02 (A117, mirrored helpers): `filterView` now copies
  `view.difficulty` (engine/visibility.js). Before, every server-game
  client computed city mood with the default contentCitizens on
  non-medium games; a native client reading the seat view and running
  `happiness.cityMood` had the same error. `engine/combat.js` adds
  `city.sdiRevealed` on an interception (state field, hashed).

### Follow-ups 2026-11-07 (fastengine message, A118)

| # | What | Status |
|---|---|---|
| 1 (#184) | civ splash in server games | `view.players[pid].civ` added (additive). Lobby games carry civs; the CLI boot game (`setupFromOpts`) assigns none, so the splash cannot show there. fastengine 2026-11-08 (#197): followed; leave the CLI boot game without civs (their shot pairs expect its names and colours). Closed. |
| 2 (#176) | `?overlay=` at boot in a remote game | fixed: overlays recompute after the boot refresh. |
| 3 (R11.8) | nameless `unknown` pedia terrain row | fixed: pedia skips it. |
| 4 | mirror list | CLAUDE.md lists `shared/state-string.js`. |
| 5 | debug-panel fractional gold | fixed: truncated to an integer. |

