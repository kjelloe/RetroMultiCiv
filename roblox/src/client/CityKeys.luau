-- City keys (plan R6.2; the browser's input.js): with a city open, 1 / 2 / 3
-- build Militia / Phalanx / Settlers and C steps to the next building or
-- wonder it can build; Home flies to the capital (the browser's C with no
-- city; C stays the Cities list here). Pure; roblox/selftest/city-keys.luau,
-- gate 74.
local M = {}

M.PRODUCTION_KEYS = { [1] = "militia", [2] = "phalanx", [3] = "settlers" }

-- the browser's cycle list: buildings not yet in the city, then wonders no one
-- has built, each with its advance known (or none needed), ids sorted
function M.cycleOptions(city, techs, rs, builtWonders)
	local function known(t)
		return t == nil or t == "" or table.find(techs or {}, t) ~= nil
	end
	local out = {}
	local ids = {}
	for id in pairs(rs.buildings) do
		ids[#ids + 1] = id
	end
	table.sort(ids)
	for _, id in ipairs(ids) do
		if table.find(city.buildings or {}, id) == nil and known(rs.buildings[id].tech) then
			out[#out + 1] = { kind = "building", id = id }
		end
	end
	ids = {}
	for id in pairs(rs.wonders) do
		ids[#ids + 1] = id
	end
	table.sort(ids)
	for _, id in ipairs(ids) do
		if (builtWonders == nil or builtWonders[id] == nil) and known(rs.wonders[id].tech) then
			out[#out + 1] = { kind = "wonder", id = id }
		end
	end
	return out
end

-- the item C switches to: the one after the current build, wrapping; the
-- first one when the city builds a unit. nil when there is nothing to build.
function M.nextBuild(city, techs, rs, builtWonders)
	local options = M.cycleOptions(city, techs, rs, builtWonders)
	if #options == 0 then
		return nil
	end
	local at = 0
	local p = city.producing
	for i, o in ipairs(options) do
		if p ~= nil and o.kind == p.kind and o.id == p.id then
			at = i
		end
	end
	return options[at % #options + 1]
end

return M
