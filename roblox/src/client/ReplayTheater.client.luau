-- R18 (docs/13 Tier-4 reach goal): the replay-theater viewer twin of the
-- browser A47+A87 shapes — turn SCRUBBER, map PERSPECTIVE toggle (omniscient
-- / per-civ historical fog), human-readable VERDICT strings. The server
-- streams the game's history (initialState + the [R4LOG] entries) AFTER the
-- game ends (or to admins — the mid-game stream is fog-gated server-side);
-- this client re-derives states in a SANDBOX through the read-only luau
-- engine (replayDiagnostics semantics: cmd entries verbatim, round entries =
-- endTurn + engine-AI chain) and renders a MINI-STAGE — a miniature tile map
-- + unit dots + city squares floating like the gallery grid. Deliberately
-- NOT the live renderer: the stage cannot interfere with live consumers
-- (auto-end, HUD, GoTo). Perspective fog runs filterView on the sandbox
-- state before anything renders, so per-civ views are historically honest.
-- Everything here is presentation; nothing acts on the live game.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Palette = require(script.Parent:WaitForChild("Palette")) -- SO14
local shared = ReplicatedStorage:WaitForChild("Shared")
local engineModule = require(shared:WaitForChild("index"))
local aiModule = require(shared:WaitForChild("ai"))
local visibility = require(shared:WaitForChild("visibility"))
local statehash = require(shared:WaitForChild("statehash"))

local remote = ReplicatedStorage:WaitForChild("RMC")

local STAGE_Y = 220
local CELL = 1.6 -- studs per tile on the mini-stage

local record = nil -- { initialState, entries, total } once streamed
local engine = nil
local rounds = {} -- indices of round entries (scrub targets)
local atRound = 0
local perspective = "spectator" -- omniscient, or a playerId
local verdict = ""

-- ---- UI ---------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "RMCTheater"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local openBtn = Instance.new("TextButton")
openBtn.Size = UDim2.new(0, 70, 0, 24)
openBtn.Position = UDim2.new(0, 8, 0.5, 46)
openBtn.BackgroundColor3 = Color3.fromRGB(58, 46, 72)
openBtn.TextColor3 = Color3.fromRGB(225, 210, 240)
openBtn.Font = Enum.Font.SourceSansBold
openBtn.TextSize = 14
openBtn.Text = "THEATER"
openBtn.Parent = gui

local bar = Instance.new("Frame")
bar.Size = UDim2.new(0, 520, 0, 58)
bar.Position = UDim2.new(0.5, -260, 1, -110)
bar.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
bar.BackgroundTransparency = 0.1
bar.BorderSizePixel = 0
bar.Visible = false
bar.Parent = gui

local verdictLabel = Instance.new("TextLabel")
verdictLabel.Size = UDim2.new(1, -12, 0, 18)
verdictLabel.Position = UDim2.new(0, 6, 0, 2)
verdictLabel.BackgroundTransparency = 1
verdictLabel.TextColor3 = Color3.fromRGB(220, 230, 240)
verdictLabel.Font = Enum.Font.Code
verdictLabel.TextSize = 14
verdictLabel.TextXAlignment = Enum.TextXAlignment.Left
verdictLabel.Parent = bar

local function barButton(x, w, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, w, 0, 24)
	b.Position = UDim2.new(0, x, 0, 26)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 14
	b.Text = text
	b.Parent = bar
	return b
end

local firstBtn = barButton(6, 34, "|<")
local backBtn = barButton(44, 34, "-1")
local fwdBtn = barButton(82, 34, "+1")
local lastBtn = barButton(120, 34, ">|")
local jumpBar = Instance.new("TextButton") -- click-to-jump (no drag slider)
jumpBar.Size = UDim2.new(0, 220, 0, 24)
jumpBar.Position = UDim2.new(0, 160, 0, 26)
jumpBar.BackgroundColor3 = Color3.fromRGB(38, 44, 58)
jumpBar.Text = ""
jumpBar.Parent = bar
local jumpFill = Instance.new("Frame")
jumpFill.BackgroundColor3 = Color3.fromRGB(120, 100, 180)
jumpFill.BorderSizePixel = 0
jumpFill.Size = UDim2.new(0, 0, 1, 0)
jumpFill.Parent = jumpBar
local viewBtn = barButton(386, 92, "view: all")
local closeBtn = barButton(482, 32, "X")

-- ---- the mini-stage ---------------------------------------------------------
local stage = nil

local function stageOrigin(map)
	return Vector3.new(-(map.width * CELL) / 2, STAGE_Y, -(map.height * CELL) / 2)
end

local function hexColor(hex)
	local n = tonumber(string.sub(hex, 2), 16) or 0
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end

local TERRAIN_TINT = { -- readable miniature palette; unknown = near-black
	ocean = Color3.fromRGB(30, 60, 110), grassland = Color3.fromRGB(70, 120, 60),
	plains = Color3.fromRGB(130, 130, 70), desert = Color3.fromRGB(180, 160, 100),
	tundra = Color3.fromRGB(150, 150, 150), arctic = Color3.fromRGB(220, 220, 230),
	swamp = Color3.fromRGB(60, 90, 70), forest = Color3.fromRGB(40, 90, 45),
	hills = Color3.fromRGB(110, 95, 60), mountains = Color3.fromRGB(90, 80, 80),
	jungle = Color3.fromRGB(35, 100, 55), river = Color3.fromRGB(50, 90, 120),
	unknown = Color3.fromRGB(12, 12, 16),
}

local function renderStage(view)
	if stage ~= nil then
		stage:Destroy()
	end
	stage = Instance.new("Folder")
	stage.Name = "TheaterStage"
	local map = view.map
	local o = stageOrigin(map)
	-- one part per ROW RUN of same-tint tiles keeps the part count sane
	for y = 0, map.height - 1 do
		local runStart, runColor = 0, nil
		local function flush(endX)
			if runColor == nil then
				return
			end
			local w = (endX - runStart) * CELL
			local p = Instance.new("Part")
			p.Anchored = true
			p.CanCollide = false
			p.CanQuery = false
			p.Size = Vector3.new(w, 0.3, CELL)
			p.CFrame = CFrame.new(o + Vector3.new(runStart * CELL + w / 2, 0, y * CELL + CELL / 2))
			p.Color = runColor
			p.Material = Enum.Material.SmoothPlastic
			p.Parent = stage
		end
		for x = 0, map.width - 1 do
			local tile = map.tiles[y * map.width + x + 1]
			local tint = TERRAIN_TINT[tile.t] or TERRAIN_TINT.unknown
			if tint ~= runColor then
				flush(x)
				runStart, runColor = x, tint
			end
		end
		flush(map.width)
	end
	for _, c in pairs(view.cities) do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.Size = Vector3.new(CELL * 1.1, 0.8, CELL * 1.1)
		p.CFrame = CFrame.new(o + Vector3.new(c.x * CELL + CELL / 2, 0.6, c.y * CELL + CELL / 2))
		p.Color = hexColor(Palette.displayColor(view.players[c.owner].color))
		p.Material = Enum.Material.Neon
		p.Parent = stage
	end
	for _, u in pairs(view.units) do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.Shape = Enum.PartType.Ball
		p.Size = Vector3.new(0.7, 0.7, 0.7)
		p.CFrame = CFrame.new(o + Vector3.new(u.x * CELL + CELL / 2, 0.7, u.y * CELL + CELL / 2))
		p.Color = hexColor(view.players[u.owner].color)
		p.Material = Enum.Material.Neon
		p.Parent = stage
	end
	stage.Parent = workspace
end

-- ---- sandbox re-derivation (replayDiagnostics semantics) --------------------
local function deriveTo(roundN)
	local rs = ClientState.rulesets()
	local st = engineModule.deepClone(record.initialState)
	local mismatchAt = nil
	local upto = roundN == 0 and 0 or rounds[roundN]
	for i = 1, upto do
		local entry = record.entries[i]
		if entry.t == "cmd" and entry.ok == true then
			local res = engine.applyCommand(st, entry.cmd)
			if res.ok then
				st = res.state
				if entry.hash ~= nil and statehash.hashState(st) ~= entry.hash and mismatchAt == nil then
					mismatchAt = i
				end
			elseif mismatchAt == nil then
				mismatchAt = i
			end
		elseif entry.t == "round" then
			local first = engine.applyCommand(st, { type = "endTurn", playerId = st.activePlayer })
			if first.ok then
				st = first.state
				local guard = 10
				while st.gameOver ~= true and st.players[st.activePlayer].human ~= true and guard > 0 do
					guard = guard - 1
					st = aiModule.runAiTurn(engine, st, st.activePlayer, rs, {})
					local res = engine.applyCommand(st, { type = "endTurn", playerId = st.activePlayer })
					if not res.ok then
						break
					end
					st = res.state
				end
				if entry.hash ~= nil and statehash.hashState(st) ~= entry.hash and mismatchAt == nil then
					mismatchAt = i
				end
			elseif mismatchAt == nil then
				mismatchAt = i
			end
		end
	end
	return st, mismatchAt
end

-- runJ item 7: point the camera AT the mini-stage. The stage is built at
-- STAGE_Y=220 near the world origin; without this it renders but stays
-- off-screen (the reported "nothing happens in the world"). The map camera is
-- suppressed while the theater is open (ClientState.theaterActive), so this
-- fixed frame holds. Diagnosis: NOT the defeated/spectator gate (perspective is
-- omniscient + the player was still seated) — a general camera-framing bug.
local theaterCamera = workspace.CurrentCamera
local function frameStage(map)
	local o = stageOrigin(map)
	local center = o + Vector3.new(map.width * CELL / 2, 0, map.height * CELL / 2)
	local span = math.max(map.width, map.height) * CELL
	theaterCamera.CameraType = Enum.CameraType.Scriptable
	theaterCamera.CFrame = CFrame.lookAt(center + Vector3.new(0, span * 0.75, span * 0.85), center)
end

local function repaint()
	if record == nil then
		return
	end
	local ok, st, mismatchAt = pcall(deriveTo, atRound)
	if not ok then
		verdictLabel.Text = "theater derivation failed: " .. tostring(st)
		return
	end
	-- A87 verdict strings, roblox wording
	if mismatchAt ~= nil then
		verdict = ("MISMATCH at entry %d"):format(mismatchAt)
	else
		verdict = "VERIFIED"
	end
	local who = perspective == "spectator" and "omniscient"
		or ((st.players[perspective] and st.players[perspective].name) or perspective)
	verdictLabel.Text = ("round %d/%d - %s - view: %s - turn %d")
		:format(atRound, #rounds, verdict, who, st.turn)
	jumpFill.Size = UDim2.new(#rounds > 0 and atRound / #rounds or 0, 0, 1, 0)
	local view = visibility.filterView(st, perspective)
	renderStage(view)
end

-- ---- wiring -----------------------------------------------------------------
local function close()
	bar.Visible = false
	ClientState.theaterActive = false -- runJ item 7: the map camera resumes control
	if stage ~= nil then
		stage:Destroy()
		stage = nil
	end
end

local function openTheater()
	if bar.Visible then
		return
	end
	record = nil
	verdictLabel.Text = "requesting history..."
	bar.Visible = true
	ClientState.panelOpened("theater") -- runI item 14: hide the other left-stack panels
	remote:FireServer({ t = "theater" })
end
openBtn.Activated:Connect(function()
	if bar.Visible then
		close()
	else
		openTheater()
	end
end)
ClientState.onOpenTheater(openTheater) -- runJ item 6: the end screen's "Watch replay"

-- runI item 14: another left-stack panel opening closes the theater so they
-- never overlap
ClientState.onPanelOpen(function(id)
	if id ~= "theater" and bar.Visible then
		close()
	end
end)

closeBtn.Activated:Connect(close)

local function step(d)
	if record == nil then
		return
	end
	atRound = math.clamp(atRound + d, 0, #rounds)
	repaint()
end
firstBtn.Activated:Connect(function()
	atRound = 0
	repaint()
end)
lastBtn.Activated:Connect(function()
	atRound = #rounds
	repaint()
end)
backBtn.Activated:Connect(function()
	step(-1)
end)
fwdBtn.Activated:Connect(function()
	step(1)
end)
jumpBar.Activated:Connect(function(input)
	if record == nil or #rounds == 0 then
		return
	end
	local rel = (input.Position.X - jumpBar.AbsolutePosition.X) / jumpBar.AbsoluteSize.X
	atRound = math.clamp(math.floor(rel * #rounds + 0.5), 0, #rounds)
	repaint()
end)
viewBtn.Activated:Connect(function()
	if record == nil then
		return
	end
	-- cycle omniscient -> each civ (sorted) -> back
	local ids = {}
	for pid in pairs(record.initialState.players) do
		table.insert(ids, pid)
	end
	table.sort(ids)
	if perspective == "spectator" then
		perspective = ids[1]
	else
		local i = table.find(ids, perspective)
		perspective = (i ~= nil and i < #ids) and ids[i + 1] or "spectator"
	end
	viewBtn.Text = perspective == "spectator" and "view: all" or ("view: " .. perspective)
	repaint()
end)

remote.OnClientEvent:Connect(function(msg)
	if typeof(msg) ~= "table" then
		return
	end
	if msg.t == "theaterInit" then
		record = { initialState = msg.initialState, entries = {}, total = msg.total }
		engine = engineModule.createEngine(ClientState.rulesets())
		verdictLabel.Text = ("history: 0/%d entries..."):format(msg.total)
	elseif msg.t == "theaterChunk" and record ~= nil then
		for i, e in ipairs(msg.entries) do
			record.entries[msg.from + i - 1] = e
		end
		verdictLabel.Text = ("history: %d/%d entries..."):format(#record.entries, record.total)
	elseif msg.t == "theaterDone" and record ~= nil then
		rounds = {}
		for i, e in ipairs(record.entries) do
			if e.t == "round" then
				table.insert(rounds, i)
			end
		end
		atRound = #rounds
		ClientState.theaterActive = true -- runJ item 7: suppress the map camera
		frameStage(record.initialState.map)
		repaint()
	elseif msg.t == "rejected" and bar.Visible and record == nil then
		if msg.code == "gameStillRunning" then
			verdictLabel.Text = "theater opens when the game ends (fog rule)"
		elseif msg.code == "notSeated" then
			verdictLabel.Text = "no finished game to replay yet"
		end
	end
end)

print("[Theater] R18 replay theater ready (THEATER button; opens post-game)")
