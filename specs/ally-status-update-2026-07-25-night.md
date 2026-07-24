# Ally status update — 2026-07-25 night (shareable, screenshots attached)

Forward freely; nothing here needs an urgent reply. Two iteration
invitations at the end are yours whenever convenient.

## Since the last update (2026-07-25 daytime)

**Marker-0103 landed** — the river arc closed end-to-end, your tone
and silhouette guidance shipped, and the Roblox intro is approved:

- **Your tone doctrine is live on the Founder's Record endscreen.**
  The fallen capital keeps its OWN glyph, drained of color and
  saturation — no ruins, no destruction iconography. Defeat plays no
  music sting. Space now "sets out for the stars" and "leaves the
  world behind" rather than framing departure as triumph. Conquest
  closes on "The last war is over," with the world slowly brightening
  in over ~2.6 seconds instead of snapping into view. One unifying
  line now sits in the code: the Chronicle exists regardless of
  outcome — every ending is an entry in the same record.
  → `tone-defeat.png`, `tone-conquest.png`, `tone-score.png`,
  `tone-space.png`
- **Specials silhouette iteration, second pass.** Following your
  gallery review (iterate only the beast/game family, keep
  crystal-vs-stone), three changes: Game (forest + tundra) now shows
  a tall dark antler V-fork above the head; Horse rears up on its
  hindquarters instead of standing flat; Seal gets an upturned tail
  flipper for asymmetry against its low head.
  → `specials-row.png`, `specials-beasts.png`, `specials-seal.png`
- **Oasis fixed** — a fresh pair of eyes caught that the desert
  Oasis tree was geometrically a fir/spruce (a solid cone), not a
  palm. Rebuilt as a bare trunk with a spreading frond crown.
  → `oasis-palm.png` (close-up; `specials-row.png` above also shows
  it in context on the map).
- **River, complete.** The twelfth Civ 1 terrain is in and tested in
  both WebGL2 and WebGL1 (the ribbon renders identically on both).
  → `river-ribbon-gallery.png`
- **The Roblox intro is approved — version 1, frozen.** "One City
  Through Time" went through a live iteration round (fade-from-black
  open, era-appropriate buildings, a brief skirmish beat, larger
  title text) and is locked as the shipping cut. It already carries
  your naming: **"A World Begun"** with the subtitle **"Start with
  one city. Build a civilization that lasts."**
- **The in-game reference gets a name**: "Encyclopedia" — plain,
  no franchise or brand collision. Applied browser-side; the Roblox
  side lands the same string shortly.
- **Authentic city rosters**: every civilization's foundable-city
  list was replaced with the dump-accurate Civ 1 founding order (the
  old lists had drifted — e.g. the Romans' second city was wrong).
  Sixteen names per civilization now, purely a naming-accuracy pass.

## Release posture

Marker-0103 is the merge candidate. The engine spine's remaining
item is diplomacy (treaties, reputation, senate, tribute — a
multi-slice arc, in build now). Once that closes, what's left for
v1 is a short build-priority pass for city AI and the Roblox
publish/acceptance session (sound, saving, the accumulated art
batches, and this intro).

## Iteration invitations (whenever convenient)

1. **Tone + silhouette round** — the screenshots above are the
   direct result of your last notes. Say if any ending's weight
   feels off, or if a beast outline (especially the horse — it's
   camera-foreshortened at the gallery's steep isometric angle and
   reads better in motion than the screenshot) wants adjustment.
2. **River look** — first outside opinion on the ribbon rendering;
   open to notes on tint, width, or how it reads against different
   terrain.

One open offer, no action needed: the conquest world-brighten above
is currently a screen-layer fade; a true renderer-level map
brightening is buildable if you'd rather have the actual 3D scene
lighten instead of a CSS overlay.
