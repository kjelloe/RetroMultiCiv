-- R6: the action bar (roblox/SPEC.md §3g, docs/13 Tier-1 row — a bottom-bar
-- ScreenGui, not Billboards, per the adopted review). Buttons mirror the
-- hotkeys and grey out when the context is wrong; every action is a command
-- through ClientState.send, nothing acts locally. Hotkeys here: G fortify,
-- Space wait (skip unit), X disband, I/M/R irrigate/mine/road (settlers,
-- startWork on the stood-on tile) — B (found) and Return (end turn) stay in
-- Select, P/N in Possess, T in ResearchPicker, L in TurnLog. All chat-guarded.
-- GoTo/pathfind: deferred (flagged @b3084114) — Select's click-move covers it.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCActionBar"
gui.ResetOnSpawn = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local bar = Instance.new("Frame")
bar.Size = UDim2.new(0, 790, 0, 34)
bar.Position = UDim2.new(0.5, -395, 1, -42)
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
local researchBtn = addButton(9, "Research (T)", 100)

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

-- ---- actions (commands only; the server judges legality) -------------------
local function doFound()
	local u = selectedUnit()
	if u ~= nil and u.type == "settlers" then
		local name = "Colony " .. (ownCityCount(ClientState.view) + 1)
		print(("[ActionBar] found city '%s' with %s"):format(name, u.id))
		ClientState.send({ type = "foundCity", unitId = u.id, name = name })
	end
end

local function doUnitCmd(cmdType)
	local u = selectedUnit()
	if u ~= nil then
		print(("[ActionBar] %s %s"):format(cmdType, u.id))
		ClientState.send({ type = cmdType, unitId = u.id })
	end
end

-- settlers job on the stood-on tile; the server judges terrain/tech/dupes
local function doWork(work)
	local u = selectedUnit()
	if u ~= nil and u.type == "settlers" then
		print(("[ActionBar] startWork %s %s"):format(work, u.id))
		ClientState.send({ type = "startWork", unitId = u.id, work = work })
	end
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
possessBtn.Activated:Connect(function()
	-- Possess.client.luau owns the mode; the button is a P-key surrogate for
	-- discoverability, so it only narrates where the real control lives
	print("[ActionBar] possession: select an own unit and press P (F dismounts)")
end)

-- ---- context refresh (selection isn't evented; cheap per-frame compare) ----
local lastKey = nil
RunService.Heartbeat:Connect(function()
	local view = ClientState.view
	local u = selectedUnit()
	local key = (view and view.turn or -1) .. "|" .. tostring(u and u.id) .. "|"
		.. tostring(u and u.moves) .. "|" .. tostring(ClientState.myTurn())
	if key == lastKey then
		return
	end
	lastKey = key
	local mine = ClientState.myTurn()
	local unitReady = mine and u ~= nil
	local settlersReady = unitReady and u.type == "settlers"
	foundBtn.BackgroundColor3 = settlersReady and ENABLED or DISABLED
	irrigateBtn.BackgroundColor3 = settlersReady and ENABLED or DISABLED
	mineBtn.BackgroundColor3 = settlersReady and ENABLED or DISABLED
	roadBtn.BackgroundColor3 = settlersReady and ENABLED or DISABLED
	fortifyBtn.BackgroundColor3 = unitReady and ENABLED or DISABLED
	waitBtn.BackgroundColor3 = unitReady and ENABLED or DISABLED
	disbandBtn.BackgroundColor3 = unitReady and ENABLED or DISABLED
	possessBtn.BackgroundColor3 = unitReady and ENABLED or DISABLED
	researchBtn.BackgroundColor3 = mine and ENABLED or DISABLED
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

print("[ActionBar] R6 action bar up (G fortify, Space wait, X disband, I/M/R work)")
