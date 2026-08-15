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

## S2 renderer-level reveal — ally ruling 2026-07-25 night

The ally reviewed the CSS-fade S2 (shipped in Founder's Record) and
prefers a TRUE renderer-level reveal over the screen-layer fade: the
actual terrain/cities/seas gradually receiving light via the real
scene lighting, not an interface overlay lifting. Requested motion:
war ends → held stillness → the world gradually lights → full globe
visible → the Chronicle receives the result.

RULING (architect + ally, non-blocking): renderer-level is the
DEFINITIVE version, but explicitly NOT worth holding the release for
— the ally's own words. The CSS fade stays as v1's shipped
implementation; the animated version queues as a v1.x follow-up,
after the D4–D6 arc.

Entry point for whoever picks this up: the prerequisite is already
shipped — `gameover-reveal` (marker-0102, `13d89e0`) means the server
sends the unfiltered map at strict gameOver, and `setEndReveal(flag)`
already un-dims explored tiles render-only (S2's existing hook). The
remaining work is ANIMATION, not new data: interpolate the reveal
(dim → lit) over the held-stillness beat instead of an instant flag
flip, timed to the Moment stage machine. Client-only, render-only,
golden-neutral by the same argument as the existing S2.

**DONE 2026-08-15 (user go).** Implemented as a LIGHTING ramp, which is
exactly the ally's wording ("the actual terrain gradually receiving
light via the real scene lighting"): `setEndReveal(true, rampMs)` —
the reveal rebuild happens with the lights pre-dropped to 12% (the pop
is invisible), the first 22% of the ramp HOLDS the stillness, then
ambient + sun smoothstep to the tier baseline over the remainder
(conquest passes 3400 ms). The ramp lives in the render loop next to
the water/sway ticks — render-time only, never state. reduce-animation
keeps the instant flip (accessibility, and the byte-stable A48 shots
never see a ramp). The CSS `moment-brighten` curtain is retired; the
`moment-reveal-bg` overlay is now a transparent vignette for caption
legibility only. Verified: virtual-time shots at 1.5 s (held dark) vs
9 s (exact baseline) — `debugging/s2-dark.png` / `s2-lit.png`;
endscreen spec 5/5; browser smoke 19/19.
