--!strict
-- Luau twin of tools/replay.js (phase 5, P5-8 Gate C): replay a
-- retromulticiv-diagnostics file through the LUAU engine and verify every
-- recorded hash. The conformance criterion is VERDICT EQUALITY with the JS
-- replayer: same commands/rounds counts, same final hash, and — for stale
-- recordings — the same first-divergence entry with the same computed hash.
-- Both engines agreeing about how a recording diverges is as strong a
-- cross-language statement as both agreeing that it passes.
--
-- Usage (lune):  lune run luau/replay.luau <file.json> [more files...]
-- Output format matches tools/replay.js line for line (the Node test diffs
-- the two reports).

local fs = require("@lune/fs")
local process = require("@lune/process")

local json2lua = require("./json2lua")
local statehash = require("./statehash")
local engineModule = require("./index")
local aiModule = require("./ai")

local function loadRuleset()
	local ruleset = {}
	for _, f in ipairs({ "terrain", "units", "techs", "buildings", "wonders", "governments", "civs", "rules" }) do
		ruleset[f] = json2lua.parse(fs.readFile("data/" .. f .. ".json"))
	end
	return ruleset
end

local function sortedKeys(t: any): { string }
	local keys = {}
	for k in pairs(t) do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

local function replayDiagnostics(diag: any, baseRuleset: any): any
	if diag.initialState == nil then
		return {
			commands = 0, rounds = 0, turn = 0, finalHash = "",
			problems = { "no initialState — a client in SERVER mode (?server=1) only holds views; "
				.. "the authoritative recording is inside the server save: replay saves/<gameId>.json instead" },
		}
	end
	local ruleset = baseRuleset
	if diag.rulesOverrides ~= nil and next(diag.rulesOverrides) ~= nil then
		local merged = {}
		for _, k in ipairs(sortedKeys(ruleset.rules)) do
			merged[k] = ruleset.rules[k]
		end
		for _, k in ipairs(sortedKeys(diag.rulesOverrides)) do
			merged[k] = diag.rulesOverrides[k]
		end
		local shallow = {}
		for _, k in ipairs(sortedKeys(ruleset)) do
			shallow[k] = ruleset[k]
		end
		shallow.rules = merged
		ruleset = shallow
	end
	local engine = engineModule.createEngine(ruleset)
	json2lua.assertState(diag.initialState)
	local state = engineModule.deepClone(diag.initialState)
	local problems = {}
	local commands = 0
	local rounds = 0

	for i, entry in ipairs(diag.log) do
		if #problems >= 5 then
			break -- after a divergence everything differs
		end
		local jsIndex = i - 1 -- report entries 0-based like tools/replay.js
		if entry.t == "cmd" then
			commands += 1
			local res = engine.applyCommand(state, entry.cmd)
			if res.ok ~= entry.ok then
				local why = if res.reason ~= nil then " (" .. res.reason .. ")" else ""
				local rec = if entry.reason ~= nil then " (" .. entry.reason .. ")" else ""
				table.insert(problems, string.format("entry %d (%s): ok=%s%s, recorded ok=%s%s",
					jsIndex, entry.cmd.type, tostring(res.ok), why, tostring(entry.ok), rec))
			else
				if res.ok then
					state = res.state
				end
				if entry.hash ~= nil and entry.hash ~= json2lua.NULL and res.ok then
					local h = statehash.hashState(state)
					if h ~= entry.hash then
						table.insert(problems, string.format("entry %d (%s): hash %s, recorded %s",
							jsIndex, entry.cmd.type, h, entry.hash))
					end
				end
			end
		elseif entry.t == "round" then
			rounds += 1
			local first = engine.applyCommand(state, { type = "endTurn", playerId = state.activePlayer })
			if not first.ok then
				table.insert(problems, string.format("entry %d (round): endTurn rejected (%s)", jsIndex, tostring(first.reason)))
				break
			end
			state = first.state
			local guard = 10
			while not state.gameOver and not state.players[state.activePlayer].human and guard > 0 do
				guard -= 1
				state = aiModule.runAiTurn(engine, state, state.activePlayer, ruleset, nil)
				local res = engine.applyCommand(state, { type = "endTurn", playerId = state.activePlayer })
				if not res.ok then
					break
				end
				state = res.state
			end
			local h = statehash.hashState(state)
			if h ~= entry.hash then
				table.insert(problems, string.format("entry %d (round -> turn %d): hash %s, recorded %s",
					jsIndex, state.turn, h, tostring(entry.hash)))
			end
		elseif entry.t == "airound" then
			rounds += 1
			local chaosBySlot: { [string]: { any } } = {}
			for _, c in ipairs(entry.chaos or {}) do
				if chaosBySlot[c.playerId] == nil then
					chaosBySlot[c.playerId] = {}
				end
				table.insert(chaosBySlot[c.playerId], c)
			end
			local startTurn = state.turn
			local guard = #state.playerOrder + 2
			local rejected = false
			while state.turn == startTurn and not state.gameOver and guard > 0 do
				guard -= 1
				local pid = state.activePlayer
				for _, c in ipairs(chaosBySlot[pid] or {}) do
					commands += 1
					local cres = engine.applyCommand(state, c.cmd)
					if cres.ok ~= c.ok then
						local why = if cres.reason ~= nil then " (" .. cres.reason .. ")" else ""
						local rec = if c.reason ~= nil then " (" .. c.reason .. ")" else ""
						table.insert(problems, string.format("entry %d (airound chaos %s): ok=%s%s, recorded ok=%s%s",
							jsIndex, c.cmd.type, tostring(cres.ok), why, tostring(c.ok), rec))
					end
					if cres.ok then
						state = cres.state
					end
				end
				if state.players[pid].alive ~= false then
					state = aiModule.runAiTurn(engine, state, pid, ruleset, nil)
				end
				local res = engine.applyCommand(state, { type = "endTurn", playerId = pid })
				if not res.ok then
					table.insert(problems, string.format("entry %d (airound): endTurn rejected (%s)", jsIndex, tostring(res.reason)))
					rejected = true
					break
				end
				state = res.state
			end
			if rejected then
				break
			end
			if entry.hash ~= nil and entry.hash ~= json2lua.NULL then
				local h = statehash.hashState(state)
				if h ~= entry.hash then
					table.insert(problems, string.format("entry %d (airound -> turn %d): hash %s, recorded %s",
						jsIndex, state.turn, h, entry.hash))
				end
			end
		end
	end

	local finalHash = statehash.hashState(state)
	if #problems == 0 and diag.finalHash ~= nil and diag.finalHash ~= json2lua.NULL and finalHash ~= diag.finalHash then
		table.insert(problems, string.format("final state: hash %s, recorded %s", finalHash, tostring(diag.finalHash)))
	end
	return { commands = commands, rounds = rounds, turn = state.turn, finalHash = finalHash, problems = problems }
end

local ruleset = loadRuleset()
for _, file in ipairs(process.args) do
	local raw = json2lua.parse(fs.readFile(file))
	local diag = raw
	if raw.format == "retromulticiv-server-save" and raw.diag ~= nil then
		diag = raw.diag
		-- #1870 slice 2: reconstruct the full per-command log from the sidecar
		-- (<gameId>.log.jsonl next to the save) when the save embeds round-hashes
		-- only. Byte-for-byte the same note + reconstruction as tools/replay.js.
		if diag.logTruncated and diag.sidecar ~= nil then
			local dir = string.match(file, "^(.*)[/\\][^/\\]*$")
			local scPath = if dir ~= nil then dir .. "/" .. diag.sidecar else diag.sidecar
			if fs.isFile(scPath) then
				local entries = {}
				for _, line in ipairs(string.split(fs.readFile(scPath), "\n")) do
					if line ~= "" then
						table.insert(entries, json2lua.parse(line))
					end
				end
				local nd = {}
				for k, v in pairs(diag) do
					nd[k] = v
				end
				nd.log = entries
				diag = nd
				print("server save (game " .. tostring(raw.gameId) .. ") — replaying its per-command sidecar (" .. tostring(diag.sidecar) .. ")")
			else
				print("server save (game " .. tostring(raw.gameId) .. ") — sidecar " .. tostring(diag.sidecar) .. " missing; replaying round-hashes only")
			end
		else
			print("server save (game " .. tostring(raw.gameId) .. ") — replaying its embedded diagnostics")
		end
	end
	if diag.format ~= "retromulticiv-diagnostics" then
		print("not a diagnostics file (format: " .. tostring(diag.format) .. ")")
	else
		local report = replayDiagnostics(diag, ruleset)
		print(string.format("replayed %d commands + %d rounds -> turn %d, final hash %s",
			report.commands, report.rounds, report.turn, report.finalHash))
		if #report.problems == 0 then
			print("OK: the recorded game reproduces exactly")
		else
			print(string.format("DIVERGENCE (%d problem%s):", #report.problems, if #report.problems > 1 then "s" else ""))
			for _, p in ipairs(report.problems) do
				print("  " .. p)
			end
		end
	end
end
