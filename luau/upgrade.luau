--!strict
-- Luau twin of engine/upgrade.js (N11 unit upgrades). A unit in an owned city
-- upgrades to its units.json `upgradesTo` successor for gold (3a, Civ3-shape;
-- formula in rules.upgrade). Leonardo (3b, Civ2) reuses applyUpgrade with
-- keepVeteran=false. All numbers from the ruleset.
local statehash = require("./statehash")
local cities = require("./cities")
local combat = require("./combat")

-- The city on tile (x, y), or nil. Local scan (keeps upgrade.luau dependency-free).
local function cityAtTile(state: any, x: number, y: number): any
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.x == x and c.y == y then return c end
	end
	return nil
end

-- Replace a unit with its upgradesTo successor IN PLACE (reviewer R2, pinned once
-- for both windows). moves = min(remaining, new type's moves): no movement refund
-- (the pay-to-move exploit). NO persistent hp in this engine, so nothing else
-- resets. veteran per keepVeteran (3a paid = carry; 3b Leonardo = drop). Returns
-- the old type.
local function applyUpgrade(state: any, unit: any, ruleset: any, keepVeteran: boolean): string
	local from = unit.type
	local targetId = ruleset.units[from].upgradesTo
	local newDef = ruleset.units[targetId]
	unit.type = targetId
	if unit.moves > newDef.moves then unit.moves = newDef.moves end
	if keepVeteran ~= true then unit.veteran = false end
	return from
end

-- The successor's gold cost, or nil if there is no successor.
local function upgradeCost(unit: any, ruleset: any): number?
	local def = ruleset.units[unit.type]
	local targetId = def.upgradesTo
	if targetId == nil then return nil end
	local newDef = ruleset.units[targetId]
	if newDef == nil then return nil end
	local diff = newDef.cost - def.cost
	local up = ruleset.rules.upgrade
	return up.baseGold + up.goldPerShield * (if diff > 0 then diff else 0)
end

-- upgradeUnit { unitId } — window 3a, human-issued (AI never sends it).
local function upgradeUnit(state: any, cmd: any, ruleset: any): any
	local unit = state.units[cmd.unitId]
	if unit == nil then return { ok = false, reason = "unknownUnit" } end
	if unit.owner ~= cmd.playerId then return { ok = false, reason = "notYourUnit" } end
	if state.activePlayer ~= cmd.playerId then return { ok = false, reason = "notYourTurn" } end
	local city = cityAtTile(state, unit.x, unit.y)
	if city == nil or city.owner ~= unit.owner then return { ok = false, reason = "notInCity" } end
	local def = ruleset.units[unit.type]
	local targetId = def.upgradesTo
	if targetId == nil then return { ok = false, reason = "noUpgrade" } end
	local newDef = ruleset.units[targetId]
	if newDef == nil then return { ok = false, reason = "noUpgrade" } end
	local player = state.players[cmd.playerId]
	if newDef.tech ~= "" and table.find(player.techs, newDef.tech) == nil then
		return { ok = false, reason = "noUpgrade" }
	end
	local cost = upgradeCost(unit, ruleset)
	if player.gold < cost then return { ok = false, reason = "notEnoughGold" } end
	player.gold = player.gold - cost
	local from = applyUpgrade(state, unit, ruleset, true)
	local events = setmetatable({}, statehash.ARRAY_MT)
	table.insert(events, {
		type = "unitUpgraded", playerId = cmd.playerId, unitId = unit.id,
		from = from, to = unit.type, gold = cost,
	})
	return { ok = true, events = events }
end

-- N11 3b Leonardo's Workshop: called from grantTech on any tech acquisition. If
-- the player owns an ACTIVE Leonardo, every eligible unit upgrades ONE step
-- (upgradesTo + owner knows the successor tech), FREE, veteran DROPPED. sortIds
-- order, no RNG, no unitOrder field. Emits unitUpgraded per upgrade.
local function leonardoUpgrade(state: any, playerId: string, ruleset: any, events: any)
	local wonderId = if ruleset.rules.upgrade == nil then nil else ruleset.rules.upgrade.leonardoWonder
	if wonderId == nil then return end
	if state.wonders == nil or state.wonders[wonderId] == nil then return end
	if not cities.wonderActive(state, wonderId, ruleset) then return end
	local wcity = state.cities[state.wonders[wonderId]]
	if wcity == nil or wcity.owner ~= playerId then return end
	local player = state.players[playerId]
	local ids = {}
	for uid in pairs(state.units) do
		table.insert(ids, uid)
	end
	for _, uid in ipairs(combat.sortIds(ids)) do
		local unit = state.units[uid]
		if unit ~= nil and unit.owner == playerId then
			local targetId = ruleset.units[unit.type].upgradesTo
			if targetId ~= nil then
				local newDef = ruleset.units[targetId]
				if newDef.tech == "" or table.find(player.techs, newDef.tech) ~= nil then
					local from = applyUpgrade(state, unit, ruleset, false)
					table.insert(events, { type = "unitUpgraded", playerId = playerId, unitId = unit.id, from = from, to = unit.type, gold = 0 })
				end
			end
		end
	end
end

return {
	upgradeUnit = upgradeUnit,
	applyUpgrade = applyUpgrade,
	upgradeCost = upgradeCost,
	cityAtTile = cityAtTile,
	leonardoUpgrade = leonardoUpgrade,
}
