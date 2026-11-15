-- check.sh gate 37: headless (lune) pins for TerrainSkirts.edges / keyOf.
local M = require("../src/client/TerrainSkirts")

local fails = 0
local function check(name, got, want)
	if got ~= want then
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

local TOP = { grassland = 0.3, hills = 3.0, mountains = 3.7, ocean = -0.5, plains = 0.9, unknown = 0 }
local function topOf(id)
	return TOP[id]
end
-- 4x3 map, row-major:
--   y0: grass  hills  mount  UNKNOWN
--   y1: grass  grass  ocean  grass
--   y2: plains grass  grass  grass
local ids = { "grassland", "hills", "mountains", "unknown",
	"grassland", "grassland", "ocean", "grassland",
	"plains", "grassland", "grassland", "grassland" }
local function mapOf(wrapX)
	local tiles = {}
	for i, id in ipairs(ids) do
		tiles[i] = { t = id, visible = true }
	end
	return { width = 4, height = 3, wrapX = wrapX, tiles = tiles }
end
local function sig(edges)
	local out = {}
	for _, e in ipairs(edges) do
		out[#out + 1] = ("%d,%d:%.1f"):format(e.dx, e.dy, e.drop)
	end
	return table.concat(out, " ")
end

local map = mapOf(false)
check("hills: west + south (east is higher)", sig(M.edges(map, 1, 0, topOf)), "-1,0:2.7 0,1:2.7")
check("mountain: only south (ocean); west step < MIN_STEP, east unknown",
	sig(M.edges(map, 2, 0, topOf)), "0,1:4.2")
check("flat tile owns no skirt", sig(M.edges(map, 0, 1, topOf)), "")
check("lower tile owns none toward a higher one", sig(M.edges(map, 1, 1, topOf)), "")
check("sub-MIN_STEP step (plains over grass) is skipped", sig(M.edges(map, 0, 2, topOf)), "")
check("unknown tile owns none", sig(M.edges(map, 3, 0, topOf)), "")
check("edge of a non-wrapping map", sig(M.edges(map, 0, 0, topOf)), "")
check("low = the neighbour top", M.edges(map, 2, 0, topOf)[1].low, -0.5)

-- wrap: (0,1) grass is the east neighbour of (3,1) and vice versa — put hills at x=3
ids[8] = "hills"
check("no wrap: hills at the east edge skirts west + south only",
	sig(M.edges(mapOf(false), 3, 1, topOf)), "-1,0:3.5 0,1:2.7")
check("wrapX: also across the seam", sig(M.edges(mapOf(true), 3, 1, topOf)), "1,0:2.7 -1,0:3.5 0,1:2.7")
ids[8] = "grassland"

local k1 = M.keyOf(map, 1, 0, "enhanced")
check("key is stable", M.keyOf(mapOf(false), 1, 0, "enhanced"), k1)
check("key carries the look", M.keyOf(map, 1, 0, "retro") ~= k1, true)
map.tiles[1].t = "forest"
check("key changes when a neighbour's type changes", M.keyOf(map, 1, 0, "enhanced") ~= k1, true)
map.tiles[1].t = "grassland"
map.tiles[2].visible = false
check("key changes with the tile's fog state", M.keyOf(map, 1, 0, "enhanced") ~= k1, true)

-- T2b corner fills. 3x3, a hill in the middle:
--   grass  grass  mount
--   grass  HILLS  grass
--   ocean  grass  UNKNOWN
do
	local cids = { "grassland", "grassland", "mountains", "grassland", "hills", "grassland", "ocean", "grassland", "unknown" }
	local tiles = {}
	for i, id in ipairs(cids) do
		tiles[i] = { t = id, visible = true }
	end
	local cmap = { width = 3, height = 3, wrapX = false, tiles = tiles }
	local function csig(list)
		local out = {}
		for _, c in ipairs(list) do
			out[#out + 1] = ("%d,%d:%.1f/%.1f/%.1f@%.1f"):format(c.cx, c.cy, c.drop, c.dropX, c.dropY, c.low)
		end
		table.sort(out)
		return table.concat(out, " ")
	end
	-- NW (-1,-1) grass diag: fill; SW (-1,1) ocean diag: fill on the ocean;
	-- NE (1,-1) mountain diag is higher: none; SE (1,1) unknown diag: none
	check("corners: lower explored diagonals only", csig(M.corners(cmap, 1, 1, topOf)), "-1,-1:2.7/2.7/2.7@0.3 -1,1:3.5/2.7/2.7@-0.5")
	check("corners: a flat tile owns none", #M.corners(cmap, 0, 0, topOf), 0)
	tiles[2].t = "mountains" -- north neighbour now higher: no north skirt, so no north corners
	check("corners: need a skirt on both sides", csig(M.corners(cmap, 1, 1, topOf)), "-1,1:3.5/2.7/2.7@-0.5")
	tiles[2].t = "grassland"
	tiles[1].t = "hills" -- NW diagonal level with the tile: nothing to fill
	check("corners: a level diagonal owns none", csig(M.corners(cmap, 1, 1, topOf)), "-1,1:3.5/2.7/2.7@-0.5")
	tiles[1].t = "grassland"
	local k1c = M.keyOf(cmap, 1, 1, "enhanced")
	tiles[7].t = "grassland"
	check("key changes when a DIAGONAL neighbour changes", M.keyOf(cmap, 1, 1, "enhanced") ~= k1c, true)
	check("run: capped", M.runOf(100, 12), 12 * M.MAX_RUN)
	check("run: by drop", M.runOf(1, 12), M.RUN_PER_DROP)
end
-- quarter turns: CFrame.Angles(0, pi/2, 0) sends local +X to world -Z
do
	local x, z = M.quarterTurn(1, 0, 1)
	check("one turn: +X -> -Z", x .. "," .. z, "0,-1")
	x, z = M.quarterTurn(1, -1, 4)
	check("four turns: identity", x .. "," .. z, "1,-1")
	for _, a in ipairs({ { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } }) do
		local seen = {}
		for _, w in ipairs({ { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } }) do
			local k = M.turnsFor(a[1], a[2], w[1], w[2])
			check(("turnsFor exists %d,%d -> %d,%d"):format(a[1], a[2], w[1], w[2]), k ~= nil, true)
			local rx, rz = M.quarterTurn(a[1], a[2], k)
			check("turnsFor lands on the wanted corner", rx == w[1] and rz == w[2], true)
			check("each wanted corner has its own turn count", seen[k] == nil, true)
			seen[k] = true
		end
	end
end

if fails > 0 then
	error(("%d terrain-skirts pin(s) failed"):format(fails))
end
print("terrain-skirts: ALL PINS PASS")
