-- R4→R9: the authoritative engine loop over RemoteEvents (roblox/SPEC.md §3d)
-- + the Tier-3 LOBBY (user design 2026-07-16, docs/13): the place boots
-- GAMELESS — players spawn on the observation deck (Deck.luau) and drive
-- everything through pads. START pad → host + 60s setup window; JOIN pad →
-- claim a human seat; host completes → 30s countdown → createGame; TAKE OVER
-- pad (running) → RANDOM vacant human seat. Vacant/absent human seats are
-- REGENT-driven (the browser A40 shape: parallel server map, state.human
-- stays true, regent commands log as ORDINARY cmd entries via the REAL
-- ai.pickCommand — round entries only ever cover an endTurn + trailing
-- engine-AI turns, which is exactly what tools/replay.js re-derives).
--
-- THE LAW (banked @77b4ae09): clients only ever receive
-- visibility.filterView(state, seat) / filterEvents — never raw state.
-- Unseated visitors get LOBBY messages only (Tier-3 spectator default: no
-- omniscient view, no fog leak).
--
-- Acceptance instrumentation (@c0ad3988) unchanged: [R4INIT] (now carries
-- humans=N), [R4LOG] per entry, [R4CODE] per round — assemble.js re-drives.
-- NO CHAT (age restriction): asserted disabled at boot.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TextChatService = game:GetService("TextChatService")

local shared = ReplicatedStorage:WaitForChild("Shared")
local engineModule = require(shared:WaitForChild("index"))
local aiModule = require(shared:WaitForChild("ai"))
local visibility = require(shared:WaitForChild("visibility"))
local statehash = require(shared:WaitForChild("statehash"))
local gamecode = require(shared:WaitForChild("gamecode"))
local json2lua = require(shared:WaitForChild("json2lua"))
local Deck = require(script.Parent:WaitForChild("Deck"))
local SaveStore = require(script.Parent:WaitForChild("SaveStore")) -- R10

local gameData = ReplicatedStorage:WaitForChild("GameData")
local rulesetsFolder = gameData:WaitForChild("rulesets")
local expectedHashes = require(gameData:WaitForChild("RulesetHashes"))

-- ---- boot: parse rulesets through json2lua and gate on the baked hashes ----
local RULESET_NAMES = { "buildings", "civs", "governments", "rules",
	"techs", "terrain", "units", "wonders" }
local ruleset = {}
for _, name in ipairs(RULESET_NAMES) do
	local value = json2lua.parse(require(rulesetsFolder:WaitForChild(name)))
	local h = statehash.hashState(value)
	if h ~= expectedHashes[name] then
		error(("[GameServer] DATA GATE FAILED: %s hashed %s, expected %s — "
			.. "the baked JSON or json2lua diverged from the Node side"):format(name, h, expectedHashes[name]))
	end
	ruleset[name] = value
end
print("[GameServer] data gate: 8/8 ruleset hashes match the Node side")

local engine = engineModule.createEngine(ruleset)

-- classic civ pick order (main.js parity), filtered against the ruleset so
-- data drift can't crash setup; any leftovers append sorted
local CIV_ORDER = { "romans", "babylonians", "germans", "egyptians", "greeks",
	"indians", "chinese", "aztecs", "french", "english", "zulus", "mongols",
	"americans", "russians" }
local civPool = {}
for _, id in ipairs(CIV_ORDER) do
	if ruleset.civs[id] ~= nil then
		table.insert(civPool, id)
	end
end
local leftovers = {}
for id in pairs(ruleset.civs) do
	if table.find(civPool, id) == nil then
		table.insert(leftovers, id)
	end
end
table.sort(leftovers)
for _, id in ipairs(leftovers) do
	table.insert(civPool, id)
end

local MAP_SIZES = { -- client/main.js MAP_SIZES parity
	{ name = "xsmall", w = 40, h = 25 },
	{ name = "small", w = 60, h = 38 },
	{ name = "medium", w = 80, h = 50 },
}

-- admins-only kick (user ruling: no host-kick, no vote-kick). The Studio /
-- place creator is always an admin; add UserIds here for public servers.
local ADMINS = {}
local function isAdmin(player)
	return player.UserId == game.CreatorId or table.find(ADMINS, player.UserId) ~= nil
end

-- NO CHAT on Roblox (age restrictions — docs/13 Tier-3, decided): assert the
-- window + input bar off; pcall because the config objects load async.
task.spawn(function()
	local ok = pcall(function()
		TextChatService:WaitForChild("ChatWindowConfiguration", 10).Enabled = false
		TextChatService:WaitForChild("ChatInputBarConfiguration", 10).Enabled = false
	end)
	print(ok and "[GameServer] R9 chat assert: window + input bar DISABLED"
		or "[GameServer] R9 chat assert FAILED — check TextChatService manually")
end)

-- ---- lobby state -----------------------------------------------------------
local remote = Instance.new("RemoteEvent")
remote.Name = "RMC"
remote.Parent = ReplicatedStorage

local deck = Deck.build()

local phase = "idle" -- idle | setup | starting | running
local hostUserId = nil
local setup = { sizeIndex = 1, civs = 3, humans = 1 }
local seatUserIds = {} -- seat number (1..humans) -> UserId; 1 = host
local countdownEnds = nil
local timerGen = 0

local state = nil -- the engine state; nil until the lobby starts a game
local seatOfUser = {} -- UserId -> "pN" (bound at game start / takeover)
local roundInFlight = false

-- R18: the theater record — the SAME entries the [R4LOG] stream prints, kept
-- as data so seated players can replay the game's history client-side
-- (initialState + entries = exactly what assemble.js/replayDiagnostics eat).
local theater = { initialState = nil, entries = {} }

local function logEntry(entry)
	print("[R4LOG] " .. statehash.canonicalize(entry))
	table.insert(theater.entries, entry)
end

local function seatVacant(pid)
	local def = state ~= nil and state.players[pid]
	if def == nil or def.human ~= true then
		return false
	end
	for userId, seat in pairs(seatOfUser) do
		if seat == pid then
			return false
		end
	end
	return true
end

local function vacantSeats()
	local out = {}
	if state == nil then
		return out
	end
	for i = 1, setup.humans do -- only human-flagged seats can be vacant
		local pid = "p" .. i
		if seatVacant(pid) then
			table.insert(out, pid)
		end
	end
	return out
end

local function playerBySeat(pid)
	for userId, seat in pairs(seatOfUser) do
		if seat == pid then
			for _, player in ipairs(Players:GetPlayers()) do
				if player.UserId == userId then
					return player
				end
			end
		end
	end
	return nil
end

local function seatedPresent(pid)
	return playerBySeat(pid) ~= nil
end

local function lobbyPayloadFor(player)
	local seats = {}
	if state ~= nil then
		for i = 1, setup.civs do
			local pid = "p" .. i
			local def = state.players[pid]
			if def ~= nil then
				local seatedPlayer = playerBySeat(pid)
				table.insert(seats, { pid = pid, name = def.name,
					who = seatedPlayer ~= nil and seatedPlayer.Name
						or (def.human == true and "regent" or "AI") })
			end
		end
	else
		for i = 1, setup.humans do
			local userId = seatUserIds[i]
			local who = "open"
			if userId ~= nil then
				for _, p in ipairs(Players:GetPlayers()) do
					if p.UserId == userId then
						who = p.Name
					end
				end
			end
			table.insert(seats, { pid = "seat " .. i, name = civPool[i] or "?", who = who })
		end
	end
	return {
		t = "lobby",
		lobby = {
			phase = phase,
			youAreHost = player.UserId == hostUserId,
			youAreAdmin = isAdmin(player),
			countdown = countdownEnds ~= nil and math.max(0, math.ceil(countdownEnds - os.clock())) or 0,
			options = { size = MAP_SIZES[setup.sizeIndex].name, civs = setup.civs, humans = setup.humans },
			seats = seats,
			gameRunning = state ~= nil,
		},
	}
end

local function broadcastLobby()
	for _, player in ipairs(Players:GetPlayers()) do
		remote:FireClient(player, lobbyPayloadFor(player))
	end
end

-- ---- per-seat pushes (THE LAW: filterView/filterEvents only) ---------------
local function pushSeat(player, pid, rawEvents)
	local payload = {
		t = "view",
		view = visibility.filterView(state, pid),
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
		code = gamecode.gameCode(state),
	}
	if rawEvents ~= nil and #rawEvents > 0 then
		payload.events = visibility.filterEvents(state, rawEvents, pid)
	end
	remote:FireClient(player, payload)
end

local function pushAll(rawEvents)
	for userId, pid in pairs(seatOfUser) do
		local player = playerBySeat(pid)
		if player ~= nil then
			pushSeat(player, pid, rawEvents)
		end
	end
end

local function sendJoined(player, pid)
	remote:FireClient(player, {
		t = "joined",
		playerId = pid,
		view = visibility.filterView(state, pid),
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
		code = gamecode.gameCode(state),
	})
end

-- ---- the round driver ------------------------------------------------------
-- chainAndRound: after ANY human-flagged seat's ok endTurn, play consecutive
-- engine-AI (human=false) turns, then log the round entry + [R4CODE] — the
-- exact unit tools/replay.js re-derives from one round entry.
local function chainAndRound(collected, pushProgress)
	local guard = 20
	while state.gameOver ~= true and state.players[state.activePlayer].human ~= true and guard > 0 do
		guard = guard - 1
		task.wait() -- A30: yield a frame per AI player; no frozen frames
		state = aiModule.runAiTurn(engine, state, state.activePlayer, ruleset, collected)
		local res = engine.applyCommand(state, { type = "endTurn", playerId = state.activePlayer })
		if not res.ok then
			break
		end
		state = res.state
		for _, e in ipairs(res.events) do
			table.insert(collected, e)
		end
		pushProgress()
	end
	logEntry({ t = "round", turn = state.turn, activePlayer = state.activePlayer,
		hash = statehash.hashState(state) })
	print(("[R4CODE] turn=%d code=%s"):format(state.turn, gamecode.gameCode(state)))
end

-- playRegentSeat: the browser A40 twin — the REAL pick logic, each command
-- logged as an ordinary cmd entry (no hash field, matching server/game.js);
-- the synthetic regentTurn summary is evented but NEVER logged.
local function playRegentSeat(pid, collected)
	local done = {}
	local guard = 500
	local applied = 0
	while guard > 0 do
		guard = guard - 1
		local cmd = aiModule.pickCommand(state, pid, ruleset, done, nil)
		if cmd == nil then
			break
		end
		local res = engine.applyCommand(state, cmd)
		local entry = { t = "cmd", turn = state.turn, cmd = cmd }
		if res.ok then
			state = res.state
			entry.ok = true
			for _, e in ipairs(res.events) do
				table.insert(collected, e)
			end
			applied = applied + 1
		else
			entry.ok = false
			entry.reason = res.reason
		end
		logEntry(entry)
		if guard % 12 == 0 then
			task.wait() -- breathe (A30)
		end
	end
	table.insert(collected, { type = "regentTurn", playerId = pid, applied = applied })
end

-- advance: drive regent seats (vacant OR absent humans) until a seated,
-- PRESENT human is active or the game ends. Regency-on-leave falls out of
-- seatedPresent (docs/13 amendment: load-bearing on this platform).
-- initiatedByEndTurn: a seated human's ok endTurn preceded this call — its
-- round entry MUST log even when zero AI turns follow (replay re-derives
-- the endTurn from the round entry; skipping it would drop the endTurn).
local function advance(collected, initiatedByEndTurn)
	roundInFlight = true
	local seen = 0
	local function pushProgress()
		local slice = table.move(collected, seen + 1, #collected, 1, {})
		seen = #collected
		pushAll(slice)
	end
	pushProgress()
	if initiatedByEndTurn then
		chainAndRound(collected, pushProgress)
		pushProgress()
	end
	local guard = 30
	while state.gameOver ~= true and guard > 0 do
		guard = guard - 1
		local active = state.activePlayer
		local def = state.players[active]
		if def.human ~= true then
			break -- unreachable in normal flow (chains consume engine AIs)
		end
		if seatedPresent(active) then
			break -- a live human's turn: stop and wait for commands
		end
		playRegentSeat(active, collected)
		pushProgress()
		local res = engine.applyCommand(state, { type = "endTurn", playerId = active })
		if not res.ok then
			break
		end
		state = res.state
		for _, e in ipairs(res.events) do
			table.insert(collected, e)
		end
		chainAndRound(collected, pushProgress)
		pushProgress()
	end
	roundInFlight = false
	if state.gameOver == true then
		print("[R4FINAL] hash=" .. statehash.hashState(state))
	end
	return seen
end

-- ---- the lobby flow --------------------------------------------------------
local function setPhase(newPhase)
	phase = newPhase
	deck.setPhase(phase, state ~= nil and #vacantSeats() > 0)
	broadcastLobby()
end

local function startCountdown(seconds, onExpire)
	timerGen = timerGen + 1
	local gen = timerGen
	countdownEnds = os.clock() + seconds
	task.spawn(function()
		while gen == timerGen do
			if os.clock() >= countdownEnds then
				countdownEnds = nil
				onExpire()
				return
			end
			broadcastLobby() -- 1 Hz countdown tick
			task.wait(1)
		end
	end)
end

local function cancelCountdown()
	timerGen = timerGen + 1
	countdownEnds = nil
end

local function startGame()
	local size = MAP_SIZES[setup.sizeIndex]
	local seed = os.time() % 1000000 -- server-side pick, PRINTED for replay;
	-- never engine RNG (the game does not exist yet)
	local civIds = {}
	local playerDefs = setmetatable({}, statehash.ARRAY_MT)
	for i = 1, setup.civs do
		local civId = civPool[i]
		table.insert(civIds, civId)
		local civ = ruleset.civs[civId]
		table.insert(playerDefs, {
			id = "p" .. i,
			name = civ.name,
			color = civ.color,
			human = i <= setup.humans,
		})
	end
	local created = engine.createGame({
		seed = seed,
		options = { width = size.w, height = size.h, players = playerDefs },
	})
	if created.ok == false then
		print("[GameServer] createGame failed: " .. tostring(created.reason))
		setPhase("idle")
		return
	end
	state = created
	theater.initialState = engineModule.deepClone(state) -- R18
	theater.entries = {}
	print(("[R4INIT] seed=%d width=%d height=%d civs=%s humanSeat=p1 humans=%d initialHash=%s")
		:format(seed, size.w, size.h, table.concat(civIds, ","), setup.humans,
			statehash.hashState(state)))

	-- bind the pre-start claims: seat 1 = host, 2.. = join-pad order
	for i = 1, setup.humans do
		local userId = seatUserIds[i]
		if userId ~= nil then
			seatOfUser[userId] = "p" .. i
		end
	end
	setPhase("running")
	for userId, pid in pairs(seatOfUser) do
		local player = playerBySeat(pid)
		if player ~= nil then
			sendJoined(player, pid)
		end
	end
	-- p1 is the host and present, so no immediate regent drive is needed;
	-- but guard the general case (host left during the 30s countdown)
	if state.players[state.activePlayer].human ~= true or not seatedPresent(state.activePlayer) then
		task.spawn(advance, {})
	end
end

-- ---- R10: save/resume (DataStore keyed by the game code, docs/07) ----------
-- envelope round-trip proven identity (canonicalize -> json2lua.parse ->
-- hashState stable, re-canonicalize byte-identical) — the resume tamper
-- check is gameCode(state) == the key the resumer typed.
local function saveGame(why)
	if state == nil then
		return nil
	end
	local code = gamecode.gameCode(state)
	local envelope = statehash.canonicalize({
		state = state, savedAt = os.time(), humans = setup.humans,
	})
	if SaveStore.save(code, envelope) then
		print(("[GameServer] R10 save (%s): %s at turn %d"):format(why, code, state.turn))
		return code
	end
	return nil
end

-- ephemeral PUBLIC servers (user design): all seated humans gone + 120s
-- grace -> autosave + end. Private servers persist (skip). Any event that
-- seats/returns a human bumps graceGen, which cancels a pending timer.
local graceGen = 0
local function anySeatedPresent()
	for _, pid in pairs(seatOfUser) do
		if playerBySeat(pid) ~= nil then
			return true
		end
	end
	return false
end

local function checkEphemeral()
	graceGen += 1 -- any call re-arms/cancels; only the newest timer counts
	if state == nil or game.PrivateServerId ~= "" or anySeatedPresent() then
		return
	end
	local gen = graceGen
	print("[GameServer] R10 ephemeral: all humans gone — 120s grace, then autosave + end")
	task.delay(120, function()
		if gen ~= graceGen or state == nil or anySeatedPresent() then
			return
		end
		local code = saveGame("ephemeral-end")
		print(("[GameServer] R10 ephemeral end: resume later with code %s"):format(tostring(code)))
		state = nil
		seatOfUser = {}
		seatUserIds = {}
		hostUserId = nil
		setPhase("idle")
	end)
end

local function resumeGame(player, rawCode)
	if phase ~= "idle" or state ~= nil then
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "gameInProgress" })
		return
	end
	local code = tostring(rawCode or ""):upper():gsub("%s", "")
	if #code < 10 then
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "badCode" })
		return
	end
	local envelopeJson = SaveStore.load(code)
	if envelopeJson == nil then
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "saveNotFound" })
		return
	end
	local ok, envelope = pcall(json2lua.parse, envelopeJson)
	if not ok or typeof(envelope) ~= "table" or envelope.state == nil then
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "badSave" })
		return
	end
	-- docs/07 tamper check: the code IS the state's own verification code
	if gamecode.gameCode(envelope.state) ~= code then
		print("[GameServer] R10 resume REJECTED: envelope fails the game-code check (tampered?)")
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "tamperedSave" })
		return
	end
	state = envelope.state
	theater.initialState = engineModule.deepClone(state) -- R18: history restarts here
	theater.entries = {}
	setup.humans = envelope.humans or 1
	local n = 0
	for _ in pairs(state.players) do
		n += 1
	end
	setup.civs = n
	hostUserId = player.UserId
	seatOfUser = { [player.UserId] = "p1" }
	seatUserIds = { player.UserId }
	print(("[R4RESUME] code=%s turn=%d humans=%d hash=%s"):format(code, state.turn,
		setup.humans, statehash.hashState(state)))
	setPhase("running")
	sendJoined(player, "p1")
	if state.players[state.activePlayer].human ~= true or not seatedPresent(state.activePlayer) then
		task.spawn(advance, {})
	end
end

deck.prompts.start.Triggered:Connect(function(player)
	if phase ~= "idle" then
		return
	end
	hostUserId = player.UserId
	setup = { sizeIndex = 1, civs = 3, humans = 1 }
	seatUserIds = { player.UserId }
	setPhase("setup")
	-- the 60-SECOND host window (user design): no completion = pad reopens
	startCountdown(60, function()
		if phase == "setup" then
			hostUserId = nil
			seatUserIds = {}
			setPhase("idle")
		end
	end)
	print(("[GameServer] R9 host window: %s (60s)"):format(player.Name))
end)

deck.prompts.join.Triggered:Connect(function(player)
	if phase ~= "setup" and phase ~= "starting" then
		return
	end
	for i = 1, setup.humans do
		if seatUserIds[i] == player.UserId then
			return -- already in
		end
	end
	for i = 2, setup.humans do
		if seatUserIds[i] == nil then
			seatUserIds[i] = player.UserId
			print(("[GameServer] R9 join: %s -> seat %d"):format(player.Name, i))
			broadcastLobby()
			return
		end
	end
	remote:FireClient(player, { t = "rejected", commandId = -1, code = "seatsFull" })
end)

deck.prompts.takeover.Triggered:Connect(function(player)
	if phase ~= "running" or state == nil or seatOfUser[player.UserId] ~= nil then
		return
	end
	local vacant = vacantSeats()
	if #vacant == 0 then
		remote:FireClient(player, { t = "rejected", commandId = -1, code = "seatsFull" })
		return
	end
	-- RANDOM assignment (user lean: no cherry-picking); server-side dice,
	-- never engine RNG — the seat map is not game state
	local pid = vacant[math.random(#vacant)]
	seatOfUser[player.UserId] = pid
	print(("[GameServer] R9 takeover: %s -> %s (random of %d vacant)"):format(player.Name, pid, #vacant))
	sendJoined(player, pid)
	checkEphemeral() -- R10: a seated human cancels any pending grace timer
	setPhase("running") -- refreshes pad availability + lobby lists
end)

-- ---- remote routing ---------------------------------------------------------
remote.OnServerEvent:Connect(function(player, msg)
	if typeof(msg) ~= "table" then
		return
	end
	local commandId = if typeof(msg.commandId) == "number" then msg.commandId else -1

	if msg.t == "join" then
		-- reconnect: UserId IS identity (docs/13 — seat codes unnecessary)
		local pid = seatOfUser[player.UserId]
		if state ~= nil and pid ~= nil then
			sendJoined(player, pid)
			checkEphemeral() -- R10: a returning human cancels the grace timer
		else
			remote:FireClient(player, lobbyPayloadFor(player))
		end
		return
	end

	if msg.t == "lobbyHello" then
		-- Lobby.client's own handshake (its handler may connect after
		-- ClientState's join fired) — lobby snapshot + first-visit greeting
		remote:FireClient(player, lobbyPayloadFor(player))
		if seatOfUser[player.UserId] == nil then
			remote:FireClient(player, { t = "greeting" })
		end
		return
	end

	if msg.t == "setup" and player.UserId == hostUserId and phase == "setup" then
		local dir = msg.dir == -1 and -1 or 1
		if msg.key == "size" then
			setup.sizeIndex = math.clamp(setup.sizeIndex + dir, 1, #MAP_SIZES)
		elseif msg.key == "civs" then
			local cap = math.min(#civPool,
				(ruleset.rules.maxCivsBySize or {})[MAP_SIZES[setup.sizeIndex].name] or 14)
			setup.civs = math.clamp(setup.civs + dir, 2, cap)
			setup.humans = math.min(setup.humans, setup.civs)
		elseif msg.key == "humans" then
			setup.humans = math.clamp(setup.humans + dir, 1, setup.civs)
		end
		broadcastLobby()
		return
	end

	if msg.t == "setupDone" and player.UserId == hostUserId and phase == "setup" then
		setPhase("starting")
		-- the 30-SECOND game-start countdown (user design)
		startCountdown(30, startGame)
		return
	end

	if msg.t == "getResumeCode" then
		-- R10: the HOST's button (user design); the code is the docs/07 chip
		if phase == "running" and player.UserId == hostUserId then
			local code = saveGame("host-button")
			remote:FireClient(player, { t = "resumeCode", ok = code ~= nil,
				code = code or "" })
		end
		return
	end

	if msg.t == "resume" then
		resumeGame(player, msg.code)
		return
	end

	if msg.t == "theater" then
		-- R18: stream the history in chunks; the client sandbox re-derives.
		-- THE LAW guard: raw history reveals every civ's whole game, so the
		-- theater opens ONLY when the game is OVER (the classic Civ replay
		-- moment) or to admins — a mid-game stream would be a fog wallhack.
		local seated = seatOfUser[player.UserId] ~= nil
		local allowed = theater.initialState ~= nil and seated
			and (state == nil or state.gameOver == true or isAdmin(player))
		if not allowed then
			remote:FireClient(player, { t = "rejected", commandId = commandId,
				code = state ~= nil and state.gameOver ~= true and "gameStillRunning" or "notSeated" })
			return
		end
		remote:FireClient(player, { t = "theaterInit",
			initialState = theater.initialState, total = #theater.entries })
		local CHUNK = 120
		for i = 1, #theater.entries, CHUNK do
			remote:FireClient(player, { t = "theaterChunk", from = i,
				entries = table.move(theater.entries, i, math.min(i + CHUNK - 1, #theater.entries), 1, {}) })
		end
		remote:FireClient(player, { t = "theaterDone", total = #theater.entries })
		return
	end

	if msg.t == "kick" and isAdmin(player) then -- admins ONLY (user ruling)
		for userId, pid in pairs(seatOfUser) do
			if pid == msg.seat then
				local target = playerBySeat(pid)
				seatOfUser[userId] = nil -- seat falls to the regent
				if target ~= nil then
					target:Kick("removed by an admin")
				end
				print(("[GameServer] R9 kick: %s unseated by %s"):format(pid, player.Name))
				setPhase(phase)
				-- if it was their turn, the regent takes over immediately
				if state ~= nil and not roundInFlight and state.activePlayer == pid then
					task.spawn(advance, {})
				end
				return
			end
		end
		return
	end

	if msg.t ~= "cmd" or typeof(msg.cmd) ~= "table" then
		return
	end
	local pid = seatOfUser[player.UserId]
	if state == nil or pid == nil then
		remote:FireClient(player, { t = "rejected", commandId = commandId, code = "notSeated" })
		return
	end
	if roundInFlight then
		remote:FireClient(player, { t = "rejected", commandId = commandId, code = "roundInFlight" })
		return
	end

	-- server-authoritative identity: the seat stamps playerId, never the client
	local cmd = {}
	for k, v in pairs(msg.cmd) do
		cmd[k] = v
	end
	cmd.playerId = pid

	local res = engine.applyCommand(state, cmd)
	if not res.ok then
		logEntry({ t = "cmd", turn = state.turn, cmd = cmd, ok = false, reason = res.reason })
		remote:FireClient(player, { t = "rejected", commandId = commandId, code = res.reason })
		return
	end

	state = res.state
	local pending = res.events
	if cmd.type == "endTurn" then
		-- an OK endTurn is subsumed by its round entry (replay re-derives it);
		-- advance() runs the AI chain, the round log, and any regent seats
		local collected = {}
		for _, e in ipairs(res.events) do
			table.insert(collected, e)
		end
		local seen = advance(collected, true)
		pending = table.move(collected, seen + 1, #collected, 1, {})
	else
		logEntry({ t = "cmd", turn = state.turn, cmd = cmd, ok = true,
			hash = statehash.hashState(state) })
	end

	local events = visibility.filterEvents(state, pending, pid)
	remote:FireClient(player, {
		t = "view",
		view = visibility.filterView(state, pid),
		events = events,
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
		commandId = commandId,
		code = gamecode.gameCode(state),
	})
	-- fan the state change out to every OTHER seat (their fog, their events)
	for userId, otherPid in pairs(seatOfUser) do
		if otherPid ~= pid then
			local other = playerBySeat(otherPid)
			if other ~= nil then
				pushSeat(other, otherPid, pending)
			end
		end
	end
end)

-- regency-on-leave: if the leaver held the ACTIVE seat, the regent finishes
-- the turn right away (churn is normal on this platform — docs/13)
Players.PlayerRemoving:Connect(function(player)
	if phase == "setup" and player.UserId == hostUserId then
		hostUserId = nil
		seatUserIds = {}
		cancelCountdown()
		setPhase("idle")
		return
	end
	local pid = seatOfUser[player.UserId]
	if state ~= nil and pid ~= nil and not roundInFlight and state.activePlayer == pid then
		task.spawn(advance, {})
	end
	if state ~= nil then
		setPhase(phase) -- refresh lobby lists (who = regent now)
	end
	-- R10: last human out starts the 120s public grace. DEFERRED: during
	-- PlayerRemoving the leaver still counts in GetPlayers(), so the
	-- presence check must run after removal completes.
	task.defer(checkEphemeral)
end)

Players.PlayerAdded:Connect(function()
	broadcastLobby()
end)

-- the place template's Baseplate tops at y=0 and buries the ocean columns
-- (top -1.08) — R4 user finding: "ocean had no tile, just baseplate"
local baseplate = workspace:FindFirstChild("Baseplate")
if baseplate ~= nil then
	baseplate:Destroy()
end

print("[GameServer] R9 lobby up: observation deck live, START pad open")
