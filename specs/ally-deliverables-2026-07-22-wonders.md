# Ally deliverables 2026-07-22 (second reply) — the wonder-personality mapping

Captured verbatim from the designer ally. This SUPERSEDES the 3-class
effect default in specs/archetype-wonders.md — the archetype slice
builds from THIS table. Mappings are effect-driven against authentic
Civ1 effects, so they hold unchanged when the A7 straggler effects land.

## The mapping (primary / secondary / never-prioritize-unless)

| Wonder | Primary | Secondary | Never prioritize unless… |
|---|---|---|---|
| Pyramids | Builder | Steward | — |
| Great Wall | Conqueror | Steward | at war or high barb pressure; obsoletes early — late builders skip |
| Colossus | Explorer | Industrialist | city coastal + trade-rich; skip if landlocked capital |
| Lighthouse | Explorer | Diplomat | has/building naval; skip if no coastline |
| Hanging Gardens | Steward | Builder | any city in/near disorder; universally safe second pick |
| Oracle | Diplomat | Steward | temples built or queued; skip without temple investment |
| Great Library | Scientist | Diplomat | behind in tech; skip if leading research |
| Copernicus' Observatory | Scientist | Visionary | has a high-science host city |
| Magellan's Expedition | Explorer | Conqueror | active naval presence; skip if landlocked/no naval strategy |
| Michelangelo's Chapel | Steward | Diplomat | systemic multi-city happiness problem; strongest happiness wonder |
| J.S. Bach's Cathedral | Diplomat | Steward | wide disorder-prone empire; never obsoletes — safe late |
| Leonardo's Workshop | Industrialist | Conqueror | large standing army needing upgrades; skip if small/modern military |
| Shakespeare's Theatre | Builder | Steward | one large high-pop anchor city; effect is LOCAL |
| Isaac Newton's College | Scientist | Visionary | strong science host city |
| Darwin's Voyage | Scientist | Explorer | behind in tech or nearing the space branch |
| Women's Suffrage | Steward | Diplomat | large army under republic/democracy; skip under despotism/monarchy |
| Hoover Dam | Industrialist | Builder | multiple same-continent cities needing power; skip small/island empires |
| Manhattan Project | Conqueror | — | GLOBAL UNLOCK — never a strategic goal; only if production-leading AND pursuing deterrence/strike; opens nukes for ALL civs |
| United Nations | Diplomat | Steward | strong reputation + active treaties; the UN amplifies standing, never repairs it |
| Apollo Program | Visionary | Scientist | GLOBAL UNLOCK — only when committed to the Space Race; else it gifts the path to rivals |
| SETI Program | Scientist | Visionary | strong late science infrastructure; pairs with Newton/Darwin |
| Cure for Cancer | Steward | Diplomat | late-game empire-wide happiness pressure; universally safe wide-empire pick |

## Cross-cutting rules (adopted as build constraints)

1. **Global unlocks (Manhattan, Apollo)**: the never-unless clause is
   the PRIMARY constraint — deliberate project builds, never prestige/
   opportunistic (a premature Apollo gifts the path to rivals).
2. **Obsolescence-aware appetite**: wonders that obsolete (Pyramids,
   Great Wall, Oracle, Michelangelo's, Leonardo's) decay in appetite as
   their obsoleteBy tech nears — a Builder racing Pyramids early is
   rational; starting them at Renaissance is not.
3. **Effect-driven stability**: when A7 straggler effects land, the
   mapping holds without revision.

## The stance bridge (ally's, adopted)

Builder→builder · Steward→growth · Scientist→science · Visionary→
science-late-biased (distinguish by tech-branch depth) · Conqueror→
aggressive · Industrialist→builder-production-weighted · Explorer→
balanced+naval-wonder affinity · Diplomat→balanced+happiness/global
affinity. The ally's stated preference: carry Explorer/Diplomat nuance
through PER-LEADER PERSONALITY BIASES (the A59 system) rather than
affinity flags if possible — "that is the cleaner solution"; the
bugfixer's pre-open grounds which is honest in our engine.
