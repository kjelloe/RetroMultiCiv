-- XII.6 Part B (#1726 §2) — the client-side BEELINE computation, ported 1:1
-- from shared/beeline.js. Pure over the tech DAG (data/techs.json shape:
-- id -> { level, prereqs[] }) + the VIEWER's known tech ids. The research goal
-- is CLIENT-only state (never game state) — TechTree issues normal setResearch
-- commands for the returned step, so recordings replay hash-exact.

local M = {}

-- prereq closure of `goal` (including the goal): { id = true }
function M.prereqClosure(techs, goal)
	local seen = {}
	local stack = { goal }
	while #stack > 0 do
		local id = table.remove(stack)
		if not seen[id] and techs[id] ~= nil then
			seen[id] = true
			for _, p in ipairs(techs[id].prereqs or {}) do
				table.insert(stack, p)
			end
		end
	end
	return seen
end

-- researchable-now: the tech exists and every prereq is known
function M.researchableNow(techs, id, known)
	local def = techs[id]
	if def == nil then
		return false
	end
	for _, p in ipairs(def.prereqs or {}) do
		if not known[p] then
			return false
		end
	end
	return true
end

-- the NEXT tech to research toward `goal`: the shallowest researchable-now,
-- still-unknown tech in the goal's prereq closure (tie-break level then id).
-- nil when the goal is known (reached) or nothing on the path is researchable.
function M.nextBeelineStep(techs, knownArr, goal)
	if goal == nil or techs[goal] == nil then
		return nil
	end
	local known = {}
	for _, t in ipairs(knownArr or {}) do
		known[t] = true
	end
	if known[goal] then
		return nil
	end
	local closure = M.prereqClosure(techs, goal)
	local best = nil
	for id in pairs(closure) do
		if not known[id] and M.researchableNow(techs, id, known) then
			if best == nil then
				best = id
			else
				local a, b = techs[id], techs[best]
				if a.level < b.level or (a.level == b.level and id < best) then
					best = id
				end
			end
		end
	end
	return best
end

-- has the goal been reached (its id is in the known set)?
function M.goalReached(knownArr, goal)
	if goal == nil then
		return false
	end
	for _, t in ipairs(knownArr or {}) do
		if t == goal then
			return true
		end
	end
	return false
end

return M
