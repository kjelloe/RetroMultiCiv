# A58 — pedia "complete": the acceptance definition (architect, 2026-07-21)

DONE means, verifiable by a coverage test (the terrain-coverage pattern):
1. Every id in units/buildings/wonders/techs/governments/terrains has a
   pedia entry (blurb or article — the ally sets are the content).
2. The concepts list covers: city management, happiness, disorder,
   corruption, combat+veterans, ZOC, fog, trade routes, specialists (the
   3 new entries), diplomacy states + reputation (D5 vocabulary), space
   race, regency, game codes/saves.
3. Every UI surface that NAMES a catalog item links it (hover-card §22/27
   + panels) — enforced by a grep-style test over the catalog-text paths.
4. Pedia search finds every entry by name.
A coverage test (test/pedia-coverage.test.js) pins 1-2; 3 is reviewed at
the helper item's gate; 4 is a browser.test.js probe. Post-1.0 additions
inherit the test — an unpedia'd item fails the suite.
