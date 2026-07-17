-- R6: research picker (roblox/SPEC.md §3g, docs/13 Tier-1 rows).
-- Presentational math ONLY comes from the read-only luau engine modules
-- (architect ruling @b81f92dd's review round: the no-local-logic rule
-- governs ACTING, not explaining) — availableTechs and researchCost are
-- required from ReplicatedStorage.Shared, never reimplemented. Acting stays
-- commands through the dispatcher: setResearch {tech}. T toggles;
-- auto-opens once whenever research is unset on your turn.
-- R12 (2): the tax/lux steppers MOVED to GovernmentPanel (user runC ruling).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local ClientState = require(script.Parent:WaitForChild("ClientState"))
local techModule = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("tech"))

local gui = Instance.new("ScreenGui")
gui.Name = "RMCResearch"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 300, 0, 400)
panel.Position = UDim2.new(0, 8, 0, 44)
panel.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = gui

local function label(y, size, text)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -16, 0, size)
	l.Position = UDim2.new(0, 8, 0, y)
	l.BackgroundTransparency = 1
	l.TextColor3 = Color3.fromRGB(235, 235, 235)
	l.Font = Enum.Font.Code
	l.TextSize = size - 2
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Text = text
	l.Parent = panel
	return l
end

local title = label(6, 22, "Research (T)")
local current = label(30, 16, "")

local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 24, 0, 24)
closeBtn.Position = UDim2.new(1, -28, 0, 4)
closeBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 66)
closeBtn.TextColor3 = Color3.fromRGB(240, 240, 240)
closeBtn.Font = Enum.Font.SourceSansBold
closeBtn.TextSize = 16
closeBtn.Text = "X"
closeBtn.Parent = panel

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1, -16, 1, -60)
list.Position = UDim2.new(0, 8, 0, 52)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 2)
layout.Parent = list

local function me()
	local view = ClientState.view
	return view and view.players[view.you]
end

-- ---- the picker list --------------------------------------------------------
local function refresh()
	local view = ClientState.view
	local m = me()
	if view == nil or m == nil then
		return
	end
	local rs = ClientState.rulesets()
	-- read-only engine math on a view-shaped shim: availableTechs/researchCost
	-- only read players[pid].techs, so the filtered own-player row suffices
	local shim = { players = { [view.you] = m } }
	local cost = techModule.researchCost(shim, view.you, rs)
	-- bulbs/turn: playerIncome over a view-shaped shim — own cities arrive
	-- WHOLE and their radius is always explored, which is everything the
	-- income walk reads. pcall: presentational only, never blocks the picker.
	local perTurn = ""
	local incomeShim = { players = view.players, cities = view.cities,
		cityOrder = view.cityOrder, map = view.map }
	local okIncome, income = pcall(techModule.playerIncome, incomeShim, view.you, rs)
	if okIncome and income ~= nil then
		perTurn = (" +%d/turn"):format(income.bulbs or 0)
	end
	if m.researching ~= nil then
		local def = rs.techs[m.researching]
		current.Text = ("researching: %s (%d/%d bulbs%s)"):format(def and def.name or m.researching,
			m.bulbs or 0, cost, perTurn)
	else
		current.Text = ("no research set - pick below (%d bulbs each%s)"):format(cost, perTurn)
	end

	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("TextButton") then
			child:Destroy()
		end
	end
	local order = 0
	for _, id in ipairs(techModule.availableTechs(shim, view.you, rs)) do
		order += 1
		local row = Instance.new("TextButton")
		row.Size = UDim2.new(1, -8, 0, 22)
		row.LayoutOrder = order
		row.BackgroundColor3 = id == m.researching and Color3.fromRGB(46, 88, 148) or Color3.fromRGB(50, 66, 92)
		row.TextColor3 = Color3.fromRGB(235, 235, 235)
		row.Font = Enum.Font.Code
		row.TextSize = 14
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.Text = "  " .. (rs.techs[id] and rs.techs[id].name or id)
		row.Parent = list
		row.Activated:Connect(function()
			print("[Research] setResearch " .. id)
			ClientState.send({ type = "setResearch", tech = id })
		end)
	end
	list.CanvasSize = UDim2.new(0, 0, 0, order * 24)
end

local function setOpen(open)
	gui.Enabled = open
	if open then
		refresh()
	end
end

closeBtn.Activated:Connect(function()
	setOpen(false)
end)

ClientState.onResearchOpen(function()
	setOpen(not gui.Enabled)
end)

-- auto-open ONCE each time research goes unset on your turn (the browser's
-- "choose new research" prompt); picking a tech re-arms it via the reset
local autoShown = false
ClientState.onView(function(view)
	local m = me()
	if m ~= nil and m.researching ~= nil then
		autoShown = false
	elseif m ~= nil and ClientState.myTurn() and not autoShown then
		autoShown = true
		setOpen(true)
	end
	if gui.Enabled then
		refresh()
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	if UserInputService:GetFocusedTextBox() ~= nil then
		return
	end
	if input.KeyCode == Enum.KeyCode.T then
		setOpen(not gui.Enabled)
	end
end)

-- R7b (11): discovery splash — name + what it unlocks, all from the baked
-- rulesets (facts only, never wiki prose). The Research button blinking
-- until the next pick lives in ActionBar (it owns the button).
local splash = Instance.new("TextLabel")
splash.Size = UDim2.new(0, 520, 0, 54)
splash.Position = UDim2.new(0.5, -260, 0.3, 0)
splash.BackgroundColor3 = Color3.fromRGB(24, 28, 38)
splash.BackgroundTransparency = 0.15
splash.TextColor3 = Color3.fromRGB(150, 230, 255)
splash.Font = Enum.Font.SourceSansBold
splash.TextSize = 20
splash.TextWrapped = true
splash.Visible = false
splash.Parent = gui.Parent:WaitForChild("RMCHud") -- HUD gui stays enabled; this panel's gui toggles

local function unlocksOf(techId, rs)
	local names = {}
	for _, group in ipairs({ rs.units, rs.buildings, rs.wonders }) do
		for _, def in pairs(group) do
			if def.tech == techId then
				table.insert(names, def.name)
			end
		end
	end
	table.sort(names)
	return names
end

ClientState.onEvents(function(events, view)
	for _, e in ipairs(events) do
		if e.type == "techDiscovered" and e.playerId == view.you then
			local rs = ClientState.rulesets()
			local def = rs.techs[e.tech]
			local unlocks = unlocksOf(e.tech, rs)
			splash.Text = ("%s discovered!%s"):format(def and def.name or e.tech,
				#unlocks > 0 and ("  Unlocks: " .. table.concat(unlocks, ", ")) or "")
			splash.Visible = true
			task.delay(5, function()
				splash.Visible = false
			end)
		end
	end
end)

print("[Research] research picker up (T toggles; rate steppers live in Government now)")
