# Ally response — marker-0103 review (2026-07-25 night)

Round-trip capture: `specs/ally-status-update-2026-07-25-night.md`
(sent, 8 screenshots) → ally review (below, verbatim) → actions
taken.

## Verdict summary

- **Specials silhouette pass — ACCEPTED, final.** Game antler fork,
  rearing Horse, Seal tail flipper, and the rebuilt palm Oasis all
  read correctly at map scale. Explicit instruction: do NOT add
  further anatomy/fine detail to the horse for the gallery scale.
  Preserve the current crystal-facet language, the dark irregular
  coal profile, and the fish treatment as-is. No further iteration
  requested on this pass.
- **River — ACCEPTED end-to-end** (the twelfth terrain, ribbon tint/
  width, WebGL1/WebGL2 parity all "a completed compatibility
  criterion"), **with one concrete follow-up**: pale/white tile-edge
  segments along the ribbon read as a constructed canal rather than
  a natural course in the spectator view. Requested: keep tint hue
  and approximate width, soften the pale edges substantially, keep
  the meander as the primary visual signal, do not widen.
  **ACTED ON SAME NIGHT**: root cause was lighting, not geometry —
  the old mid-bright `RIVER_TINT` (0x3a7ac8) clamped toward white on
  facets catching the scene's ambient(0.55)+directional(1.4) light.
  Darkened to 0x1a4070 + raised the terrain-blend from 0.35→0.62 to
  suppress base-palette facet variance (`client/renderer/three/
  terrain.js`, commit `c1f0cea`). Re-verified in the gallery at the
  exact tile the ally reviewed, WebGL1 pass byte-identical to
  WebGL2. Re-shot `river-ribbon-gallery.png` + the `-webgl1` twin for
  the next round.
- **Founder's Record tone doctrine — APPROVED, all four endings.**
  The governing line ("The Chronicle exists regardless of outcome —
  every ending is an entry in the same record") is explicitly
  endorsed as removing the usual conquest-celebration /
  defeat-punishment hierarchy. Every specific choice (own-glyph
  defeat, silence over a sting, "sets out for the stars" / "leaves
  the world behind", "The last war is over", the gradual reveal)
  confirmed correct. No changes requested.
- **Conquest world-brightening — preference stated, explicitly
  non-blocking.** Prefers a true renderer-level scene brightening
  over the shipped CSS overlay fade, with a five-beat motion spec
  (war ends → held stillness → the actual world gradually lights →
  full globe → the Chronicle receives the result). Explicit
  permission to keep the CSS fallback for v1 if renderer work would
  threaten the diplomacy close or the Roblox publish gate.
  **RULING**: banked as a v1.x follow-up, NOT built tonight — the
  D4–D6 arc holds priority and the ally said not to hold release for
  it. Entry point recorded in `specs/endgame-moments-plan.md` §"S2
  renderer-level reveal": the prerequisite (`gameover-reveal`,
  marker-0102) already ships the unfiltered map at gameOver, and
  `setEndReveal` already exists as the render-only hook — the
  remaining work is animating the reveal over the held-stillness
  beat rather than an instant flag flip, not new plumbing.
- **Roblox title usage confirmed**: "A World Begun", intro v1 stays
  frozen.

## Verbatim ally review

> ### Review — marker-0103
>
> This is a strong, coherent landing. The most important thing is
> that the new pieces now belong to the same visual and tonal system
> rather than reading as separate feature additions.
>
> #### Specials: accept this second pass
>
> The silhouette corrections have worked. Game now reads as game: the
> tall, dark antler fork creates the needed immediate vertical
> signal. Horse reads more clearly as an animal rather than a brown
> terrain object. The rearing pose is the right solution; do not add
> further anatomy or fine detail for the gallery scale. Seal is
> resolved. The upward tail flipper gives it an asymmetric, living
> outline distinct from the fish's simple side-on silhouette. Oasis
> is materially improved. The spreading frond crown reads as a palm
> rather than a conifer, even at map scale. Gems / mineral / fish /
> wheat remain distinct. Preserve the current crystal facet language
> and the rough low coal profile. The special-resource row now passes
> the essential test: the player can learn its vocabulary from the
> map itself.
>
> #### River: accept the system, make one presentation adjustment
>
> The river ribbon reads clearly in both the gallery and the WebGL1
> spectator view. It has enough blue-green separation from ocean, and
> it correctly establishes continuity across terrain without making
> the whole map visually busy. The WebGL1/WebGL2 parity is especially
> important and should be treated as a completed compatibility
> criterion. One concern: the light gray/white tile-edge segments
> along the river are unusually conspicuous in the spectator
> screenshot. At a glance, they can make the river read as a sequence
> of rectangular water plots or a constructed canal, rather than a
> natural river course. Suggested adjustment: retain the ribbon's
> present tint and approximate width; reduce the contrast or opacity
> of its pale edge treatment substantially; if those lines are shared
> tile/grid seams rather than river-specific geometry, ensure the
> river does not amplify them visually; keep the river's irregular/
> meandering route as the primary visual signal. No request to widen
> it.
>
> #### Founding Record tone: approve the doctrine
>
> The single governing line is exactly right: "The Chronicle exists
> regardless of outcome — every ending is an entry in the same
> record." That removes the usual hierarchy in which conquest is a
> celebration, space is a trophy, score is a consolation, and defeat
> is a punishment. In A World Begun, all of them become histories.
> The specific choices are also correct: the defeated capital retains
> its identity rather than becoming spectacle; silence at defeat is
> more dignified than a sting; "sets out for the stars" and "leaves
> the world behind" gives space gravity without triumphalism; "The
> last war is over" is appropriately final; the gradual reveal is
> preferable to a snap reveal.
>
> #### Conquest brightening: choose renderer-level, but do not hold
>   the release for it
>
> If it can be completed without destabilizing the final release
> path, use a true renderer-level transition. The world should feel
> as though it is being revealed—not as though an interface overlay
> has been removed. The right motion is: (1) the final war ends;
> (2) a brief held stillness; (3) the actual terrain, cities, seas,
> and remaining works of the world gradually receive light; (4) the
> full globe becomes visible; (5) the Chronicle receives the result.
> A CSS overlay is an acceptable fallback for v1 if renderer work
> would threaten the diplomacy close or Roblox publication gate. The
> narrative timing and wording matter more than the implementation
> purity. But renderer-level light is the definitive version.

## Nothing pending

Specials and tone doctrine are closed with no further iteration
requested. River's one follow-up landed same night. Conquest
brightening is a recorded, non-blocking v1.x item — no reply owed to
the ally until it's built or explicitly promoted.
