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
-- explanation of why it doesn't apply right now (bottom-center, 5s)
local toastLabel = Instance.new("TextLabel")
toastLabel.Size = UDim2.new(0, 620, 0, 44)
toastLabel.Position = UDim2.new(0.5, -310, 1, -170)
toastLabel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
toastLabel.BackgroundTransparency = 0.12
toastLabel.TextColor3 = Color3.fromRGB(255, 235, 180)
toastLabel.Font = Enum.Font.SourceSansBold
toastLabel.TextSize = 18
toastLabel.TextWrapped = true
toastLabel.Visible = false
toastLabel.Parent = gui
local toastGen = 0

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
greeting.Text = "Welcome to RetroMultiCiv! You are on the observation deck - "
	.. "spectate from the sky, or use the pads below to start or join a game."
greeting.Parent = gui

-- lobby panel (phase + seats + countdown)
local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 260, 0, 210)
panel.Position = UDim2.new(1, -268, 0, 120)
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
local seatsFrame = Instance.new("Frame")
seatsFrame.Size = UDim2.new(1, -12, 1, -52)
seatsFrame.Position = UDim2.new(0, 6, 0, 48)
seatsFrame.BackgroundTransparency = 1
seatsFrame.Parent = panel
local seatsLayout = Instance.new("UIListLayout")
seatsLayout.SortOrder = Enum.SortOrder.LayoutOrder
seatsLayout.Padding = UDim.new(0, 2)
seatsLayout.Parent = seatsFrame

-- host setup panel
local setupPanel = Instance.new("Frame")
setupPanel.Size = UDim2.new(0, 300, 0, 190)
setupPanel.Position = UDim2.new(0.5, -150, 0.3, 0)
setupPanel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
setupPanel.BackgroundTransparency = 0.08
setupPanel.BorderSizePixel = 0
setupPanel.Visible = false
setupPanel.Parent = gui

label(setupPanel, 6, 22, "New game (you are the host)")
local sizeLine = label(setupPanel, 34, 18, "")
local civsLine = label(setupPanel, 76, 18, "")
local humansLine = label(setupPanel, 118, 18, "")

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

local function sendSetup(key, dir)
	remote:FireServer({ t = "setup", key = key, dir = dir })
end

stepButton(8, 52, "-", function() sendSetup("size", -1) end)
stepButton(42, 52, "+", function() sendSetup("size", 1) end)
stepButton(8, 94, "-", function() sendSetup("civs", -1) end)
stepButton(42, 94, "+", function() sendSetup("civs", 1) end)
stepButton(8, 136, "-", function() sendSetup("humans", -1) end)
stepButton(42, 136, "+", function() sendSetup("humans", 1) end)

local startBtn = Instance.new("TextButton")
startBtn.Size = UDim2.new(0, 130, 0, 28)
startBtn.Position = UDim2.new(1, -138, 1, -36)
startBtn.BackgroundColor3 = Color3.fromRGB(60, 130, 80)
startBtn.TextColor3 = Color3.fromRGB(235, 245, 235)
startBtn.Font = Enum.Font.SourceSansBold
startBtn.TextSize = 17
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
		row.Size = UDim2.new(1, 0, 0, 20)
		row.LayoutOrder = i
		row.BackgroundTransparency = 1
		row.Parent = seatsFrame
		local text = Instance.new("TextLabel")
		text.Size = UDim2.new(1, lobby.youAreAdmin and -46 or 0, 1, 0)
		text.BackgroundTransparency = 1
		text.TextColor3 = Color3.fromRGB(220, 220, 225)
		text.Font = Enum.Font.Code
		text.TextSize = 14
		text.TextXAlignment = Enum.TextXAlignment.Left
		text.Text = ("%s %s - %s"):format(seat.pid, seat.name, seat.who)
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
		sizeLine.Text = "map size: " .. lobby.options.size
		civsLine.Text = ("civilizations: %d"):format(lobby.options.civs)
		humansLine.Text = ("human seats: %d (rest are AI)"):format(lobby.options.humans)
	end

	-- R10 chrome: resume input only while gameless; host save button in-game
	local idle = lobby.phase == "idle"
	resumeBox.Visible = idle
	resumeBtn.Visible = idle
	saveBtn.Visible = lobby.phase == "running" and lobby.youAreHost
	codeOut.Visible = saveBtn.Visible and codeOut.Text ~= ""
end

remote.OnClientEvent:Connect(function(msg)
	if typeof(msg) ~= "table" then
		return
	end
	if msg.t == "toast" then
		toastLabel.Text = tostring(msg.text)
		toastLabel.Visible = true
		toastGen += 1
		local gen = toastGen
		task.delay(5, function()
			if gen == toastGen then
				toastLabel.Visible = false
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
	end
end)

-- own hello (ClientState's {t="join"} may fire before our handler connects —
-- scripts load in parallel; the reply to THIS message can't be missed)
remote:FireServer({ t = "lobbyHello" })

print("[Lobby] R9 lobby UI up (deck pads drive the flow)")
