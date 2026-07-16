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
for name in VerifyAnchors GameServer RetroMultiCiv Shared RetroMultiCivClient GameData TerrainPalette RulesetHashes rulesets Camera Select ClientState ViewRenderer Hud CityPanel Possess TurnLog ActionBar ResearchPicker MoveHints Options VoidCover CityList Statistics OddsPreview AssetFactory AssetRecipes GalleryGrid; do
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

[ $fail -eq 0 ] && echo "roblox/check.sh: ALL GREEN" || echo "roblox/check.sh: FAILURES"
exit $fail
