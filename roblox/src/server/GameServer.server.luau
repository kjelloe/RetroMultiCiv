-- R4: the authoritative engine loop over RemoteEvents (roblox/SPEC.md §3d).
-- Single Studio instance: one human seat (first player to join = p1) + AI
-- opponents. Mirrors client/session.js sequencing exactly — including the
-- chunked AI round (one AI player per heartbeat, the A30 lesson: no frozen
-- frames; determinism unchanged, same commands in the same order).
--
-- THE LAW (banked @77b4ae09): clients only ever receive
-- visibility.filterView(state, seat) / filterEvents — never raw state.
--
-- Acceptance instrumentation (@c0ad3988): every log entry prints as one
-- `[R4LOG] {json}` line (statehash.canonicalize = the JSON writer, so the
-- entries are directly assemblable into a tools/replay.js diagnostics file);
-- ok commands carry PER-COMMAND hashes, rounds carry the round hash —
-- the same shapes client/session.js records and tools/replay.js verifies.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local shared = ReplicatedStorage:WaitForChild("Shared")
local engineModule = require(shared:WaitForChild("index"))
local aiModule = require(shared:WaitForChild("ai"))
local visibility = require(shared:WaitForChild("visibility"))
local statehash = require(shared:WaitForChild("statehash"))
local gamecode = require(shared:WaitForChild("gamecode"))
local json2lua = require(shared:WaitForChild("json2lua"))

local gameData = ReplicatedStorage:WaitForChild("GameData")
local rulesetsFolder = gameData:WaitForChild("rulesets")
local expectedHashes = require(gameData:WaitForChild("RulesetHashes"))

-- acceptance-run constants: FIXED so the Node side can rebuild the identical
-- initial state from the printed setup line (createGame is deterministic)
local SEED = 42
local WIDTH, HEIGHT = 40, 25 -- "xsmall" (client/main.js MAP_SIZES reference)
local CIV_IDS = { "romans", "babylonians", "germans" } -- p1 = human

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

-- ---- create the game (deterministic; the acceptance twin of main.js) ------
local playerDefs = setmetatable({}, statehash.ARRAY_MT)
for i, civId in ipairs(CIV_IDS) do
	local civ = ruleset.civs[civId]
	table.insert(playerDefs, {
		id = "p" .. i,
		name = civ.name,
		color = civ.color,
		human = i == 1,
	})
end
local state = engine.createGame({
	seed = SEED,
	options = { width = WIDTH, height = HEIGHT, players = playerDefs },
})
if state.ok == false then
	error("[GameServer] createGame failed: " .. tostring(state.reason))
end

local HUMAN_SEAT = "p1"

print(("[R4INIT] seed=%d width=%d height=%d civs=%s humanSeat=%s initialHash=%s")
	:format(SEED, WIDTH, HEIGHT, table.concat(CIV_IDS, ","), HUMAN_SEAT, statehash.hashState(state)))

-- ---- the recording (session.js log semantics, printed line by line) -------
local function logEntry(entry)
	print("[R4LOG] " .. statehash.canonicalize(entry))
end

-- ---- RemoteEvents (docs/06 shapes over one event) --------------------------
local remote = Instance.new("RemoteEvent")
remote.Name = "RMC"
remote.Parent = ReplicatedStorage

local seatUserId = nil
local roundInFlight = false

-- rawEvents (optional) ride the push AFTER the fog policy — filterEvents at
-- push time with the then-current state, the session.js incremental-notify
-- semantics (R6: the turn log's server half)
local function pushView(player, rawEvents)
	local payload = {
		t = "view",
		view = visibility.filterView(state, HUMAN_SEAT),
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
	}
	if rawEvents ~= nil and #rawEvents > 0 then
		payload.events = visibility.filterEvents(state, rawEvents, HUMAN_SEAT)
	end
	remote:FireClient(player, payload)
end

local function seatPlayer()
	for _, player in ipairs(Players:GetPlayers()) do
		if player.UserId == seatUserId then
			return player
		end
	end
	return nil
end

-- ws-style handshake (docs/06): the CLIENT opens with {t='join'} once its
-- scripts are listening — a server-initiated push at PlayerAdded would race
-- the client's script load. Roblox UserId IS the seat binding (no tokens).
local function handleJoin(player, commandId)
	if seatUserId == nil then
		seatUserId = player.UserId
		print(("[GameServer] seat %s bound to UserId %d (%s)"):format(HUMAN_SEAT, player.UserId, player.Name))
	end
	if player.UserId ~= seatUserId then
		remote:FireClient(player, { t = "rejected", commandId = commandId, code = "seatsFull" })
		return
	end
	remote:FireClient(player, {
		t = "joined",
		playerId = HUMAN_SEAT,
		view = visibility.filterView(state, HUMAN_SEAT),
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
	})
end

-- the chunked AI round: session.js endTurn(), one heartbeat per AI player.
-- R6: `collected` gathers every event of the round (the human endTurn's own,
-- each AI's runAiTurn eventsOut, each AI endTurn's) — the eventsOut=nil gap
-- that starved the turn log. Progress pushes carry the slice since the last
-- push; the caller sends whatever remains. Event collection never touches
-- state or RNG, so hashes are unchanged.
local function runAiRound(player, collected)
	roundInFlight = true
	local seen = 0
	local function pushProgress()
		if player == nil then
			seen = #collected
			return
		end
		local slice = table.move(collected, seen + 1, #collected, 1, {})
		seen = #collected
		pushView(player, slice) -- progress: the client watches the round advance
	end
	pushProgress() -- repaint after the human endTurn, carrying its events
	local guard = 10
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
	roundInFlight = false
	logEntry({ t = "round", turn = state.turn, activePlayer = state.activePlayer,
		hash = statehash.hashState(state) })
	-- the player-visible acceptance token (@c0ad3988): the Node replay must
	-- reproduce this exact code from the same point in the log
	print(("[R4CODE] turn=%d code=%s"):format(state.turn, gamecode.gameCode(state)))
	return seen
end

remote.OnServerEvent:Connect(function(player, msg)
	if typeof(msg) ~= "table" then
		return
	end
	local commandId = if typeof(msg.commandId) == "number" then msg.commandId else -1
	if msg.t == "join" then
		handleJoin(player, commandId)
		return
	end
	if msg.t ~= "cmd" or typeof(msg.cmd) ~= "table" then
		return
	end
	if player.UserId ~= seatUserId then
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
	cmd.playerId = HUMAN_SEAT

	local res = engine.applyCommand(state, cmd)
	if not res.ok then
		logEntry({ t = "cmd", turn = state.turn, cmd = cmd, ok = false, reason = res.reason })
		remote:FireClient(player, { t = "rejected", commandId = commandId, code = res.reason })
		return
	end

	state = res.state
	local pending = res.events
	if cmd.type == "endTurn" then
		-- session.js semantics: an OK endTurn is subsumed by the round entry
		local collected = {}
		for _, e in ipairs(res.events) do
			table.insert(collected, e)
		end
		local seen = runAiRound(player, collected)
		pending = table.move(collected, seen + 1, #collected, 1, {})
	else
		logEntry({ t = "cmd", turn = state.turn, cmd = cmd, ok = true,
			hash = statehash.hashState(state) })
	end

	local events = visibility.filterEvents(state, pending, HUMAN_SEAT)
	remote:FireClient(player, {
		t = "view",
		view = visibility.filterView(state, HUMAN_SEAT),
		events = events,
		activePlayer = state.activePlayer,
		turn = state.turn,
		year = state.year,
		gameOver = state.gameOver == true,
		commandId = commandId,
	})
	if state.gameOver == true then
		print("[R4FINAL] hash=" .. statehash.hashState(state))
	end
end)

-- the place template's Baseplate tops at y=0 and buries the ocean columns
-- (top -1.08) — R4 user finding: "ocean had no tile, just baseplate"
local baseplate = workspace:FindFirstChild("Baseplate")
if baseplate ~= nil then
	baseplate:Destroy()
end

print("[GameServer] R4 live loop up: seat open, awaiting join")
