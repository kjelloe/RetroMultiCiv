-- R6: the action bar (roblox/SPEC.md §3g, docs/13 Tier-1 row — a bottom-bar
-- ScreenGui, not Billboards, per the adopted review). Buttons mirror the
-- hotkeys and grey out when the context is wrong; every action is a command
-- through ClientState.send, nothing acts locally. Hotkeys here: G fortify,
-- Space wait (skip unit), X disband, I/M/R irrigate/mine/road (settlers,
-- startWork on the stood-on tile) — B (found) and Return (end turn) stay in
-- Select, P/N in Possess, T in ResearchPicker, L in TurnLog. All chat-guarded.
-- GoTo/pathfind: deferred (flagged @b3084114) — Select's click-move covers it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCActionBar"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local bar = Instance.new("Frame")
bar.Size = UDim2.new(0, 690, 0, 34)
bar.Position = UDim2.new(0.5, -345, 1, -42)
bar.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
bar.BackgroundTransparency = 0.25
bar.BorderSizePixel = 0
bar.Parent = gui
local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Horizontal
layout.Padding = UDim.new(0, 4)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.VerticalAlignment = Enum.VerticalAlignment.Center
layout.Parent = bar

local ENABLED = Color3.fromRGB(50, 66, 92)
local DISABLED = Color3.fromRGB(38, 40, 48)

local buttons = {}
local function addButton(order, text, width)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, width, 0, 26)
	b.LayoutOrder = order
	b.BackgroundColor3 = DISABLED
	b.TextColor3 = Color3.fromRGB(235, 235, 235)
	b.Font = Enum.Font.SourceSansBold
	b.TextSize = 15
	b.Text = text
	b.Parent = bar
	table.insert(buttons, b)
	return b
end

local foundBtn = addButton(1, "Found (B)", 90)
local fortifyBtn = addButton(2, "Fortify (G)", 90)
local waitBtn = addButton(3, "Wait (Spc)", 90)
local disbandBtn = addButton(4, "Disband (X)", 100)
local irrigateBtn = addButton(5, "Irr (I)", 70)
local mineBtn = addButton(6, "Mine (M)", 70)
local roadBtn = addButton(7, "Road (R)", 70)
local possessBtn = addButton(8, "Ride (P)", 80)

-- R7a (6): research leaves the unit bar for a top-center cluster (slots
-- reserved for diplomacy later). R12 (2)(5): Government joins it, and a
-- live research-status line sits beside the Research button.
local cluster = Instance.new("Frame")
cluster.Size = UDim2.new(0, 560, 0, 30)
cluster.Position = UDim2.new(0.5, -280, 0, 6)
cluster.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
cluster.BackgroundTransparency = 0.25
cluster.BorderSizePixel = 0
cluster.Parent = gui
local clusterLayout = Instance.new("UIListLayout")
clusterLayout.FillDirection = Enum.FillDirection.Horizontal
clusterLayout.Padding = UDim.new(0, 4)
clusterLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
clusterLayout.VerticalAlignment = Enum.VerticalAlignment.Center
clusterLayout.Parent = cluster

local researchBtn = Instance.new("TextButton")
researchBtn.LayoutOrder = 1
researchBtn.Size = UDim2.new(0, 110, 0, 24)
researchBtn.BackgroundColor3 = DISABLED
researchBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
researchBtn.Font = Enum.Font.SourceSansBold
researchBtn.TextSize = 15
researchBtn.Text = "Research (T)"
researchBtn.Parent = cluster

-- R12 (5): always-visible research status (tech + turns remaining)
local researchStatus = Instance.new("TextLabel")
researchStatus.LayoutOrder = 2
researchStatus.Size = UDim2.new(0, 260, 0, 24)
researchStatus.BackgroundTransparency = 1
researchStatus.TextColor3 = Color3.fromRGB(180, 210, 240)
researchStatus.Font = Enum.Font.SourceSansBold
researchStatus.TextSize = 15
researchStatus.TextXAlignment = Enum.TextXAlignment.Left
researchStatus.Text = ""
researchStatus.Parent = cluster

-- R12 (2): government button — panel hosts the rate steppers (and later
-- the government switch). Run-4 live request: sits LEFT of Research.
local governmentBtn = Instance.new("TextButton")
governmentBtn.LayoutOrder = 0
governmentBtn.Size = UDim2.new(0, 120, 0, 24)
governmentBtn.BackgroundColor3 = DISABLED
governmentBtn.TextColor3 = Color3.fromRGB(235, 235, 235)
governmentBtn.Font = Enum.Font.SourceSansBold
governmentBtn.TextSize = 15
governmentBtn.Text = "Government"
governmentBtn.Parent = cluster

local function selectedUnit()
	local view = ClientState.view
	if view == nil or ClientState.selectedUnitId == nil then
		return nil
	end
	local u = view.units[ClientState.selectedUnitId]
	if u ~= nil and u.owner == view.you then
		return u
	end
	return nil
end

local function ownCityCount(view)
	local n = 0
	for _, c in pairs(view.cities) do
		if c.owner == view.you then
			n += 1
		end
	end
	return n
end

-- R7a (4): view-side legality PRECHECK — grey + dead when the action can't
-- apply to the selected unit (A29 pattern: display-only, the server still
-- judges the real rules at command time)
local function onLandTile(u)
	local view = ClientState.view
	local tile = view.map.tiles[u.y * view.map.width + u.x + 1]
	local terr = tile and ClientState.rulesets().terrain.terrains[tile.t]
	return terr ~= nil and terr.domain == "land"
end

local function can(action)
	if not ClientState.myTurn() then
		return false
	end
	local u = selectedUnit()
	if action == "research" then
		return true
	end
	if u == nil then
		return false
	end
	if action == "disband" then
		return true
	end
	if action == "fortify" or action == "wait" then
		return u.moves > 0 and u.fortified ~= true
	end
	-- settlers jobs: found / irrigate / mine / road / possess-shaped
	if action == "possess" then
		return true
	end
	if u.type ~= "settlers" or u.moves <= 0 then
		return false
	end
	if action == "found" then
		return true
	end
	return onLandTile(u) -- irrigate / mine / road
end

-- ---- actions (commands only; the precheck gates the SEND, the server
-- still judges the real rules) ------------------------------------------------
local function doFound()
	if not can("found") then
		return
	end
	local u = selectedUnit()
	local name = "Colony " .. (ownCityCount(ClientState.view) + 1)
	print(("[ActionBar] found city '%s' with %s"):format(name, u.id))
	ClientState.send({ type = "foundCity", unitId = u.id, name = name })
end

local function doUnitCmd(cmdType)
	if not can(cmdType) then
		return
	end
	local u = selectedUnit()
	print(("[ActionBar] %s %s"):format(cmdType, u.id))
	ClientState.send({ type = cmdType, unitId = u.id })
end

-- settlers job on the stood-on tile; the server judges terrain/tech/dupes
local function doWork(work)
	if not can(work) then
		return
	end
	local u = selectedUnit()
	print(("[ActionBar] startWork %s %s"):format(work, u.id))
	ClientState.send({ type = "startWork", unitId = u.id, work = work })
end

foundBtn.Activated:Connect(doFound)
fortifyBtn.Activated:Connect(function()
	doUnitCmd("fortify")
end)
waitBtn.Activated:Connect(function()
	doUnitCmd("wait")
end)
disbandBtn.Activated:Connect(function()
	doUnitCmd("disband")
end)
irrigateBtn.Activated:Connect(function()
	doWork("irrigate")
end)
mineBtn.Activated:Connect(function()
	doWork("mine")
end)
roadBtn.Activated:Connect(function()
	doWork("road")
end)
researchBtn.Activated:Connect(function()
	ClientState.openResearch()
end)
governmentBtn.Activated:Connect(function()
	ClientState.openGovernment()
end)
possessBtn.Activated:Connect(function()
	-- R12 (6): the button IS the P toggle now — ride the selected unit or
	-- dismount; Possess.client.luau owns the mode (nil request = dismount)
	if ClientState.possessedUnitId ~= nil then
		ClientState.requestPossess(nil)
	elseif ClientState.selectedUnitId ~= nil then
		ClientState.requestPossess(ClientState.selectedUnitId)
	else
		print("[ActionBar] select one of your units first (or press N)")
	end
end)

-- ---- context refresh (selection isn't evented; cheap per-frame compare).
-- R7b (11): the Research button BLINKS while research is unset on your turn
-- (the blink phase joins the key so the repaint keeps ticking).
local BLINK = Color3.fromRGB(90, 160, 235)

-- R12 (5): "researching: <tech> · ~N turns" from the same read-only engine
-- math as the picker (cost via tech.researchCost, bulbs/turn via
-- tech.playerIncome on a view shim, pcall — presentational only)
local function researchLine(view, me)
	if me.researching == nil then
		return ClientState.myTurn() and "no research set!" or ""
	end
	local rs = ClientState.rulesets()
	local def = rs.techs[me.researching]
	local line = "researching: " .. (def and def.name or me.researching)
	local cost = techModule.researchCost({ players = { [view.you] = me } }, view.you, rs)
	local shim = { players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, map = view.map }
	local ok, income = pcall(techModule.playerIncome, shim, view.you, rs)
	if ok and income ~= nil and (income.bulbs or 0) > 0 then
		line ..= (" - %d turns"):format(math.ceil(math.max(0, cost - (me.bulbs or 0)) / income.bulbs))
	end
	return line
end

local lastKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local u = selectedUnit()
	local me = view and view.players[view.you]
	local needBlink = ClientState.myTurn() and me ~= nil and me.researching == nil
	local phase = needBlink and (math.floor(os.clock() * 2) % 2) or 0
	local mounted = ClientState.possessedUnitId ~= nil
	local key = (view and view.turn or -1) .. "|" .. tostring(u and u.id) .. "|"
		.. tostring(u and u.moves) .. "|" .. tostring(ClientState.myTurn())
		.. "|" .. tostring(needBlink) .. phase .. "|" .. tostring(mounted)
		.. "|" .. tostring(me and me.researching) .. "|" .. tostring(me and me.bulbs)
	if key == lastKey then
		return
	end
	lastKey = key
	-- R12 (6): the ride button mirrors mount state
	possessBtn.Text = mounted and "Dismount (P)" or "Ride (P)"
	if me ~= nil then
		researchStatus.Text = researchLine(view, me)
	end
	governmentBtn.BackgroundColor3 = view ~= nil and ENABLED or DISABLED
	foundBtn.BackgroundColor3 = can("found") and ENABLED or DISABLED
	irrigateBtn.BackgroundColor3 = can("irrigate") and ENABLED or DISABLED
	mineBtn.BackgroundColor3 = can("mine") and ENABLED or DISABLED
	roadBtn.BackgroundColor3 = can("road") and ENABLED or DISABLED
	fortifyBtn.BackgroundColor3 = can("fortify") and ENABLED or DISABLED
	waitBtn.BackgroundColor3 = can("wait") and ENABLED or DISABLED
	disbandBtn.BackgroundColor3 = can("disband") and ENABLED or DISABLED
	possessBtn.BackgroundColor3 = can("possess") and ENABLED or DISABLED
	if needBlink then
		researchBtn.BackgroundColor3 = phase == 0 and BLINK or ENABLED
	else
		researchBtn.BackgroundColor3 = can("research") and ENABLED or DISABLED
	end
end)

-- ---- hotkeys ----------------------------------------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.G then
		doUnitCmd("fortify")
	elseif input.KeyCode == Enum.KeyCode.Space then
		doUnitCmd("wait")
	elseif input.KeyCode == Enum.KeyCode.X then
		doUnitCmd("disband")
	elseif input.KeyCode == Enum.KeyCode.I then
		doWork("irrigate")
	elseif input.KeyCode == Enum.KeyCode.M then
		doWork("mine")
	elseif input.KeyCode == Enum.KeyCode.R then
		doWork("road")
	end
end)

print("[ActionBar] action bar up (G fortify, Space wait, X disband, I/M/R work, P ride/dismount; cluster: research + government)")
