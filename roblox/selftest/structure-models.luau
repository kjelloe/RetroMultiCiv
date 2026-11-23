-- check.sh gate 65: wonder / building model data (StructureModels): known
-- shapes and roles, the part budget, the 12 x 12 x 12 box, bottom-up order,
-- and that the Roblox builder and the headless preview draw every shape.
local fs = require("@lune/fs")
local S = require("../src/client/StructureModels")

local fails = 0
local function check(name, ok, detail)
	if not ok then
		fails += 1
		print(("FAIL %s%s"):format(name, detail and (": " .. tostring(detail)) or ""))
	end
end

local MATERIALS = { Sand = true, Sandstone = true, Marble = true, Slate = true, Brick = true, WoodPlanks = true,
	Metal = true, Concrete = true, Glass = true, SmoothPlastic = true, Grass = true, Neon = true }
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
		local yaw = (p.yaw or 0) % 180
		local rx, rz = math.sqrt(w * w + d * d) / 2, math.sqrt(w * w + d * d) / 2
		if yaw == 0 then
			rx, rz = w / 2, d / 2
		elseif yaw == 90 then
			rx, rz = d / 2, w / 2
		end
		check(tag .. " inside the box", math.abs(p.at[1]) + rx <= S.LIMIT.half + 1e-6
			and math.abs(p.at[3]) + rz <= S.LIMIT.half + 1e-6, ("%s,%s"):format(p.at[1], p.at[3]))
		check(tag .. " height", p.at[2] >= 0 and p.at[2] + h <= S.LIMIT.height + 1e-6, p.at[2] + h)
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

if fails > 0 then
	error(("structure-models: %d failure(s)"):format(fails))
end
print(("structure-models: ok (%d models, %d variant sets)"):format(nModels, 1))
