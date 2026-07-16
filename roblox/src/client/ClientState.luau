-- R4: client-side session state (roblox/SPEC.md §3e). One module owns the
-- RemoteEvent channel and the latest VIEW — every client script reads from
-- here. The view is all the client ever knows (the visibility law): it comes
-- from the server's filterView and nothing else.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remote = ReplicatedStorage:WaitForChild("RMC")

local M = {
	view = nil, -- filterView table: you/turn/year/activePlayer/map/units/cities/players
	playerId = nil,
	gameOver = false,
	selectedUnitId = nil,
	possessedUnitId = nil, -- R5: unit the avatar is riding (Possess.client.luau)
	followAvatar = false,
	TILE = 4, -- studs per tile edge (must match ViewRenderer)
}

local viewCallbacks = {}
local cityOpenCallbacks = {}
local eventCallbacks = {} -- R6: filtered round events riding view pushes
local researchOpenCallbacks = {} -- R6: research picker open/toggle channel
local nextCommandId = 1

-- lazy client-side ruleset tables (R5 city panel): same baked JSON, same
-- json2lua parser as the server — read-only display data, never game logic
local rulesetCache = nil
function M.rulesets()
	if rulesetCache == nil then
		local json2lua = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("json2lua"))
		local folder = ReplicatedStorage:WaitForChild("GameData"):WaitForChild("rulesets")
		rulesetCache = {}
		for _, name in ipairs({ "units", "buildings", "wonders", "techs", "rules", "terrain", "governments" }) do
			rulesetCache[name] = json2lua.parse(require(folder:WaitForChild(name)))
		end
	end
	return rulesetCache
end

function M.onCityOpen(cb)
	table.insert(cityOpenCallbacks, cb)
end

function M.openCity(cityId)
	for _, cb in ipairs(cityOpenCallbacks) do
		cb(cityId)
	end
end

function M.onEvents(cb)
	table.insert(eventCallbacks, cb)
end

function M.onResearchOpen(cb)
	table.insert(researchOpenCallbacks, cb)
end

function M.openResearch()
	for _, cb in ipairs(researchOpenCallbacks) do
		cb()
	end
end

function M.onView(cb)
	table.insert(viewCallbacks, cb)
	if M.view ~= nil then
		cb(M.view)
	end
end

function M.send(cmdTable)
	local id = nextCommandId
	nextCommandId += 1
	remote:FireServer({ t = "cmd", commandId = id, cmd = cmdTable })
	return id
end

function M.myTurn()
	return M.view ~= nil and M.view.activePlayer == M.playerId
end

-- own unit standing on tile (x, y), if any — reads the VIEW only
function M.ownUnitAt(x, y)
	if M.view == nil then
		return nil
	end
	for id, u in pairs(M.view.units) do
		if u.x == x and u.y == y and u.owner == M.playerId then
			return u
		end
	end
	return nil
end

remote.OnClientEvent:Connect(function(msg)
	if typeof(msg) ~= "table" then
		return
	end
	if msg.t == "joined" then
		M.playerId = msg.playerId
		print(("[Client] joined as %s (turn %d, %s active)"):format(msg.playerId, msg.turn, msg.activePlayer))
	end
	if msg.t == "joined" or msg.t == "view" then
		M.view = msg.view
		M.gameOver = msg.gameOver == true
		if M.selectedUnitId ~= nil and M.view.units[M.selectedUnitId] == nil then
			M.selectedUnitId = nil -- unit died or left our sight
		end
		if M.possessedUnitId ~= nil and M.view.units[M.possessedUnitId] == nil then
			M.possessedUnitId = nil -- ridden unit died; Possess handles the dismount
		end
		for _, cb in ipairs(viewCallbacks) do
			cb(M.view)
		end
		if msg.events ~= nil and #msg.events > 0 then
			for _, cb in ipairs(eventCallbacks) do
				cb(msg.events, M.view)
			end
		end
	elseif msg.t == "rejected" then
		print(("[Client] rejected (commandId %s): %s"):format(tostring(msg.commandId), tostring(msg.code)))
	end
end)

remote:FireServer({ t = "join" })

return M
