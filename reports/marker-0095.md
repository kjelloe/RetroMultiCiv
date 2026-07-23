# marker-0095 — the AI manages unhappiness (MERGE-CONSISTENT)

Tagged at `f854fd6` (2026-07-24, away-window close). **MERGE-CONSISTENT
— supersedes 0094. Current merge candidate** (27th consecutive,
0069–0095). Gates: rehome #2336 + disorder engine-diff #2338 + Gate-B
#2339 (byte-exact) + the disorder-columns sweep PASS #2340.

## What changed (delta since 0094)

1. **XV §11 — the AI disorder playbook (#22)**, built exactly to the
   user's runI §19 recipe: on multi-city disorder (≥2), the empire
   raises LUXURY first — the minimum sustainable step that clears all
   disorder (tax-then-science, science floor 10, government-headroom
   cap), gated on a K=10-turn treasury-sustainability window; the
   entertainer conversion is the combo-residual and stays first for
   single-city disorder. Deferred per the bounded-window ruling:
   government-for-happiness + rush/starve last resorts.
   **Measured: 26% disorder reduction** (disordered city-turns
   1280→805 at prince canonical; 3% at godemperor max-stress; no
   floor regression).
2. **XIV §45b — rehome (#7)** (`b70a38b`): the Civ1-authentic rehome
   command — a unit re-homes to the city it stands in, upkeep shifts;
   legality-gated, evented, cross-language scenario 060.

## Next

Engine queue (6): default-defender §46 → A6a future-tech → A8 tile
contention → pollution-perf remainder → view-contract test →
D3-surfacing → D4–D6 tail. Fresh-session windows ready: deepClone COW
(turnkey handoff), A49 playwright + endgame-moments (helper). The
user-return brief: `reports/away-window-3-brief.md`.
