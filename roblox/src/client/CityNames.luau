-- F1 (docs/13): the found-city name suggestion + input cleanup. Pure view
-- math (lune-pinned by roblox/selftest/city-names.luau, check.sh gate 33).
-- suggest() mirrors the browser's ctx.suggestCityName (client/main.js): the
-- next unused name from the viewer civ's roster, else a numbered fallback.
-- "Unused" reads the VIEW, so a name on a city under fog can repeat — the
-- same limit the browser has in a server game.

local M = {}

M.MAX_NAME = 24 -- GameServer MAX_CMD_NAME / server/protocol.js

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			n += 1
		end
	end
	return n
end

function M.fallback(view, taken)
	local n = ownCityCount(view) + 1
	while taken ~= nil and taken["Colony " .. n] == true do
		n += 1
	end
	return "Colony " .. n
end

function M.suggest(view, civs)
	local taken = {}
	for _, c in pairs(view.cities) do
		if c.name ~= nil then
			taken[c.name] = true
		end
	end
	local me = view.players ~= nil and view.players[view.you] or nil
	local civ = me ~= nil and me.civ ~= nil and civs ~= nil and civs[me.civ] or nil
	if civ ~= nil and civ.cities ~= nil then
		for _, name in ipairs(civ.cities) do
			if taken[name] ~= true then
				return name
			end
		end
	end
	return M.fallback(view, taken)
end

-- typed text -> a state-legal name (printable ASCII, trimmed, single-spaced,
-- <= MAX_NAME) or nil when nothing usable is left
function M.clean(text)
	if type(text) ~= "string" then
		return nil
	end
	local s = text:gsub("[^\32-\126]", ""):gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
	s = s:sub(1, M.MAX_NAME):gsub(" $", "")
	if s == "" then
		return nil
	end
	return s
end

return M
