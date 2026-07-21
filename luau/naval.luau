--!strict
-- Luau twin of engine/naval.js (naval-truth Bundle 2): the trireme open-sea gamble.
-- At turn-wrap, each unit flagged openSeaLoss NOT adjacent to a land tile rolls
-- rollRange(state.rng, 100) < rules.trireme.lossChancePct -> lost (its cargo drowns).
-- RNG-WHEN-ELIGIBLE (draw ONLY for an at-risk unit, fixed sortIds order). Applies to ALL
-- owners incl AI. Matches engine/naval.js. EXPORTS: process(state, ruleset, events).

local rng = require("./rng")
local combat = require("./combat")

local ADJ8 = {
	{ dx = 0, dy = -1 }, { dx = 1, dy = -1 }, { dx = 1, dy = 0 }, { dx = 1, dy = 1 },
	{ dx = 0, dy = 1 }, { dx = -1, dy = 1 }, { dx = -1, dy = 0 }, { dx = -1, dy = -1 },
}

-- is (x, y) adjacent to a LAND tile (a safe harbour)?
local function adjacentToLand(state: any, x: number, y: number, ruleset: any): boolean
	local W, H = state.map.width, state.map.height
	for _, o in ipairs(ADJ8) do
		local nx = x + o.dx
		if nx < 0 or nx >= W then
			if state.map.wrapX ~= true then
				continue
			end
			nx = ((nx % W) + W) % W
		end
		local ny = y + o.dy
		if ny < 0 or ny >= H then
			continue
		end
		if ruleset.terrain.terrains[state.map.tiles[ny * W + nx + 1].t].domain == "land" then
			return true
		end
	end
	return false
end

local function keysOf(t: any): { string }
	local ks = {}
	for k in pairs(t) do
		table.insert(ks, k)
	end
	return ks
end

-- once per game turn (turn-wrap): the open-sea trireme gamble.
local function process(state: any, ruleset: any, events: any)
	local t = ruleset.rules.trireme
	if t == nil then
		return
	end
	for _, id in ipairs(combat.sortIds(keysOf(state.units))) do
		local u = state.units[id]
		if u == nil then
			continue
		end
		if ruleset.units[u.type].openSeaLoss ~= true then
			continue
		end
		if adjacentToLand(state, u.x, u.y, ruleset) then
			continue
		end
		local roll = rng.rollRange(state.rngState, 100)
		state.rngState = roll.rngState
		if roll.value < t.lossChancePct then
			for _, cid in ipairs(combat.sortIds(keysOf(state.units))) do
				local c = state.units[cid]
				if c ~= nil and c.aboard == u.id then
					state.units[cid] = nil
					table.insert(events, { type = "cargoLost", unitId = cid, owner = c.owner, shipId = u.id, x = u.x, y = u.y })
				end
			end
			state.units[id] = nil
			table.insert(events, { type = "triremeLost", unitId = u.id, owner = u.owner, x = u.x, y = u.y })
		end
	end
end

return {
	process = process,
}
