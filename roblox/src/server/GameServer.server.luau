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
local fastforward = require(shared:WaitForChild("fastforward")) -- R24 age starts
local aiModule = require(shared:WaitForChild("ai"))
local visibility = require(shared:WaitForChild("visibility"))
local statehash = require(shared:WaitForChild("statehash"))
local gamecode = require(shared:WaitForChild("gamecode"))
local scoreModule = require(shared:WaitForChild("score")) -- SO7 end screen
local json2lua = require(shared:WaitForChild("json2lua"))
local Deck = require(script.Parent:WaitForChild("Deck"))
local SaveStore = require(script.Parent:WaitForChild("SaveStore")) -- R10

local gameData = ReplicatedStorage:WaitForChild("GameData")
local rulesetsFolder = gameData:WaitForChild("rulesets")
local expectedHashes = require(gameData:WaitForChild("RulesetHashes"))

-- ---- run-4 fix: THE FLOOR COMES FIRST -------------------------------------
-- The data gate below takes seconds; players can spawn during it. Boot order
-- used to be gate -> deck -> destroy Baseplate (at the very bottom), so the
-- player spawned on the Baseplate, it vanished under their feet, and with no
-- game there was NO floor anywhere (VoidCover builds on the first view) —
-- an endless fall that read as "lobby broken + no map" (user run-4). Now:
-- deck + spawn + permanent catch floor exist BEFORE anything slow, and only
-- then the Baseplate goes (it buries ocean columns, the R4 finding).
-- run-4 (user ruling): the daylight cycle is SUSPENDED — permanent midday.
-- Time-of-day comes back only as a planned special event ("dark times",
-- undesigned). VoidCover's galaxy art mode overrides client-locally only.
do
	local Lighting = game:GetService("Lighting")
	Lighting.ClockTime = 12
	for _, inst in ipairs(Lighting:GetChildren()) do
		if inst:IsA("Script") or inst:IsA("LocalScript") then
			inst.Disabled = true -- no cycle drivers survive boot
		end
	end
end

local deck = Deck.build()
do
	local baseplate = workspace:FindFirstChild("Baseplate")
	if baseplate ~= nil then
		baseplate:Destroy()
	end
	-- run-4 live fix (user): the PLACE FILE carries its own template
	-- SpawnLocation (the lone plate in the F1 shot) and Roblox picks among
	-- ALL spawns — players could spawn on it in the void. Move every stray
	-- spawn UP onto the deck floor plane, flush beside the DeckSpawn.
	local deckSpawn = deck.folder.DeckSpawn
	local floorTop = deck.folder.Floor.Position.Y + deck.folder.Floor.Size.Y / 2
	local slot = 1
	for _, inst in ipairs(workspace:GetDescendants()) do
		if inst:IsA("SpawnLocation") and inst ~= deckSpawn then
			-- top face flush with the floor plane (+0.06 reveal, no z-fight)
			inst.CFrame = CFrame.new(deckSpawn.Position.X + slot * 12,
				floorTop + 0.06 - inst.Size.Y / 2, deckSpawn.Position.Z)
			inst.Anchored = true
			slot += 1
			print("[GameServer] stray SpawnLocation moved onto the deck plane: " .. inst:GetFullName())
		end
	end
	for _, player in ipairs(Players:GetPlayers()) do
		local character = player.Character
		local rootPart = character and character:FindFirstChild("HumanoidRootPart")
		if rootPart ~= nil then
			rootPart.CFrame = deckSpawn.CFrame + Vector3.new(0, 4, 0)
		end
	end
end

-- ---- boot: parse rulesets through json2lua and gate on the baked hashes ----
local RULESET_NAMES = { "buildings", "civs", "governments", "rules",
	"techs", "terrain", "units", "wonders" }
local ruleset = {}
for _, name in ipairs(RULESET_NAMES) do
	local value = json2lua.parse(require(rulesetsFolder:WaitForChild(name)))
	local h = statehash.hashState(value)
	if h ~= expectedHashes[name] then
		-- run-4 F1 lesson: a silent server death leaves an empty void scene.
		-- Plant a VISIBLE sign on the deck before dying so the failure is
		-- diagnosable in-world, not just in Output.
		local sign = Instance.new("Part")
		sign.Anchored = true
		sign.Size = Vector3.new(24, 10, 1)
		sign.Position = Vector3.new(78, 148, 40)
		sign.Color = Color3.fromRGB(140, 40, 40)
		sign.Parent = workspace
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.new(0, 420, 0, 60)
		bb.AlwaysOnTop = true
		bb.Adornee = sign
		local t = Instance.new("TextLabel")
		t.Size = UDim2.new(1, 0, 1, 0)
		t.BackgroundTransparency = 0.2
		t.BackgroundColor3 = Color3.fromRGB(60, 20, 20)
		t.TextColor3 = Color3.fromRGB(255, 220, 220)
		t.Font = Enum.Font.SourceSansBold
		t.TextSize = 16
		t.TextWrapped = true
		t.Text = ("DATA GATE FAILED (%s) - stale Rojo sync? Use the NATIVE "
			.. "Windows rojo serve (README), then restart Play."):format(name)
		t.Parent = bb
		bb.Parent = sign
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

local phase = "idle" -- idle | setup | starting | running
local hostUserId = nil
-- R24b host-options parity (task @2905b966): difficulty + combat map to the
-- SAME ruleset overrides the browser lobby applies (server/lobby.js is the
-- authority): difficulty -> rules.contentCitizens, bestof3 -> combatRounds=3.
-- Browser defaults: medium + best-of-three.
local DIFFICULTY_LEVELS = { "trainer", "easy", "medium", "hard", "godemperor" }
local DIFFICULTY_CONTENT = { trainer = 6, easy = 5, medium = 4, hard = 3, godemperor = 2 }
local baseRules = ruleset.rules -- pristine; per-game overrides swap a merged copy in

local setup = { sizeIndex = 1, civs = 3, humans = 1, mapType = "continents",
	maxIdleMin = 1, -- R22: host-set idle threshold (minutes) before regency
	age = "ancient", -- R24: starting age (rules.ages id; later = fast-forward)
	difficulty = "medium", combat = "bestof3", seedOverride = 0 } -- R24b (0 = random)
local seatUserIds = {} -- seat number (1..humans) -> UserId; 1 = host
-- R22: seats voluntarily (or via idle timeout) handed to the AI regent —
-- pid -> true. Treated exactly like an absent seat by advance(); any
-- command from the seat's player takes it back.
local awaySeats = {}
local lastAutosaveTurn = -1 -- R23: rolling autosave marker (declared early:
-- startGame resets it and is defined above the autosave helper)
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
	-- R22: an away seat counts as absent — the regent drives it
	return playerBySeat(pid) ~= nil and awaySeats[pid] ~= true
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
						or (def.human == true and "regent" or "AI"),
					-- R21: stance is openly visible by design (Civ1 showed
					-- leader personalities); absent = balanced, no tag
					stance = def.stance })
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
			options = { size = MAP_SIZES[setup.sizeIndex].name, civs = setup.civs,
				humans = setup.humans, mapType = setup.mapType,
				maxIdleMin = setup.maxIdleMin, age = setup.age,
				difficulty = setup.difficulty, combat = setup.combat,
				seed = setup.seedOverride },
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
		maxIdleMin = setup.maxIdleMin, -- R22: the client idle watcher's knob
		away = awaySeats[pid] == true,
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
-- SO7 (catalog row; browser A73 twin): on gameOver the SERVER computes the
-- scoreboard from FULL state (the seat views stay fog-filtered; post-game
-- data is public — the R18 theater precedent) and broadcasts one
-- {t="endscreen"} frame: headline inputs + per-civ score component rows
-- straight from the shared scoreBreakdown twin, never a parallel formula.
local endscreenSent = false
local function sendEndscreen()
	if endscreenSent or state == nil then
		return
	end
	endscreenSent = true
	local rows = setmetatable({}, statehash.ARRAY_MT)
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		local bd = scoreModule.scoreBreakdown(state, pid, ruleset)
		local cities, pop, wonders = 0, 0, 0
		for _, cid in ipairs(state.cityOrder) do
			local c = state.cities[cid]
			if c ~= nil and c.owner == pid then
				cities += 1
				pop += c.pop
			end
		end
		if state.wonders ~= nil then
			for _, hostCity in pairs(state.wonders) do
				local h = state.cities[hostCity]
				if h ~= nil and h.owner == pid then
					wonders += 1
				end
			end
		end
		table.insert(rows, { pid = pid, name = p.name, color = p.color,
			alive = p.alive ~= false, total = bd.total,
			popPts = bd.population, techPts = bd.techs, wonderPts = bd.wonders,
			cities = cities, techs = #p.techs, wonders = wonders })
	end
	-- victory type: space when the winner's launched ship has arrived,
	-- conquest when one civ stands, else the end year settled it on score
	local victory = "score"
	local w = state.winner ~= nil and state.players[state.winner] or nil
	if w ~= nil and w.spaceship ~= nil and w.spaceship.launched ~= nil
		and w.spaceship.launched ~= 0 and (w.spaceship.arrivalTurn or math.huge) <= state.turn then
		victory = "space"
	else
		local alive = 0
		for _, pid in ipairs(state.playerOrder) do
			if state.players[pid].alive ~= false then
				alive += 1
			end
		end
		if alive <= 1 then
			victory = "conquest"
		end
	end
	local frame = { t = "endscreen", winner = state.winner, victory = victory,
		year = state.year, rows = rows }
	for userId in pairs(seatOfUser) do
		local player = Players:GetPlayerByUserId(userId)
		if player ~= nil then
			remote:FireClient(player, frame)
		end
	end
	print(("[SO7] endscreen sent: %s victory, winner %s"):format(victory, tostring(state.winner)))
end

-- SO9 (catalog row; browser A75 twin): the historian's report — when the
-- world enters a new age (ageChanged at the turn wrap), broadcast the
-- world-public standings AT THAT MOMENT: every civ ranked by the shared
-- score twin, with cities/techs/pop. Scores are world-public (the browser's
-- own fog argument), so full-state reads are honest here.
local function sendHistorian(age)
	if state == nil then
		return
	end
	local rows = setmetatable({}, statehash.ARRAY_MT)
	for _, pid in ipairs(state.playerOrder) do
		local p = state.players[pid]
		local cities, pop = 0, 0
		for _, cid in ipairs(state.cityOrder) do
			local c = state.cities[cid]
			if c ~= nil and c.owner == pid then
				cities += 1
				pop += c.pop
			end
		end
		table.insert(rows, { pid = pid, name = p.name, color = p.color,
			alive = p.alive ~= false, score = scoreModule.score(state, pid, ruleset),
			cities = cities, techs = #p.techs, pop = pop })
	end
	local frame = { t = "historian", age = age, year = state.year, turn = state.turn, rows = rows }
	for userId in pairs(seatOfUser) do
		local player = Players:GetPlayerByUserId(userId)
		if player ~= nil then
			remote:FireClient(player, frame)
		end
	end
	print("[SO9] historian sent: the world enters " .. tostring(age))
end

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
	-- SO9: the last ageChanged in this batch of rounds gets the report
	local newAge = nil
	for _, e in ipairs(collected) do
		if e.type == "ageChanged" then
			newAge = e.age
		end
	end
	if newAge ~= nil then
		sendHistorian(newAge)
	end
	if state.gameOver == true then
		print("[R4FINAL] hash=" .. statehash.hashState(state))
		sendEndscreen() -- SO7: the full-state scoreboard (post-game = public)
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

-- R24b: difficulty/combat -> the browser's ruleset overrides, applied by
-- swapping a MERGED rules copy in and rebuilding the engine (baseRules stays
-- pristine for the next game). Saves record the two knobs so resume rebuilds
-- the same rules (marker-0045 rulesetHash pins would split otherwise).
local function applyRuleOverrides(difficulty, combat)
	local o = {}
	if difficulty ~= nil and DIFFICULTY_CONTENT[difficulty] ~= nil and difficulty ~= "medium" then
		o.contentCitizens = DIFFICULTY_CONTENT[difficulty]
	end
	if combat == "bestof3" then
		o.combatRounds = 3
	end
	if next(o) == nil then
		ruleset.rules = baseRules
	else
		local merged = {}
		for k, v in pairs(baseRules) do
			merged[k] = v
		end
		for k, v in pairs(o) do
			merged[k] = v
		end
		ruleset.rules = merged
	end
	engine = engineModule.createEngine(ruleset)
end

local function startGame()
	awaySeats = {} -- R22: fresh game, every seat starts human-driven
	lastAutosaveTurn = -1 -- R23
	endscreenSent = false -- SO7
	applyRuleOverrides(setup.difficulty, setup.combat) -- R24b
	local size = MAP_SIZES[setup.sizeIndex]
	-- R24b: the host's explicit seed wins; else the server picks. PRINTED
	-- for replay; never engine RNG (the game does not exist yet)
	local seed = setup.seedOverride > 0 and setup.seedOverride or (os.time() % 1000000)
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
		options = { width = size.w, height = size.h, players = playerDefs,
			mapType = setup.mapType }, -- A82a preset (validated by mapgen)
	})
	if created.ok == false then
		print("[GameServer] createGame failed: " .. tostring(created.reason))
		setPhase("idle")
		return
	end
	state = created

	-- R24 (user request, architect grant @0acb4ef4): later starting ages
	-- fast-forward the whole world as AI to the age's turn, then grant the
	-- cumulative era techs — the browser's ?age= twin. CHUNKED through the
	-- stepper with task.wait() so the server never stalls a heartbeat;
	-- abort (game over / a human civ died) cancels the start honestly —
	-- deterministic UX, the host picks another seed/age knowingly.
	local ageDef = nil
	for _, a in ipairs(ruleset.rules.ages or {}) do
		if a.id == setup.age then
			ageDef = a
		end
	end
	if ageDef ~= nil and ageDef.turn > 0 then
		local humanSeats = {}
		for i = 1, setup.humans do
			table.insert(humanSeats, "p" .. i)
		end
		print(("[GameServer] R24 fast-forward to %s (turn %d)..."):format(ageDef.id, ageDef.turn))
		local ff = fastforward.createFastForward(ruleset, state, { humanSeats = humanSeats })
		local r = { done = false }
		while not r.done do
			r = ff.step(5, ageDef.turn)
			task.wait()
		end
		if ff.aborted() ~= nil then
			local ab = ff.aborted()
			print(("[GameServer] R24 fast-forward aborted: %s"):format(tostring(ab.reason)))
			local host = Players:GetPlayerByUserId(hostUserId or 0)
			if host ~= nil then
				-- toast() is a later local (scope order) — send the shape direct
				remote:FireClient(host, { t = "toast",
					text = "Fast-forward stopped early (" .. tostring(ab.reason)
						.. ") - try another seed, age, or civ count." })
			end
			state = nil
			setPhase("idle")
			return
		end
		state = ff.state()
		local grant = fastforward.applyAgeGrant(state, ageDef, ruleset)
		for _, pid in ipairs(humanSeats) do
			state.players[pid].human = true
		end
		print(("[GameServer] R24 age start ready: turn %d, %d techs granted"):format(state.turn, #grant))
	end

	theater.initialState = engineModule.deepClone(state) -- R18
	theater.entries = {}
	print(("[R4INIT] seed=%d width=%d height=%d civs=%s humanSeat=p1 humans=%d maptype=%s age=%s difficulty=%s combat=%s initialHash=%s")
		:format(seed, size.w, size.h, table.concat(civIds, ","), setup.humans,
			setup.mapType, setup.age, setup.difficulty, setup.combat,
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
		-- R24b: resume must rebuild the same rules overrides
		difficulty = setup.difficulty, combat = setup.combat,
	})
	if SaveStore.save(code, envelope) then
		print(("[GameServer] R10 save (%s): %s at turn %d"):format(why, code, state.turn))
		return code
	end
	return nil
end

-- R23 (session-E round 23, user request): a rolling autosave every 10 turns
-- so a Studio stop (or crash) never loses more than 10 turns — each save is
-- keyed by that turn's docs/07 code and every one of them is resumable.
-- Clients get {t="saved"} so the Hud can show the latest resumable code.
local function maybeAutosave()
	if state == nil or state.gameOver == true or state.turn % 10 ~= 0
		or state.turn == lastAutosaveTurn then
		return
	end
	lastAutosaveTurn = state.turn
	local code = saveGame("autosave")
	if code ~= nil then
		for userId in pairs(seatOfUser) do
			local player = Players:GetPlayerByUserId(userId)
			if player ~= nil then
				remote:FireClient(player, { t = "saved", code = code, turn = state.turn })
			end
		end
	end
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
	-- R24b: rebuild the game's rules overrides from the envelope. Older saves
	-- carry neither field: they were CREATED under plain baseRules (no knobs
	-- existed), so the no-override pair is the faithful default — defaulting
	-- to bestof3 here would change their rules mid-game and split the
	-- marker-0045 rulesetHash pin.
	setup.difficulty = envelope.difficulty or "medium"
	setup.combat = envelope.combat or "authentic"
	applyRuleOverrides(setup.difficulty, setup.combat)
	endscreenSent = false -- SO7: a resumed game can end again
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

-- run-4 live ruling: pads are WALK-ON (touch = trigger; the E-prompt stays a
-- backup), and a pad that does not apply EXPLAINS itself with a toast
-- instead of silently doing nothing.
local function toast(player, text)
	remote:FireClient(player, { t = "toast", text = text })
end

local function padStart(player)
	if phase == "setup" or phase == "starting" then
		toast(player, hostUserId == player.UserId
			and "You are already hosting - finish the setup panel (or let the 60s window lapse)."
			or "A game is already being set up - use JOIN GAME to claim a seat.")
		return
	end
	if phase == "running" then
		toast(player, "A game is already in progress - TAKE OVER AI CIV joins it, or wait for it to end.")
		return
	end
	hostUserId = player.UserId
	setup = { sizeIndex = 1, civs = 3, humans = 1, mapType = "continents",
		maxIdleMin = 1, age = "ancient",
		difficulty = "medium", combat = "bestof3", seedOverride = 0 }
	seatUserIds = { player.UserId }
	setPhase("setup")
	toast(player, "You are the HOST - pick map size / civs / human seats, then START GAME (60s).")
	-- the 60-SECOND host window (user design): no completion = pad reopens
	startCountdown(60, function()
		if phase == "setup" then
			hostUserId = nil
			seatUserIds = {}
			setPhase("idle")
		end
	end)
	print(("[GameServer] R9 host window: %s (60s)"):format(player.Name))
end

local function padJoin(player)
	if phase == "idle" then
		toast(player, "JOIN GAME claims a seat while a host sets up - nobody is hosting yet. "
			.. "Step on START A NEW GAME to host one yourself.")
		return
	end
	if phase == "running" then
		toast(player, "The game already started - TAKE OVER AI CIV is the way in now.")
		return
	end
	if hostUserId == player.UserId then
		toast(player, "You are the host - you already hold seat 1.")
		return
	end
	for i = 1, setup.humans do
		if seatUserIds[i] == player.UserId then
			toast(player, "You already claimed a seat - the game starts when the host is done.")
			return
		end
	end
	for i = 2, setup.humans do
		if seatUserIds[i] == nil then
			seatUserIds[i] = player.UserId
			print(("[GameServer] R9 join: %s -> seat %d"):format(player.Name, i))
			toast(player, ("Seat %d is yours - the game starts when the host is done."):format(i))
			broadcastLobby()
			return
		end
	end
	toast(player, ("All %d human seats are taken - ask the host to raise the count."):format(setup.humans))
end

local function padTakeover(player)
	if state == nil then
		toast(player, "TAKE OVER AI CIV joins a RUNNING game as one of its AI civs - "
			.. "no game is running. START A NEW GAME instead.")
		return
	end
	if seatOfUser[player.UserId] ~= nil then
		toast(player, "You already hold a seat in this game.")
		return
	end
	local vacant = vacantSeats()
	if #vacant == 0 then
		toast(player, "No seat is free to take over - every human-capable civ is claimed.")
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
end

local padTouchAt = {} -- player -> os.clock() debounce (touch fires in bursts)

-- session-E: the GOTO CAPITOL pad — teleports the toucher to their own
-- civ's capital (government.capitalOf; fallback = any own city) with a
-- Sparkles burst. Walk-on with the same per-player debounce.
local governmentModule = require(shared:WaitForChild("government"))
deck.capitolPad.Touched:Connect(function(hit)
	local character = hit.Parent
	local player = character ~= nil and Players:GetPlayerFromCharacter(character) or nil
	if player == nil then
		return
	end
	local now = os.clock()
	if padTouchAt[player.UserId] ~= nil and now - padTouchAt[player.UserId] < 1.5 then
		return
	end
	padTouchAt[player.UserId] = now
	local pid = seatOfUser[player.UserId]
	if state == nil or pid == nil then
		toast(player, "GOTO CAPITOL flies you to your capital - join a game first.")
		return
	end
	local capital = nil
	local ok, cap = pcall(governmentModule.capitalOf, state, pid, ruleset)
	if ok and cap ~= nil then
		capital = cap
	else
		for _, cid in ipairs(state.cityOrder or {}) do
			local c = state.cities[cid]
			if c ~= nil and c.owner == pid then
				capital = c
				break
			end
		end
	end
	if capital == nil then
		toast(player, "No capital yet - found a city first (your settlers, B).")
		return
	end
	local root = character:FindFirstChild("HumanoidRootPart")
	if root ~= nil then
		local TILE = 4 -- shared/const: studs per tile (ClientState.TILE twin)
		root.CFrame = CFrame.new(capital.x * TILE + TILE, 8, capital.y * TILE + TILE)
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = Color3.fromRGB(255, 220, 140)
		sparkles.Parent = root
		task.delay(2.5, function()
			sparkles:Destroy()
		end)
		print(("[GameServer] goto-capitol: %s -> %s"):format(player.Name, capital.id))
	end
end)

local PAD_HANDLERS = { start = padStart, join = padJoin, takeover = padTakeover }
for name, handler in pairs(PAD_HANDLERS) do
	deck.prompts[name].Triggered:Connect(handler)
	deck.padParts[name].Touched:Connect(function(hit)
		local character = hit.Parent
		local player = character ~= nil and Players:GetPlayerFromCharacter(character) or nil
		if player == nil then
			return
		end
		local now = os.clock()
		if padTouchAt[player.UserId] ~= nil and now - padTouchAt[player.UserId] < 1.5 then
			return
		end
		padTouchAt[player.UserId] = now
		handler(player)
	end)
end

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
		elseif msg.key == "maxidle" then
			-- R22: minutes of inactivity before the regency countdown (1..15)
			setup.maxIdleMin = math.clamp(setup.maxIdleMin + dir, 1, 15)
		elseif msg.key == "difficulty" then
			-- R24b: cycle the browser's five levels
			local i = table.find(DIFFICULTY_LEVELS, setup.difficulty) or 3
			setup.difficulty = DIFFICULTY_LEVELS[(i - 1 + dir) % #DIFFICULTY_LEVELS + 1]
		elseif msg.key == "combat" then
			-- R24b: two-state toggle (browser default best-of-three)
			setup.combat = setup.combat == "bestof3" and "authentic" or "bestof3"
		elseif msg.key == "seed" then
			-- R24b: explicit world seed from the host's TextBox; 0 = random
			setup.seedOverride = math.clamp(math.floor(tonumber(msg.value) or 0), 0, 999999)
		elseif msg.key == "age" then
			-- R24: cycle rules.ages in array order (wrap both ways)
			local ages = ruleset.rules.ages or {}
			local i = 1
			for k, a in ipairs(ages) do
				if a.id == setup.age then
					i = k
				end
			end
			if #ages > 0 then
				setup.age = ages[(i - 1 + dir) % #ages + 1].id
			end
		elseif msg.key == "maptype" then
			-- A82a: cycle the rules.json presets (sorted keys, wrap both ways)
			local names = {}
			for name in pairs(ruleset.rules.mapTypes or {}) do
				table.insert(names, name)
			end
			table.sort(names)
			if #names > 0 then
				local i = table.find(names, setup.mapType) or 1
				setup.mapType = names[(i - 1 + dir) % #names + 1]
			end
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

	if msg.t == "away" then
		-- R22: hand the seat to the AI regent / take it back. Idle timeout
		-- and the Hud toggle both arrive here; commands auto-reclaim below.
		local pid = seatOfUser[player.UserId]
		if pid ~= nil and state ~= nil and state.gameOver ~= true then
			local on = msg.on == true
			awaySeats[pid] = on and true or nil
			remote:FireClient(player, { t = "away", on = on })
			print(("[R22] %s away=%s (%s)"):format(pid, tostring(on), player.Name))
			if on and not roundInFlight and state.activePlayer == pid then
				task.spawn(advance, {}) -- regent finishes the turn (leave-path twin)
			end
		end
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

	-- R22: any real command from an away seat takes it back from the regent
	if awaySeats[pid] == true then
		awaySeats[pid] = nil
		remote:FireClient(player, { t = "away", on = false })
		print(("[R22] %s reclaimed by command (%s)"):format(pid, player.Name))
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
		maybeAutosave() -- R23: every-10-turns autosave after the round wraps
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
	if pid ~= nil then
		awaySeats[pid] = nil -- R22: presence rules while gone; rejoin starts fresh
	end
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

print("[GameServer] R9 lobby up: observation deck live, START pad open")
