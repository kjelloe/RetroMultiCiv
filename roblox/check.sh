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
for name in VerifyAnchors GameServer RetroMultiCiv Shared RetroMultiCivClient GameData TerrainPalette RulesetHashes rulesets Camera Select ClientState ViewRenderer Hud CityPanel Possess TurnLog ActionBar ResearchPicker MoveHints Options VoidCover CityList Statistics OddsPreview AssetFactory AssetRecipes GalleryGrid GovernmentPanel Deck Lobby SaveStore RidePad GoToPlan StepLegality WorkedTiles CatalogText pathfind fastforward spaceship ReplayTheater Pedia PediaConcepts Legend BuildQueue Ship DiscoveryCard Minimap Tooltip Palette EndScreen score Historian AdviceCards DebugMenu SettlerAuto strategic Strategic FastForward Beeline TechTree PediaBlurbs Diplomacy DiplomacyView; do
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

[ $fail -eq 0 ] && echo "roblox/check.sh: ALL GREEN" || echo "roblox/check.sh: FAILURES"
exit $fail
