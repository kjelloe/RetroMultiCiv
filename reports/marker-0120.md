# marker-0120 — cities age with the eras (H10)

**Tag:** `marker-0120` · **merge-consistent — the user may merge this**
(supersedes marker-0119). Client-only, High-gated, Low byte-verified.

H10, built on the user's go the same day it was planned. The fog-honest
era bands (shared/city-era.js) each get a street kit at High:

- **Ancient** — thatch and log roofs only, mud walls, and a village WELL
  (stone ring, posts, thatch cap) at every non-capital center.
- **Classical/Medieval** — the full H9 roof rotation with TIMBER-FRAME
  walls alternating along the outer ring.
- **Industrial** — tar roofs, warehouse proportions on every third outer
  house, street lamps at the doors, and window panes switched to the lit
  material.
- **Modern/Space** — lit panes and lamps, antennas on two-storey roofs,
  tilted solar panels on slabs, and the capital's LANDING PAD with an H
  marking at the city edge.

No engine/state/protocol change — the band id already reached the city
builder; fog-honesty is inherited (a rival city under fog still reads
ancient). Deferred detail: classical banner poles. Intensity pick A
"full kit" of 3, user-confirmed (`debugging/h10-eras-a/b/c.png`).

Test state: battery 22/22 (render-spec regenerated for the era-kit
geometries), graphics-levels.spec 3/3, Low byte-identical.
