-- R4: minimal HUD (roblox/SPEC.md §3e) — a status line and an End Turn
-- button; the full action bar is R5. Reads ClientState.view only.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local Tooltip = require(script.Parent:WaitForChild("Tooltip")) -- SO2
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCHud"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local status = Instance.new("TextLabel")
status.Name = "Status"
status.Size = UDim2.new(0, 560, 0, 28)
status.Position = UDim2.new(0, 8, 0, 8)
status.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
status.BackgroundTransparency = 0.25
status.TextColor3 = Color3.fromRGB(235, 235, 235)
status.Font = Enum.Font.Code
status.TextSize = 16
status.TextXAlignment = Enum.TextXAlignment.Left
status.Text = "  joining…"
status.Parent = gui
status.Active = true -- SO2: tooltip target

-- SO2 (C2 twin): the income ledger on the status line — hover/long-press
Tooltip.attach(status, function()
	local view = ClientState.view
	local me = view ~= nil and view.players[view.you] or nil
	if me == nil then
		return ""
	end
	local rs = ClientState.rulesets()
	local shim = { players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, map = view.map }
	local ok, inc = pcall(techModule.playerIncome, shim, view.you, rs)
	if not ok or inc == nil then
		return "income breakdown unavailable"
	end
	local tax = me.taxRate or rs.rules.defaultTaxRate or 0
	local sci = me.sciRate or rs.rules.defaultSciRate or 0
	return ("income per turn\n  gold %+d (maintenance -%d)\n  bulbs +%d\nrates: tax %d%% sci %d%% lux %d%%\ntreasury %d gold")
		:format((inc.gold or 0) - (inc.maintenance or 0), inc.maintenance or 0,
			inc.bulbs or 0, tax, sci, math.max(0, 100 - tax - sci), me.gold or 0)
end)

local endTurn = Instance.new("TextButton")
endTurn.Name = "EndTurn"
endTurn.Size = UDim2.new(0, 150, 0, 44)
endTurn.Position = UDim2.new(1, -158, 1, -52)
endTurn.BackgroundColor3 = Color3.fromRGB(38, 40, 48) -- session-E: grey until a game exists
endTurn.TextColor3 = Color3.fromRGB(240, 240, 240)
endTurn.Font = Enum.Font.SourceSansBold
endTurn.TextSize = 20
endTurn.Text = "End Turn"
endTurn.Parent = gui
do -- session-E: big rounded buttons
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 8)
	c.Parent = endTurn
end

-- session-E round 21 (user): every server REJECT gets a visible red
-- center-screen banner in plain language (rejects carry no coordinates,
-- so center screen is the reliable anchor); the raw code still prints.
local REJECT_TEXT = {
	tooCloseToCity = "Too close to another city",
	zoc = "Blocked - enemy zone of control",
	noMovesLeft = "No moves left this turn",
	impassable = "That terrain is impassable for this unit",
	notYourTurn = "Not your turn",
	notEnoughGold = "Not enough gold",
	alreadyComplete = "Production is already complete",
	transportFull = "That transport is full",
	noAmphibiousAssault = "Cannot attack straight off a ship - unload first",
	roundInFlight = "Hold on - the round is still resolving",
	notSeated = "You are not seated in this game",
	badItem = "That cannot be built here",
	unknownCity = "Unknown city",
	notYourCity = "Not your city",
	gameStillRunning = "The replay theater opens after the game ends",
	-- CP17 trade rejections
	notCaravan = "Only caravans establish trade routes",
	cityRequired = "Move the caravan INTO the destination city first",
	noHomeCity = "The caravan needs a home city",
	sameCity = "A route needs a DIFFERENT city than home",
	duplicateRoute = "That route already exists",
	ownCityTooClose = "Own cities this close cannot form a route",
}
local rejectBanner = Instance.new("TextLabel")
rejectBanner.Size = UDim2.new(0, 800, 0, 44)
rejectBanner.Position = UDim2.new(0.5, -400, 0.35, 0)
rejectBanner.BackgroundTransparency = 1
rejectBanner.TextColor3 = Color3.fromRGB(255, 90, 80)
rejectBanner.Font = Enum.Font.SourceSansBold
rejectBanner.TextSize = 30
rejectBanner.TextStrokeTransparency = 0.3
rejectBanner.Visible = false
rejectBanner.Parent = gui
local rejectGen = 0
ClientState.onRejected(function(code)
	rejectGen += 1
	local gen = rejectGen
	rejectBanner.Text = REJECT_TEXT[code] or ("Command rejected: " .. code)
	rejectBanner.Visible = true
	task.delay(3, function()
		if gen == rejectGen then
			rejectBanner.Visible = false
		end
	end)
end)

-- CP17: the camel windfall banner (green twin of the reject banner)
local noticeBanner = Instance.new("TextLabel")
noticeBanner.Size = UDim2.new(0, 800, 0, 40)
noticeBanner.Position = UDim2.new(0.5, -400, 0.30, 0)
noticeBanner.BackgroundTransparency = 1
noticeBanner.TextColor3 = Color3.fromRGB(150, 230, 150)
noticeBanner.Font = Enum.Font.SourceSansBold
noticeBanner.TextSize = 26
noticeBanner.TextStrokeTransparency = 0.3
noticeBanner.Visible = false
noticeBanner.Parent = gui
local noticeGen = 0
ClientState.onEvents(function(events, view)
	for _, e in ipairs(events) do
		if e.type == "tradeRouteEstablished" and view ~= nil and e.playerId == view.you then
			local home = view.cities[e.cityId] -- marker-0054 final field
			local partner = view.cities[e.partnerCityId]
			noticeGen += 1
			local gen = noticeGen
			noticeBanner.Text = ("Trade route: %s - %s. Windfall +%d gold, +%d bulbs!")
				:format(home ~= nil and home.name or "?", partner ~= nil and partner.name or "?",
					e.gold or 0, e.bulbs or 0)
			noticeBanner.Visible = true
			task.delay(5, function()
				if gen == noticeGen then
					noticeBanner.Visible = false
				end
			end)
		end
	end
end)

-- R22 (session-E, user design): the AI-regency toggle — left of End Turn.
-- ON: glowing gold. OFF: grey with a dash across. Click = hand the seat to
-- the regent / take it back (server-authoritative, ClientState.setAway).
local regencyBtn = Instance.new("TextButton")
regencyBtn.Name = "Regency"
regencyBtn.Size = UDim2.new(0, 44, 0, 44)
regencyBtn.Position = UDim2.new(1, -210, 1, -52)
regencyBtn.Font = Enum.Font.SourceSansBold
regencyBtn.TextSize = 18
regencyBtn.Text = "AI"
regencyBtn.Parent = gui
local regencyCorner = Instance.new("UICorner")
regencyCorner.CornerRadius = UDim.new(0, 8)
regencyCorner.Parent = regencyBtn
local regencyGlow = Instance.new("UIStroke")
regencyGlow.Thickness = 3
regencyGlow.Color = Color3.fromRGB(255, 220, 90)
regencyGlow.Parent = regencyBtn
local regencyDash = Instance.new("Frame") -- the OFF strike-through
regencyDash.AnchorPoint = Vector2.new(0.5, 0.5)
regencyDash.Position = UDim2.new(0.5, 0, 0.5, 0)
regencyDash.Size = UDim2.new(0, 44, 0, 4)
regencyDash.Rotation = -45
regencyDash.BorderSizePixel = 0
regencyDash.BackgroundColor3 = Color3.fromRGB(150, 150, 156)
regencyDash.Parent = regencyBtn

local function paintRegency()
	local on = ClientState.away
	regencyBtn.BackgroundColor3 = on and Color3.fromRGB(230, 185, 60) or Color3.fromRGB(44, 46, 54)
	regencyBtn.TextColor3 = on and Color3.fromRGB(30, 26, 12) or Color3.fromRGB(150, 150, 156)
	regencyGlow.Enabled = on
	regencyDash.Visible = not on
end
paintRegency()
regencyBtn.Activated:Connect(function()
	if ClientState.view ~= nil and not ClientState.gameOver then
		ClientState.setAway(not ClientState.away)
	end
end)

-- R22: the idle watcher — no unit command and no avatar movement for the
-- host's maxIdleMin, then a 60 s countdown (game-start banner style); zero
-- hands the seat to the regent. Any movement/command cancels everything.
local idleBanner = Instance.new("TextLabel")
idleBanner.Size = UDim2.new(0, 700, 0, 60)
idleBanner.Position = UDim2.new(0.5, -350, 0.25, 0)
idleBanner.BackgroundTransparency = 1
idleBanner.TextColor3 = Color3.fromRGB(235, 180, 70)
idleBanner.Font = Enum.Font.SourceSansBold
idleBanner.TextSize = 52
idleBanner.TextStrokeTransparency = 0.4
idleBanner.Visible = false
idleBanner.Parent = gui

local sentAway = false
local lastRootPos = nil
game:GetService("RunService").Heartbeat:Connect(function()
	local character = Players.LocalPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root ~= nil then
		if lastRootPos ~= nil and (root.Position - lastRootPos).Magnitude > 2 then
			ClientState.lastActivity = os.clock() -- avatar movement = activity
		end
		lastRootPos = root.Position
	end
	paintRegency()
	if ClientState.view == nil or ClientState.gameOver or ClientState.away then
		idleBanner.Visible = false
		sentAway = false
		return
	end
	local idle = os.clock() - ClientState.lastActivity
	local threshold = (ClientState.maxIdleMin or 1) * 60
	if idle < threshold then
		idleBanner.Visible = false
		sentAway = false
		return
	end
	local remaining = math.ceil(threshold + 60 - idle)
	if remaining > 0 then
		idleBanner.Text = ("IDLE - AI REGENT TAKES OVER IN %d"):format(remaining)
		idleBanner.Visible = true
	elseif not sentAway then
		sentAway = true
		idleBanner.Visible = false
		print("[Hud] idle timeout - handing the seat to the AI regent")
		ClientState.setAway(true)
	end
end)

-- R17: the permanent DEBUG taint chip — visible the moment the view's
-- push envelope says debugUsed (the watermark never comes off the state)
local debugChip = Instance.new("TextLabel")
debugChip.Size = UDim2.new(0, 70, 0, 20)
debugChip.Position = UDim2.new(0, 574, 0, 8)
debugChip.BackgroundColor3 = Color3.fromRGB(140, 40, 40)
debugChip.TextColor3 = Color3.fromRGB(255, 230, 230)
debugChip.Font = Enum.Font.SourceSansBold
debugChip.TextSize = 14
debugChip.Text = "DEBUG"
debugChip.Visible = false
debugChip.Parent = gui
do
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = debugChip
end

-- R7d (5): the docs/07 trust-loop chip — a read-only TextBox so the code is
-- SELECTABLE (Roblox has no clipboard API; selecting for manual copy is the
-- available affordance). Server sends the code with every push.
local codeChip = Instance.new("TextBox")
codeChip.Name = "GameCode"
codeChip.Size = UDim2.new(0, 220, 0, 20)
codeChip.Position = UDim2.new(0, 8, 0, 40)
codeChip.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
codeChip.BackgroundTransparency = 0.35
codeChip.TextColor3 = Color3.fromRGB(160, 200, 160)
codeChip.Font = Enum.Font.Code
codeChip.TextSize = 13
codeChip.TextXAlignment = Enum.TextXAlignment.Left
codeChip.TextEditable = false
codeChip.ClearTextOnFocus = false
codeChip.Text = "  code …"
codeChip.Parent = gui

-- R23: the latest AUTOSAVED (resumable) code — distinct from the live chip
-- above, which is a per-turn fingerprint with no save behind it. Selectable
-- for read/retype into the lobby resume box after a stop.
local saveChip = Instance.new("TextBox")
saveChip.Name = "SavedCode"
saveChip.Size = UDim2.new(0, 220, 0, 20)
saveChip.Position = UDim2.new(0, 8, 0, 62)
saveChip.BackgroundColor3 = Color3.fromRGB(20, 24, 34)
saveChip.BackgroundTransparency = 0.35
saveChip.TextColor3 = Color3.fromRGB(200, 180, 120)
saveChip.Font = Enum.Font.Code
saveChip.TextSize = 13
saveChip.TextXAlignment = Enum.TextXAlignment.Left
saveChip.TextEditable = false
saveChip.ClearTextOnFocus = false
saveChip.Visible = false
saveChip.Text = ""
saveChip.Parent = gui

-- R7d (5): A29 three-state End Turn — grey off-turn, green READY when no
-- movable units remain (fortified/working are standing orders), and a
-- two-press CONFIRM when units still have moves (first press warns, second
-- within 3 s sends anyway).
local READY = Color3.fromRGB(52, 130, 72)
local NORMAL = Color3.fromRGB(46, 88, 148)
local OFF = Color3.fromRGB(60, 60, 66)
local WARN = Color3.fromRGB(170, 120, 40)
local confirmUntil = 0

local function movableCount()
	local view = ClientState.view
	local n = 0
	if view ~= nil then
		for _, u in pairs(view.units) do
			if u.owner == view.you and u.moves > 0 and u.fortified ~= true
				and u.working == nil and not ClientState.isGarrisoned(u) then
				n += 1 -- round 19: garrisons never trip "N can move!"
			end
		end
	end
	return n
end

endTurn.Activated:Connect(function()
	if ClientState.view == nil then
		return -- session-E: dead on the deck, no game yet
	end
	if not ClientState.myTurn() then
		return
	end
	local left = movableCount()
	if left > 0 and os.clock() > confirmUntil then
		confirmUntil = os.clock() + 3
		endTurn.Text = ("%d can move!"):format(left)
		endTurn.BackgroundColor3 = WARN
		task.delay(3, function()
			if os.clock() >= confirmUntil then
				endTurn.Text = "End Turn"
			end
		end)
		return
	end
	confirmUntil = 0
	print("[Hud] end turn " .. ClientState.view.turn)
	ClientState.send({ type = "endTurn" })
end)

local function refresh(view)
	local mine = ClientState.myTurn()
	local me = view.players[view.you]
	local bits = ("  turn %d · %s · gold %d · active %s%s"):format(
		view.turn,
		view.year < 0 and (-view.year .. " BC") or (view.year .. " AD"),
		me and me.gold or 0,
		view.activePlayer,
		mine and " (YOU)" or " (AI thinking…)")
	if ClientState.gameOver then
		bits ..= "  ·  GAME OVER"
	end
	status.Text = bits
	if ClientState.code ~= nil then
		codeChip.Text = "  code " .. ClientState.code
	end
	debugChip.Visible = ClientState.debugUsed == true -- R17
	if ClientState.lastSave ~= nil then
		saveChip.Visible = true
		saveChip.Text = ("  saved %s (turn %d)"):format(ClientState.lastSave.code, ClientState.lastSave.turn)
	end
	if os.clock() > confirmUntil then
		endTurn.Text = "End Turn"
	end
	if not mine then
		endTurn.BackgroundColor3 = OFF
	elseif movableCount() == 0 then
		endTurn.BackgroundColor3 = READY -- A29 'ready': green when all moved
	else
		endTurn.BackgroundColor3 = NORMAL
	end
end

ClientState.onView(refresh)

print("[Hud] R7d hud up (three-state End Turn, game-code chip)")
