# marker-0137 — fastengine follow-ups, the soundtrack

**Tag:** `marker-0137` at `b8222bd` (re-pointed 2026-11-24 after the rebase onto the Roblox lane's `151287b`; first cut at `7b27b4a`, never pushed) · **merge-consistent — the user may merge this**
(supersedes marker-0136). Golden-neutral: no pinned hash moved. Two
additive surfaces: a seat-view field and a new music folder.

The tag is local only (no GitHub credentials in the agent shell):
`git push origin dev_night marker-0133 marker-0134 marker-0135 marker-0136 marker-0137`.

## Delta since marker-0136

| Commit | What |
|---|---|
| `d1fbf4e` | marker-0136 report + plan/workitem sync |
| `26e15f0` | A118 fastengine follow-ups |
| `a8680bb` | fastengine #197 followed; CLI boot game keeps no civs (their ruling) |
| `f632736` | A119 the soundtrack |
| `1158b95` | removed playwright screenshots committed by mistake in `f632736` |
| `7b27b4a` | Roblox keeps its two tunes (user ruling); records |

## Items

1. **A118 — fastengine follow-ups.**
   - #184: the seat view carries every player's `civ` (engine/visibility.js +
     luau/visibility.luau). Lobby games now show the civ splash online. The
     CLI boot game assigns no civs and stays that way (fastengine's shot
     pairs rely on its "Player N" names and colours). Side effect: browser
     and Roblox turn-log diplomacy rows now know the viewer's civ, so party
     rows show detail instead of the world headline.
   - #176: `?overlay=` draws at boot in a server game (overlays recompute
     after the first HUD refresh; before it the renderer has no view).
   - R11.8: the pedia terrain list skips the nameless `unknown` terrain that
     the remote session adds for fog tiles.
   - The debug panel's gold amount is truncated to an integer (the A116
     command door refuses fractions).
   - CLAUDE.md lists `shared/state-string.js` among the fastengine mirrors.
   - The game-simulation leak audit (test/sim-driver.js) allows `civ` on a
     rival player row.
2. **A119 — the soundtrack (user ruling: build it now, follow the brief).**
   overworld's FM score player copied into `client/music/` (MIT, NOTICE),
   with gain 0 refused, scores and output node passed in, and a 4 s
   cross-fade. Ten pieces written to `specs/game-soundtrack-design.md` by
   `tools/compose-music.js`: `intro-title`, `loading-age`, `map-ancient`,
   `map-renaissance`, `map-industrial`, `map-modern`, `map-space`,
   `map-war`, `end-victory`, `end-defeat`. The pure theme rule
   `shared/music-theme.js` picks the piece: screen, then a finished game,
   then war (a combat involving the viewer this turn or last), then the
   space programme, then the viewer's highest era. The two old one-voice
   tunes are gone from the browser; the Music option and master volume
   control the player. The soundboard lists every piece.
3. **Roblox keeps its two uploaded tunes** (user ruling 2026-11-17). Recorded
   in workitems-roblox (item 21 closed; numbered 11 before the rebase onto the Roblox lane's items 11-20), docs/13, the brief, and the v2 shelf.

## Golden state

No GOLDEN_SOAK / NATURAL / BEHAVIOR or scenario pin moved. Views are not
hashed; the music is client-only.

## Breaking notes

- Wire: the seat view gains `players[pid].civ` (additive). fastengine
  followed it in their #197.
- fastengine mirrors: new `shared/music-theme.js` and
  `client/music/pieces/*.json`; named in `f632736`.

## Rebase 2026-11-24

dev_night was rebased onto `151287b` (53 Roblox-lane commits: `roblox/`, docs/13,
`specs/roblox-native-look.md`, `specs/roblox-parity-plan.md`, workitems-roblox items
11-20; no engine, client or shared change). The only conflicts were in
`workitems-roblox.md`; the soundtrack item moved from 11 to 21. Commit ids in the
table above are the pre-rebase ones (`f632736` = `fe3356e`, `1158b95` = `3ce3ad0`,
`7b27b4a` = `b8222bd`). After the rebase: node suite 1094 tests, 1084 pass, 0 fail,
10 skipped; roblox/check.sh 52 gates pass (gates 1-2 need rojo, absent here).

## Test state

- `node --test test/` on `f632736`: 1094 tests, 1083 pass, 0 fail, 10
  skipped. The first run of that suite failed one check (runtime imports must
  be git-tracked) until the new files were staged.
- Playwright lane on `f632736`: 68 passed, 2 skipped.
- Golden-seed sims, Luau twins, server tests after A118: 40/40.
- Commits after `f632736` are docs-only.
- Listening quality is the user's pass (human-workitems D3).
