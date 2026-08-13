# marker-0116 — v2 ladder + confirmed picks + sync/omissions pass

**Tag:** `marker-0116` at the tip · **merge-consistent — the user may merge
this** (supersedes marker-0115; merge THIS one). Contents beyond 0115, all
documentation/verification-grade:

- The three H2/H3 art picks recorded as user-confirmed (blend V2, forest A,
  houses A — each was the landed provisional; no code change).
- The sync pass: `human-workitems.md` + html twin rewritten from the stale
  pre-v1.0.0 state to the real post-release list; CLAUDE.md renderer module
  list + gallery `?gfx=` param; A106 carries the v2-ladder record; the
  patch plan and spec statuses current; the art-variants skill carries the
  plain-boot measurement rider.
- Omissions found by review and closed:
  1. `gallery.html?vertexcheck=1` now byte-proves the SMOOTH high terrain
     path too (it only guarded the low path) — verified
     positions/colors/smoothPos/smoothCol all true.
  2. The roblox-helper queue item #1 covered only the G0 horse/desert —
     item #2 adds the H1 deer/seal/fish motif re-mirror with the exact
     primitive lists, and notes the high-only tree/dash shapes are
     browser-only (Roblox mirrors low).
  3. The spec's original §1 tier table contradicted the shipped §4b ladder
     — marked superseded, kept for the record.
  4. `terrain.js`'s header still claimed high renders the medium look —
     corrected.

Test state: battery 22/22, low scene re-verified pixel-identical below the
gallery label (the label text changed — the baseline was refreshed for
that line only). Suite count 1063 confirmed current in all pinned docs.
