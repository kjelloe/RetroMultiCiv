# marker-0122 — sync + omissions pass after H11

**Tag:** `marker-0122` · **merge-consistent — the user may merge this**
(supersedes marker-0121; merge THIS one). Documentation/guard-grade only,
plus one new playwright test.

Omissions the review found, all closed:

1. **Medium's WebGL1 path was unverified after the R15 promotion** — the
   promotion changed every Medium unit body. Re-shot and byte-identical.
2. **The budget numbers were stale** — H6–H11 grew both upper tiers.
   Re-measured on the plain boot: low 9,600 tris/24 calls → medium
   135,640/67 → high 149,043/63 (~20× headroom under the 3M ceiling);
   recorded beside the originals in the spec.
3. **The `?gfx=` link feature had no guard** — a new spec test proves it
   pre-selects, persists, and canonicalizes out of the URL (lane 4/4).
4. **The spec cited untracked third-party images as if durable** —
   `helmets.png` and the Transport World screenshot are user-provided,
   deliberately untracked (not for the MIT repo), and now labeled so.
5. **Workitems drift** — the stray A3b remnant removed, A3 = the
   playtest.md pass in both twins, a swallowed section header restored.
6. **The camera-facing lesson entered the skill** — it bit twice
   (facades, then wonder anchors); the art-variants skill now says:
   anchor detail on the south rim and review from the play angle.

Also synced: CLAUDE.md play-params gain `?gfx=`, A106 carries the full
H6–H11 record, the patch plan points at marker-0121+. Suite count 1063
verified current everywhere.
