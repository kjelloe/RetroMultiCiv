-- check.sh gate 65: wonder / building model data (StructureModels): known
-- shapes and roles, the part budget, the 12 x 12 x 12 box, bottom-up order,
-- and that the Roblox builder and the headless preview draw every shape.
local fs = require("@lune/fs")
local S = require("../src/client/StructureModels")
local WONDERS = 0
for _ in pairs(S.MODELS) do
	WONDERS += 1
end
local isWonder = {}
for id in pairs(S.MODELS) do
	isWonder[id] = true
end
require("../src/client/BuildingModels")(S)
require("../src/client/EmblemModels")(S)
require("../src/client/CivEmblems")(S)

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local MATERIALS = { Sand = true, Sandstone = true, Marble = true, Slate = true, Brick = true, WoodPlanks = true,
	Metal = true, Concrete = true, Glass = true, SmoothPlastic = true, Grass = true, Neon = true, Fabric = true }
local nRoles = 0
for name, def in pairs(S.ROLES) do
	nRoles += 1
	check("role colour " .. name, type(def.color) == "string" and def.color:match("^#%x%x%x%x%x%x$") ~= nil)
	check("role material " .. name, MATERIALS[def.material] == true, def.material)
end
check("roles exist", nRoles >= 12, nRoles)

local function checkModel(id, def)
	check(id .. " ground role", S.ROLES[def.ground] ~= nil, def.ground)
	local c = def.camera
	check(id .. " camera", type(c) == "table" and c.yaw >= 0 and c.yaw < 360 and c.pitch >= 5 and c.pitch <= 60
		and c.fit >= 0.8 and c.fit <= 1.6)
	check(id .. " has parts", #def.parts >= 1)
	for i, p in ipairs(def.parts) do
		check(("%s part %d shape"):format(id, i), S.SHAPES[p.s] == true, p.s)
		check(("%s part %d role"):format(id, i), S.ROLES[p.role] ~= nil, p.role)
	end
	local parts = S.expand(def)
	check(id .. " part budget", #parts <= S.LIMIT.parts, #parts)
	local lastY = -1
	for i, p in ipairs(parts) do
		local tag = ("%s prim %d (%s)"):format(id, i, p.s)
		check(tag .. " is a primitive", p.s ~= "arch" and S.SHAPES[p.s] == true)
		local w, h, d = p.size[1], p.size[2], p.size[3]
		check(tag .. " size", w > 0 and h > 0 and d > 0)
		if p.s == "pyramid" or p.s == "cone" or p.s == "cyl" or p.s == "ball" then
			check(tag .. " square base", w == d, ("%s x %s"):format(w, d))
		end
		-- the footprint stays inside the box (a part at an odd angle by its bounding circle)
		-- the part's eight corners, tilted about its base centre and then turned
		local ya, ti = math.rad(p.yaw or 0), math.rad(p.tilt or 0)
		local minX, maxX, minY, maxY, minZ, maxZ = math.huge, -math.huge, math.huge, -math.huge, math.huge, -math.huge
		for _, cx in ipairs({ -w / 2, w / 2 }) do
			for _, cy in ipairs({ 0, h }) do
				for _, cz in ipairs({ -d / 2, d / 2 }) do
					local y1 = cy * math.cos(ti) - cz * math.sin(ti)
					local z1 = cy * math.sin(ti) + cz * math.cos(ti)
					local x2 = cx * math.cos(ya) + z1 * math.sin(ya)
					local z2 = -cx * math.sin(ya) + z1 * math.cos(ya)
					minX, maxX = math.min(minX, p.at[1] + x2), math.max(maxX, p.at[1] + x2)
					minY, maxY = math.min(minY, p.at[2] + y1), math.max(maxY, p.at[2] + y1)
					minZ, maxZ = math.min(minZ, p.at[3] + z2), math.max(maxZ, p.at[3] + z2)
				end
			end
		end
		check(tag .. " tilt", math.abs(p.tilt or 0) <= 180)
		local lim = S.LIMIT.half + 1e-6
		check(tag .. " inside the box", minX >= -lim and maxX <= lim and minZ >= -lim and maxZ <= lim,
			("x %.2f..%.2f z %.2f..%.2f"):format(minX, maxX, minZ, maxZ))
		check(tag .. " height", minY >= -1e-6 and maxY <= S.LIMIT.height + 1e-6, ("%.2f..%.2f"):format(minY, maxY))
		check(tag .. " bottom-up", p.at[2] >= lastY, p.at[2])
		lastY = p.at[2]
	end
end

local nModels = 0
for id, def in pairs(S.MODELS) do
	nModels += 1
	checkModel(id, def)
end
for id, list in pairs(S.VARIANTS) do
	check(id .. " has three variants", #list == 3, #list)
	local keys = {}
	for _, v in ipairs(list) do
		check(id .. " variant key unique " .. tostring(v.key), not keys[v.key])
		keys[v.key] = true
		checkModel(id .. " " .. v.key, v)
	end
end

-- governments and concepts: the same data, checked the same way
local nEmblems = 0
local ALL = {}
for id, def in pairs(S.MODELS) do
	ALL[id] = def
end
for set, list in pairs(S.EMBLEMS) do
	for id, def in pairs(list) do
		nEmblems += 1
		checkModel(set .. "/" .. id, def)
		ALL[set .. "/" .. id] = def
	end
end

-- every model stands on a full ground slab and has a setting, not one lone
-- subject (a wonder is the richest: 20 parts; a building or emblem 12)
for id, def in pairs(ALL) do
	local first = def.parts[1]
	check(id .. " ground slab", first.s == "box" and first.at[2] == 0 and first.size[1] == 11.6 and first.size[3] == 11.6)
	check(id .. " is a diorama", #S.expand(def) >= (isWonder[id] and 20 or 12), #S.expand(def))
	local roles = {}
	for _, p in ipairs(def.parts) do
		roles[p.role] = true
	end
	local nRole = 0
	for _ in pairs(roles) do
		nRole += 1
	end
	check(id .. " uses several materials", nRole >= (isWonder[id] and 4 or 3), nRole)
end

-- an arch is two posts and a lintel that span exactly its size
local arch = S.expand({ parts = { { s = "arch", at = { 1, 2, 0 }, size = { 5, 4, 1 }, role = "stone" } } })
check("arch pieces", #arch == 3, #arch)
check("arch posts stand at the base", arch[1].at[2] == 2 and arch[2].at[2] == 2 and arch[1].size[2] == 3)
check("arch lintel on top", arch[3].at[2] == 5 and arch[3].size[1] == 5 and arch[3].at[2] + arch[3].size[2] == 6)
check("arch posts at the ends", math.abs(arch[1].at[1] - (-1)) < 1e-9 and math.abs(arch[2].at[1] - 3) < 1e-9)
local turned = S.expand({ parts = { { s = "arch", at = { 0, 0, 0 }, size = { 5, 4, 1 }, role = "stone", yaw = 90 } } })
check("a turned arch moves its posts along z", math.abs(turned[1].at[1]) < 1e-9 and math.abs(math.abs(turned[1].at[3]) - 2) < 1e-9)

-- both drawers handle every primitive shape
local builder = fs.readFile("roblox/src/client/StructureBuilder.luau")
local preview = fs.readFile("roblox/tools/model-preview.html")
for shape in pairs(S.SHAPES) do
	if shape ~= "arch" then
		check("builder draws " .. shape, builder:find('s == "' .. shape .. '"', 1, true) ~= nil)
		check("preview draws " .. shape, preview:find("p.s === '" .. shape .. "'", 1, true) ~= nil)
	end
end

check("the 22 wonders have a model", WONDERS >= 22, WONDERS)
check("the 21 buildings have a model", nModels - WONDERS >= 21, nModels - WONDERS)
check("governments and concepts have an emblem", nEmblems >= 35, nEmblems)

-- the civilization gallery: a scene for every civ and for "random", each
-- flying the civ's two colours
local serde = require("@lune/serde")
local nCivs = 0
for id in pairs(serde.decode("json", fs.readFile("data/civs.json"))) do
	nCivs += 1
	check("civ scene " .. id, S.EMBLEMS.civs[id] ~= nil)
end
check("civ scene random", S.EMBLEMS.civs.random ~= nil)
for id, def in pairs(S.EMBLEMS.civs) do
	local roles = {}
	for _, p in ipairs(def.parts) do
		roles[p.role] = true
	end
	check("civ scene " .. id .. " flies the civ colours", id == "random" or (roles.civPrimary and roles.civSecondary))
	nCivs -= 1
end
check("no civ scene without a civ", nCivs == -1, nCivs)
if fails > 0 then
	error(("structure-models: %d failure(s)"):format(fails))
end
print(("structure-models: ok (%d models, %d emblems)"):format(nModels, nEmblems))
