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
local UiTheme = require(script.Parent:WaitForChild("UiTheme"))
local ClientState = require(script.Parent:WaitForChild("ClientState"))

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
panel.Size = UDim2.new(0, 360, 0, 172) -- render() sizes it to the seat count
panel.Position = UDim2.new(1, -368, 0, 120)
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

-- run-R (user): the seat list as a titled panel — heading, what the phase
-- means for YOU, a seat count, then one card per seat (civ, who holds it, a
-- status badge). Same lobby payload; nothing sent changed.
local SEATS_TOP = 108
local panelTitle = label(panel, 8, 30, "Game lobby")
panelTitle.Position = UDim2.new(0, 12, 0, 8)
panelTitle.Font = UiTheme.FONT
panelTitle.TextSize = UiTheme.TEXT.title
local phaseLine = label(panel, 40, 40, "")
phaseLine.Position = UDim2.new(0, 12, 0, 40)
phaseLine.Size = UDim2.new(1, -24, 0, 40)
phaseLine.Font = UiTheme.BODY_FONT
phaseLine.TextSize = 15
phaseLine.TextColor3 = Color3.fromRGB(200, 208, 224)
phaseLine.TextYAlignment = Enum.TextYAlignment.Top
local countdownLine = label(panel, 82, 22, "")
countdownLine.Position = UDim2.new(0, 12, 0, 82)
countdownLine.Size = UDim2.new(1, -24, 0, 22)
countdownLine.Font = Enum.Font.GothamBold
countdownLine.TextSize = 15
countdownLine.RichText = true
local seatsFrame = Instance.new("ScrollingFrame") -- runI item 6: scroll so ALL N seats show at the +50% font
seatsFrame.Size = UDim2.new(1, -16, 1, -(SEATS_TOP + 8))
seatsFrame.Position = UDim2.new(0, 8, 0, SEATS_TOP)
seatsFrame.BackgroundTransparency = 1
seatsFrame.BorderSizePixel = 0
seatsFrame.ScrollBarThickness = 6
seatsFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
seatsFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
seatsFrame.Parent = panel
local seatsLayout = Instance.new("UIListLayout")
seatsLayout.SortOrder = Enum.SortOrder.LayoutOrder
seatsLayout.Padding = UDim.new(0, 6)
seatsLayout.Parent = seatsFrame

-- host setup panel
local setupPanel = Instance.new("Frame")
setupPanel.Size = UDim2.new(0, 510, 0, 628) -- runI/runJ item 1 width; taller for the #2543 toggle row + two run-R rows
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
-- W7: full rules.mapTypes roster, SORTED — the server steps sorted keys, so
-- this list must stay alphabetical or segment taps land on the wrong preset
local SETUP_MAPTYPES = {
	"archipelago", "clover", "continents", "fractal", "inland-sea",
	"islands", "oval", "pangaea", "ring",
}
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
local midgameJoinToggle = stepButton(8, 474, "", function() sendSetup("midgamejoin", 1) end) -- #2543 toggle
spectatorsToggle.Size = UDim2.new(0, 58, 0, 26)
marathonToggle.Size = UDim2.new(0, 58, 0, 26)
midgameJoinToggle.Size = UDim2.new(0, 58, 0, 26)
label(setupPanel, 406, 20, "        spectators").Position = UDim2.new(0, 74, 0, 406)
label(setupPanel, 440, 20, "        marathon (play to victory)").Position = UDim2.new(0, 74, 0, 440)
label(setupPanel, 474, 20, "        mid-game join (AI-civ takeover)").Position = UDim2.new(0, 74, 0, 474)
-- run-R rulings 1 + 4: diagnostics for players (host), debug game (owner only)
local diagToggle = stepButton(8, 508, "", function() sendSetup("diag", 1) end)
local debugGameToggle = stepButton(8, 542, "", function() sendSetup("debuggame", 1) end)
diagToggle.Size = UDim2.new(0, 58, 0, 26)
debugGameToggle.Size = UDim2.new(0, 58, 0, 26)
label(setupPanel, 508, 20, "        diagnostics log for players").Position = UDim2.new(0, 74, 0, 508)
local debugGameLabel = label(setupPanel, 542, 20, "        debug game (owner; marks the game debug-used)")
debugGameLabel.Position = UDim2.new(0, 74, 0, 542)

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
require(script.Parent:WaitForChild("UiTheme")).apply(startBtn, { color = "go" }) -- U2 dress
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
require(script.Parent:WaitForChild("UiTheme")).apply(resumeBtn, { color = "menu" }) -- U2 dress
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
require(script.Parent:WaitForChild("UiTheme")).apply(saveBtn, { color = "menu" }) -- U2 dress
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

-- run-R (user): the button floated under the menu row with no context. Saving
-- is a settings-menu action, so it and its code box live at the foot of the
-- Options panel (host, game running); the panel grows by their height.
local optionsPanel, optionsBase = nil, nil
local function placeSave()
	if optionsPanel ~= nil then
		optionsPanel.Size = optionsBase + UDim2.new(0, 0, 0, saveBtn.Visible and 74 or 0)
	end
end
task.spawn(function()
	local og = Players.LocalPlayer.PlayerGui:WaitForChild("RMCOptions", 20)
	local p = og ~= nil and og:WaitForChild("Panel", 20) or nil
	if p == nil then
		return -- stays where it was built
	end
	optionsPanel, optionsBase = p, p.Size
	saveBtn.Size = UDim2.new(1, -12, 0, 32)
	saveBtn.Position = UDim2.new(0, 6, 1, -70)
	saveBtn.TextSize = 15
	saveBtn.Text = "Save - get resume code"
	saveBtn.Parent = p
	codeOut.Size = UDim2.new(1, -12, 0, 28)
	codeOut.Position = UDim2.new(0, 6, 1, -34)
	codeOut.TextSize = 15
	codeOut.PlaceholderText = "the code appears here"
	codeOut.Parent = p
	placeSave()
end)

local PHASE_TEXT = {
	idle = "No game yet. Step on the START pad to host one, or enter a resume code below.",
	setup = "The host is choosing options. Step on the JOIN pad to claim a seat.",
	starting = "The game is starting. The JOIN pad is still open.",
	running = "A game is in progress. Step on TAKE OVER to play an AI civ.",
}

-- seat status -> badge text + colour (one colour per status, also the row's edge bar)
local SEAT_LOOK = {
	you = { badge = "YOU", color = Color3.fromRGB(110, 220, 130) },
	player = { badge = "PLAYER", color = Color3.fromRGB(96, 168, 240) },
	ai = { badge = "AI", color = Color3.fromRGB(150, 160, 180) },
	regent = { badge = "REGENT", color = Color3.fromRGB(176, 136, 236) },
	open = { badge = "OPEN", color = Color3.fromRGB(240, 196, 96) },
}

local youSeated = false

local function render(lobby)
	-- run-R rulings 1 + 4: what the dev surfaces read (DebugMenu, Strategic, DiagAudit)
	ClientState.debugGame = lobby.options ~= nil and lobby.options.debugGame == true
	ClientState.diagForPlayers = lobby.options ~= nil and lobby.options.diag == true
	if lobby.gameRunning ~= true then
		youSeated = false -- the game ended (ephemeral or otherwise): lobby returns
	end
	panel.Visible = not youSeated -- seated players live in the HUD, not here
	phaseLine.Text = PHASE_TEXT[lobby.phase] or tostring(lobby.phase)
	phaseLine.TextWrapped = true
	do
		local humans, open = 0, 0
		for _, seat in ipairs(lobby.seats or {}) do
			if seat.who == "open" then
				open += 1
			elseif seat.who ~= "AI" and seat.who ~= "regent" then
				humans += 1
			end
		end
		local n = #(lobby.seats or {})
		local count = ("%d seat%s  ·  %d player%s  ·  %d open"):format(n, n == 1 and "" or "s",
			humans, humans == 1 and "" or "s", open)
		countdownLine.Text = lobby.countdown > 0
			and ('<font color="#ffd76a">starts in %d s</font>  ·  %s'):format(lobby.countdown, count) or count
	end

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
	local rows = 0
	for i, seat in ipairs(lobby.seats or {}) do
		rows += 1
		local mine = seat.who == Players.LocalPlayer.Name
		local kind = mine and "you" or seat.who == "open" and "open" or seat.who == "AI" and "ai"
			or seat.who == "regent" and "regent" or "player"
		local look = SEAT_LOOK[kind]
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, -8, 0, 50)
		row.LayoutOrder = i
		row.BackgroundColor3 = Color3.fromRGB(38, 44, 60)
		row.BackgroundTransparency = kind == "open" and 0.55 or 0.1
		row.BorderSizePixel = 0
		row.Parent = seatsFrame
		local rc = Instance.new("UICorner")
		rc.CornerRadius = UDim.new(0, 8)
		rc.Parent = row
		if mine then
			local rs = Instance.new("UIStroke")
			rs.Color = look.color
			rs.Thickness = 2
			rs.Parent = row
		end
		local bar = Instance.new("Frame") -- status colour along the left edge
		bar.Size = UDim2.new(0, 6, 1, -12)
		bar.Position = UDim2.new(0, 6, 0, 6)
		bar.BackgroundColor3 = look.color
		bar.BorderSizePixel = 0
		bar.Parent = row
		local bc = Instance.new("UICorner")
		bc.CornerRadius = UDim.new(0, 3)
		bc.Parent = bar
		local civ = Instance.new("TextLabel")
		civ.Size = UDim2.new(1, -150, 0, 24)
		civ.Position = UDim2.new(0, 20, 0, 4)
		civ.BackgroundTransparency = 1
		civ.TextColor3 = Color3.fromRGB(240, 242, 248)
		civ.Font = Enum.Font.GothamBold
		civ.TextSize = 18
		civ.TextXAlignment = Enum.TextXAlignment.Left
		civ.TextTruncate = Enum.TextTruncate.AtEnd
		civ.Text = tostring(seat.name):sub(1, 1):upper() .. tostring(seat.name):sub(2)
		civ.Parent = row
		local who = Instance.new("TextLabel")
		who.Size = UDim2.new(1, -150, 0, 18)
		who.Position = UDim2.new(0, 20, 0, 28)
		who.BackgroundTransparency = 1
		who.TextColor3 = Color3.fromRGB(170, 180, 198)
		who.Font = UiTheme.BODY_FONT
		who.TextSize = 14
		who.TextXAlignment = Enum.TextXAlignment.Left
		who.TextTruncate = Enum.TextTruncate.AtEnd
		-- R21: 'Perfectionist' = the authentic Civ1 trait name for the
		-- engine's 'builder' stance (reviewer-verified); balanced = no tag
		local stanceTag = seat.stance == "builder" and "  ·  Perfectionist" or ""
		who.Text = ("%s  ·  %s%s"):format(tostring(seat.pid),
			kind == "open" and "free - step on JOIN" or kind == "ai" and "computer player"
				or kind == "regent" and "AI regent holds this seat" or seat.who, stanceTag)
		who.Parent = row
		local canKick = lobby.youAreAdmin and (kind == "player" or kind == "you")
		local badge = Instance.new("TextLabel")
		badge.Size = UDim2.new(0, 62, 0, 22)
		badge.Position = UDim2.new(1, canKick and -132 or -70, 0.5, -11)
		badge.BackgroundColor3 = look.color
		badge.BackgroundTransparency = 0.15
		badge.TextColor3 = Color3.fromRGB(16, 18, 26)
		badge.Font = Enum.Font.GothamBold
		badge.TextSize = 14
		badge.Text = look.badge
		badge.Parent = row
		local bdc = Instance.new("UICorner")
		bdc.CornerRadius = UDim.new(0, 11)
		bdc.Parent = badge
		if canKick then
			local kick = Instance.new("TextButton")
			kick.Size = UDim2.new(0, 56, 0, 28)
			kick.Position = UDim2.new(1, -62, 0.5, -14)
			kick.TextSize = 15
			kick.Text = "Kick"
			kick.Parent = row
			UiTheme.apply(kick, { color = "danger", radius = 8 })
			kick.Activated:Connect(function()
				remote:FireServer({ t = "kick", seat = seat.pid })
			end)
		end
	end
	-- the panel is as tall as its seats (was a fixed 430 px box around one row)
	panel.Size = UDim2.new(0, 360, 0, SEATS_TOP + 8 + math.clamp(rows, 1, 8) * 56)

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
		local mgjOn = lobby.options.midgameJoin ~= false -- #2543 (default ON)
		midgameJoinToggle.Text = mgjOn and "On" or "Off"
		midgameJoinToggle.BackgroundColor3 = mgjOn and ON or OFF
		local diagOn = lobby.options.diag == true
		diagToggle.Text = diagOn and "On" or "Off"
		diagToggle.BackgroundColor3 = diagOn and ON or OFF
		local dbgOn = lobby.options.debugGame == true
		debugGameToggle.Text = dbgOn and "On" or "Off"
		debugGameToggle.BackgroundColor3 = dbgOn and ON or OFF
		debugGameToggle.Visible = lobby.youAreOwner == true
		debugGameLabel.Visible = lobby.youAreOwner == true
	end

	-- R10 chrome: resume input only while gameless; host save button in-game
	local idle = lobby.phase == "idle"
	resumeBox.Visible = idle
	resumeBtn.Visible = idle
	saveBtn.Visible = lobby.phase == "running" and lobby.youAreHost
	codeOut.Visible = saveBtn.Visible and (optionsPanel ~= nil or codeOut.Text ~= "")
	placeSave()
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
