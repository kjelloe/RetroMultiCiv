--!strict
-- D3 AI-diplomacy score models, twin of engine/ai-diplomacy.js. PURE integer
-- scores over personality (A59) + relationship (D1/D3) + military/proximity. No
-- ai.luau require (ai.luau requires THIS). Byte-shaped.
local leaders = require("./leaders")
local diplomacy = require("./diplomacy")

local function idiv(a: number, b: number): number
	return math.floor(a / b)
end

local function milStrength(state: any, pid: string, ruleset: any): number
	local n = 0
	for _, u in pairs(state.units) do
		if u.owner == pid and ruleset.units[u.type].attack > 0 then
			n += 1
		end
	end
	return n
end

local function weakness(state: any, me: string, other: string, ruleset: any): number
	local mine = milStrength(state, me, ruleset)
	local theirs = milStrength(state, other, ruleset)
	return idiv(mine * 100, mine + theirs + 1)
end

local function fearOf(state: any, me: string, other: string, ruleset: any): number
	local mine = milStrength(state, me, ruleset)
	local theirs = milStrength(state, other, ruleset)
	return idiv(theirs * 100, mine + theirs + 1)
end

local function cheb(map: any, ax: number, ay: number, bx: number, by: number): number
	local dx = math.abs(ax - bx)
	if map.wrapX and map.width - dx < dx then dx = map.width - dx end
	local dy = math.abs(ay - by)
	return if dx > dy then dx else dy
end

local function borderPressure(state: any, me: string, other: string, ruleset: any): number
	local r = if ruleset.rules.threatRadius == nil then 8 else ruleset.rules.threatRadius
	local myCities = {}
	for _, cid in ipairs(state.cityOrder or {}) do
		local c = state.cities[cid]
		if c ~= nil and c.owner == me then
			table.insert(myCities, c)
		end
	end
	if #myCities == 0 then return 0 end
	for _, u in pairs(state.units) do
		if u.owner == other then
			for _, c in ipairs(myCities) do
				if cheb(state.map, u.x, u.y, c.x, c.y) <= r then return 100 end
			end
		end
	end
	for _, cid in ipairs(state.cityOrder or {}) do
		local oc = state.cities[cid]
		if oc ~= nil and oc.owner == other then
			for _, c in ipairs(myCities) do
				if cheb(state.map, oc.x, oc.y, c.x, c.y) <= r then return 100 end
			end
		end
	end
	return 0
end

local function hasLaunched(state: any, pid: string): boolean
	local p = state.players[pid]
	return p ~= nil and p.spaceship ~= nil and p.spaceship.launched ~= nil and p.spaceship.launched ~= 0
end

local function scoreWarIntent(state: any, me: string, other: string, ruleset: any): number
	local d = ruleset.rules.diplomacy
	local agg = leaders.personalityOf(state, me, ruleset).aggression
	local grv = diplomacy.grievanceOf(state, me, other)
	local weak = weakness(state, me, other, ruleset)
	local border = borderPressure(state, me, other, ruleset)
	local fear = fearOf(state, me, other, ruleset)
	local trust = diplomacy.trustOf(state, me, other)
	local launch = if hasLaunched(state, other) then d.relLaunchWarBonus else 0
	return agg * d.wAgg + grv * d.wGrv + weak * d.wWeak + border * d.wBorder
		- fear * d.wFear - trust * d.wTrust + launch * d.wLaunch
end

local function scorePeaceAccept(state: any, me: string, other: string, ruleset: any): number
	local d = ruleset.rules.diplomacy
	local agg = leaders.personalityOf(state, me, ruleset).aggression
	local grv = diplomacy.grievanceOf(state, me, other)
	local fear = fearOf(state, me, other, ruleset)
	local trust = diplomacy.trustOf(state, me, other)
	local winning = weakness(state, me, other, ruleset)
	local warWeariness = 0
	return fear * d.wPFear + trust * d.wPTrust + warWeariness * d.wWeary
		- agg * d.wPAgg - grv * d.wPGrv - winning * d.wWinning
end

return {
	scoreWarIntent = scoreWarIntent,
	scorePeaceAccept = scorePeaceAccept,
	weakness = weakness,
	fearOf = fearOf,
	borderPressure = borderPressure,
	milStrength = milStrength,
	hasLaunched = hasLaunched,
}
