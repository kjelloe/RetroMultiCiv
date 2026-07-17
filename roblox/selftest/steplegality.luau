-- check.sh gate 7: headless (lune) pinned verdicts for StepLegality — the
-- ONE-SOURCE tile-entry module behind the ride keys, Select click-move,
-- the GoTo planner, and MoveHints. Pure view math, so it runs outside
-- Studio; these pins keep the four call sites' semantics from drifting
-- while the client iterates.
local M = require("../src/client/StepLegality")

-- synthetic 6x3 wrapping map: y0 = grass grass grass FOG ocean grass;
-- y1/y2 all grassland. Enemy unit parked at (2,1).
local W, H = 6, 3
local tiles = {}
for i = 1, W * H do
	tiles[i] = { t = "grassland" }
end
tiles[0 * W + 3 + 1] = { t = "unknown" }
tiles[0 * W + 4 + 1] = { t = "ocean" }
local map = { width = W, height = H, wrapX = true, tiles = tiles }
local view = {
	you = "p1",
	map = map,
	units = {
		e1 = { x = 2, y = 1, owner = "p2" },
		m1 = { x = 1, y = 1, owner = "p1" },
	},
}
local rs = { terrain = { terrains = {
	grassland = { domain = "land" },
	ocean = { domain = "sea" },
} } }

local fails = 0
local function check(name, got, want)
	if got == want then
		print(("PASS %s"):format(name))
	else
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

check("norm wraps left edge", M.norm(map, -1, 0), 5)
check("norm wraps right edge", M.norm(map, 6, 0), 0)
check("norm rejects off-map y", M.norm(map, 0, -1), nil)
check("norm rejects x on non-wrap map",
	M.norm({ width = W, height = H, wrapX = false, tiles = tiles }, -1, 0), nil)

check("terrainOk: land on grassland", (M.terrainOk(view, rs, "land", 0, 0)), true)
check("terrainOk: land on ocean", (M.terrainOk(view, rs, "land", 4, 0)), false)
check("terrainOk: sea on ocean", (M.terrainOk(view, rs, "sea", 4, 0)), true)

check("enemyAt: enemy tile", M.enemyAt(view, 2, 1), true)
check("enemyAt: own unit is not an enemy", M.enemyAt(view, 1, 1), false)

check("canEnter: free grassland", M.canEnter(view, rs, "land", 1, 2), true)
check("canEnter: enemy blocks the planner", M.canEnter(view, rs, "land", 2, 1), false)

check("canAttempt: fog passes (engine judges)", (M.canAttempt(view, rs, "land", 3, 0)), true)
check("canAttempt: enemy tile passes (attack)", (M.canAttempt(view, rs, "land", 2, 1)), true)
check("canAttempt: known wrong domain rejects", (M.canAttempt(view, rs, "land", 4, 0)), false)
local _, why = M.canAttempt(view, rs, "land", 4, 0)
check("canAttempt: reject reason is the terrain id", why, "ocean")
local ok2, why2 = M.canAttempt(view, rs, "land", 0, -1)
check("canAttempt: map edge rejects", ok2, false)
check("canAttempt: edge reason", why2, "edge of the map")

if fails > 0 then
	error(("steplegality: %d pinned verdicts FAILED"):format(fails))
end
print("steplegality: all pinned verdicts hold")
