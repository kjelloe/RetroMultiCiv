# Endgame Moments (#34 "Founder's Record") — implementation slice plan

Turns the sanctioned design (`specs/ally-design-response-2026-07-21-endings.md` §1)
into an ordered build. Client-only, golden-neutral (render/DOM/sound over the
existing gameOver event + scoreBreakdown). Naming: the replay/history interface is
**"Founder's Record"** (architect #2355); the SCORE Chronicle + history-graph frame
carry that name. NOT started — awaiting architect greenlight (item flagged
"needs design iteration").

## The seam (endscreen.js, 190 lines)

Today `show(state, victory)` builds the scoreboard immediately; the gameOver handler
(L182) and the loaded-already-over path (L185) call it directly; `reopen()` (View
game summary, L172) also calls `show()`.

Add `playMoment(state, victory, onDone)` — a small Continue-gated state machine that
renders per-ending STAGES in a full-screen overlay (reuse the discovery-card/splash
overlay pattern + sound.js cues + the renderer for fog reveal), then calls the
existing `show()` as the final reveal. Wiring:
- gameOver (L182) + loaded-over (L185): route through `playMoment(...)` → `show()`.
- `reopen()` (L172): call `show()` DIRECTLY — the moment plays once; re-opening the
  summary skips it.
- Default / unknown victory: no stages → `show()` immediately (zero regression —
  the current behavior is the empty-moment case).
- e2e/screenshot: expose `playMoment` + keep `show`; drive per-ending via the
  gameOver event (space/conquest/score) + a `?ending=` probe hook.

## Slices (each: golden-neutral, fog-honest — never regress the score-view guard;
## e2e probe driving that victory + one screenshot per stage)

- **S0 scaffold (design-neutral infra):** the Moment state machine + `#endscreen-moment`
  overlay (staged pages, Continue button, optional per-stage CSS filter / renderer
  hook / sound cue) wrapping `show()`. Route gameOver through it; `reopen()` skips it;
  empty-moment = immediate scoreboard. VERIFY: endscreen browser/e2e tests stay green.
- **S1 DEFEAT** (least design-risk): "The Fall of [Civ]" → capital glyph → grayscale
  desaturate (CSS filter on the end view) → final log "Your people will remember you
  for [best metric], but the story of the world continues without you." → scoreboard;
  Replay button framed as ghost-witnessing. (NEVER "Game Over".)
- **S2 CONQUEST:** instant full-globe fog reveal (renderer, render-only — never state)
  + "The world is at peace. The colors of [Civ] span the horizon." (no WINNER text) →
  scoreboard.
- **S3 SCORE (Retirement / Founder's Record):** "Chronicle of the World" + a
  score-band→title map ("Historians will remember [Leader] as a [title]") + closing-book
  motif → scoreboard.
- **S4 SPACE (Aspiration), largest:** ship-in-orbit wireframe glyph → 3-2-1 (console log)
  → launch fanfare → 15-YEAR starfield time-skip ("The voyage of the [Ship] continues…")
  → arrival card ("Arrival at Alpha Centauri. Year: [Y]. A second home for humanity…") →
  STELLAR ERA FRAME around the history graph. Uses the spaceVictory event payload
  (flightYears / arrivalTurn / population).

## Design-iteration points for the architect/ally (build-to-spec, screenshot each)

Exact glyphs, stage timings, copy tone, and the stellar/era frame treatment want the
ally's eye — I'll build each stage to the §1 spec and post a screenshot per moment for
iteration rather than finalize unseen. Suggested first greenlight: S0 + S1 (scaffold +
DEFEAT) as the proof-of-approach, then iterate S2–S4.
