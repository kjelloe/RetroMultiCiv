--!strict
-- PARTIAL twin of engine/combat.js (phase 5, P5-3 batch 1): only the pure
-- helpers movement.luau imports. resolveAttack is a STUB rejecting
-- "notPorted:combat" — batch 2 replaces this module wholesale; the R-lane
-- must NOT treat the stub as final API (flagged in the P5-3 claim mail).
-- EXPORTS (stable): sortIds(ids), unitsAt(state, x, y), cityAt(state, x, y).
-- EXPORTS (stub, batch 2): resolveAttack.

-- Deterministic id ordering that needs no key order: shorter first, then
-- lexicographic — so u2 < u10. (JS twin: sortIds in engine/combat.js.)
local function sortIds(ids: { string }): { string }
	local out = table.clone(ids)
	table.sort(out, function(a, b)
		if #a ~= #b then
			return #a < #b
		end
		return a < b
	end)
	return out
end

local function unitsAt(state: any, x: number, y: number): { any }
	local out = {}
	local keys = {}
	for id in pairs(state.units) do
		table.insert(keys, id)
	end
	for _, id in sortIds(keys) do
		local u = state.units[id]
		if u.x == x and u.y == y then
			table.insert(out, u)
		end
	end
	return out
end

local function cityAt(state: any, x: number, y: number): any
	for _, id in ipairs(state.cityOrder or {}) do
		local c = state.cities[id]
		if c ~= nil and c.x == x and c.y == y then
			return c
		end
	end
	return nil
end

local function resolveAttack(_state: any, _attacker: any, _tx: number, _ty: number, _ruleset: any): any
	return { ok = false, reason = "notPorted:combat" }
end

-- called mid-move (the step already happened) — a silent rejection would
-- diverge from JS, so an unported capture must fail LOUDLY instead
local function captureCity(_state: any, _unit: any, _city: any, _events: any)
	error("notPorted:combat.captureCity")
end

return {
	sortIds = sortIds,
	unitsAt = unitsAt,
	cityAt = cityAt,
	resolveAttack = resolveAttack,
	captureCity = captureCity,
}
