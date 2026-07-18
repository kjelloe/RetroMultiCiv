--!strict
-- Luau twin of shared/strategic.js strategicSnapshot: a PURE derived read of full
-- state -> { stance, gov, mode, threat, units, producing, topGoal }. GOLDEN-NEUTRAL
-- (no state/rng). Byte-shaped with the JS; the SO17 spectator overlay ports off it.
-- Counts are order-independent so pairs() is safe; topGoal replicates JS's stable
-- Object.entries+sort by iterating the fixed prod-key order and keeping the FIRST max.
local function strategicSnapshot(state: any, pid: string, ruleset: any): any
	local U = ruleset.units
	local threatR = if ruleset.rules.threatRadius == nil then 8 else ruleset.rules.threatRadius
	local W = state.map.width
	local function cheb(ax: number, ay: number, bx: number, by: number): number
		local dx = math.min(math.abs(ax - bx), W - math.abs(ax - bx))
		return math.max(dx, math.abs(ay - by))
	end
	local mil, settlers, scouts, naval = 0, 0, 0, 0
	for _, u in pairs(state.units) do
		if u.owner == pid then
			local d = U[u.type]
			if u.type == "settlers" then
				settlers += 1
			elseif d.domain == "sea" then
				naval += 1
			elseif d.attack > 0 then
				mil += 1
				if d.moves >= 2 then
					scouts += 1
				end
			end
		end
	end
	local prod = { attacker = 0, settler = 0, defender = 0, building = 0, wonder = 0, other = 0 }
	local myCities = {}
	for _, cid in ipairs(state.cityOrder) do
		local c = state.cities[cid]
		if c.owner == pid then
			table.insert(myCities, c)
			local pr = c.producing
			if pr == nil then
				prod.other += 1
			elseif pr.kind == "building" then
				prod.building += 1
			elseif pr.kind == "wonder" then
				prod.wonder += 1
			elseif pr.kind == "unit" then
				if pr.id == "settlers" then
					prod.settler += 1
				else
					local d = U[pr.id]
					if d ~= nil and d.attack > 0 and d.attack >= d.defense then
						prod.attacker += 1
					elseif d ~= nil and d.defense > 0 then
						prod.defender += 1
					else
						prod.other += 1
					end
				end
			else
				prod.other += 1
			end
		end
	end
	local threat = 0
	for _, u in pairs(state.units) do
		if u.owner ~= pid then
			for _, c in ipairs(myCities) do
				if cheb(u.x, u.y, c.x, c.y) <= threatR then
					threat += 1
					break
				end
			end
		end
	end
	local threatBucket = if threat == 0 then "none" elseif threat < 3 then "low" elseif threat < 8 then "med" else "high"
	local mode
	if prod.attacker > 0 and threat >= 3 then
		mode = "warring"
	elseif prod.settler >= prod.building + prod.wonder and prod.settler > 0 then
		mode = "expanding"
	elseif (prod.building + prod.wonder) > 0 then
		mode = "building"
	else
		mode = "defending"
	end
	local order = { "attacker", "settler", "defender", "building", "wonder", "other" }
	local topGoal = order[1]
	local maxVal = prod[order[1]]
	for i = 2, #order do
		if prod[order[i]] > maxVal then
			maxVal = prod[order[i]]
			topGoal = order[i]
		end
	end
	local pstance = state.players[pid].stance
	local pgov = state.players[pid].government
	return {
		stance = if pstance ~= nil and pstance ~= "" then pstance else "balanced",
		gov = if pgov ~= nil and pgov ~= "" then pgov else "despotism",
		mode = mode,
		threat = threatBucket,
		units = { mil = mil, settlers = settlers, scouts = scouts, naval = naval },
		producing = prod,
		topGoal = topGoal,
	}
end

return {
	strategicSnapshot = strategicSnapshot,
}
