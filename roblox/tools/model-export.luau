-- lune: prints the model sheet as JSON for roblox/tools/model-preview.js.
--   lune run roblox/tools/model-export.luau variants pyramids
--   lune run roblox/tools/model-export.luau models pyramids,colossus   (or: models all)
local process = require("@lune/process")
local serde = require("@lune/serde")
local S = require("../src/client/StructureModels")
require("../src/client/BuildingModels")(S)
require("../src/client/EmblemModels")(S)
require("../src/client/CivEmblems")(S)
local fs = require("@lune/fs")

local mode, arg = process.args[1], process.args[2]
local cells = {}
local function add(label, def, roles)
	local parts = S.expand(def)
	cells[#cells + 1] = { label = ("%s - %d parts"):format(label, #parts), ground = S.ROLES[def.ground].color,
		camera = def.camera, parts = parts, roles = roles }
end
if mode == "variants" then
	for _, v in ipairs(S.VARIANTS[arg] or {}) do
		add(("%s %s: %s"):format(arg, v.key, v.name), v)
	end
elseif mode == "governments" or mode == "concepts" or mode == "civs" then
	local civs = mode == "civs" and serde.decode("json", fs.readFile("data/civs.json")) or {}
	local ids = {}
	for id in pairs(S.EMBLEMS[mode]) do
		ids[#ids + 1] = id
	end
	table.sort(ids)
	local from, to = (arg or "1-99"):match("^(%d+)-(%d+)$")
	for i, id in ipairs(ids) do
		if i >= tonumber(from) and i <= tonumber(to) then
			local v = civs[id] ~= nil and civs[id].visual or nil
			add(id, S.EMBLEMS[mode][id], v ~= nil and { civPrimary = v.primary, civSecondary = v.secondary } or nil)
		end
	end
else
	local ids = {}
	if arg == nil or arg == "all" then
		for id in pairs(S.MODELS) do
			ids[#ids + 1] = id
		end
		table.sort(ids)
	else
		ids = arg:split(",")
	end
	for _, id in ipairs(ids) do
		if S.MODELS[id] ~= nil then
			add(id, S.MODELS[id])
		end
	end
end
local roles = {}
for name, def in pairs(S.ROLES) do
	roles[name] = def.color
end
print(serde.encode("json", { cells = cells, roles = roles, half = S.LIMIT.half }))
