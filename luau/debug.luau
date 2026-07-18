--!strict
-- Luau twin of engine/debug.js (N12 / A92 debug commands). God-mode family
-- (grantGold / spawnUnit / grantTech / revealMap) gated on state.debugEnabled;
-- recorded like any command; the first use sets state.debugUsed=true PERMANENTLY.
-- Both fields OMIT-SAFE. No turn check; any target player.
local statehash = require("./statehash")
local tech = require("./tech")

local function debugCommand(state: any, cmd: any, ruleset: any): any
	if state.debugEnabled ~= true then return { ok = false, reason = "debugDisabled" } end
	local player = state.players[cmd.playerId]
	if player == nil then return { ok = false, reason = "unknownPlayer" } end
	local action = cmd.action
	local events = setmetatable({}, statehash.ARRAY_MT)

	if action == "grantGold" then
		player.gold = player.gold + cmd.amount
		if player.gold < 0 then player.gold = 0 end
	elseif action == "spawnUnit" then
		local def = ruleset.units[cmd.unitType]
		if def == nil then return { ok = false, reason = "badUnitType" } end
		if cmd.x < 0 or cmd.x >= state.map.width or cmd.y < 0 or cmd.y >= state.map.height then
			return { ok = false, reason = "outOfBounds" }
		end
		for uid in pairs(state.units) do
			local u = state.units[uid]
			if u.x == cmd.x and u.y == cmd.y and u.owner ~= cmd.playerId then
				return { ok = false, reason = "occupiedByEnemy" }
			end
		end
		local unitId = "u" .. state.nextUnitId
		state.nextUnitId = state.nextUnitId + 1
		state.units[unitId] = {
			id = unitId, type = cmd.unitType, owner = cmd.playerId,
			x = cmd.x, y = cmd.y, moves = def.moves, fortified = false, veteran = false,
		}
	elseif action == "grantTech" then
		if ruleset.techs[cmd.tech] == nil then return { ok = false, reason = "unknownTech" } end
		if table.find(player.techs, cmd.tech) ~= nil then return { ok = false, reason = "alreadyKnown" } end
		tech.grantTech(state, cmd.playerId, cmd.tech, ruleset, events)
	elseif action == "revealMap" then
		local size = state.map.width * state.map.height
		local explored = setmetatable({}, statehash.ARRAY_MT)
		for _ = 1, size do
			table.insert(explored, 1)
		end
		player.explored = explored
	else
		return { ok = false, reason = "unknownDebugAction" }
	end

	state.debugUsed = true
	table.insert(events, { type = "debugCommand", playerId = cmd.playerId, action = action })
	return { ok = true, events = events }
end

return {
	debugCommand = debugCommand,
}
