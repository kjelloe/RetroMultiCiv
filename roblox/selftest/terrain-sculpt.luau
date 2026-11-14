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
	local feet, crown, tops = 0, nil, {}
	for _, it in ipairs(items) do
		check("known shape " .. it.k, shapeExists(it.k))
		check("has color", type(it.color) == "string" and it.color:sub(1, 1) == "#")
		if it.role == "boulder" then
			check("boulder inside the tile", math.max(math.abs(it.dx), math.abs(it.dz)) <= 0.42)
		else
			check("smooth: an ellipsoid, not a wedge fan", it.k == "treeCanopy" and it.ell == true)
			local axis = math.sqrt(it.dx * it.dx + it.dz * it.dz)
			-- the tile centre (where a unit or city sits) stays outside every layer
			check("centre clear " .. seed, axis > M.baseRadiusOf(it), axis - M.baseRadiusOf(it))
			check("near its tile " .. seed, math.max(math.abs(it.dx), math.abs(it.dz)) + M.baseRadiusOf(it) <= 0.6)
			if it.role == "foot" then
				feet += 1
				check("foot within the cap", M.baseRadiusOf(it) <= M.MAX_R + 1e-9, M.baseRadiusOf(it))
				check("foot is low and wide", M.apexOf(it) < M.baseRadiusOf(it) * 1.4)
			elseif it.role == "body" then
				check("body rises above the foot", M.apexOf(it) > 0.2)
			elseif it.role == "crown" then
				crown = it
				tops[#tops + 1] = M.apexOf(it)
				check("crown narrower than the foot cap", M.baseRadiusOf(it) < 0.14)
				check("summit height in range " .. seed, M.apexOf(it) >= 0.38 and M.apexOf(it) <= 0.81, M.apexOf(it))
			elseif it.role == "snow" then
				snowSeen += 1
				check("snow sits on its crown", crown ~= nil and it.dx == crown.dx and it.dz == crown.dz)
				check("snow apex = crown apex " .. seed, math.abs(M.apexOf(it) - M.apexOf(crown)) < 0.01, M.apexOf(it) - M.apexOf(crown))
				check("snow narrower than the crown", M.baseRadiusOf(it) < M.baseRadiusOf(crown))
				check("snow starts above half height", it.dy > M.apexOf(crown) * 0.5)
			else
				check("known role", false, it.role)
			end
		end
	end
	check("three summits " .. seed, feet == 3 and #tops == 3, feet)
	check("the first summit is the tallest " .. seed, tops[1] == math.max(tops[1], tops[2], tops[3]))
	maxParts = math.max(maxParts, #items)

	local lite = M.mountain(randFor(seed), true)
	liteMax = math.max(liteMax, #lite)
	for _, it in ipairs(lite) do
		check("lite has no body layer or boulders", it.role ~= "body" and it.role ~= "boulder")
	end

	local hills = M.hills(randFor(seed))
	check("hills deterministic " .. seed, sameList(hills, M.hills(randFor(seed))))
	check("three domes " .. seed, #hills == 3, #hills)
	for i, it in ipairs(hills) do
		check("dome shape exists", shapeExists(it.k) and it.ell == true)
		local r = M.baseRadiusOf(it)
		check("dome is low (rolling, not a ball)", M.apexOf(it) <= M.HILL_MAX_H + 1e-9 and M.apexOf(it) < r * 0.75, M.apexOf(it))
		check("dome stands on the ground", it.dy == 0)
		check("dome inside the tile", math.max(math.abs(it.dx), math.abs(it.dz)) + r * 0.8 <= 0.5,
			math.max(math.abs(it.dx), math.abs(it.dz)) + r * 0.8)
		check("the first dome is the broad one", i == 1 or r < M.baseRadiusOf(hills[1]) + 1e-9)
	end
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

check("full massif part budget <= 14", maxParts <= 14, maxParts)
check("lite massif part budget <= 5", liteMax <= 5, liteMax)
check("some shoulders carry snow, not all", snowSeen > 400 and snowSeen < 1200, snowSeen)

if fails > 0 then
	error(("%d terrain-sculpt check(s) failed"):format(fails))
end
print(("terrain-sculpt: full<=%d parts, lite<=%d parts, ALL PASS"):format(maxParts, liteMax))
