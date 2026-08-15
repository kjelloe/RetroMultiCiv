# marker-0131 — S2 renderer-level reveal + the roblox work-list audit

**Tag:** `marker-0131` at `8235764` · **merge-consistent — the user may
merge this** (supersedes marker-0130). Client render/UI + docs/trackers;
gamesim-golden-neutral; no visual-golden change (the ramp is gated off
under reduce-animation, which every byte-stable shot uses).

## Delta since marker-0130

1. **S2 renderer-level reveal (`5bfdc3a`)** — the banked v1.x conquest
   moment, closed on the user's go. `setEndReveal(true, rampMs)`: the
   reveal rebuild happens with ambient + sun pre-dropped to 12% (the
   un-dim pop is invisible), the first 22% of the ramp HOLDS the
   stillness, then both lights smoothstep to the tier baseline — the
   ally's requested motion ("the actual terrain gradually receiving
   light via the real scene lighting, not an interface overlay
   lifting"). Conquest passes 3400 ms. Render-loop ramp, render-time
   only, never state; reduce-animation keeps the instant flip. The CSS
   `moment-brighten` curtain is retired; `moment-reveal-bg` is now a
   transparent caption vignette only. Verified: virtual-time shots at
   1.5 s (held dark) vs 9 s (exact baseline) — `debugging/s2-dark.png`
   / `s2-lit.png`; endscreen spec 5/5; browser smoke 19/19; render
   battery + graphics lane green.
2. **Roblox work-list completeness audit (`8235764`)** — the lane's
   queue is now the verified-complete list (5 items). Two gaps
   recovered: (a) the held #2616 **Encyclopedia swap never landed** —
   `Pedia.client.luau` still says Gamepedia (queued #4); (b) the
   **TileProps road/rail twin drifted** behind the H13/H13b window
   (queued #5, extends #3; docs/13 CP1 paragraph carries the drift
   note, and SO15 sound is marked resolved there). The user-gated
   **Studio session** (midgame-join verify + publish +
   `ROBLOX_EXPERIENCE_URL`) was surfaced in #2665 but had fallen off
   the tracked list — now `human-workitems` C1b, with C1 rewritten to
   the audited queue. Verified closed, not queued: the 1.0-close batch
   (built/verified per #2783), SO2 tooltips (ruled open-ended polish),
   D4-D6 client surfaces (ruled post-1.0), F1 city naming (v1.x
   divergence), the bigger-lift art backlog (user-pick-ordered),
   tech-glyphs phase-2 (architect + ally gated). Lane mailed the full
   audit (#2926).

## Verification

- Endscreen spec 5/5 (all four ending previews + the real `?server=1`
  gameOver); browser smoke 19/19; render battery 18/18; graphics lane
  5/5. Full suite unchanged since marker-0130's 1062-green run — the
  S2 delta touches no engine or test-visible surface beyond the lanes
  above.

## Open

- Roblox lane: 5 queue items + the C1b Studio session (user).
- Architect: the tech-glyphs phase-2 Roblox-asset approach ruling
  (also gated on the ally motif-concept pass).
- User: merge marker-0131 (carries 0130's canonical-floors CI repair —
  the nightly's floor job keeps dying at the 45-min wire until this
  reaches main); v1.0.2 release notes on your word.
