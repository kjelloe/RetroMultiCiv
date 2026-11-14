-- check.sh gate 41: headless (lune) pins for TerrainCoast.edges / keyOf.
local M = require("../src/client/TerrainCoast")

local fails = 0
local function check(name, got, want)
	if got ~= want then
		fails += 1
		print(("FAIL %s: got %s, want %s"):format(name, tostring(got), tostring(want)))
	end
end

-- 4x3, row-major:
--   y0: ocean  grass  hills   ocean
--   y1: ocean  plains ocean   arctic
--   y2: grass  UNKN   desert  ocean
local ids = { "ocean", "grassland", "hills", "ocean",
	"ocean", "plains", "ocean", "arctic",
	"grassland", "unknown", "desert", "ocean" }
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
		out[#out + 1] = ("%d,%d"):format(e.dx, e.dy)
	end
	return table.concat(out, " ")
end

local map = mapOf(false)
check("grass: west only (east is hills, south is plains)", sig(M.edges(map, 1, 0)), "-1,0")
check("plains: east + west", sig(M.edges(map, 1, 1)), "1,0 -1,0")
check("hills are cliffs: no beach", sig(M.edges(map, 2, 0)), "")
check("arctic: no beach", sig(M.edges(map, 3, 1)), "")
check("ocean owns no rim", sig(M.edges(map, 0, 0)), "")
check("unknown owns no rim", sig(M.edges(map, 1, 2)), "")
check("an unknown neighbour is not a coast", sig(M.edges(map, 0, 2)), "0,-1")
check("desert: east + north", sig(M.edges(map, 2, 2)), "1,0 0,-1")
check("map edge is not a coast (no wrap)", sig(M.edges(map, 0, 2)), "0,-1")
check("wrap: the far column counts", sig(M.edges(mapOf(true), 0, 2)), "-1,0 0,-1")

check("key carries type, fog, look, ocean sides", M.keyOf(map, 1, 1, "enhanced"), "plains|true|enhanced|o|o|-|-")
local fog = mapOf(false)
fog.tiles[6].visible = false
check("key moves with fog", M.keyOf(fog, 1, 1, "enhanced") ~= M.keyOf(map, 1, 1, "enhanced"), true)
local filled = mapOf(false)
filled.tiles[7].t = "grassland"
check("key moves when a neighbour stops being ocean",
	M.keyOf(filled, 1, 1, "enhanced") ~= M.keyOf(map, 1, 1, "enhanced"), true)
-- river banks: a river neighbour gives a "bank" rim; a river tile owns none
local rmap = { width = 3, height = 1, tiles = {
	{ t = "grassland", visible = true }, { t = "river", visible = true }, { t = "ocean", visible = true },
} }
check("land beside a river: one bank edge east", sig(M.edges(rmap, 0, 0)), "1,0")
check("that edge is a bank", M.edges(rmap, 0, 0)[1].kind, "bank")
check("an ocean edge is sand", M.edges(map, 1, 0)[1].kind, "sand")
check("a river tile owns no rim", sig(M.edges(rmap, 1, 0)), "")
check("key marks the river side", M.keyOf(rmap, 0, 0, "enhanced"), "grassland|true|enhanced|r|-|-|-")
check("bank is narrower than the beach", M.BANK_DEPTH < M.DEPTH, true)
check("rim is thin and shallow", M.DEPTH < 0.25 and M.THICK < 0.2, true)

if fails > 0 then
	error(("%d terrain-coast pin(s) failed"):format(fails))
end
print("terrain-coast: ALL PINS PASS")
