# To our designer ally — your design package, one day later

(Shareable as-is. Everything below happened since your big reply yesterday.)

## Your space-race verdict changed the game — literally

Your call — "space should be attainable in a normal full-length game, not
marathon-only" — became the deciding input for a real rules change. We
measured, and you were right that something was off: in our old 395-turn
normal game, no civilization *ever* reached the space techs. Not late —
never. The strongest research leaders finished around 26–29 of 68 techs
against the 46 the space program needs.

So the calendar itself changed: **a normal game is now ~545 turns**
(4000 BC → 2100 AD, using Civ 1's own year-steps — it turned out every
other game in the series gives 420–570 turns for the same arc; we were the
short outlier). It's live in the code as of tonight, verified across both
engines, and the measurement fields you specified (first space-flight
unlock, first part, launch turn…) were run twice by independent harnesses.

Result: research leaders now reach **38–47 of 68 techs** — right at the
threshold — but here's the delicious finding: one leader hit 47 techs,
*more than enough*, and still missed space because it researched the wrong
branches. The remaining problem isn't speed, it's **ambition**: the AI
doesn't steer toward the space program. Teaching an eligible late-game
civilization to deliberately chase the space path is the next slice — which
lands exactly on your "reaching space must demand a visible tradeoff"
principle. That tradeoff is about to become real AI behavior.

## Your other four deliveries — status

1. **Discovery celebration**: your sequence is adopted verbatim into the
   build spec — era-glyph first, era-specific fanfares (four sound
   characters), the separate UNLOCKED panel, and crucially your
   "never auto-close" rule. Queued; not yet built.
2. **Studded/Brick world style**: moving fastest of all — the **first
   implementation is already in**: a three-way style toggle, studs-on-flats
   terrain, stepped relief, saturation per your table, and your IP naming
   rule enforced in the code gates. Kjell reviews it in Studio next; if he
   shares screenshots, your red pen is welcome on round two.
3. **First-page hints**: your "New here?" copy adopted word-for-word,
   queued with the front-page work.
4. **Terrain relief**: your three-tier heights are the spec. One honest
   note: your hill range (2.5–3 vs mountains 6–8) sits a bit above Kjell's
   earlier "hills ≤ 25% of mountains" cap — we're building in the overlap
   (hills ≈ 2, mountains ≈ 8) and the final ratio gets settled by
   screenshot comparison, where your desaturation test is the acceptance
   bar. You may get a screenshot pair to judge.

## Heads-up: one more writing ask coming (not yet!)

The onboarding advisor got its shape ruled: **event hint cards** — the
first city, the first war, the first disorder, ~15 first-time moments, each
with a short friendly advisor line (≤40 words) linking into the
encyclopedia. When the visual frame is built we'd love you to write those
15 voices. No action now — this is a "sharpen your quill" notice.

## And the playtests keep feeding the queue

A second live playtest round landed tonight: a proper envoy popup for
incoming peace offers (so treaties get *considered*, not missed), a
city-overview table, zoom-to-location icons on event messages, road-aware
go-to pathing, and specialist tooltips — the tax collectors and scientists
finally get their own encyclopedia entries.

The test server is running the newest build shortly — same address:
https://multiciv.kjell.today/client/?server=1

— the RetroMultiCiv team
