-- A20 starting-age fast-forward (design in agent-workitems A20, 2026-07-13):
-- later-age starts run the whole world as AI up to the age's turn, then grant
-- every civ the cumulative techs of prior eras and hand the humans their
-- seats. Pure engine-API consumer — the same public loop the sim driver
-- and the session AI-drive use; no engine changes, nothing stored beyond the
-- ordinary state. TWIN of shared/fastforward.js (architect grant @0acb4ef4,
-- pathfind precedent: NEW FILE ONLY, siblings required never edited;
-- golden-neutral by construction — create-time only, the goldens never
-- run through it).

local index = require("./index")
local ai = require("./ai")

local M = {}

-- Grant the union of the named eras' techs to EVERY player — identical list
-- for all civs (fairness), deduped against what the AI already researched,
-- sorted for a deterministic canonical state. Research resets: the player
-- picks fresh at takeover; bulbs zero out (no carried progress).
function M.applyAgeGrant(state: any, age: any, ruleset: any): any
	local grant = {}
	local eras = {}
	local except = {}
	for _, e in ipairs(age.grantEras == nil and {} or age.grantEras) do
		eras[e] = true
	end
	for _, t in ipairs(age.except == nil and {} or age.except) do
		except[t] = true -- Space Age: everything but Future Tech
	end
	local techIds = {}
	for id in pairs(ruleset.techs) do
		table.insert(techIds, id)
	end
	table.sort(techIds)
	for _, id in ipairs(techIds) do
		if eras[ruleset.techs[id].era] == true and except[id] ~= true then
			table.insert(grant, id)
		end
	end
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		local merged = {}
		for _, t in ipairs(p.techs) do
			merged[t] = true
		end
		for _, t in ipairs(grant) do
			merged[t] = true
		end
		local techs = {}
		for t in pairs(merged) do
			table.insert(techs, t)
		end
		table.sort(techs)
		p.techs = techs
		p.researching = ""
		p.bulbs = 0
	end
	return grant
end

-- Drive full all-AI rounds toward targetTurn. Returns a stepper so callers
-- can chunk work; loop step() to completion. Aborts — never re-rolls —
-- when the game ends or a to-be-human civ dies (deterministic UX: the
-- player picks another seed/age/civ knowingly).
function M.createFastForward(ruleset: any, initialState: any, opts: any): any
	local engine = index.createEngine(ruleset)
	local humanSeats = (opts ~= nil and opts.humanSeats) or {}
	local state = initialState
	local aborted = nil

	local function deadHumanSeat()
		for _, pid in ipairs(humanSeats) do
			if state.players[pid] ~= nil and state.players[pid].alive == false then
				return pid
			end
		end
		return nil
	end

	local ff = {}
	function ff.state()
		return state
	end
	function ff.turn()
		return state.turn
	end
	function ff.aborted()
		return aborted
	end
	-- run up to `rounds` full game turns; returns { done, aborted }
	function ff.step(rounds: number, targetTurn: number): any
		for _ = 1, rounds do
			if state.turn >= targetTurn or aborted ~= nil then
				break
			end
			local startTurn = state.turn
			local guard = #state.playerOrder + 2
			while state.turn == startTurn and state.gameOver ~= true and guard > 0 do
				guard -= 1
				local pid = state.activePlayer
				if state.players[pid].alive ~= false then
					state = ai.runAiTurn(engine, state, pid, ruleset, {})
				end
				local res = engine.applyCommand(state, { type = "endTurn", playerId = pid })
				if not res.ok then
					aborted = { reason = "wedged", detail = res.reason }
					break
				end
				state = res.state
			end
			if state.gameOver == true then
				aborted = { reason = "gameOver", winner = state.winner }
			end
			local dead = deadHumanSeat()
			if aborted == nil and dead ~= nil then
				aborted = { reason = "civEliminated", playerId = dead, name = state.players[dead].name }
			end
		end
		return { done = state.turn >= targetTurn or aborted ~= nil, aborted = aborted }
	end
	return ff
end

-- Server-side convenience (createGame, checks): run to completion, then grant
-- and flip the chosen seats human. Returns { state, grant } or { aborted }.
function M.fastForwardTo(ruleset: any, initialState: any, age: any, humanSeats: any): any
	if age.turn == 0 then
		return { state = initialState, grant = {} } -- Ancient: today's behavior
	end
	local ff = M.createFastForward(ruleset, initialState, { humanSeats = humanSeats })
	local r = { done = false }
	while not r.done do
		r = ff.step(50, age.turn)
	end
	if ff.aborted() ~= nil then
		return { aborted = ff.aborted() }
	end
	local state = ff.state()
	local grant = M.applyAgeGrant(state, age, ruleset)
	for _, pid in ipairs(humanSeats) do
		state.players[pid].human = true
	end
	return { state = state, grant = grant }
end

return M
