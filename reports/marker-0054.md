# marker-0054 — the N10 seam bundle (golden-neutral)

The two client seams endorsed at marker-0052 land in the engine:

1. **Event field finalization:** tradeRouteEstablished carries
   `cityId` (was homeCityId in the draft) and `gold`/`bulbs` (the
   bugfixer's endorsed veto of `cash` for engine-wide naming
   consistency). Events aren't hashed — scenarios 031-034 re-verified
   byte-identical on both engines.
2. **tradeRouteReport export** (engine/trade.js + twin): the
   anti-drift seam — `[{ partnerCityId, arrows, counted }]` in state
   order, arrows = the live per-route contribution under the R1
   base-arrows rule, counted = the top routeCap by contribution with
   the low-id tiebreak, dead partners report zero/uncounted. A pure
   derived read; the browser city panel and the Roblox tooltip both
   probe for it and show per-route arrow numbers now that it exists —
   neither client ever re-derives ranking math.

Twin fidelity note: the report reuses the contribution/sort/cap path
scenario 034 already pins cross-language; no separate golden needed.
Test row covers state order, exact cap count, counted-sum ==
routeArrows, the tie-broken exclusion, and the route-less empty case.

Suite 525/525; pins synced. Also in the span: the gaming-PC train
advanced to 4 commits on the marker-0053 lineage (batches 2-4 + the
0052 re-bake trio) awaiting the user's push, and roblox batch 5
closed (end screen, historian, advice cards, CP17 client half) with
two design proposals ruled separately (SO8 stats sampling, the
spectate slice). Next in the game stream: N11 field
upgrades/Leonardo.
