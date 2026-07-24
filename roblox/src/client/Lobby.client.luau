-- R9 client half (docs/13 Tier-3): the lobby UI over the deck. Attaches its
-- OWN handler to the shared RemoteEvent (ClientState ignores t="lobby"/
-- "greeting", so the frozen state module needs no edits). Renders:
--   greeting     first-visit welcome banner (auto-hides)
--   lobby        phase line + seat list + countdowns; the HOST additionally
--                gets the setup panel (size/civs/humans steppers + START —
--                the 60s window is server-enforced, shown as a countdown)
--   admin kick   seat rows grow a [kick] button when youAreAdmin (user
--                ruling: admins ONLY — no host-kick, no vote-kick)
-- Acting is messages to the server; the server judges everything.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remote = ReplicatedStorage:WaitForChild("RMC")

local gui = Instance.new("ScreenGui")
gui.Name = "RMCLobby"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

-- run-4: pad toasts — every pad touch answers with either an action or an
-- runI item 2: user-message banner — top-center over the deck, 2x the old font,
-- a dark rounded panel auto-sized to the text, a RED left edge for rejects/errors
-- (msg.kind=="error"), ~6s auto-dismiss + tap-to-dismiss, one at a time.
local toastPanel = Instance.new("TextButton") -- a button so tapping dismisses it
toastPanel.AutomaticSize = Enum.AutomaticSize.XY
toastPanel.Size = UDim2.new(0, 0, 0, 0)
toastPanel.AnchorPoint = Vector2.new(0.5, 0)
toastPanel.Position = UDim2.new(0.5, 0, 0, 70)
toastPanel.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
toastPanel.BackgroundTransparency = 0.1
toastPanel.AutoButtonColor = false
toastPanel.Text = ""
toastPanel.Visible = false
toastPanel.ZIndex = 20
toastPanel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 10)
	c.Parent = toastPanel
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 22)
	pad.PaddingRight = UDim.new(0, 18)
	pad.PaddingTop = UDim.new(0, 12)
	pad.PaddingBottom = UDim.new(0, 12)
	pad.Parent = toastPanel
end
local toastEdge = Instance.new("Frame") -- the reject-only red left edge
toastEdge.Size = UDim2.new(0, 6, 1, 0)
toastEdge.Position = UDim2.new(0, 0, 0, 0)
toastEdge.BackgroundColor3 = Color3.fromRGB(200, 70, 60)
toastEdge.BorderSizePixel = 0
toastEdge.ZIndex = 21
toastEdge.Visible = false
toastEdge.Parent = toastPanel
local toastLabel = Instance.new("TextLabel")
toastLabel.AutomaticSize = Enum.AutomaticSize.XY
toastLabel.Size = UDim2.new(0, 0, 0, 0)
toastLabel.BackgroundTransparency = 1
toastLabel.TextColor3 = Color3.fromRGB(255, 240, 200)
toastLabel.Font = Enum.Font.SourceSansBold
toastLabel.TextSize = 36 -- 2x the old 18 (the user's spec)
toastLabel.TextWrapped = true
toastLabel.ZIndex = 20
toastLabel.Parent = toastPanel
do -- cap the width so long messages wrap instead of stretching off-screen
	local sc = Instance.new("UISizeConstraint")
	sc.MaxSize = Vector2.new(760, math.huge)
	sc.Parent = toastLabel
end
local toastGen = 0
toastPanel.Activated:Connect(function()
	toastPanel.Visible = false
end)

-- run-4 live request: BIG global game-start countdown — center, ~25% from
-- the top, unmissable; ticks with the server's 1 Hz lobby broadcast
local bigCountdown = Instance.new("TextLabel")
bigCountdown.Size = UDim2.new(0, 640, 0, 80)
bigCountdown.Position = UDim2.new(0.5, -320, 0.25, -40)
bigCountdown.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
bigCountdown.BackgroundTransparency = 0.25
bigCountdown.TextColor3 = Color3.fromRGB(140, 255, 170)
bigCountdown.Font = Enum.Font.SourceSansBold
bigCountdown.TextSize = 52
bigCountdown.TextStrokeTransparency = 0.4
bigCountdown.Visible = false
bigCountdown.Parent = gui

-- greeting banner
local greeting = Instance.new("TextLabel")
greeting.Size = UDim2.new(0, 560, 0, 60)
greeting.Position = UDim2.new(0.5, -280, 0.18, 0)
greeting.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
greeting.BackgroundTransparency = 0.15
greeting.TextColor3 = Color3.fromRGB(220, 235, 255)
greeting.Font = Enum.Font.SourceSansBold
greeting.TextSize = 20
greeting.TextWrapped = true
greeting.Visible = false
greeting.Text = "Welcome to A World Begun! You are on the observation deck - " -- name ruled #2541
	.. "spectate from the sky, or use the pads below to start or join a game."
greeting.Parent = gui

-- lobby panel (phase + seats + countdown)
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 330, 0, 430) -- runI item 6: wider + taller for the +50% seat font
panel.Position = UDim2.new(1, -338, 0, 120)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui

local function label(parent, y, size, text)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -12, 0, size)
	l.Position = UDim2.new(0, 6, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = Color3.fromRGB(235, 235, 235)
	l.Font = Enum.Font.Code
	l.TextSize = size - 2
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Text = text
	l.Parent = parent
	return l
end

local phaseLine = label(panel, 6, 18, "")
local countdownLine = label(panel, 26, 18, "")
local seatsFrame = Instance.new("ScrollingFrame") -- runI item 6: scroll so ALL N seats show at the +50% font
seatsFrame.Size = UDim2.new(1, -12, 1, -52)
seatsFrame.Position = UDim2.new(0, 6, 0, 48)
seatsFrame.BackgroundTransparency = 1
seatsFrame.BorderSizePixel = 0
seatsFrame.ScrollBarThickness = 6
seatsFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
seatsFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
seatsFrame.Parent = panel
local seatsLayout = Instance.new("UIListLayout")
seatsLayout.SortOrder = Enum.SortOrder.LayoutOrder
seatsLayout.Padding = UDim.new(0, 3)
seatsLayout.Parent = seatsFrame

-- host setup panel
local setupPanel = Instance.new("Frame")
setupPanel.Size = UDim2.new(0, 510, 0, 520) -- runI/runJ item 1: 50% wider so the bars fit any step count
setupPanel.Position = UDim2.new(0.5, -255, 0.28, 0)
setupPanel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
setupPanel.BackgroundTransparency = 0.08
setupPanel.BorderSizePixel = 0
setupPanel.Visible = false
setupPanel.Parent = gui

label(setupPanel, 6, 33, "New game (you are the host)") -- runI item 5: +50% title

local function sendSetup(key, dir)
	remote:FireServer({ t = "setup", key = key, dir = dir })
end

-- runI item 3: ranged options are SEGMENTED BARS — one segment per legal value,
-- filled to the current value in the UI accent (NOT meaning-loaded); tapping a
-- segment sets it via |target-current| dir steps over the EXISTING setup protocol
-- (no server change). The legal-value lists MIRROR the server (GameServer
-- MAP_SIZES / DIFFICULTY_LEVELS / rules.mapTypes / rules.ages / maxCivsBySize) —
-- browser-parity, no contract touch.
local SETUP_SIZES = { "xsmall", "small", "medium" }
local SETUP_MAPTYPES = { "archipelago", "continents", "islands", "pangaea" }
local SETUP_AGES = { "ancient", "renaissance", "industrial", "modern", "space" }
local SETUP_DIFFICULTY = { "trainer", "easy", "medium", "hard", "godemperor" }
local SETUP_COMBAT = { "bestof3", "authentic" }
local MAXCIV_BY_SIZE = { xsmall = 7, small = 12, medium = 14 }
local UIACCENT = Color3.fromRGB(70, 120, 190)

local barsHost = Instance.new("ScrollingFrame")
barsHost.Size = UDim2.new(1, -16, 0, 286)
barsHost.Position = UDim2.new(0, 8, 0, 48)
barsHost.BackgroundTransparency = 1
barsHost.BorderSizePixel = 0
barsHost.ScrollBarThickness = 6
barsHost.AutomaticCanvasSize = Enum.AutomaticSize.Y
barsHost.CanvasSize = UDim2.new(0, 0, 0, 0)
barsHost.Parent = setupPanel
do
	local l = Instance.new("UIListLayout")
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Padding = UDim.new(0, 8)
	l.Parent = barsHost
end

-- one segmented-bar row: a +50%-font header "name: value" + a strip of segments
-- filled to the current index. display maps a value to its shown label.
local function buildBar(order, name, values, current, key, display)
	local curIdx = table.find(values, current) or 1
	local row = Instance.new("Frame")
	row.Size = UDim2.new(1, -4, 0, 48)
	row.BackgroundTransparency = 1
	row.LayoutOrder = order
	row.Parent = barsHost
	local head = Instance.new("TextLabel")
	head.Size = UDim2.new(1, 0, 0, 24)
	head.BackgroundTransparency = 1
	head.TextColor3 = Color3.fromRGB(235, 235, 235)
	head.Font = Enum.Font.Code
	head.TextSize = 20 -- runI item 5: +50% setup text (was 16)
	head.TextXAlignment = Enum.TextXAlignment.Left
	head.Text = ("%s: %s"):format(name, display and display(current) or tostring(current))
	head.Parent = row
	local w = 1 / #values
	for i, v in ipairs(values) do
		local seg = Instance.new("TextButton")
		seg.Size = UDim2.new(w, -2, 0, 18)
		seg.Position = UDim2.new(w * (i - 1), 1, 0, 26)
		seg.BackgroundColor3 = i <= curIdx and UIACCENT or Color3.fromRGB(44, 50, 64)
		seg.BorderSizePixel = 0
		seg.AutoButtonColor = true
		seg.Text = ""
		seg.Parent = row
		local target = i
		seg.Activated:Connect(function()
			local steps = target - curIdx
			local dir = steps >= 0 and 1 or -1
			for _ = 1, math.abs(steps) do
				sendSetup(key, dir)
			end
		end)
	end
end

-- rebuild every ranged bar from the current options (civs cap is size-dynamic,
-- so the strip must be regenerated each render)
local function rebuildBars(opts)
	for _, c in ipairs(barsHost:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	local cap = MAXCIV_BY_SIZE[opts.size] or 14
	local civVals, humanVals, idleVals = {}, {}, {}
	for n = 2, cap do table.insert(civVals, n) end
	for n = 1, opts.civs or 2 do table.insert(humanVals, n) end
	for n = 1, 15 do table.insert(idleVals, n) end
	buildBar(1, "map size", SETUP_SIZES, opts.size, "size")
	buildBar(2, "civilizations", civVals, opts.civs, "civs")
	buildBar(3, "human seats", humanVals, opts.humans, "humans")
	buildBar(4, "map type", SETUP_MAPTYPES, opts.mapType or "continents", "maptype")
	buildBar(5, "max idle (min)", idleVals, opts.maxIdleMin or 1, "maxidle")
	buildBar(6, "starting age", SETUP_AGES, opts.age or "ancient", "age",
		function(v) return v ~= "ancient" and (v .. " (fast-forward)") or v end)
	buildBar(7, "difficulty", SETUP_DIFFICULTY, opts.difficulty or "medium", "difficulty")
	buildBar(8, "combat", SETUP_COMBAT, opts.combat or "bestof3", "combat",
		function(v) return v == "bestof3" and "best of 3" or "authentic (single)" end)
end

local function stepButton(x, y, text, onClick)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 30, 0, 22)
	b.Position = UDim2.new(0, x, 0, y)
	b.BackgroundColor3 = Color3.fromRGB(50, 66, 92)
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 16
	b.Text = text
	b.Parent = setupPanel
	b.Activated:Connect(onClick)
	return b
end

-- R24b: explicit world seed (browser parity); empty or 0 = random
local seedLbl = label(setupPanel, 344, 20, "world seed (empty = random):") -- item 5 font
local seedBox = Instance.new("TextBox")
seedBox.Size = UDim2.new(0, 150, 0, 26)
seedBox.Position = UDim2.new(0, 8, 0, 370)
seedBox.BackgroundColor3 = Color3.fromRGB(38, 44, 58)
seedBox.TextColor3 = Color3.fromRGB(235, 235, 235)
seedBox.Font = Enum.Font.Code
seedBox.TextSize = 14
seedBox.PlaceholderText = "seed (empty=random)"
seedBox.Text = ""
seedBox.ClearTextOnFocus = false
seedBox.Parent = setupPanel
seedBox.FocusLost:Connect(function()
	remote:FireServer({ t = "setup", key = "seed",
		value = tonumber(seedBox.Text) or 0 })
end)
-- runI item 3: boolean options are a single green "On" / red "Off" button
-- (recolored per state in render), not a "~" stepper.
local spectatorsToggle = stepButton(8, 406, "", function() sendSetup("spectators", 1) end) -- CP16 toggle
local marathonToggle = stepButton(8, 440, "", function() sendSetup("marathon", 1) end) -- MP11 toggle
spectatorsToggle.Size = UDim2.new(0, 58, 0, 26)
marathonToggle.Size = UDim2.new(0, 58, 0, 26)
label(setupPanel, 406, 20, "        spectators").Position = UDim2.new(0, 74, 0, 406)
label(setupPanel, 440, 20, "        marathon (play to victory)").Position = UDim2.new(0, 74, 0, 440)

local startBtn = Instance.new("TextButton")
-- runI item 5: +50% Start button, anchored bottom-center, full width minus margins
startBtn.Size = UDim2.new(1, -16, 0, 42)
startBtn.Position = UDim2.new(0, 8, 1, -50)
startBtn.BackgroundColor3 = Color3.fromRGB(60, 130, 80)
startBtn.TextColor3 = Color3.fromRGB(235, 245, 235)
startBtn.Font = Enum.Font.SourceSansBold
startBtn.TextSize = 26
startBtn.Text = "START GAME"
startBtn.Parent = setupPanel
startBtn.Activated:Connect(function()
	remote:FireServer({ t = "setupDone" })
end)

-- R10: resume-by-code (idle phase) — a selectable TextBox (no clipboard on
-- Roblox; read/retype is the platform shape) + RESUME sends {t="resume"}
local resumeBox = Instance.new("TextBox")
resumeBox.Size = UDim2.new(0, 170, 0, 24)
resumeBox.Position = UDim2.new(0, 6, 1, -30)
resumeBox.BackgroundColor3 = Color3.fromRGB(38, 44, 58)
resumeBox.TextColor3 = Color3.fromRGB(235, 235, 235)
resumeBox.Font = Enum.Font.Code
resumeBox.TextSize = 14
resumeBox.PlaceholderText = "resume code..."
resumeBox.Text = ""
resumeBox.ClearTextOnFocus = false
resumeBox.Visible = false
resumeBox.Parent = panel

local resumeBtn = Instance.new("TextButton")
resumeBtn.Size = UDim2.new(0, 70, 0, 24)
resumeBtn.Position = UDim2.new(1, -76, 1, -30)
resumeBtn.BackgroundColor3 = Color3.fromRGB(60, 110, 90)
resumeBtn.TextColor3 = Color3.fromRGB(235, 245, 235)
resumeBtn.Font = Enum.Font.SourceSansBold
resumeBtn.TextSize = 15
resumeBtn.Text = "RESUME"
resumeBtn.Visible = false
resumeBtn.Parent = panel
resumeBtn.Activated:Connect(function()
	if resumeBox.Text ~= "" then
		remote:FireServer({ t = "resume", code = resumeBox.Text })
	end
end)

-- R10: the HOST's Get-Resume-Code button (visible while seated as host);
-- the code lands in a selectable box — the docs/07 trust loop, save flavor
local hostSaveGui = Instance.new("ScreenGui")
hostSaveGui.Name = "RMCResume"
hostSaveGui.ResetOnSpawn = false
hostSaveGui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
local saveBtn = Instance.new("TextButton")
saveBtn.Size = UDim2.new(0, 130, 0, 24)
saveBtn.Position = UDim2.new(1, -138, 0, 84)
saveBtn.BackgroundColor3 = Color3.fromRGB(60, 90, 110)
saveBtn.TextColor3 = Color3.fromRGB(230, 240, 245)
saveBtn.Font = Enum.Font.SourceSansBold
saveBtn.TextSize = 14
saveBtn.Text = "GET RESUME CODE"
saveBtn.Visible = false
saveBtn.Parent = hostSaveGui
local codeOut = Instance.new("TextBox")
codeOut.Size = UDim2.new(0, 170, 0, 24)
codeOut.Position = UDim2.new(1, -178, 0, 112)
codeOut.BackgroundColor3 = Color3.fromRGB(38, 44, 58)
codeOut.TextColor3 = Color3.fromRGB(180, 235, 200)
codeOut.Font = Enum.Font.Code
codeOut.TextSize = 14
codeOut.TextEditable = false
codeOut.ClearTextOnFocus = false
codeOut.Text = ""
codeOut.Visible = false
codeOut.Parent = hostSaveGui
saveBtn.Activated:Connect(function()
	remote:FireServer({ t = "getResumeCode" })
end)

local PHASE_TEXT = {
	idle = "no game - START pad opens hosting",
	setup = "host is choosing options (JOIN pad claims a seat)",
	starting = "game starting! (JOIN pad still open)",
	running = "game in progress (TAKE OVER pad joins as a civ)",
}

local youSeated = false

local function render(lobby)
	if lobby.gameRunning ~= true then
		youSeated = false -- the game ended (ephemeral or otherwise): lobby returns
	end
	panel.Visible = not youSeated -- seated players live in the HUD, not here
	phaseLine.Text = "lobby: " .. (PHASE_TEXT[lobby.phase] or lobby.phase)
	phaseLine.TextWrapped = true
	countdownLine.Text = lobby.countdown > 0 and ("countdown: %ds"):format(lobby.countdown) or ""

	-- the BIG center countdown: game start is green + loud; the host setup
	-- window shows amber so nobody mistakes the two
	if lobby.countdown > 0 and lobby.phase == "starting" then
		bigCountdown.Text = ("GAME STARTS IN %d"):format(lobby.countdown)
		bigCountdown.TextColor3 = Color3.fromRGB(140, 255, 170)
		bigCountdown.Visible = true
	elseif lobby.countdown > 0 and lobby.phase == "setup" then
		bigCountdown.Text = ("HOST IS SETTING UP - %d"):format(lobby.countdown)
		bigCountdown.TextColor3 = Color3.fromRGB(255, 220, 140)
		bigCountdown.Visible = true
	else
		bigCountdown.Visible = false
	end

	for _, child in ipairs(seatsFrame:GetChildren()) do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	for i, seat in ipairs(lobby.seats or {}) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, 0, 0, 30) -- runI item 6: taller for the +50% font
		row.LayoutOrder = i
		row.BackgroundTransparency = 1
		row.Parent = seatsFrame
		local text = Instance.new("TextLabel")
		text.Size = UDim2.new(1, lobby.youAreAdmin and -46 or 0, 1, 0)
		text.BackgroundTransparency = 1
		text.TextColor3 = Color3.fromRGB(220, 220, 225)
		text.Font = Enum.Font.Code
		text.TextSize = 21 -- runI item 6: +50% font
		text.TextXAlignment = Enum.TextXAlignment.Left
		-- R21: 'Perfectionist' = the authentic Civ1 trait name for the
		-- engine's 'builder' stance (reviewer-verified); balanced = no tag
		local stanceTag = seat.stance == "builder" and " [Perfectionist]" or ""
		-- runI item 6: the host's own row carries the same ★ idiom the capital uses
		local star = seat.who == Players.LocalPlayer.Name and "★ " or ""
		text.Text = ("%s%s %s - %s%s"):format(star, seat.pid, seat.name, seat.who, stanceTag)
		text.Parent = row
		if lobby.youAreAdmin and seat.who ~= "open" and seat.who ~= "AI" and seat.who ~= "regent" then
			local kick = Instance.new("TextButton")
			kick.Size = UDim2.new(0, 42, 0, 18)
			kick.Position = UDim2.new(1, -42, 0, 1)
			kick.BackgroundColor3 = Color3.fromRGB(120, 50, 50)
			kick.TextColor3 = Color3.fromRGB(240, 220, 220)
			kick.Font = Enum.Font.SourceSansBold
			kick.TextSize = 13
			kick.Text = "kick"
			kick.Parent = row
			kick.Activated:Connect(function()
				remote:FireServer({ t = "kick", seat = seat.pid })
			end)
		end
	end

	local isHostSetup = lobby.youAreHost and lobby.phase == "setup"
	setupPanel.Visible = isHostSetup
	if isHostSetup then
		-- runI item 3: rebuild the ranged segmented bars from the current options
		rebuildBars(lobby.options)
		-- runI item 3: green On / red Off two-state buttons
		local ON, OFF = Color3.fromRGB(56, 138, 74), Color3.fromRGB(150, 58, 52)
		local specOn = lobby.options.spectators ~= false
		spectatorsToggle.Text = specOn and "On" or "Off"
		spectatorsToggle.BackgroundColor3 = specOn and ON or OFF
		local marOn = lobby.options.marathon == true
		marathonToggle.Text = marOn and "On" or "Off"
		marathonToggle.BackgroundColor3 = marOn and ON or OFF
	end

	-- R10 chrome: resume input only while gameless; host save button in-game
	local idle = lobby.phase == "idle"
	resumeBox.Visible = idle
	resumeBtn.Visible = idle
	saveBtn.Visible = lobby.phase == "running" and lobby.youAreHost
	codeOut.Visible = saveBtn.Visible and codeOut.Text ~= ""
end

-- runJ item 5: the defeat overlay — a seated player who loses their last city
-- gets this full-screen notice + countdown; the server then returns them to the
-- observation deck seatless (the game continues without them).
local defeatOverlay = Instance.new("TextLabel")
defeatOverlay.Size = UDim2.new(1, 0, 1, 0)
defeatOverlay.BackgroundColor3 = Color3.fromRGB(12, 10, 14)
defeatOverlay.BackgroundTransparency = 0.22
defeatOverlay.TextColor3 = Color3.fromRGB(255, 210, 200)
defeatOverlay.Font = Enum.Font.SourceSansBold
defeatOverlay.TextSize = 34
defeatOverlay.TextWrapped = true
defeatOverlay.Visible = false
defeatOverlay.ZIndex = 50
defeatOverlay.Text = ""
defeatOverlay.Parent = gui
local defeatGen = 0
local function showDefeatOverlay(seconds)
	defeatGen += 1
	local gen = defeatGen
	defeatOverlay.Visible = true
	for s = seconds, 1, -1 do
		if gen ~= defeatGen then
			return
		end
		defeatOverlay.Text = ("DEFEATED\n\nYour last city has fallen.\n\nReturning to the observation deck in %d\u{2026}"):format(s)
		task.wait(1)
	end
	if gen == defeatGen then
		defeatOverlay.Visible = false
	end
end

-- runK item 6: the server-reset countdown banner (shown to everyone when the
-- post-game theater has had no watchers for 30s).
local resetLabel = Instance.new("TextLabel")
resetLabel.Size = UDim2.new(0, 520, 0, 40)
resetLabel.AnchorPoint = Vector2.new(0.5, 0)
resetLabel.Position = UDim2.new(0.5, 0, 0, 120)
resetLabel.BackgroundColor3 = Color3.fromRGB(84, 30, 30)
resetLabel.BackgroundTransparency = 0.15
resetLabel.TextColor3 = Color3.fromRGB(255, 230, 220)
resetLabel.Font = Enum.Font.SourceSansBold
resetLabel.TextSize = 20
resetLabel.Visible = false
resetLabel.ZIndex = 30
resetLabel.Text = ""
resetLabel.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = resetLabel
end

remote.OnClientEvent:Connect(function(msg)
	if typeof(msg) ~= "table" then
		return
	end
	if msg.t == "toast" then
		toastLabel.Text = tostring(msg.text)
		toastEdge.Visible = msg.kind == "error" -- rejects/errors get the red edge
		toastPanel.Visible = true -- newest replaces (one at a time)
		toastGen += 1
		local gen = toastGen
		task.delay(6, function()
			if gen == toastGen then
				toastPanel.Visible = false
			end
		end)
	elseif msg.t == "greeting" then
		greeting.Visible = true
		task.delay(8, function()
			greeting.Visible = false
		end)
	elseif msg.t == "lobby" then
		render(msg.lobby)
	elseif msg.t == "resumeCode" then
		codeOut.Text = msg.ok and msg.code or "save failed - see Output"
		codeOut.Visible = true
	elseif msg.t == "joined" then
		-- seated: the lobby chrome folds away (HUD takes over)
		youSeated = true
		panel.Visible = false
		setupPanel.Visible = false
	elseif msg.t == "defeated" then
		-- runJ item 5: last city fell — countdown, then the server decks us
		youSeated = false
		task.spawn(showDefeatOverlay, msg.seconds or 10)
	elseif msg.t == "resetCountdown" then
		-- runK item 6: the server resets for a new game once nobody is watching
		resetLabel.Text = ("Server resets for a new game in %d\u{2026}"):format(msg.seconds or 0)
		resetLabel.Visible = true
		if (msg.seconds or 0) <= 1 then
			task.delay(1.5, function()
				resetLabel.Visible = false
			end)
		end
	end
end)

-- own hello (ClientState's {t="join"} may fire before our handler connects —
-- scripts load in parallel; the reply to THIS message can't be missed)
remote:FireServer({ t = "lobbyHello" })

print("[Lobby] R9 lobby UI up (deck pads drive the flow)")
