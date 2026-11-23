#!/usr/bin/env bash
# roblox/ lane self-test (roblox-helper, SPEC.md §4). Headless gates only —
# Luau execution is provable only in Studio (Play Solo output).
#   1. rojo build green from the current tree
#   2. built place contains every mapped instance
#   3. anchor literals in VerifyAnchors.server.luau match the canonical
#      goldens in test/ (drift check; test/ is consumed read-only)
set -u
cd "$(dirname "$0")/.."
command -v rojo >/dev/null 2>&1 || PATH="$HOME/.local/bin:$PATH"

fail=0
note() { printf '%s %s\n' "$1" "$2"; [ "$1" = "FAIL" ] && fail=1; }

# gate 1 — build
out=$(mktemp /tmp/rmc-build-XXXXXX.rbxlx)
if rojo build roblox -o "$out" >/dev/null 2>&1; then
  note PASS "gate 1: rojo build roblox"
else
  note FAIL "gate 1: rojo build roblox (rerun without -o to see the error)"
fi

# gate 2 — mapped instances present in the built place
for name in VerifyAnchors GameServer RetroMultiCiv Shared RetroMultiCivClient GameData TerrainPalette RulesetHashes rulesets Camera Select ClientState ViewRenderer Hud CityPanel Possess TurnLog ActionBar ResearchPicker MoveHints Options VoidCover CityList Statistics OddsPreview AssetFactory AssetRecipes GalleryGrid GovernmentPanel Deck Lobby SaveStore RidePad GoToPlan StepLegality WorkedTiles CatalogText pathfind fastforward spaceship ReplayTheater Pedia PediaConcepts Legend BuildQueue Ship DiscoveryCard Minimap Tooltip Palette EndScreen score Historian AdviceCards DebugMenu SettlerAuto strategic Strategic FastForward Beeline TechTree PediaBlurbs Diplomacy DiplomacyView WaitStatus TurnLogClasses RegentDialog TileProps TechGlyphs SoundMap CityNames FoundCity LabelDeclutter UiTheme MenuIcons TerrainSculpt TerrainSkirts Diag DiagAudit DiagServer UiText DockLayout HudDock TerrainCoast UiPanel PanelDress DevAccess HudGate DeckPlan LeftStack TechTreeLayout CivGallery TechInfo LegendData TurnLogView StatsView CatalogInfo MilitaryView Military TourPlan UiTour TopRowPlan BadgeRules BadgeTrack BadgeIds BadgeAward StructureModels StructureBuilder PediaArt PediaPicture TileHeight StructureCatalog BuildingModels EmblemModels CivEmblems WonderScene WonderStage DiscoveryView CityView EmpireView BarFit UnitOrders; do
  if grep -q "$name" "$out" 2>/dev/null; then
    note PASS "gate 2: $name in built place"
  else
    note FAIL "gate 2: $name missing from built place"
  fi
done
rm -f "$out"

# gate 3 — anchor literals must match the canonical goldens (docs/09 §1)
va=roblox/src/server/VerifyAnchors.server.luau
seq=$(grep -o 'GOLDEN = \[[0-9, ]*\]' test/rng.test.js | grep -o '[0-9][0-9, ]*[0-9]')
if [ -n "$seq" ] && grep -qF "$seq" "$va"; then
  note PASS "gate 3: xorshift sequence matches test/rng.test.js ($seq)"
else
  note FAIL "gate 3: xorshift sequence drifted from test/rng.test.js"
fi
for anchor in 0x30db1e29 0xa687b72d AD1X-Q5MR-DP7H9; do
  if grep -qF "$anchor" "$va" && grep -rqF "$anchor" test/gamecode.test.js test/statehash.test.js 2>/dev/null; then
    note PASS "gate 3: $anchor present in gate and test/"
  else
    note FAIL "gate 3: $anchor drifted (gate vs test/)"
  fi
done

# gate 4 — generated Luau data matches its JS/JSON sources (R2 converter)
if command -v node >/dev/null 2>&1; then
  if node roblox/data/build.js --check >/dev/null 2>&1; then
    note PASS "gate 4: generated data matches sources (build.js --check)"
  else
    note FAIL "gate 4: generated data drifted — rerun: node roblox/data/build.js"
  fi
else
  note SKIP "gate 4: node absent"
fi

# gate 6 — no client script binds a platform-reserved KeyCode (SPEC §4;
# F9 = Developer Console collision found live at runC)
if grep -rnE 'KeyCode\.(F9|F12|Escape)\b' roblox/src/client/ >/dev/null 2>&1; then
  note FAIL "gate 6: platform-reserved KeyCode bound in src/client (F9/F12/Escape)"
else
  note PASS "gate 6: no platform-reserved KeyCodes bound"
fi

# gate 5 — R8 recipe keys: every units.json id resolves through
# unitSilhouette to a real recipe (the ally's check-asset-sync idea)
if command -v node >/dev/null 2>&1; then
  if node roblox/data/build.js --keys >/dev/null 2>&1; then
    note PASS "gate 5: recipe keys cover units.json (build.js --keys)"
  else
    note FAIL "gate 5: recipe keys broken — run: node roblox/data/build.js --keys"
  fi
else
  note SKIP "gate 5: node absent"
fi

# gate 7 — StepLegality pinned verdicts run headlessly (the one-source
# tile-entry module behind ride keys, click-move, GoTo, MoveHints)
command -v lune >/dev/null 2>&1 || PATH="$HOME/.local/bin:$PATH"
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/steplegality.luau >/dev/null 2>&1; then
    note PASS "gate 7: StepLegality pinned verdicts (lune)"
  else
    note FAIL "gate 7: StepLegality verdicts drifted — run: lune run roblox/selftest/steplegality.luau"
  fi
else
  note SKIP "gate 7: lune absent"
fi

# gate 9 — fastforward twin parity (architect grant @0acb4ef4 condition c):
# JS and luau fast-forward the same seed+probe-age; the printed hash lines
# must be byte-identical
if command -v node >/dev/null 2>&1 && command -v lune >/dev/null 2>&1; then
  ffjs=$(node roblox/selftest/fastforward-parity.mjs 2>/dev/null)
  fflu=$(lune run roblox/selftest/fastforward-parity.luau 2>/dev/null)
  if [ -n "$ffjs" ] && [ "$ffjs" = "$fflu" ]; then
    note PASS "gate 9: fastforward JS==luau ($ffjs)"
  else
    note FAIL "gate 9: fastforward parity split (js='$ffjs' luau='$fflu')"
  fi
else
  note SKIP "gate 9: node or lune absent"
fi

# gate 10 — palette coverage: the deuteranopia table in Palette.luau must
# map every civs.json color + visual.primary (browser test/palette.test.js
# twin; a civ recolor / hex typo would silently un-remap a civ)
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/palette-coverage.mjs >/dev/null 2>&1; then
    note PASS "gate 10: palette covers all civ colors"
  else
    note FAIL "gate 10: palette coverage — run: node roblox/selftest/palette-coverage.mjs"
  fi
else
  note SKIP "gate 10: node absent"
fi

# gate 8 — billboard-input lint: a button parented into a BillboardGui must
# set <bb>.Active = true (the session-E 'CLOSE does nothing' class of bug)
if command -v node >/dev/null 2>&1; then
  if node roblox/lint.js >/dev/null 2>&1; then
    note PASS "gate 8: billboard-button Active lint (lint.js)"
  else
    note FAIL "gate 8: billboard-button lint — run: node roblox/lint.js"
  fi
else
  note SKIP "gate 8: node absent"
fi

# gate 11 — tech-blurbs parity: DiscoveryCard.client.luau TECH_BLURBS must be
# a 1:1 port of the browser client/ui/tech-blurbs.js (ally §B1 authoring
# source); id-set + string equality so the two can't drift silently
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/tech-blurbs-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 11: tech-blurbs match browser source"
  else
    note FAIL "gate 11: tech-blurbs parity — run: node roblox/selftest/tech-blurbs-parity.mjs"
  fi
else
  note SKIP "gate 11: node absent"
fi

# gate 12 — city-era parity: the ViewRenderer progressive city model (run-F #8)
# must use the SHARED shared/city-era.js band contract — BAND_STYLE keys ==
# CITY_ERA_BANDS + ERA_TO_BAND covers every engine era; no Roblox-invented bands
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/city-era-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 12: city-era bands match shared contract"
  else
    note FAIL "gate 12: city-era parity — run: node roblox/selftest/city-era-parity.mjs"
  fi
else
  note SKIP "gate 12: node absent"
fi

# gate 13 — improvement render coverage: every tile improvement flag the
# filterView twin emits (run-F #5) must be drawn by ViewRenderer, so a new
# improvement in the twin can't render invisibly
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/improvement-coverage.mjs >/dev/null 2>&1; then
    note PASS "gate 13: tile improvements all drawn"
  else
    note FAIL "gate 13: improvement coverage — run: node roblox/selftest/improvement-coverage.mjs"
  fi
else
  note SKIP "gate 13: node absent"
fi

# gate 14 — pedia-concepts parity: the PediaConcepts.luau concept set is a port
# of client/ui/pedia-concepts.js — id-set + body equality (bodies normalized for
# the em-dash->hyphen transliteration; the recordings body is an allowed
# platform divergence), so a new concept or a reworded line can't drift
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/pedia-concepts-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 14: pedia concepts match browser source"
  else
    note FAIL "gate 14: pedia-concepts parity — run: node roblox/selftest/pedia-concepts-parity.mjs"
  fi
else
  note SKIP "gate 14: node absent"
fi

# gate 15 — beeline parity: the Roblox client Beeline.luau (#1726 §2 tech-tree
# beeline) must produce byte-identical steps to shared/beeline.js over every
# tech goal from empty-known (node + lune, self-skips without either)
if command -v node >/dev/null 2>&1 && command -v lune >/dev/null 2>&1; then
  bjs=$(node roblox/selftest/beeline-parity.mjs 2>/dev/null)
  blu=$(lune run roblox/selftest/beeline-parity.luau 2>/dev/null)
  if [ -n "$bjs" ] && [ "$bjs" = "$blu" ]; then
    note PASS "gate 15: beeline JS==luau ($(printf '%s' "$bjs" | grep -c '=') goals)"
  else
    note FAIL "gate 15: beeline parity split — run: diff <(node roblox/selftest/beeline-parity.mjs) <(lune run roblox/selftest/beeline-parity.luau)"
  fi
else
  note SKIP "gate 15: node or lune absent"
fi

# gate 16 — pedia-blurbs parity: PediaBlurbs.luau unit/building blurbs are a
# verbatim port of the committed ally source md AND cover every ruleset unit
# (minus barbleader) + building (run-F #9)
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/pedia-blurbs-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 16: pedia unit/building blurbs match source + cover rulesets"
  else
    note FAIL "gate 16: pedia-blurbs parity — run: node roblox/selftest/pedia-blurbs-parity.mjs"
  fi
else
  note SKIP "gate 16: node absent"
fi

# gate 17 — diplomacy-turnlog parity (D3, #1878): TurnLog.client.luau diplomacyRow
# is a 1:1 port of shared/diplomacy-view.js diplomacyEventRow (WAR_DECLARED/
# PEACE_TREATY_SIGNED/TREATY_BROKEN) + view-derived first-contact mirrors
# client/ui/turnlog.js scanContacts. A reword on either side fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/diplomacy-turnlog-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 17: diplomacy turnlog matches browser diplomacyEventRow/scanContacts"
  else
    note FAIL "gate 17: diplomacy-turnlog parity — run: node roblox/selftest/diplomacy-turnlog-parity.mjs"
  fi
else
  note SKIP "gate 17: node absent"
fi

# gate 18 — brick/Studded world style (XIV §15): BRICK_MATERIAL covers every
# terrain the enhanced style does (parity, no silent fallback), explicit brick
# branch everywhere `look` is read (no fall-through to retro), player-facing
# "Studded" label, and no trademarked naming.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/brick-coverage.mjs >/dev/null 2>&1; then
    note PASS "gate 18: brick/Studded style covers terrain + explicit branches + no trademark"
  else
    note FAIL "gate 18: brick-coverage — run: node roblox/selftest/brick-coverage.mjs"
  fi
else
  note SKIP "gate 18: node absent"
fi

# gate 19 — D3 Tier-B diplomacy panel: DiplomacyView.luau relationLabel is a 1:1
# port of shared/diplomacy-view.js relationLabel (peace/war/perpetual/expiry) +
# the Foreign-relations panel reads the twin-exposed view.relations. A reword on
# either side fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/diplomacy-panel-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 19: diplomacy panel relationLabel matches shared/diplomacy-view.js"
  else
    note FAIL "gate 19: diplomacy-panel parity — run: node roblox/selftest/diplomacy-panel-parity.mjs"
  fi
else
  note SKIP "gate 19: node absent"
fi

# gate 20 — Tier-3 wait-status: WaitStatus.luau is a 1:1 port of
# client/ui/wait-status.js (A26 createWaitTracker + formatWait/formatSlowNote) and
# the HUD line reads the filtered view. Format fragments + tracker semantics are
# derived from the browser source; a reword on either side fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/wait-status-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 20: wait-status matches client/ui/wait-status.js"
  else
    note FAIL "gate 20: wait-status parity — run: node roblox/selftest/wait-status-parity.mjs"
  fi
else
  note SKIP "gate 20: node absent"
fi

# gate 21 — CP13 government switching: the GovernmentPanel switch row mirrors
# client/ui/panels.js's gov-row (skip anarchy + current, tech-gate the rest,
# revolution countdown) + issues setGovernment; the engine reject-reason contract
# the client relies on stays intact. A reword either side / contract drift fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/government-switch-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 21: government switching mirrors client/ui/panels.js gov-row"
  else
    note FAIL "gate 21: government-switch parity — run: node roblox/selftest/government-switch-parity.mjs"
  fi
else
  note SKIP "gate 21: node absent"
fi

# gate 22 — SO6 turn-log class filters: TurnLogClasses.luau is a 1:1 port of
# client/ui/turnlog-classes.js (LOG_CLASSES + classifyEvent), and TurnLog.client
# wires the filter strip. The browser classifyEvent is driven over a
# representative event per class; a reword either side fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/turnlog-classes-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 22: turn-log classes match client/ui/turnlog-classes.js"
  else
    note FAIL "gate 22: turnlog-classes parity — run: node roblox/selftest/turnlog-classes-parity.mjs"
  fi
else
  note SKIP "gate 22: node absent"
fi

# gate 23 — MP4 regent stance-select: RegentDialog offers the regency.js STANCES,
# the arm message carries the stance, and the GameServer feeds it to pickCommand
# (whose 5th stance param both engine twins already accept — no engine change).
# A reword on either side, or a broken stance-wire, fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/regent-stance-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 23: regent stance-select wired client→GameServer→pickCommand"
  else
    note FAIL "gate 23: regent-stance parity — run: node roblox/selftest/regent-stance-parity.mjs"
  fi
else
  note SKIP "gate 23: node absent"
fi

# gate 24 — SO8 battles/wonders timelines: the GameServer accumulates world-public
# battles (combatResolved) + wonders (wonderBuilt) the same way client/ui/stats-data.js
# does, pushes them on {t=stats}, and Statistics.client renders them. Reword either
# side / broken wire fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/stats-timeline-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 24: stats battles/wonders mirror client/ui/stats-data.js"
  else
    note FAIL "gate 24: stats-timeline parity — run: node roblox/selftest/stats-timeline-parity.mjs"
  fi
else
  note SKIP "gate 24: node absent"
fi

# gate 25 — CP1 tile props: TileProps.luau mirrors client/renderer/three/props.js
# (PROP_SHAPES recipe key-for-key, visualRand, the terrain-feature branches) and
# ViewRenderer wires TileProps.rebuild. Reword either side / broken wire fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/tile-props-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 25: tile props mirror client/renderer/three/props.js"
  else
    note FAIL "gate 25: tile-props parity — run: node roblox/selftest/tile-props-parity.mjs"
  fi
else
  note SKIP "gate 25: node absent"
fi

# gate 26 — XII.6 glyphs (fallback b, #2078 item 5): TechGlyphs.luau ships the 4
# ERA FRAMES only (EditableImage motif path is Studio-runtime-gated); its era
# palette must match client/ui/tech-glyphs.js hex-for-hex and be wired into the
# research picker, discovery card, and tech tree. Colour drift / broken wire fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/tech-glyphs-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 26: tech-glyph era palette matches client/ui/tech-glyphs.js"
  else
    note FAIL "gate 26: tech-glyphs parity — run: node roblox/selftest/tech-glyphs-parity.mjs"
  fi
else
  note SKIP "gate 26: node absent"
fi

# gate 27 — SO15 sound: SoundMap.luau is the pure twin of client/ui/sound-map.js
# (same SOUND_IDS catalogue + viewer-relative decisions), consumed by Sound.client
# via onEvents. SoundIds themselves are provisional (user-curated). Cue drift /
# dropped mapping / broken wire fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/sound-map-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 27: sound cue map mirrors client/ui/sound-map.js"
  else
    note FAIL "gate 27: sound-map parity — run: node roblox/selftest/sound-map-parity.mjs"
  fi
else
  note SKIP "gate 27: node absent"
fi

# gate 28 — SO6 jump-to: a located turn-log entry earns a ⌖ button that centres
# the camera on its tile (the browser turnlog.js centerOn twin — locOf resolves
# e.x/e.y or the city, ClientState.focusCamera does the centring). Broken wire fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/turnlog-jumpto-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 28: turn-log jump-to mirrors client/ui/turnlog.js centerOn"
  else
    note FAIL "gate 28: turnlog jump-to parity — run: node roblox/selftest/turnlog-jumpto-parity.mjs"
  fi
else
  note SKIP "gate 28: node absent"
fi

# gate 29 — MP4 regent narration: the seat owner's turn log narrates what the
# armed regent did (the browser turnlog.js regentTurn audit line). GameServer
# emits the tally (byType/research/production) on the synthetic regentTurn event
# and TurnLog narrates the same bits, own-seat only. Dropped bit / tally fails.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/regent-narration-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 29: regent narration mirrors client/ui/turnlog.js regentTurn"
  else
    note FAIL "gate 29: regent-narration parity — run: node roblox/selftest/regent-narration-parity.mjs"
  fi
else
  note SKIP "gate 29: node absent"
fi

# gate 30 — R6 seat registry bridge-compat hook (specs/r6-roblox-multiplayer.md):
# GameServer keeps an internal seatMeta[pid].seatCode (24-hex, browser
# randomBytes(12).hex shape) as the future cross-play bridge token. It must be
# GENERATED server-side and NEVER surfaced — no client module may reference it.
gs="roblox/src/server/GameServer.server.luau"
if grep -q "seatMeta" "$gs" && grep -q "newSeatCode" "$gs" && grep -q "seatCode" "$gs"; then
  if grep -rq "seatCode" roblox/src/client/ 2>/dev/null; then
    note FAIL "gate 30: seatCode LEAKED to a client module (must stay server-internal)"
  else
    note PASS "gate 30: R6 seat registry bridge-hook present + never client-surfaced"
  fi
else
  note FAIL "gate 30: R6 seatMeta/newSeatCode/seatCode hook missing from GameServer"
fi

# gate 31 — SO18 tech glyphs: GlyphData.luau GLYPH is a 1:1 port of the browser
# client/ui/tech-glyphs.js GLYPH (all 68 tech ids match) AND every primitive kind
# GlyphData uses is handled by EditableGlyph.luau. Render fidelity is the Studio
# step (SPEC.md §4); this pins the headless data/coverage contract.
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/glyph-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 31: tech glyphs match browser GLYPH (68) + primitive coverage"
  else
    note FAIL "gate 31: glyph parity — run: node roblox/selftest/glyph-parity.mjs"
  fi
else
  note SKIP "gate 31: node absent"
fi

# gate 32 — city mood row: the Roblox city panel lists the same mood-wonder
# effect keys as client/ui/panels.js MOOD_WONDER_EFFECTS and calls the shared
# happiness.cityMood (no reimplemented mood math).
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/city-mood-parity.mjs >/dev/null 2>&1; then
    note PASS "gate 32: city mood row matches panels.js MOOD_WONDER_EFFECTS"
  else
    note FAIL "gate 32: city-mood parity — run: node roblox/selftest/city-mood-parity.mjs"
  fi
else
  note SKIP "gate 32: node absent"
fi

# gate 33 — F1 city naming: the name suggestion + typed-name cleanup pins
# (lune), every client foundCity send goes through the FoundCity prompt, and
# the server filters the typed name (TextService) before the engine sees it.
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/city-names.luau >/dev/null 2>&1 \
     && [ "$(grep -l 'type = "foundCity"' roblox/src/client/*.luau | tr '\n' ' ')" = "roblox/src/client/FoundCity.luau " ] \
     && grep -q 'FilterStringAsync' roblox/src/server/GameServer.server.luau \
     && grep -q 'filteredCityName(player, msg.cmd.name' roblox/src/server/GameServer.server.luau; then
    note PASS "gate 33: city-name pins (lune) + single prompt send site + server text filter"
  else
    note FAIL "gate 33: city naming — run: lune run roblox/selftest/city-names.luau; foundCity must be sent only by FoundCity.luau and filtered in GameServer"
  fi
else
  note SKIP "gate 33: lune absent"
fi

# gate 34 — F2 label collision: LabelDeclutter.pick pinned verdicts (lune) and
# ViewRenderer still routes both label kinds through it.
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/label-declutter.luau >/dev/null 2>&1 \
     && grep -q 'LabelDeclutter.pick(items)' roblox/src/client/ViewRenderer.client.luau; then
    note PASS "gate 34: label declutter pinned verdicts (lune) + ViewRenderer wiring"
  else
    note FAIL "gate 34: label declutter — run: lune run roblox/selftest/label-declutter.luau"
  fi
else
  note SKIP "gate 34: lune absent"
fi

# gate 35 — U1 menu icons: MenuIcons data contract (known kinds, in-box
# coordinates), every kind drawable by EditableGlyph, every icon id used by a
# client script present (lune).
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/menu-icons.luau >/dev/null 2>&1; then
    note PASS "gate 35: menu icons data contract + used ids present (lune)"
  else
    note FAIL "gate 35: menu icons — run: lune run roblox/selftest/menu-icons.luau"
  fi
else
  note SKIP "gate 35: lune absent"
fi

# gate 36 — T1 terrain sculpt: the massif/mound planner is deterministic,
# stays inside its tile, fits each snow cap to its cone, uses only existing
# PROP_SHAPES keys, and holds its part budget (lune); TileProps still calls it.
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/terrain-sculpt.luau >/dev/null 2>&1 \
     && grep -q 'TerrainSculpt.mountain' roblox/src/client/TileProps.luau; then
    note PASS "gate 36: terrain sculpt planner pins (lune) + TileProps wiring"
  else
    note FAIL "gate 36: terrain sculpt — run: lune run roblox/selftest/terrain-sculpt.luau"
  fi
else
  note SKIP "gate 36: lune absent"
fi

# gate 37 — T2 slope skirts: which edges get a wedge (step threshold, fog,
# map edge, wrap) and the per-tile cache key (lune); ViewRenderer still calls it.
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/terrain-skirts.luau >/dev/null 2>&1 \
     && grep -q 'TerrainSkirts.update' roblox/src/client/ViewRenderer.client.luau \
     && grep -q 'M.turnsFor(apex.x, apex.z, -c.cx, -c.cy)' roblox/src/client/TerrainSkirts.luau \
     && grep -q 'corner wedge apex not measurable' roblox/src/client/TerrainSkirts.luau; then
    note PASS "gate 37: slope-skirt edge + corner-fill pins (lune) + ViewRenderer wiring"
  else
    note FAIL "gate 37: slope skirts — run: lune run roblox/selftest/terrain-skirts.luau"
  fi
else
  note SKIP "gate 37: lune absent"
fi

# gate 38 — diagnostics: Diag's tagged failure record (lune); the audit's
# ScreenGui lists equal what the client creates and tools/studio-log.js
# parses the Studio log shape (node); the fallback paths still report.
if command -v lune >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  if lune run roblox/selftest/diag.luau >/dev/null 2>&1 \
     && node roblox/selftest/diag-coverage.mjs >/dev/null 2>&1 \
     && grep -q 'Diag.fail' roblox/src/client/UiTheme.luau \
     && grep -q 'Diag.fail' roblox/src/client/EditableGlyph.luau \
     && grep -q 'Diag.fail' roblox/src/client/TileProps.luau \
     && grep -q 'Diag.fail' roblox/src/client/HudDock.luau; then
    note PASS "gate 38: diagnostics record (lune) + audit gui list + studio-log parser (node)"
  else
    note FAIL "gate 38: diagnostics — run: lune run roblox/selftest/diag.luau; node roblox/selftest/diag-coverage.mjs"
  fi
else
  note SKIP "gate 38: lune or node absent"
fi

# gate 39 — U3 top-row planner (no overlap, hidden members close up, compact
# and wrap on narrow viewports) + the touch label rule (lune); the five menu
# buttons and the clock are registered with the dock.
if command -v lune >/dev/null 2>&1; then
  docked=$(grep -l 'HudDock")).register' roblox/src/client/*.client.luau | wc -l)
  if lune run roblox/selftest/ui-dock.luau >/dev/null 2>&1 && [ "$docked" -eq 5 ]; then
    note PASS "gate 39: top-row dock planner + touch label pins (lune), 5 scripts docked"
  else
    note FAIL "gate 39: top-row dock — run: lune run roblox/selftest/ui-dock.luau (docked scripts: $docked, want 5)"
  fi
else
  note SKIP "gate 39: lune absent"
fi

# gate 40 — every Luau source compiles (rojo build does not parse scripts)
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/syntax.luau >/dev/null 2>&1; then
    note PASS "gate 40: all roblox/src Luau sources compile (lune)"
  else
    note FAIL "gate 40: syntax — run: lune run roblox/selftest/syntax.luau"
  fi
else
  note SKIP "gate 40: lune absent"
fi

# gate 41 — T3 sand coasts: which land edges get a rim (ocean neighbour only,
# no cliffs/ice, fog, wrap) and the cache key (lune); ViewRenderer calls it.
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/terrain-coast.luau >/dev/null 2>&1 \
     && grep -q 'TerrainCoast.update' roblox/src/client/ViewRenderer.client.luau; then
    note PASS "gate 41: sand-coast edge pins (lune) + ViewRenderer wiring"
  else
    note FAIL "gate 41: sand coasts — run: lune run roblox/selftest/terrain-coast.luau"
  fi
else
  note SKIP "gate 41: lune absent"
fi

# gate 42 — panel fit (UiPanel): screen scale, anchor-preserving placement,
# cut-to-fit on a phone; PanelDress is the only applier
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/ui-panel.luau >/dev/null 2>&1 \
     && grep -q 'UiPanel.place' roblox/src/client/PanelDress.client.luau \
     && grep -q '^function M.row' roblox/src/client/UiTheme.luau \
     && grep -q '\.row(row' roblox/src/client/CityList.client.luau \
     && grep -q '\.row(row' roblox/src/client/ResearchPicker.client.luau \
     && grep -q '\.row(row' roblox/src/client/CityPanel.client.luau \
     && grep -q 'local function addSection' roblox/src/client/CityPanel.client.luau \
     && grep -q 'prodCard.Name = "Production"' roblox/src/client/CityPanel.client.luau \
     && ! grep -qE 'Enum.Font.(Code|SourceSans)' roblox/src/client/CityPanel.client.luau \
     && ! grep -qE 'TextSize = (9|1[0-3])$' roblox/src/client/CityPanel.client.luau roblox/src/client/CityList.client.luau roblox/src/client/TurnLog.client.luau roblox/src/client/Options.client.luau; then
    note PASS "gate 42: panel fit pins (lune) + PanelDress wiring"
  else
    note FAIL "gate 42: panel fit — run: lune run roblox/selftest/ui-panel.luau"
  fi
else
  note SKIP "gate 42: lune absent"
fi

# gate 43 — observation deck plan (DeckPlan): five stations inside the floor,
# each with a title + explanation, a status line for every phase; Deck.luau
# builds from it and keeps the instance names GameServer / Possess read
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/deck-plan.luau >/dev/null 2>&1 \
     && grep -q 'DeckPlan.status' roblox/src/server/Deck.luau \
     && grep -q 'spawnLoc.Name = "DeckSpawn"' roblox/src/server/Deck.luau \
     && grep -q '"Floor"' roblox/src/server/Deck.luau; then
    note PASS "gate 43: deck plan pins (lune) + Deck.luau contract names"
  else
    note FAIL "gate 43: deck plan — run: lune run roblox/selftest/deck-plan.luau"
  fi
else
  note SKIP "gate 43: lune absent"
fi

# gate 44 — tech tree graph (TechTreeLayout): every tech placed in its level's
# column, prerequisites to the left, no overlapping boxes, one elbow line per
# link with its vertical run in the column gap; TechTree.client draws from it
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/techtree-layout.luau >/dev/null 2>&1 \
     && grep -q 'Layout.layout(techs)' roblox/src/client/TechTree.client.luau \
     && grep -q 'ApplyStrokeMode.Border' roblox/src/client/TechTree.client.luau; then
    note PASS "gate 44: tech tree graph layout pins (lune) + TechTree wiring"
  else
    note FAIL "gate 44: tech tree graph — run: lune run roblox/selftest/techtree-layout.luau"
  fi
else
  note SKIP "gate 44: lune absent"
fi

# gate 45 — run-S wiring pins (grep): civilization pick end to end (gallery ->
# pickCiv -> roster swap, printed in [R4INIT]'s civ list), a close X on every
# click-opened panel, the tech tree hover card
if grep -q 'msg.t == "pickCiv"' roblox/src/server/GameServer.server.luau \
   && grep -q 'roster\[i\], roster\[j\] = roster\[j\], roster\[i\]' roblox/src/server/GameServer.server.luau \
   && grep -q 't = "pickCiv"' roblox/src/client/Lobby.client.luau \
   && grep -q '"random"' roblox/src/client/CivGallery.luau \
   && grep -q 'PanelClose' roblox/src/client/PanelDress.client.luau \
   && grep -q 'CloseByEnabled' roblox/src/client/CityList.client.luau \
   && grep -q 'Tooltip.attach(btn' roblox/src/client/TechTree.client.luau \
   && grep -q 'TechInfo.card' roblox/src/client/TechTree.client.luau \
   && grep -q 'TechInfo.card' roblox/src/client/ResearchPicker.client.luau \
   && grep -q 'M.HEIGHT \* 0.25' roblox/src/client/TileHeight.luau \
   && grep -q 'REFONT\[gui.Name\]' roblox/src/client/PanelDress.client.luau \
   && ! grep -qE 'size="1[0-3]"|, 1[0-3], (nil|Enum)' roblox/src/client/GovernmentPanel.client.luau roblox/src/client/CityList.client.luau roblox/src/client/ResearchPicker.client.luau roblox/src/client/CivGallery.luau roblox/src/client/TechInfo.luau; then
  note PASS "gate 45: civ pick wiring, panel close X, shared tech info, half-height hills, reading face, no text under 14 px in the new panels (grep pins)"
else
  note FAIL "gate 45: run-S wiring pins — civ pick / PanelClose / tech hover card"
fi

# gate 46 — controls legend (LegendData): every key the client binds is in a
# legend row or EXEMPT with a reason, no row names an unbound key, caps and
# text fit their columns; Legend.client draws from it; F (follow-avatar) is
# ignored while a walk key is held (session 2026-11-16 08:11Z)
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/legend.luau >/dev/null 2>&1 \
     && grep -q 'LegendData.capLayout(row)' roblox/src/client/Legend.client.luau \
     && grep -q 'heading.Name = "Heading"' roblox/src/client/Legend.client.luau \
     && grep -q 'if UserInputService:IsKeyDown(k) then' roblox/src/client/Camera.client.luau \
     && ! grep -q 'Enum.Font.Code' roblox/src/client/Legend.client.luau; then
    note PASS "gate 46: legend covers every bound key, caps fit (lune) + Legend wiring"
  else
    note FAIL "gate 46: legend — run: lune run roblox/selftest/legend.luau"
  fi
else
  note SKIP "gate 46: lune absent"
fi

# gate 47 — turn log presentation (TurnLogView): filter chips never overlap at
# any width, a chip per filter class, a shown word per narrator tag, escaped
# RichText rows; TurnLog.client places chips from the layout
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/turnlog-view.luau >/dev/null 2>&1 \
     && grep -q 'TurnLogView.chipLayout(classIds, STRIP_W)' roblox/src/client/TurnLog.client.luau \
     && grep -q 'TurnLogView.rowText(turn, text)' roblox/src/client/TurnLog.client.luau \
     && ! grep -q 'Enum.Font.Code' roblox/src/client/TurnLog.client.luau \
     && [ "$(grep -l 'panel.Position = UDim2.new(0, 206, 1,' roblox/src/client/TurnLog.client.luau roblox/src/client/Legend.client.luau roblox/src/client/Diplomacy.client.luau roblox/src/client/Overlays.client.luau | wc -l)" = 4 ]; then
    note PASS "gate 47: turn log chips and rows (lune) + TurnLog wiring; left-column panels stand beside the buttons"
  else
    note FAIL "gate 47: turn log view — run: lune run roblox/selftest/turnlog-view.luau"
  fi
else
  note SKIP "gate 47: lune absent"
fi

# gate 48 — statistics content (StatsView): rival cards carry only
# view-derived counts (the fog rule), own card fields, wonders window, chart
# dots inside the box, block layout; Statistics.client draws from it
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/stats-view.luau >/dev/null 2>&1 \
     && grep -q 'StatsView.cards(view, rs, lastBattles)' roblox/src/client/Statistics.client.luau \
     && grep -q 'StatsView.chartDots(lastSeries' roblox/src/client/Statistics.client.luau \
     && ! grep -qE 'Enum.Font.(Code|SourceSans)' roblox/src/client/Statistics.client.luau; then
    note PASS "gate 48: statistics cards, fog rule, chart, layout (lune) + Statistics wiring"
  else
    note FAIL "gate 48: statistics view — run: lune run roblox/selftest/stats-view.luau"
  fi
else
  note SKIP "gate 48: lune absent"
fi

# gate 49 — city catalog rules (CatalogInfo) over data/*.json: the list
# mirrors the engine's setProduction rejections (barb-only and obsolete units
# not listed, coast, nukes, tech, built, taken) and every row has a hover card
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/catalog-info.luau >/dev/null 2>&1 \
     && grep -q 'CatalogInfo.availability(kind, id, def, ctx)' roblox/src/client/CityPanel.client.luau \
     && grep -q 'CatalogInfo.card(kind, id, def' roblox/src/client/CityPanel.client.luau \
     && grep -q 'def.barbOnly == true' luau/cities.luau; then
    note PASS "gate 49: city catalog offers only what the engine accepts, hover card per row (lune) + CityPanel wiring"
  else
    note FAIL "gate 49: catalog rules — run: lune run roblox/selftest/catalog-info.luau"
  fi
else
  note SKIP "gate 49: lune absent"
fi

# gate 50 — military overview (MilitaryView, the military-overview.js twin):
# own units only, where / home / summary / ordering (lune); the panel, its
# top-row button and the Statistics button + end screen entry are wired
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/military-view.luau >/dev/null 2>&1 \
     && grep -q 'MilitaryView.rows(view' roblox/src/client/Military.client.luau \
     && grep -q 'ClientState.toggleMilitary()' roblox/src/client/ActionBar.client.luau \
     && grep -q 'ClientState.toggleStats(nil)' roblox/src/client/ActionBar.client.luau \
     && grep -q 'ClientState.toggleStats(true)' roblox/src/client/EndScreen.client.luau \
     && grep -q 'ClientState.onStatsToggle(setOpen)' roblox/src/client/Statistics.client.luau; then
    note PASS "gate 50: military overview rows (lune) + Military / Statistics buttons and end screen entry wired"
  else
    note FAIL "gate 50: military overview — run: lune run roblox/selftest/military-view.luau"
  fi
else
  note SKIP "gate 50: lune absent"
fi

# gate 51 — feature parity list + user scenarios (roblox/parity/*.txt):
# every browser feature's proof string still exists, every client/ui module is
# named, every Roblox "yes / partial" has evidence in roblox/src, scenarios name
# known features, and roblox/PARITY.md is the generated report
if command -v node >/dev/null 2>&1; then
  if out=$(node roblox/selftest/feature-parity.mjs 2>&1); then
    note PASS "gate 51: $out"
  else
    note FAIL "gate 51: feature parity — run: node roblox/selftest/feature-parity.mjs"
  fi
else
  note SKIP "gate 51: node absent"
fi

# gate 52 — the UI tour (TourPlan): every ScreenGui the audit expects is a tour
# stop or exempt with a reason, every toured panel registers itself, judge()
# finds off-screen / empty / clipped / small text (lune); the tour is wired
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/tour-plan.luau >/dev/null 2>&1 \
     && grep -q 'TourPlan.judge(stop' roblox/src/client/UiTour.client.luau \
     && grep -q 'ClientState.runTour()' roblox/src/client/DebugMenu.client.luau \
     && grep -q 'RMC-TOUR' roblox/tools/after-run.js; then
    note PASS "gate 52: UI tour covers every gui or exempts it, judging rules (lune) + Debug menu and after-run wiring"
  else
    note FAIL "gate 52: UI tour — run: lune run roblox/selftest/tour-plan.luau"
  fi
else
  note SKIP "gate 52: lune absent"
fi

# gate 53 — the after-run report (roblox/tools/after-run.js): tour lines,
# refusals by reason and type, seconds per turn, diagnostics read correctly
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/after-run.mjs >/dev/null 2>&1 \
     && grep -q '^		debug = RunService:IsStudio() or setup.debugGame == true,' roblox/src/server/GameServer.server.luau \
     && grep -q "debug ? { debug: true } : {}));" roblox/acceptance/assemble.js \
     && grep -q 'setup.debug == true' luau/mapgen.luau; then
    note PASS "gate 53: after-run report reads a session (node); debug flag passed where the engine reads it"
  else
    note FAIL "gate 53: after-run — run: node roblox/selftest/after-run.mjs"
  fi
else
  note SKIP "gate 53: node absent"
fi

# gate 54 — the top-centre button row (TopRowPlan): clear of the turn chip
# and the menu row at every width 320-2600, labels never lost by widening
# (lune); ActionBar places the row from the plan
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/top-row.luau >/dev/null 2>&1 \
     && grep -q 'TopRowPlan.plan(vw)' roblox/src/client/ActionBar.client.luau \
     && [ "$(grep -c 'joinCluster(' roblox/src/client/ActionBar.client.luau)" -ge 5 ]; then
    note PASS "gate 54: top row plan at every width (lune) + ActionBar wiring"
  else
    note FAIL "gate 54: top row — run: lune run roblox/selftest/top-row.luau"
  fi
else
  note SKIP "gate 54: lune absent"
fi

# gate 55 — no top-level local is read on a line above its declaration (Luau
# makes that a nil global, silently: the city panel's queue strip bug)
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/local-order.mjs >/dev/null 2>&1; then
    note PASS "gate 55: no top-level local read before its declaration (node)"
  else
    note FAIL "gate 55: local order — run: node roblox/selftest/local-order.mjs"
  fi
else
  note SKIP "gate 55: node absent"
fi

# gate 56 — badge rules (BadgeRules): 50 badges, unique keys / names, ladders
# that rise, difficulty and era ids from data/*.json, every event type read
# is emitted by the engine port, earning rules incl. regent and debug games
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/badge-rules.luau >/dev/null 2>&1; then
    note PASS "gate 56: badge rules over the real rulesets and engine events (lune)"
  else
    note FAIL "gate 56: badge rules — run: lune run roblox/selftest/badge-rules.luau"
  fi
else
  note SKIP "gate 56: lune absent"
fi

# gate 57 — the discovery splash (DiscoveryView) over data/*.json: every
# buildable is announced by its tech, "now open" vs "later" by prerequisites,
# research prompt, regent-only timeout, chips that wrap without overlap
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/discovery-view.luau >/dev/null 2>&1 \
     && grep -q 'DiscoveryView.model(techId' roblox/src/client/DiscoveryCard.client.luau \
     && grep -q 'ADVANCE DISCOVERED' roblox/src/client/DiscoveryCard.client.luau \
     && grep -q 'registerPanel("discovery"' roblox/src/client/DiscoveryCard.client.luau \
     && grep -q 'ClientState.tourRunning == true' roblox/src/client/DiscoveryCard.client.luau \
     && grep -q 'never two splashes' roblox/src/client/DiscoveryCard.client.luau; then
    note PASS "gate 57: discovery splash content (lune) + DiscoveryCard wiring"
  else
    note FAIL "gate 57: discovery splash — run: lune run roblox/selftest/discovery-view.luau"
  fi
else
  note SKIP "gate 57: lune absent"
fi

# gate 58 — difficulty levels (plan step 1.0): server and lobby offer exactly
# rules.json's seven levels, createGame takes each, the server passes it, the
# replay tool rebuilds from [R4INIT] levels=7; legacy ids fall back to prince
if command -v node >/dev/null 2>&1; then
  if node roblox/selftest/difficulty-levels.mjs >/dev/null 2>&1; then
    note PASS "gate 58: the host's difficulty level reaches the engine (node, JS engine)"
  else
    note FAIL "gate 58: difficulty levels — run: node roblox/selftest/difficulty-levels.mjs"
  fi
else
  note SKIP "gate 58: node absent"
fi

# gate 59 — city screen rules (CityView, plan step 1): food / growth / starving
# figures as the engine computes them, specialist commands the engine accepts,
# capital, trade routes, previous / next city (lune); CityPanel draws from it
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/city-view.luau >/dev/null 2>&1 \
     && grep -q 'CityView.food(city' roblox/src/client/CityPanel.client.luau \
     && grep -q 'CityView.specialistCommand(city, mood, workers, action)' roblox/src/client/CityPanel.client.luau \
     && grep -q 'CityView.neighbour(view, openCityId, dir)' roblox/src/client/CityPanel.client.luau \
     && grep -q 'CityView.subtitle(city, rs, view)' roblox/src/client/CityPanel.client.luau; then
    note PASS "gate 59: city screen rules (lune) + CityPanel wiring"
  else
    note FAIL "gate 59: city view — run: lune run roblox/selftest/city-view.luau"
  fi
else
  note SKIP "gate 59: lune absent"
fi

# gate 60 — empire overview rules (EmpireView, plan step 2): the Economy
# statement sums to tech.playerIncome for every civ of a real game, from the
# state and from the player's view; city rows; the income readers use the
# own-cities shim (the raw view breaks playerIncome once rival cities are known)
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/empire-view.luau >/dev/null 2>&1 \
     && grep -q 'EmpireView.economy, EmpireView.shim(view)' roblox/src/client/CityList.client.luau \
     && grep -q 'EmpireView.cityRow, shim, c, rs, DEPS, worked' roblox/src/client/CityList.client.luau \
     && grep -q 'EmpireView.shim(view)' roblox/src/client/Hud.client.luau \
     && grep -q 'EmpireView.shim(view)' roblox/src/client/ActionBar.client.luau \
     && grep -q 'EmpireView.shim(view)' roblox/src/client/ResearchPicker.client.luau \
     && grep -q 'StatsView.chartDots(lastSeries, card.pid, INNER - 4, maxValue, key)' roblox/src/client/Statistics.client.luau; then
    note PASS "gate 60: empire overview rules (lune) + Cities / Economy / income wiring"
  else
    note FAIL "gate 60: empire view — run: lune run roblox/selftest/empire-view.luau"
  fi
else
  note SKIP "gate 60: lune absent"
fi

# gate 61 — the bottom action bar never shares pixels with the corner toggles
# (BarFit: shrink between them, else its own strip above them)
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/bar-fit.luau >/dev/null 2>&1 \
     && grep -q 'BarFit.plan(cam.ViewportSize.X, natural)' roblox/src/client/ActionBar.client.luau; then
    note PASS "gate 61: bottom bar placement (lune) + ActionBar wiring"
  else
    note FAIL "gate 61: bar fit — run: lune run roblox/selftest/bar-fit.luau"
  fi
else
  note SKIP "gate 61: lune absent"
fi

# gate 62 — unit order rules (UnitOrders, plan step 3): settlers jobs open /
# greyed exactly as improvements.startWork accepts / refuses them on every
# terrain, tile labels (Clear / Drain / Plant / Rail), Help Wonder vs
# cities.helpWonder, disband confirm, route dots; ActionBar + GoToPlan wiring
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/unit-orders.luau >/dev/null 2>&1 \
     && grep -q 'UnitOrders.order(action, view, u, ClientState.rulesets()' roblox/src/client/ActionBar.client.luau \
     && grep -q 'type = "helpWonder", unitId = u.id' roblox/src/client/ActionBar.client.luau \
     && grep -q 'UnitOrders.disbandPress(disbandArmed.id, disbandArmed.at, u.id, os.clock())' roblox/src/client/ActionBar.client.luau \
     && grep -q 'UnitOrders.card(def\[2\], orderOf(action))' roblox/src/client/ActionBar.client.luau \
     && grep -q 'GoToPlan.cancel(u.id)' roblox/src/client/ActionBar.client.luau \
     && grep -q 'UnitOrders.routeDots(points, #crumbs)' roblox/src/client/GoToPlan.luau; then
    note PASS "gate 62: unit order rules vs the engine (lune) + ActionBar / GoToPlan wiring"
  else
    note FAIL "gate 62: unit orders — run: lune run roblox/selftest/unit-orders.luau"
  fi
else
  note SKIP "gate 62: lune absent"
fi

# gate 63 — treaty actions (DiplomacyView, user ruling 2026-11-16): every
# command the panel builds is accepted / refused by the engine as its button
# state says, read from the filtered view; offer wording; a line for every
# engine refusal; panel + envoy + Propose wiring; the three big map sizes are
# offered on both sides with the latency wording
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/diplomacy-actions.luau >/dev/null 2>&1 \
     && grep -q 'DiplomacyView.rows(view, view.you, ClientState.rulesets())' roblox/src/client/Diplomacy.client.luau \
     && grep -q 'DiplomacyView.incomingOffers(view, view.you, ClientState.rulesets())' roblox/src/client/Diplomacy.client.luau \
     && grep -q 'DiplomacyView.parleyCommand(c.pid, c.term' roblox/src/client/Diplomacy.client.luau \
     && grep -q 'DiplomacyView.confirmPress(' roblox/src/client/Diplomacy.client.luau \
     && grep -q '"RMCEnvoy"' roblox/src/client/DiagAudit.client.luau \
     && grep -q '"diplomacy"' roblox/src/server/GameServer.server.luau \
     && grep -q '{ name = "huge", w = 160, h = 100 }' roblox/src/server/GameServer.server.luau \
     && grep -q 'huge = "Huge 160x100 (very slow)"' roblox/src/client/Lobby.client.luau; then
    note PASS "gate 63: treaty actions vs the engine (lune) + panel / envoy wiring + big map sizes"
  else
    note FAIL "gate 63: diplomacy actions — run: lune run roblox/selftest/diplomacy-actions.luau"
  fi
else
  note SKIP "gate 63: lune absent"
fi

# gate 64 — badge awards (BadgeTrack + BadgeIds + BadgeAward, rulings
# 2026-11-17): a real 80-turn engine game earns milestones per seat, each
# once; victory badges need half the turns ended by the user, the winning
# seat only, nothing in a debug game; an id row per badge; the server feeds
# every event batch once and the award call never runs in the turn's thread
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/badge-track.luau >/dev/null 2>&1 \
     && [ "$(grep -c 'badgeEvents(' roblox/src/server/GameServer.server.luau)" -eq 3 ] \
     && grep -q 'BadgeTrack.onTurn(badgeTrack, player.UserId, pid)' roblox/src/server/GameServer.server.luau \
     && [ "$(grep -c 'badgeTrack = BadgeTrack.new(BadgeRules, ruleset' roblox/src/server/GameServer.server.luau)" -eq 2 ] \
     && grep -q 'task.spawn(award, g.userId, g.key, id)' roblox/src/server/BadgeAward.luau \
     && grep -q 'not RunService:IsStudio()' roblox/src/server/BadgeAward.luau \
     && grep -q "RMC-BADGE" roblox/tools/after-run.js; then
    note PASS "gate 64: badge awards over a real engine game (lune) + server wiring"
  else
    note FAIL "gate 64: badge awards — run: lune run roblox/selftest/badge-track.luau"
  fi
else
  note SKIP "gate 64: lune absent"
fi

# gate 65 — wonder / building model data (StructureModels,
# specs/roblox-pedia-art.md P0): known shapes and roles, at most 80 parts,
# inside the 12 x 12 x 12 box (exact tilted bounds), bottom-up order, arch
# expansion, a diorama model for each of the 22 wonders; the Roblox
# builder and the headless preview draw every shape; the export runs
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/structure-models.luau >/dev/null 2>&1 \
     && lune run roblox/tools/model-export.luau models pyramids 2>/dev/null | grep -q '"cells":\[{' \
     && grep -q 'StructureBuilder.build(' roblox/src/client/GalleryGrid.client.luau \
     && grep -q 'set = "civs"' roblox/src/client/CivGallery.luau \
     && grep -q 'PediaPicture.draw(picBox' roblox/src/client/CivGallery.luau \
     && grep -q 'WonderScene.ownMode(ClientState.options.wonderScenes' roblox/src/client/WonderStage.client.luau; then
    note PASS "gate 65: structure models (lune) + builder / preview shape coverage"
  else
    note FAIL "gate 65: structure models — run: lune run roblox/selftest/structure-models.luau"
  fi
else
  note SKIP "gate 65: lune absent"
fi

# gate 66 — encyclopedia pictures (PediaArt, specs/roblox-pedia-art.md P1):
# every unit, advance and terrain of the real rulesets resolves to a
# picture; the list still without art is exactly the structures without a
# model + governments + concepts; pane layout across widths; terrain patch;
# the tile height rule shared by the map and the picture; panel wiring
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/pedia-art.luau >/dev/null 2>&1 \
     && grep -q 'PediaArt.layout(paneW, art.kind)' roblox/src/client/Pedia.client.luau \
     && grep -q 'PediaPicture.show(artBox, catDef.key, id, lay' roblox/src/client/Pedia.client.luau \
     && grep -q 'return TileHeight.top(TerrainPalette, id)' roblox/src/client/ViewRenderer.client.luau \
     && grep -q 'TileProps.rebuild, props, { map = map, cities = {} }, top, TILE, 3, true' roblox/src/client/PediaPicture.luau \
     && grep -q 'if uncached ~= true then' roblox/src/client/TileProps.luau; then
    note PASS "gate 66: encyclopedia pictures over the real rulesets (lune) + panel wiring"
  else
    note FAIL "gate 66: pedia art — run: lune run roblox/selftest/pedia-art.luau"
  fi
else
  note SKIP "gate 66: lune absent"
fi

# gate 67 — the wonder completion scene (WonderScene, specs/roblox-pedia-art.md
# P3): what plays for which event and when nothing plays, beats, part rise,
# camera path, card lines, a model and a blurb per wonder; the stage script's
# wiring; the pyramid pieces meet at the axis (the corner wedge's tall corner
# is local +x -z, measured in Studio 2026-11-23 - it was drawn outward)
if command -v lune >/dev/null 2>&1; then
  if lune run roblox/selftest/wonder-scene.luau >/dev/null 2>&1 \
     && grep -q 'WonderScene.plan(events, {' roblox/src/client/WonderStage.client.luau \
     && grep -q 'ClientState.sceneActive = true' roblox/src/client/WonderStage.client.luau \
     && grep -q 'ClientState.sceneActive = false' roblox/src/client/WonderStage.client.luau \
     && grep -q 'ClientState.introActive or ClientState.sceneActive' roblox/src/client/Camera.client.luau \
     && grep -q 'if ClientState.sceneActive then' roblox/src/client/HudGate.client.luau \
     && grep -q 'o.wonderScenes ~= false' roblox/src/client/Options.client.luau \
     && grep -q 'ClientState.registerPanel("wonder", holder' roblox/src/client/WonderStage.client.luau \
     && grep -q 'CFrame.new(-r / 2, h / 2, r / 2)' roblox/src/client/StructureBuilder.luau \
     && grep -q 'CFrame.new(-r / 2, h / 2, r / 2)' roblox/src/client/AssetFactory.luau \
     && [ ! -e roblox/src/client/WonderScene.client.luau ]; then
    note PASS "gate 67: wonder scene rules (lune) + stage wiring + pyramid placement"
  else
    note FAIL "gate 67: wonder scene — run: lune run roblox/selftest/wonder-scene.luau"
  fi
else
  note SKIP "gate 67: lune absent"
fi

[ $fail -eq 0 ] && echo "roblox/check.sh: ALL GREEN" || echo "roblox/check.sh: FAILURES"
exit $fail
