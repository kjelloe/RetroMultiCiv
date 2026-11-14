-- check.sh gate 36: headless (lune) pins for the T1 sculpt planner.
local fs = require("@lune/fs")
local M = require("../src/client/TerrainSculpt")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

-- a deterministic stand-in for TileProps.visualRand at one tile
local function randFor(seed)
	return function(salt)
		local h = (seed * 374761393 + (salt + 1) * 668265263) % 4294967296
		h = bit32.bxor(h, bit32.rshift(h, 13))
		h = (h * 1274126177) % 4294967296
		h = bit32.bxor(h, bit32.rshift(h, 16))
		return h / 4294967296
	end
end

local propSrc = fs.readFile("roblox/src/client/TileProps.luau")
local function shapeExists(k)
	return propSrc:find("\n\t" .. k .. " = { shape = ", 1, true) ~= nil
end

local function sameList(a, b)
	if #a ~= #b then
		return false
	end
	for i = 1, #a do
		for key, v in pairs(a[i]) do
			if b[i][key] ~= v then
				return false
			end
		end
	end
	return true
end

local maxParts, snowSeen, liteMax = 0, 0, 0
for seed = 1, 400 do
	local items = M.mountain(randFor(seed), false)
	check("mountain deterministic " .. seed, sameList(items, M.mountain(randFor(seed), false)))
	local peaks, parts = 0, 0
	local lastPeak = nil
	for _, it in ipairs(items) do
		check("known shape " .. it.k, shapeExists(it.k))
		check("has color", type(it.color) == "string" and it.color:sub(1, 1) == "#")
		if it.k == "peak" then
			peaks += 1
			parts += 5
			lastPeak = it
			local reach = math.max(math.abs(it.dx), math.abs(it.dz)) + M.baseRadiusOf(it)
			check("peak near its tile " .. seed, reach <= 0.6, reach)
			-- the tile centre (where a unit or city sits) stays outside every cone
			local axis = math.sqrt(it.dx * it.dx + it.dz * it.dz)
			check("centre clear of the cone " .. seed, axis > M.baseRadiusOf(it), axis - M.baseRadiusOf(it))
		elseif it.k == "snow" then
			snowSeen += 1
			parts += 5
			check("snow follows its peak", lastPeak ~= nil and it.dx == lastPeak.dx and it.dz == lastPeak.dz)
			-- same apex (within the anti-z-fight lift), cap no wider than the cone base
			check("snow apex = peak apex " .. seed,
				math.abs(M.apexOf(it) - M.apexOf(lastPeak)) < 0.01, M.apexOf(it) - M.apexOf(lastPeak))
			check("snow narrower than the peak", M.baseRadiusOf(it) < M.baseRadiusOf(lastPeak))
		else
			parts += 1
			check("boulder inside the tile", math.max(math.abs(it.dx), math.abs(it.dz)) <= 0.42)
		end
	end
	check("three summits " .. seed, peaks == 3, peaks)
	check("the first summit is the tallest " .. seed, (function()
		local top, first = 0, nil
		for _, it in ipairs(items) do
			if it.k == "peak" then
				first = first or M.apexOf(it)
				top = math.max(top, M.apexOf(it))
			end
		end
		return first == top
	end)())
	maxParts = math.max(maxParts, parts)

	local lite = M.mountain(randFor(seed), true)
	local lp = 0
	for _, it in ipairs(lite) do
		lp += (it.k == "rock") and 1 or 5
	end
	liteMax = math.max(liteMax, lp)

	-- the resource marker stands clear of every cone and boulder
	local fx, fz = M.flank(randFor(seed))
	check("flank inside the tile", math.max(math.abs(fx), math.abs(fz)) <= 0.42)
	for _, it in ipairs(items) do
		local d = math.sqrt((it.dx - fx) ^ 2 + (it.dz - fz) ^ 2)
		if it.k == "peak" then
			check("flank clear of the cones " .. seed, d > M.baseRadiusOf(it) * 0.8, d - M.baseRadiusOf(it))
		elseif it.k == "rock" then
			check("flank clear of the boulders " .. seed, d > 0.2, d)
		end
	end

	local hills = M.hills(randFor(seed))
	check("hills deterministic " .. seed, sameList(hills, M.hills(randFor(seed))))
	check("two rolling hills " .. seed, #hills == 2, #hills)
	local sides = 0
	for _, it in ipairs(hills) do
		check("ridge shape exists", shapeExists(it.k) and it.ell == true)
		check("ridge stands on the block", it.dy == 0)
		check("ridge not rotated", it.rotY == nil)
		local rx, rz = 0.11 * it.sx, 0.11 * it.sz
		check("ridge inside the tile " .. seed, math.abs(it.dx) + rx <= 0.52 and math.abs(it.dz) + rz <= 0.52,
			math.max(math.abs(it.dx) + rx, math.abs(it.dz) + rz))
		-- the tile centre (a unit, a city) is in the valley, outside both ridges
		check("centre in the valley " .. seed, (it.dx / rx) ^ 2 + (it.dz / rz) ^ 2 > 1, (it.dx / rx) ^ 2 + (it.dz / rz) ^ 2)
		check("ridge is long and low", math.max(rx, rz) >= 1.7 * math.min(rx, rz) and M.apexOf(it) <= M.HILL_MAX_H + 1e-9
			and M.apexOf(it) >= 0.24, M.apexOf(it))
		sides += (it.dx + it.dz) > 0 and 1 or -1
	end
	check("one ridge each side " .. seed, sides == 0)
end
-- T4 woods
for seed = 1, 400 do
	local wood = M.forest(randFor(seed))
	check("forest deterministic " .. seed, sameList(wood, M.forest(randFor(seed))))
	check("4-5 trees = 8-10 items " .. seed, #wood == 8 or #wood == 10, #wood)
	local cones, balls = 0, 0
	for i, it in ipairs(wood) do
		check("wood shape exists " .. it.k, shapeExists(it.k))
		check("wood has color", type(it.color) == "string" and it.color:sub(1, 1) == "#")
		local axis = math.sqrt(it.dx * it.dx + it.dz * it.dz)
		check("tree on the ring " .. seed, axis >= M.WOOD_RING_MIN - 1e-9 and axis <= M.WOOD_RING_MAX + 1e-9, axis)
		check("tree inside the tile " .. seed, math.max(math.abs(it.dx), math.abs(it.dz)) <= 0.36)
		if i % 2 == 1 then
			check("each tree starts with its trunk", it.k == "treeTrunk")
			check("trunk stands on the ground", math.abs(it.dy - 0.16 * it.sy / 2) < 1e-9)
		else
			local trunk = wood[i - 1]
			check("crown over its trunk", it.dx == trunk.dx and it.dz == trunk.dz)
			local trunkTop = 0.16 * trunk.sy
			local crownBottom = it.k == "tree" and (it.dy - 0.28 * it.sy / 2) or (it.dy - 0.11 * it.sy)
			check("crown overlaps the trunk top, clear of the ground " .. it.k,
				crownBottom < trunkTop and crownBottom > 0, crownBottom)
			cones += it.k == "tree" and 1 or 0
			balls += it.k == "treeCanopy" and 1 or 0
		end
	end
	check("2-3 spruces " .. seed, cones == 2 or cones == 3, cones)
	check("two broadleaf " .. seed, balls == 2, balls)
end

check("full massif part budget <= 32", maxParts <= 32, maxParts)
check("lite massif part budget <= 20", liteMax <= 20, liteMax)
check("some shoulders carry snow, not all", snowSeen > 400 and snowSeen < 1200, snowSeen)

if fails > 0 then
	error(("%d terrain-sculpt check(s) failed"):format(fails))
end
print(("terrain-sculpt: full<=%d parts, lite<=%d parts, ALL PASS"):format(maxParts, liteMax))
